/**
 * Parser de ofertas de trabajo (PED-21, base de v11.0).
 * Recibe una URL o el texto de la oferta; si es URL, la descarga con /api/fetch-url.
 * Una sola llamada a Haiku clasifica las palabras clave en requeridas y deseables, con relevancia 1–10.
 * Cada palabra clave debe aparecer en la oferta; las que no aparecen se descartan.
 * Requisitos estructurados (PED-30): los años de experiencia y las carreras no son keywords. Los años van a
 * `experiencia` ({ anios_minimos, area }) y las carreras alternativas ("A, B o afín") a UN requisito en `carreras`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { herramientaTieneRespaldo, matcheaPalabra, normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { canonCarrera, esCarrera } from "./mapeo-semantico";

export const MODELO_JD = "claude-haiku-4-5-20251001";

export interface KeywordJD {
  keyword: string;
  relevancia: number; // 1–10
}

export type TipoRequisito = "requerido" | "deseable";

export interface RequisitoExperiencia {
  anios_minimos: number;
  area: string | null; // null = experiencia profesional en general
  tipo: TipoRequisito;
}

export interface RequisitoCarreras {
  carreras: string[];    // alternativas: basta una
  acepta_afin: boolean;  // la oferta dice "o afín", "carrera afín", "o similar"
  tipo: TipoRequisito;
}

export interface ResultadoJD {
  texto_limpio: string;
  keywords_requeridas: KeywordJD[];
  keywords_deseables: KeywordJD[];
  nivel_posicion: string;
  industria?: string;
  cargo?: string; // título del cargo tal como aparece en la oferta
  experiencia: RequisitoExperiencia[];
  carreras: RequisitoCarreras[];
  descartadas: string[]; // keywords del modelo que no aparecen en la oferta
  usage?: Anthropic.Usage;
}

export const SYSTEM_JD = `Parseas ofertas de trabajo en español o inglés. Extrae las palabras clave que un reclutador buscaría en un CV y clasifícalas:
- requeridas: lo que la oferta exige. Señales: requisitos, excluyente, obligatorio, indispensable, required, must, "se requiere", "debe".
- deseables: lo que la oferta valora pero no exige. Señales: deseable, valorable, idealmente, "se valorará", plus, nice to have, preferred.
Si la oferta dice explícitamente deseable, valorable, no excluyente, nice-to-have o idealmente junto a un término, ese término es deseable aunque también aparezca en las funciones. Si no lo dice explícitamente pero aparece en los requisitos, es requerida, incluidos sus detalles (por ejemplo, lo que se pide dentro de una herramienta requerida).
Si una sección no dice cuál es, las funciones y requisitos principales son requeridas.

Cada palabra clave:
- Es un término que aparece literalmente en la oferta, de 1 a 4 palabras: herramienta, metodología, certificación, conocimiento, carrera, idioma o función concreta. Nunca inferido ni parafraseado.
- Excluye el tipo de contrato, la modalidad y la jornada (práctica, part-time, híbrido, full-time).
- Relevancia de 1 a 10: 10 si es central para el cargo y se repite o encabeza los requisitos; 1 si es secundaria.

cargo: el título del cargo tal como aparece en la oferta ("Practicante de Trade Marketing"), o null si no lo dice.
nivel: "practicante", "junior", "semi-senior", "senior" o "jefatura", según el cargo y los años de experiencia pedidos.
industria: el rubro de la empresa en 1 a 3 palabras, o null si la oferta no lo dice.

Dentro de un requisito o función, extrae como keywords propias solo las tecnologías con nombre propio (DAX, BigQuery, Google Cloud Platform, SAP, Python), con la misma clasificación que su requisito. No extraigas los conceptos genéricos que las acompañan (consultas, joins, agregaciones, visualizaciones).

Años de experiencia y carreras NO son keywords:
- experiencia: cada mínimo de años que pide la oferta, con el área a la que se refiere tal como la nombra la oferta ("5 años en relaciones laborales" → {"anios_minimos":5,"area":"relaciones laborales"}), o area null si es experiencia profesional en general. Si pide varios mínimos, uno por cada uno.
- carreras: las carreras o títulos que la oferta acepta como alternativas, escritos como aparecen, en UN solo requisito ("Derecho, Ingeniería, Psicología o carrera afín" → {"carreras":["Derecho","Ingeniería","Psicología"],"acepta_afin":true}). acepta_afin es true si la oferta dice afín, a fin, similar o equivalente.
- tipo "requerido" o "deseable" con el mismo criterio de las keywords.

Responde ÚNICAMENTE con un JSON válido: {"requeridas":[{"keyword":"...","relevancia":8}],"deseables":[{"keyword":"...","relevancia":4}],"experiencia":[{"anios_minimos":5,"area":"...","tipo":"requerido"}],"carreras":[{"carreras":["..."],"acepta_afin":true,"tipo":"requerido"}],"cargo":"...","nivel":"...","industria":"..."}`;

const esUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

// ─── descarga vía /api/fetch-url ─────────────────────────────────────────────
// El endpoint exige sesión: desde el servidor hay que reenviar la cookie del usuario.

async function descargarConFetchUrl(url: string, baseUrl: string, cookie?: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/fetch-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.texto !== "string") {
    throw new Error(`fetch-url: ${data.error ?? `error ${res.status}`}`);
  }
  return data.texto;
}

// ─── validación de la respuesta ──────────────────────────────────────────────

function limpiarKeywords(lista: unknown, ofertaNorm: string, descartadas: string[], vistas: Set<string>): KeywordJD[] {
  if (!Array.isArray(lista)) return [];
  const out: KeywordJD[] = [];
  for (const item of lista) {
    const keyword = typeof item?.keyword === "string" ? item.keyword.trim() : "";
    if (!keyword) continue;
    const clave = normalizarParaComparar(keyword);
    if (vistas.has(clave)) continue; // requerida gana sobre deseable
    if (!herramientaTieneRespaldo(keyword, ofertaNorm)) { descartadas.push(keyword); continue; }
    vistas.add(clave);
    const r = Math.round(Number(item?.relevancia));
    out.push({ keyword, relevancia: Number.isFinite(r) ? Math.min(10, Math.max(1, r)) : 5 });
  }
  return out.sort((a, b) => b.relevancia - a.relevancia);
}

// ─── requerida → deseable (sin API) ──────────────────────────────────────────
// Con un término que está en funciones y también marcado como deseable, Haiku no decide de forma estable.
// Si en alguna línea de la oferta la keyword aparece DESPUÉS de un marcador de deseable, pasa a deseables.
// Solo después: en "SQL: nivel intermedio. Deseable manejo de BigQuery." SQL sigue requerida.

const MARCADOR_DESEABLE = /\b(deseable|valorable|no excluyente|idealmente|nice to have)\b/;

// Todas las palabras significativas de la keyword deben estar después del marcador: "cierre mensual"
// no se mueve por "Deseable: … procesos de cierre financiero".
export function marcadaComoDeseable(keyword: string, texto: string): boolean {
  const palabras = normalizarParaComparar(keyword).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p));
  if (palabras.length === 0) return false;
  return texto.split("\n").some(linea => {
    const n = normalizarParaComparar(linea);
    const marcador = n.match(MARCADOR_DESEABLE);
    if (!marcador || marcador.index === undefined) return false;
    const despues = n.slice(marcador.index + marcador[0].length);
    return palabras.every(p => matcheaPalabra(p, despues));
  });
}

// Palabras de rol o nivel que no describen el área del cargo: "Practicante de Trade Marketing" → "trade marketing".
// Singular o plural, masculino o femenino (PED-35: "Reclutadores", "Analistas", "Ejecutivas").
const RE_ROL = /^(practicantes?|pasantes?|trainees?|analistas?|asistentes?|ayudantes?|auxiliar(es)?|jefe|jefa|jefes|jefas|jefe a|gerentes?|subgerentes?|encargad[oa]s?|encargado a|coordinador(a|es|as)?|coordinador a|especialistas?|ejecutiv[oa]s?|ejecutivo a|supervisor(a|es|as)?|director(a|es|as)?|lider(es)?|profesional(es)?|reclutador(a|es|as)?|junior|senior|semi senior|semisenior|sr|jr|de|del|en|y|para|la|el|los|las|un|una|a)$/;
// Rol que nombra el área: "Reclutador Masivo" → "reclutamiento masivo".
const ROL_AREA: [RegExp, string][] = [[/^reclutador(a|es|as)?$/, "reclutamiento"]];
// Jornada y modalidad al final del título: no son área.
const RE_JORNADA = /\s+(part time|full time|media jornada|jornada completa|remoto|presencial|h[ií]brido)$/i;
const singularAdj = (w: string) => w.replace(/(iv|ic|al|ad)(o|a)s$/, "$1o").replace(/(iv|ic|ad)a$/, "$1o");

// Lo que queda del título sin rol ni nivel: el área del cargo. Siempre es keyword requerida de relevancia 10,
// si tiene entre 1 y 4 palabras y aparece en la oferta.
export function keywordDelCargo(cargo: string | undefined, ofertaNorm: string): string | null {
  if (!cargo) return null;
  const tokens = cargo.replace(/\(.*?\)/g, " ").split(/\s+/).filter(Boolean);
  let i = 0, area: string | null = null;
  while (i < tokens.length && RE_ROL.test(normalizarParaComparar(tokens[i]))) {
    const n = normalizarParaComparar(tokens[i]);
    area = ROL_AREA.find(([re]) => re.test(n))?.[1] ?? area;
    i++;
  }
  const resto = tokens.slice(i).join(" ").replace(/[,.;:|–—-]+$/, "").trim().replace(RE_JORNADA, "").trim();
  if (area) {
    // El área sale del rol; lo que sigue ("Masivos") debe aparecer en la oferta (en cualquier género o número).
    const adj = resto.split(/\s+/).filter(Boolean);
    if (adj.length > 2 || !adj.every(w => new RegExp(`\\b${normalizarParaComparar(w).replace(/(o|a)s?$/, "")}(o|a|os|as)\\b`).test(ofertaNorm))) return null;
    return [area, ...adj.map(w => singularAdj(normalizarParaComparar(w)))].join(" ");
  }
  const n = resto.split(/\s+/).filter(Boolean).length;
  if (n === 0 || n > 4 || esCarrera(resto) || !herramientaTieneRespaldo(resto, ofertaNorm)) return null; // la carrera va en `carreras`
  return resto;
}

const esKeywordDeAnios = (k: string) => /\d/.test(k) && /\b(anos?|years?)\b/.test(normalizarParaComparar(k));
const tipoRequisito = (t: unknown): TipoRequisito => (t === "deseable" ? "deseable" : "requerido");

function limpiarExperiencia(lista: unknown): RequisitoExperiencia[] {
  if (!Array.isArray(lista)) return [];
  return lista.flatMap(item => {
    const anios = Number(item?.anios_minimos);
    if (!Number.isFinite(anios) || anios <= 0 || anios > 40) return [];
    const area = typeof item?.area === "string" && item.area.trim() ? item.area.trim() : null;
    return [{ anios_minimos: anios, area, tipo: tipoRequisito(item?.tipo) }];
  });
}

// Las carreras deben aparecer en la oferta; acepta_afin se confirma también en el texto.
function limpiarCarreras(lista: unknown, texto: string, ofertaNorm: string, descartadas: string[]): RequisitoCarreras[] {
  if (!Array.isArray(lista)) return [];
  const afinEnTexto = /\b(afin|afines|a fin|similar|similares|equivalente)\b/.test(ofertaNorm);
  return lista.flatMap(item => {
    const carreras = (Array.isArray(item?.carreras) ? item.carreras : [])
      .filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0)
      .map((c: string) => c.trim())
      .filter((c: string) => herramientaTieneRespaldo(c, ofertaNorm) || herramientaTieneRespaldo(canonCarrera(c), canonCarrera(texto))
        || (descartadas.push(c), false)); // "Psicología" vale con "Psicóloga" en la oferta
    if (carreras.length === 0) return [];
    return [{ carreras, acepta_afin: item?.acepta_afin === true || afinEnTexto, tipo: tipoRequisito(item?.tipo) }];
  });
}

export function consolidarJD(texto: string, respuesta: Record<string, unknown>): Omit<ResultadoJD, "usage"> {
  const ofertaNorm = normalizarParaComparar(texto);
  const descartadas: string[] = [];
  const vistas = new Set<string>();
  const carreras = limpiarCarreras(respuesta.carreras, texto, ofertaNorm, descartadas);
  const experiencia = limpiarExperiencia(respuesta.experiencia);
  // Años y carreras van estructurados: si el modelo igual los mandó como keyword, se sacan.
  const nombresCarreras = new Set(carreras.flatMap(c => c.carreras).map(normalizarParaComparar));
  for (const k of nombresCarreras) vistas.add(k);
  const requeridasModelo = limpiarKeywords(respuesta.requeridas, ofertaNorm, descartadas, vistas).filter(k => !esKeywordDeAnios(k.keyword));
  const movidas = requeridasModelo.filter(k => marcadaComoDeseable(k.keyword, texto));
  if (movidas.length > 0) {
    console.warn(`[postulai] Parser JD: requeridas movidas a deseables por la oferta: ${movidas.map(k => k.keyword).join(", ")}`);
  }
  const cargo = typeof respuesta.cargo === "string" && respuesta.cargo.trim() ? respuesta.cargo.trim() : undefined;
  const delCargo = keywordDelCargo(cargo, ofertaNorm);
  let keywords_requeridas = requeridasModelo.filter(k => !movidas.includes(k));
  if (delCargo) {
    const clave = normalizarParaComparar(delCargo);
    keywords_requeridas = [{ keyword: delCargo, relevancia: 10 }, ...keywords_requeridas.filter(k => normalizarParaComparar(k.keyword) !== clave)];
    vistas.add(clave); // si el modelo la puso en deseables, queda solo como requerida
  }
  const keywords_deseables = [...movidas, ...limpiarKeywords(respuesta.deseables, ofertaNorm, descartadas, vistas).filter(k => !esKeywordDeAnios(k.keyword))]
    .filter(k => !delCargo || normalizarParaComparar(k.keyword) !== normalizarParaComparar(delCargo))
    .sort((a, b) => b.relevancia - a.relevancia);
  const industria = typeof respuesta.industria === "string" && respuesta.industria.trim() ? respuesta.industria.trim() : undefined;
  return {
    texto_limpio: texto,
    keywords_requeridas,
    keywords_deseables,
    nivel_posicion: typeof respuesta.nivel === "string" ? respuesta.nivel : "desconocido",
    ...(industria ? { industria } : {}),
    ...(cargo ? { cargo } : {}),
    experiencia,
    carreras,
    descartadas,
  };
}

// ─── función principal ───────────────────────────────────────────────────────

export async function parsearJD(
  urlOTexto: string,
  opts: { client?: Anthropic; baseUrl?: string; cookie?: string } = {}
): Promise<ResultadoJD> {
  let texto = urlOTexto.trim();
  if (esUrl(texto)) {
    if (!opts.baseUrl) throw new Error("parsearJD: para una URL se necesita baseUrl (y la cookie de sesión) para llamar a /api/fetch-url");
    texto = await descargarConFetchUrl(texto, opts.baseUrl, opts.cookie);
  }

  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create(
    {
      model: MODELO_JD,
      max_tokens: 2000,
      temperature: 0,
      system: SYSTEM_JD,
      messages: [{ role: "user", content: `OFERTA DE TRABAJO:\n${texto}` }],
    },
    { timeout: 20_000, maxRetries: 1 }
  );
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("la respuesta del parser de ofertas no contiene JSON");

  const resultado = consolidarJD(texto, JSON.parse(m[0]));
  if (resultado.descartadas.length > 0) {
    console.warn(`[postulai] Parser JD: keywords que no aparecen en la oferta: ${resultado.descartadas.join(", ")}`);
  }
  return { ...resultado, usage: res.usage };
}

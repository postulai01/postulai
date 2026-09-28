/**
 * Parser de ofertas de trabajo (PED-21, base de v11.0).
 * Recibe una URL o el texto de la oferta; si es URL, la descarga con /api/fetch-url.
 * Una sola llamada a Haiku clasifica las palabras clave en requeridas y deseables, con relevancia 1–10.
 * Cada palabra clave debe aparecer en la oferta; las que no aparecen se descartan.
 */
import Anthropic from "@anthropic-ai/sdk";
import { herramientaTieneRespaldo, normalizarParaComparar } from "./cv-postprocess";

export const MODELO_JD = "claude-haiku-4-5-20251001";

export interface KeywordJD {
  keyword: string;
  relevancia: number; // 1–10
}

export interface ResultadoJD {
  texto_limpio: string;
  keywords_requeridas: KeywordJD[];
  keywords_deseables: KeywordJD[];
  nivel_posicion: string;
  industria?: string;
  descartadas: string[]; // keywords del modelo que no aparecen en la oferta
  usage?: Anthropic.Usage;
}

export const SYSTEM_JD = `Parseas ofertas de trabajo en español o inglés. Extrae las palabras clave que un reclutador buscaría en un CV y clasifícalas:
- requeridas: lo que la oferta exige. Señales: requisitos, excluyente, obligatorio, indispensable, required, must, "se requiere", "debe".
- deseables: lo que la oferta valora pero no exige. Señales: deseable, valorable, idealmente, "se valorará", plus, nice to have, preferred.
Si una sección no dice cuál es, las funciones y requisitos principales son requeridas.

Cada palabra clave:
- Es un término que aparece literalmente en la oferta, de 1 a 4 palabras: herramienta, metodología, certificación, conocimiento, carrera, idioma o función concreta. Nunca inferido ni parafraseado.
- Excluye el tipo de contrato, la modalidad y la jornada (práctica, part-time, híbrido, full-time).
- Relevancia de 1 a 10: 10 si es central para el cargo y se repite o encabeza los requisitos; 1 si es secundaria.

nivel: "practicante", "junior", "semi-senior", "senior" o "jefatura", según el cargo y los años de experiencia pedidos.
industria: el rubro de la empresa en 1 a 3 palabras, o null si la oferta no lo dice.

Responde ÚNICAMENTE con un JSON válido: {"requeridas":[{"keyword":"...","relevancia":8}],"deseables":[{"keyword":"...","relevancia":4}],"nivel":"...","industria":"..."}`;

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

export function consolidarJD(texto: string, respuesta: Record<string, unknown>): Omit<ResultadoJD, "usage"> {
  const ofertaNorm = normalizarParaComparar(texto);
  const descartadas: string[] = [];
  const vistas = new Set<string>();
  const keywords_requeridas = limpiarKeywords(respuesta.requeridas, ofertaNorm, descartadas, vistas);
  const keywords_deseables = limpiarKeywords(respuesta.deseables, ofertaNorm, descartadas, vistas);
  const industria = typeof respuesta.industria === "string" && respuesta.industria.trim() ? respuesta.industria.trim() : undefined;
  return {
    texto_limpio: texto,
    keywords_requeridas,
    keywords_deseables,
    nivel_posicion: typeof respuesta.nivel === "string" ? respuesta.nivel : "desconocido",
    ...(industria ? { industria } : {}),
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
      max_tokens: 1500,
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

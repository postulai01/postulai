/**
 * Reescritura de líneas por contexto de oferta (PED-23).
 * Reescribe el CV LÍNEA POR LÍNEA usando solo keywords que el mapeo (PED-22) ya respaldó en el CV,
 * y deja trazabilidad de cada cambio: qué keyword se agregó y qué fragmento del CV la respalda.
 *
 * Flujo por línea:
 * 1. planificarLinea (sin API): elige las keywords permitidas para esa línea (matches directos o relacionados
 *    que tocan su contenido y que aún no están escritas en ella). Sin ninguna → "sin_cambios", sin llamar a la API.
 * 2. Haiku propone la línea adaptada en JSON.
 * 3. verificarAdaptacion (sin API): palabras nuevas sin respaldo, keywords de brecha, verbos de escalada,
 *    cifras nuevas y la métrica de fuerzo (palabras_nuevas > MAX_PALABRAS_NUEVAS). Si falla, un reintento
 *    con el motivo; si vuelve a fallar → "rechazada_forzada" y se conserva la original.
 * No está conectado a process-cv todavía (PED-25).
 */
import Anthropic from "@anthropic-ai/sdk";
import { normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { raizVerbo, VERBOS_ESCALADA } from "./cv-verificacion";
import { esCarrera, type KeywordsJD, type ResultadoMapeo } from "./mapeo-semantico";

export const MODELO_REESCRITOR = "claude-haiku-4-5-20251001";
export const MAX_PALABRAS_NUEVAS = 4;
const MIN_PALABRAS_LINEA = 4; // encabezados, nombre y contacto no se reescriben

export type EstadoLinea = "adaptada" | "sin_cambios" | "rechazada_forzada";

export interface ResultadoLinea {
  original: string;
  adaptada: string;             // igual a original si no hay mejora honesta
  keywords_agregadas: string[]; // cada una viene de mapeo.matches_*
  fuente_en_cv: string[];       // fragmento del CV que respalda cada keyword (mismo orden)
  palabras_nuevas: number;      // métrica de fuerzo
  reintentos: 0 | 1;
  estado: EstadoLinea;
  motivo?: string;              // por qué se rechazó (último intento)
  usage?: { input_tokens: number; output_tokens: number }; // suma de los intentos, para el costo real
}

export interface InputLinea {
  lineaOriginal: string;
  cvCompleto: string;
  mapeo: ResultadoMapeo;
  keywordsJD: KeywordsJD;
}

export interface OpcionesReescritor {
  client?: Anthropic;
  maxPalabrasNuevas?: number;
}

export interface KeywordPermitida { keyword: string; competencia_cv: string; fuente: string }

// ─── palabras ────────────────────────────────────────────────────────────────

// Palabras de contenido normalizadas (sin stop words ni palabras de 1–2 letras, salvo cifras).
function palabrasContenido(texto: string): string[] {
  return normalizarParaComparar(texto).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p) && (p.length > 2 || /\d/.test(p)));
}

const raiz = (p: string) => p.slice(0, 5);

// La palabra está en el conjunto, tolerando plural y flexión (misma raíz de 5 letras en palabras largas).
function presente(p: string, conjunto: Set<string>, raices: Set<string>): boolean {
  if (conjunto.has(p) || conjunto.has(p.replace(/s$/, "")) || conjunto.has(p + "s")) return true;
  return p.length >= 6 && !/\d/.test(p) && raices.has(raiz(p));
}

function indice(texto: string) {
  const ps = palabrasContenido(texto);
  return { set: new Set(ps), raices: new Set(ps.filter(p => p.length >= 6).map(raiz)) };
}

const lineasCV = (cv: string) => cv.split("\n").map(l => l.replace(/^\s*[-•]\s+/, "").trim()).filter(Boolean);

// Primera línea del CV (distinta de la actual si se puede) que contiene todas las palabras del término.
function fuenteDe(termino: string, cv: string, lineaActual: string): string | null {
  const t = palabrasContenido(termino);
  if (t.length === 0) return null;
  const candidatas = lineasCV(cv).filter(l => {
    const ix = indice(l);
    return t.every(p => presente(p, ix.set, ix.raices));
  });
  return candidatas.find(l => l !== lineaActual.replace(/^\s*[-•]\s+/, "").trim()) ?? candidatas[0] ?? null;
}

// ─── plan (sin API) ──────────────────────────────────────────────────────────

// Keywords del mapeo que tocan esta línea y que todavía no están escritas en ella, con su fuente en el CV.
export function planificarLinea(input: InputLinea): KeywordPermitida[] {
  const { lineaOriginal, cvCompleto, mapeo } = input;
  const pl = palabrasContenido(lineaOriginal);
  if (pl.length < MIN_PALABRAS_LINEA) return [];
  const ixLinea = indice(lineaOriginal);
  const raicesLinea = new Set(pl.map(raiz));

  const permitidas: KeywordPermitida[] = [];
  for (const m of [...mapeo.matches_directos, ...mapeo.matches_relacionados]) {
    if (esCarrera(m.keyword_jd)) continue; // la carrera va en Educación, no se inyecta en bullets
    const kw = palabrasContenido(m.keyword_jd);
    if (kw.length === 0) continue;
    if (kw.every(p => presente(p, ixLinea.set, ixLinea.raices))) continue; // ya está escrita
    // Toca la línea si comparte una raíz con la keyword o con la competencia del CV que la respalda.
    const comp = m.competencia_cv === "(texto del CV)" ? [] : palabrasContenido(m.competencia_cv);
    if (![...kw, ...comp].some(p => raicesLinea.has(raiz(p)))) continue;
    const fuente = fuenteDe(m.keyword_jd, cvCompleto, lineaOriginal)
      ?? (comp.length > 0 ? fuenteDe(m.competencia_cv, cvCompleto, lineaOriginal) : null);
    if (!fuente) continue; // sin fragmento que la respalde no se usa
    if (!permitidas.some(p => p.keyword === m.keyword_jd)) {
      permitidas.push({ keyword: m.keyword_jd, competencia_cv: m.competencia_cv, fuente });
    }
  }
  return permitidas;
}

// ─── verificación local (sin API) ────────────────────────────────────────────

export interface Verificacion {
  ok: boolean;
  palabras_nuevas: number;
  problemas: string[];
}

export function verificarAdaptacion(
  original: string,
  adaptada: string,
  keywordsAgregadas: string[],
  cvCompleto: string,
  mapeo: ResultadoMapeo,
  maxPalabrasNuevas = MAX_PALABRAS_NUEVAS,
): Verificacion {
  const problemas: string[] = [];
  const ixOrig = indice(original);
  const ixCV = indice(cvCompleto);
  const ixKw = indice(keywordsAgregadas.join(" "));
  const nuevas = palabrasContenido(adaptada).filter(p => !presente(p, ixOrig.set, ixOrig.raices));
  const nuevasUnicas = [...new Set(nuevas)];

  const sinRespaldo = nuevasUnicas.filter(p => !presente(p, ixCV.set, ixCV.raices) && !presente(p, ixKw.set, ixKw.raices));
  if (sinRespaldo.length > 0) problemas.push(`palabras sin respaldo en el CV: ${sinRespaldo.join(", ")}`);

  const cifras = nuevasUnicas.filter(p => /\d/.test(p));
  if (cifras.length > 0) problemas.push(`cifras nuevas: ${cifras.join(", ")}`);

  const ixAdapt = indice(adaptada);
  const gaps = mapeo.gap_keywords.filter(g => {
    const k = palabrasContenido(g.keyword);
    return k.length > 0 && k.every(p => presente(p, ixAdapt.set, ixAdapt.raices)) && !k.every(p => presente(p, ixOrig.set, ixOrig.raices));
  });
  if (gaps.length > 0) problemas.push(`keywords de brecha: ${gaps.map(g => g.keyword).join(", ")}`);

  const raicesOrig = new Set(palabrasContenido(original).map(raizVerbo));
  const escaladas = nuevasUnicas.filter(p => VERBOS_ESCALADA.test(raizVerbo(p)) && !raicesOrig.has(raizVerbo(p)) && !ixKw.set.has(p));
  const primera = palabrasContenido(adaptada)[0];
  if (primera && VERBOS_ESCALADA.test(raizVerbo(primera)) && !raicesOrig.has(raizVerbo(primera)) && !escaladas.includes(primera)) {
    escaladas.push(primera); // un verbo de escalada al inicio nunca se justifica por la keyword
  }
  if (escaladas.length > 0) problemas.push(`verbos de escalada: ${escaladas.join(", ")}`);

  if (nuevas.length > maxPalabrasNuevas) problemas.push(`fuerzo: ${nuevas.length} palabras nuevas (máx. ${maxPalabrasNuevas})`);

  return { ok: problemas.length === 0, palabras_nuevas: nuevas.length, problemas };
}

// ─── llamada a modelo ────────────────────────────────────────────────────────

export const SYSTEM_REESCRITOR = `Adaptas UNA línea de un CV en español a una oferta de trabajo, sin inventar nada.
Reglas:
- Solo puedes reordenar, resaltar o usar sinónimos verdaderos de lo que la línea y los fragmentos del CV ya dicen.
- Puedes incorporar SOLO keywords de la lista permitida, y solo si el fragmento del CV que la respalda lo justifica para esta línea.
- Prohibido agregar habilidades, herramientas, cifras, logros o responsabilidades que no estén en el CV.
- Prohibido cambiar el verbo por uno de mayor responsabilidad (coordiné, lideré, dirigí, gestioné, supervisé, administré).
- Cambia lo mínimo: a lo más 4 palabras nuevas. Mantén el tiempo verbal y el largo aproximado.
- Si no hay una mejora honesta, devuelve la línea igual y keywords_agregadas vacío.
Responde SOLO con JSON: {"adaptada": "...", "keywords_agregadas": ["..."]}`;

function promptLinea(linea: string, permitidas: KeywordPermitida[], motivo?: string): string {
  const kws = permitidas.map(p => `- "${p.keyword}" — respaldo en el CV: "${p.fuente}"`).join("\n");
  const reintento = motivo ? `\n\nTu intento anterior fue rechazado (${motivo}). Cambia menos y usa solo lo respaldado.` : "";
  return `LÍNEA:\n${linea}\n\nKEYWORDS PERMITIDAS:\n${kws}${reintento}`;
}

async function pedirAdaptacion(
  client: Anthropic,
  linea: string,
  permitidas: KeywordPermitida[],
  motivo: string | undefined,
  usage: { input_tokens: number; output_tokens: number },
): Promise<{ adaptada: string; keywords_agregadas: string[] } | null> {
  try {
    const res = await client.messages.create(
      {
        model: MODELO_REESCRITOR,
        max_tokens: 400,
        temperature: 0,
        system: SYSTEM_REESCRITOR,
        messages: [{ role: "user", content: promptLinea(linea, permitidas, motivo) }],
      },
      { timeout: 20_000, maxRetries: 1 },
    );
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (typeof j.adaptada !== "string") return null;
    const kws = Array.isArray(j.keywords_agregadas) ? j.keywords_agregadas.filter((k: unknown) => typeof k === "string") : [];
    return { adaptada: j.adaptada.trim(), keywords_agregadas: kws };
  } catch (err) {
    console.warn("[postulai] Reescritor: respuesta inválida o error de API:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── funciones principales ───────────────────────────────────────────────────

export async function reescribirLinea(input: InputLinea, opts: OpcionesReescritor = {}): Promise<ResultadoLinea> {
  const { lineaOriginal, cvCompleto, mapeo } = input;
  const max = opts.maxPalabrasNuevas ?? MAX_PALABRAS_NUEVAS;
  const sinCambios = (estado: EstadoLinea, reintentos: 0 | 1, motivo?: string): ResultadoLinea => ({
    original: lineaOriginal, adaptada: lineaOriginal, keywords_agregadas: [], fuente_en_cv: [],
    palabras_nuevas: 0, reintentos, estado, ...(motivo ? { motivo } : {}),
  });

  const permitidas = planificarLinea(input);
  if (permitidas.length === 0) return sinCambios("sin_cambios", 0);

  // Viñeta y sangría se conservan fuera del modelo.
  const prefijo = lineaOriginal.match(/^\s*(?:[-•]\s+)?/)?.[0] ?? "";
  const cuerpo = lineaOriginal.slice(prefijo.length);
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const usage = { input_tokens: 0, output_tokens: 0 };
  let motivo: string | undefined;
  for (const intento of [0, 1] as const) {
    const r = await pedirAdaptacion(client, cuerpo, permitidas, motivo, usage);
    if (!r) { motivo = "respuesta sin JSON válido"; continue; }

    const fuera = r.keywords_agregadas.filter(k => !permitidas.some(p => normalizarParaComparar(p.keyword) === normalizarParaComparar(k)));
    const kws = permitidas.filter(p => r.keywords_agregadas.some(k => normalizarParaComparar(k) === normalizarParaComparar(p.keyword)));
    const v = verificarAdaptacion(cuerpo, r.adaptada, kws.map(k => k.keyword), cvCompleto, mapeo, max);
    const problemas = [...v.problemas, ...(fuera.length > 0 ? [`keywords no permitidas: ${fuera.join(", ")}`] : [])];

    if (problemas.length === 0) {
      if (normalizarParaComparar(r.adaptada) === normalizarParaComparar(cuerpo)) return { ...sinCambios("sin_cambios", intento), usage };
      return {
        original: lineaOriginal,
        adaptada: prefijo + r.adaptada,
        keywords_agregadas: kws.map(k => k.keyword),
        fuente_en_cv: kws.map(k => k.fuente),
        palabras_nuevas: v.palabras_nuevas,
        reintentos: intento,
        estado: "adaptada",
        usage,
      };
    }
    motivo = problemas.join("; ");
  }
  return { ...sinCambios("rechazada_forzada", 1, motivo), usage };
}

export async function reescribirCV(
  lineas: string[],
  ctx: Omit<InputLinea, "lineaOriginal">,
  opts: OpcionesReescritor = {},
): Promise<ResultadoLinea[]> {
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return Promise.all(lineas.map(lineaOriginal => reescribirLinea({ ...ctx, lineaOriginal }, { ...opts, client })));
}

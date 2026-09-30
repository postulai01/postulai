/**
 * Perfil profesional adaptado a la oferta (PED-32).
 * Reescribe el párrafo de perfil para el cargo usando solo hechos del CV; cada afirmación trae citas exactas.
 *
 * Flujo:
 * 1. detectarPerfil (sin API): el párrafo de perfil está en el bloque "resumen" de bloquesCV. Sin perfil → "sin_perfil"
 *    (no se inventa uno).
 * 2. UNA llamada a Haiku con el perfil, el CV, las keywords de la oferta, los matches del mapeo, los requisitos
 *    cumplidos y las brechas prohibidas. Devuelve { perfil, afirmaciones: [{ frase, citas, keywords }] }.
 * 3. verificarPerfil (sin API): citas literales, palabras con respaldo en el CV o en una keyword con match, cifras del
 *    CV, sin verbos de escalada nuevos ni keywords de brecha, largo ±20%. Si falla: 1 reintento con los motivos;
 *    si vuelve a fallar → "rechazado" y se conserva el original.
 * No está conectado a process-cv.
 */
import Anthropic from "@anthropic-ai/sdk";
import { cifrasSinRespaldo } from "./cv-postprocess";
import { norm, raizVerbo, VERBOS_ESCALADA } from "./cv-verificacion";
import { RAICES_GENERICAS, type KeywordsJD, type ResultadoMapeo } from "./mapeo-semantico";
import { bloquesCV, indice, palabrasContenido, presente } from "./reescritor-contextual";

export const MODELO_PERFIL = "claude-haiku-4-5-20251001";
export const TOLERANCIA_LARGO = 0.2;
const MIN_PALABRAS_PERFIL = 20;

export type EstadoPerfil = "adaptado" | "rechazado" | "sin_perfil";

export interface Afirmacion {
  frase: string;
  lineas?: number[];            // números de línea del CV (1-based) que cita el modelo
  citas: string[];              // texto de esas líneas, armado por el código (literal por construcción)
  keywords: string[];           // traza verificada: solo keywords que la frase contiene
  keywordsEliminadas?: string[]; // keywords que el modelo asignó pero la frase no contiene
}

export interface RespuestaPerfil { perfil: string; afirmaciones: Afirmacion[] }

export interface ResultadoPerfil {
  estado: EstadoPerfil;
  original: string | null;
  perfil: string | null;        // adaptado, o el original si se rechazó
  indiceLinea: number | null;   // línea del perfil en cv.split("\n")
  afirmaciones: Afirmacion[];
  reintentos: 0 | 1;
  problemas: string[];          // del último intento
  keywordsEliminadas?: number;  // keywords sacadas de la traza porque la frase no las contiene
  respuestas: unknown[];        // crudas, para re-verificar sin API
  usage: { input_tokens: number; output_tokens: number };
}

export interface InputPerfil { cv: string; mapeo: ResultadoMapeo; keywordsJD: KeywordsJD }

// ─── detección ───────────────────────────────────────────────────────────────

// El párrafo más largo del bloque resumen que no es lista ("Etiqueta: a, b") ni viñeta.
export function detectarPerfil(cv: string): { texto: string; indice: number } | null {
  const lineas = cv.split("\n");
  const resumen = bloquesCV(cv).find(b => b.tipo === "resumen");
  let mejor: { texto: string; indice: number } | null = null;
  for (const i of resumen?.indices ?? []) {
    const l = lineas[i].trim();
    if (/^[-•]/.test(l) || /^[^:]{2,40}:\s/.test(l)) continue;
    if (l.split(/\s+/).length < MIN_PALABRAS_PERFIL) continue;
    if (!mejor || l.length > mejor.texto.length) mejor = { texto: l, indice: i };
  }
  return mejor;
}

// ─── verificación (sin API) ──────────────────────────────────────────────────

const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();
const contarPalabras = (s: string) => s.split(/\s+/).filter(Boolean).length;
const raiz5 = (p: string) => p.slice(0, 5);

// Conectores neutros que no necesitan respaldo en el CV.
const RELLENO_NEUTRO = /^(posee|poseo|poseen|cuenta|cuento|cuentan|experiencia|orientad[oa]s?)$/;
// Intensificadores de nivel: solo si el CV ya los dice (la palabra o su variante de género/número).
const INTENSIFICADOR = /^(domin|solid|ampli|profund|expert|especialista|avanzad)/;
const variantes = (p: string) => { const b = p.replace(/(as|os|a|o|es|s)$/, ""); return [p, b, b + "a", b + "o", b + "as", b + "os", b + "es", b + "s"]; };

// Palabras de contenido que comparten (igual o raíz no genérica) dos textos.
function compartenContenido(a: string, b: string): boolean {
  const ib = indice(b);
  return palabrasContenido(a).some(p => ib.set.has(p) || (p.length >= 6 && !RAICES_GENERICAS.has(raiz5(p)) && ib.raices.has(raiz5(p))));
}

export function verificarPerfil(original: string, r: RespuestaPerfil, input: InputPerfil): string[] {
  const { cv, mapeo } = input;
  const problemas: string[] = [];
  const cvCol = colapsar(cv);

  // Afirmaciones: cada una con al menos una cita, cada cita literal en el CV y, si viene por número de línea, la
  // línea comparte contenido con la frase.
  const sinCita = r.afirmaciones.filter(a => a.citas.length === 0).map(a => a.frase);
  if (sinCita.length > 0) problemas.push(`afirmaciones sin cita: ${sinCita.join(" | ")}`);
  const citasMalas = r.afirmaciones.flatMap(a => a.citas).filter(c => !cvCol.includes(colapsar(c)));
  if (citasMalas.length > 0) problemas.push(`citas que no existen literal en el CV: ${citasMalas.map(c => `"${c}"`).join(" | ")}`);
  const lineasAjenas = r.afirmaciones.flatMap(a => (a.lineas ? a.citas.filter(c => !compartenContenido(c, a.frase)).map(c => `"${a.frase}" ← "${c}"`) : []));
  if (lineasAjenas.length > 0) problemas.push(`líneas citadas que no comparten contenido con la frase: ${lineasAjenas.join(" | ")}`);

  // Palabras: en el CV o en una keyword con match (literal o semántico).
  const ixCV = indice(cv);
  const ixKw = indice([...mapeo.matches_directos, ...mapeo.matches_relacionados].map(m => m.keyword_jd).join(" "));
  const sinRespaldo = [...new Set(palabrasContenido(r.perfil))]
    .filter(p => !/\d/.test(p) && !RELLENO_NEUTRO.test(p) && !presente(p, ixCV.set, ixCV.raices) && !presente(p, ixKw.set, ixKw.raices));
  if (sinRespaldo.length > 0) problemas.push(`palabras sin respaldo en el CV: ${sinRespaldo.join(", ")}`);
  const intensificadores = [...new Set(palabrasContenido(r.perfil))]
    .filter(p => INTENSIFICADOR.test(p) && !variantes(p).some(v => ixCV.set.has(v)));
  if (intensificadores.length > 0) problemas.push(`intensificadores sin respaldo en el CV: ${intensificadores.join(", ")}`);

  const cifras = cifrasSinRespaldo(r.perfil, cv);
  if (cifras.length > 0) problemas.push(`cifras que no están en el CV: ${cifras.join(", ")}`);

  // Verbos de escalada: su prefijo de 6 letras debe aparecer en el CV (misma regla que verboEscalado:
  // "liderazgo" y "lidera" están respaldados por "liderando"; "coordinación" por "Coordiné").
  const cvNorm = norm(cv);
  const raicesCV = cvNorm.split(/[^a-zñ]+/).filter(Boolean).map(raizVerbo);
  const respaldado = (p: string) => {
    const prefijo = raizVerbo(p).slice(0, 6);
    return cvNorm.includes(prefijo) || raicesCV.some(r => r.startsWith(prefijo)); // "Dirijo" → dirig
  };
  const escaladas = [...new Set(palabrasContenido(r.perfil))].filter(p => VERBOS_ESCALADA.test(raizVerbo(p)) && !respaldado(p));
  if (escaladas.length > 0) problemas.push(`verbos de escalada sin respaldo: ${escaladas.join(", ")}`);

  // Keywords de brecha: ninguna nueva respecto del perfil original.
  const ixNuevo = indice(r.perfil), ixOrig = indice(original);
  const gaps = mapeo.gap_keywords.filter(g => {
    const k = palabrasContenido(g.keyword);
    return k.length > 0 && k.every(p => presente(p, ixNuevo.set, ixNuevo.raices)) && !k.every(p => presente(p, ixOrig.set, ixOrig.raices));
  });
  if (gaps.length > 0) problemas.push(`keywords de brecha: ${gaps.map(g => g.keyword).join(", ")}`);

  const n = contarPalabras(r.perfil), n0 = contarPalabras(original);
  if (Math.abs(n - n0) > TOLERANCIA_LARGO * n0) problemas.push(`largo ${n} palabras fuera de ±20% de ${n0}`);

  return problemas;
}

// ─── traza de keywords (sin API) ──────────────────────────────────────────────

// Una keyword queda en la traza de una afirmación solo si la frase la contiene: sus palabras de raíz no genérica
// (igual o misma raíz), o la mitad de las palabras de la cita de un match semántico ya aceptado.
export function verificarTraza(afirmaciones: Afirmacion[], mapeo: ResultadoMapeo): { afirmaciones: Afirmacion[]; eliminadas: number } {
  const semanticos = [...mapeo.matches_directos, ...mapeo.matches_relacionados].filter(m => m.origen === "semantico" && m.cita);
  let eliminadas = 0;
  const out = afirmaciones.map(a => {
    const ix = indice(a.frase);
    const esta = (w: string) => ix.set.has(w) || (w.length >= 6 && ix.raices.has(raiz5(w)));
    const contiene = (k: string) => {
      const ps = palabrasContenido(k);
      const propias = ps.filter(p => !RAICES_GENERICAS.has(raiz5(p)));
      if (ps.length === 0) return false;
      if ((propias.length ? propias : ps).every(esta)) return true;
      return semanticos.some(m => {
        if (m.keyword_jd !== k) return false;
        const pc = palabrasContenido(m.cita!).filter(p => !RAICES_GENERICAS.has(raiz5(p)));
        return pc.length > 0 && pc.filter(esta).length >= pc.length / 2;
      });
    };
    const keywords = a.keywords.filter(contiene);
    const fuera = a.keywords.filter(k => !keywords.includes(k));
    eliminadas += fuera.length;
    return { ...a, keywords, ...(fuera.length ? { keywordsEliminadas: fuera } : {}) };
  });
  return { afirmaciones: out, eliminadas };
}

// ─── llamada a modelo ────────────────────────────────────────────────────────

export const SYSTEM_PERFIL = `Reescribes el párrafo de PERFIL PROFESIONAL de un CV en español para una oferta de trabajo, sin inventar nada.
Reglas:
- Solo hechos que están en el CV. Puedes sintetizar hechos de distintos puestos: el perfil resume la carrera.
- Prioriza lo que la oferta pide y el CV respalda (usa las keywords con match y los requisitos cumplidos).
- Prohibido: las keywords de brecha, cifras que no estén en el CV, escalar verbos o seniority (no conviertas "apoyé" en "lideré" ni "subgerente" en "gerente").
- Los años de experiencia se escriben como los dice el CV; no los recalcules desde las fechas.
- Largo: entre -20% y +20% de las palabras del perfil original.
- Mantén los términos del perfil original que calzan con keywords de la oferta.
- Mismo registro y persona gramatical que el original. Frases naturales, sin listas de keywords pegadas.
- No uses intensificadores de nivel (domina, sólida, amplia, profunda, experto, especialista, avanzado) salvo que el CV ya los diga.
- Divide el perfil en afirmaciones. Cada afirmación indica los NÚMEROS DE LÍNEA del CV (el CV viene numerado) que la respaldan, y las keywords de la oferta que la frase contiene.
Responde SOLO con JSON: {"perfil":"...","afirmaciones":[{"frase":"...","lineas":[12,40],"keywords":["..."]}]}`;

export function promptPerfil(original: string, input: InputPerfil, problemasPrevios?: string[]): string {
  const { cv, mapeo, keywordsJD } = input;
  const kw = (ks: { keyword: string; relevancia: number }[]) => ks.map(k => `- ${k.keyword} (${k.relevancia})`).join("\n") || "—";
  const matches = [...mapeo.matches_directos, ...mapeo.matches_relacionados]
    .map(m => `- ${m.keyword_jd} ← ${m.cita ?? m.competencia_cv}`).join("\n") || "—";
  const cumplidos = (mapeo.requisitos ?? []).filter(q => q.estado !== "no_cumple")
    .map(q => `- ${q.descripcion}: ${q.estado} (${q.detalle})`).join("\n") || "—";
  const brechas = mapeo.gap_keywords.map(g => `- ${g.keyword}`).join("\n") || "—";
  const reintento = problemasPrevios?.length
    ? `\n\nTu intento anterior fue rechazado por: ${problemasPrevios.join("; ")}. Corrígelo cumpliendo todas las reglas.`
    : "";
  return `PERFIL ORIGINAL (${contarPalabras(original)} palabras):
${original}

KEYWORDS REQUERIDAS (relevancia):
${kw(keywordsJD.requeridas)}

KEYWORDS DESEABLES:
${kw(keywordsJD.deseables)}

MATCHES DEL CV (keyword ← respaldo):
${matches}

REQUISITOS CUMPLIDOS:
${cumplidos}

BRECHAS (prohibido mencionarlas):
${brechas}

CV COMPLETO (numerado por línea):
${numerarCV(cv)}${reintento}`;
}

export function numerarCV(cv: string): string {
  return cv.split("\n").map((l, i) => (l.trim() ? `${i + 1}| ${l.trim()}` : "")).filter(Boolean).join("\n");
}

// Parsea y normaliza la respuesta; null si no es JSON válido con perfil. Con "lineas", las citas se arman desde el
// CV (literal por construcción); un número fuera de rango o de una línea vacía queda como cita vacía (inválida).
// Las respuestas antiguas con "citas" en texto se aceptan tal cual (se verifican igual).
export function parsearRespuesta(raw: unknown, cv: string): RespuestaPerfil | null {
  const lineasCV = cv.split("\n");
  const j = raw as { perfil?: unknown; afirmaciones?: unknown } | null;
  if (!j || typeof j.perfil !== "string" || !j.perfil.trim()) return null;
  const afirmaciones = (Array.isArray(j.afirmaciones) ? j.afirmaciones : []).map((a: Record<string, unknown>): Afirmacion => {
    const frase = typeof a?.frase === "string" ? a.frase : "";
    const keywords = Array.isArray(a?.keywords) ? a.keywords.filter((k: unknown): k is string => typeof k === "string") : [];
    if (Array.isArray(a?.lineas)) {
      const lineas = a.lineas.map(Number).filter(Number.isInteger);
      const citas = lineas.map(n => (n >= 1 && n <= lineasCV.length ? lineasCV[n - 1].replace(/^\s*[-•]\s+/, "").trim() : ""));
      return { frase, lineas, citas: citas.length ? citas : [], keywords };
    }
    const citas = Array.isArray(a?.citas) ? a.citas.filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0) : [];
    return { frase, citas, keywords };
  });
  return { perfil: colapsar(j.perfil), afirmaciones };
}

// Aplica la regla de intentos a respuestas ya obtenidas (del modelo o guardadas).
export function evaluarRespuestas(input: InputPerfil, respuestas: unknown[]): Omit<ResultadoPerfil, "usage"> {
  const det = detectarPerfil(input.cv);
  const base = { original: det?.texto ?? null, indiceLinea: det?.indice ?? null, respuestas };
  if (!det) return { ...base, estado: "sin_perfil", perfil: null, afirmaciones: [], reintentos: 0, problemas: [] };
  let problemas: string[] = [];
  for (const [k, raw] of respuestas.slice(0, 2).entries()) {
    const r = parsearRespuesta(raw, input.cv);
    problemas = r ? verificarPerfil(det.texto, r, input) : ["respuesta sin JSON válido"];
    if (r && problemas.length === 0) {
      const traza = verificarTraza(r.afirmaciones, input.mapeo);
      return { ...base, estado: "adaptado", perfil: r.perfil, afirmaciones: traza.afirmaciones, reintentos: k as 0 | 1, problemas, keywordsEliminadas: traza.eliminadas };
    }
  }
  return { ...base, estado: "rechazado", perfil: det.texto, afirmaciones: [], reintentos: respuestas.length > 1 ? 1 : 0, problemas };
}

export async function adaptarPerfil(input: InputPerfil, opts: { client?: Anthropic } = {}): Promise<ResultadoPerfil> {
  const usage = { input_tokens: 0, output_tokens: 0 };
  const det = detectarPerfil(input.cv);
  if (!det) return { ...evaluarRespuestas(input, []), usage };
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const respuestas: unknown[] = [];
  let problemas: string[] | undefined;
  for (let intento = 0; intento < 2; intento++) {
    const res = await client.messages.create(
      { model: MODELO_PERFIL, max_tokens: 2000, temperature: 0, system: SYSTEM_PERFIL, messages: [{ role: "user", content: promptPerfil(det.texto, input, problemas) }] },
      { timeout: 30_000, maxRetries: 1 },
    );
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    let json: unknown = null;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      json = m ? JSON.parse(m[0]) : null;
    } catch { /* se registra como respuesta inválida */ }
    respuestas.push(json);
    const r = parsearRespuesta(json, input.cv);
    problemas = r ? verificarPerfil(det.texto, r, input) : ["respuesta sin JSON válido"];
    if (problemas.length === 0) break;
  }
  return { ...evaluarRespuestas(input, respuestas), usage };
}

/**
 * Perfil profesional adaptado a la oferta (PED-32).
 *
 * Modo por defecto: "priorizado" (perfilParaOferta). Divide el perfil original en oraciones y las reordena por puntaje
 * contra la oferta (misma lógica del priorizador: tema central + raíces no genéricas). La primera oración, la que
 * presenta a la persona, queda siempre primera. No escribe texto: el multiconjunto de oraciones es idéntico. $0.
 *
 * Modo "generativo" (adaptarPerfil): DESACTIVADO HASTA PED-24. Produce afirmaciones infladas que la verificación por
 * palabras no detecta ("Apoyar la definición" → "Responsable de la definición"; hechos de distintos puestos unidos).
 * Queda en el código solo detrás de una opción explícita (modo: "generativo"). Ver evals/validador/inflados-ped32.json.
 *
 * Generativo, en detalle: reescribe el párrafo de perfil oración por oración, con trazabilidad.
 *
 * Flujo:
 * 1. detectarPerfil (sin API): el párrafo de perfil está en el bloque "resumen" de bloquesCV. Sin perfil → "sin_perfil"
 *    (no se inventa uno).
 * 2. UNA llamada a Haiku con el perfil, el CV numerado por línea, las keywords de la oferta, los matches del mapeo,
 *    los requisitos cumplidos y las brechas prohibidas. Devuelve { oraciones: [{ texto, lineas, keywords }] }:
 *    oraciones completas cuya concatenación es el perfil. Las citas las arma el código desde las líneas.
 * 3. verificarOracion (sin API), a CADA oración: citas literales que comparten contenido con la oración, palabras con
 *    respaldo en el CV o en una keyword con match, sin intensificadores, cifras ni verbos de escalada sin respaldo,
 *    sin keywords de brecha.
 * 4. armarPerfil: se descartan las oraciones que fallan y el perfil se arma con las que pasan, en su orden. Se acepta
 *    si la primera oración pasa y el largo queda entre 70% y 120% del original. Si no: 1 reintento con los motivos;
 *    si vuelve a fallar → "rechazado" y se conserva el original.
 * No está conectado a process-cv.
 */
import Anthropic from "@anthropic-ai/sdk";
import { cifrasSinRespaldo } from "./cv-postprocess";
import { norm, raizVerbo, VERBOS_ESCALADA } from "./cv-verificacion";
import { RAICES_GENERICAS, type KeywordsJD, type ResultadoMapeo } from "./mapeo-semantico";
import { puntuarTextos, type KeywordPuntaje } from "./priorizador";
import { bloquesCV, indice, palabrasContenido, presente } from "./reescritor-contextual";

export const MODELO_PERFIL = "claude-haiku-4-5-20251001";
export const LARGO_MIN = 0.7;
export const LARGO_MAX = 1.2;
const MIN_PALABRAS_PERFIL = 20;

export type EstadoPerfil = "adaptado" | "rechazado" | "sin_perfil";

export interface Oracion {
  texto: string;
  lineas?: number[];             // números de línea del CV (1-based) que cita el modelo
  citas: string[];               // texto de esas líneas, armado por el código (literal por construcción)
  keywords: string[];            // traza verificada: solo keywords que la oración contiene
  keywordsEliminadas?: string[]; // keywords que el modelo asignó pero la oración no contiene
}

export interface OracionDescartada { texto: string; problemas: string[] }

export interface ResultadoPerfil {
  estado: EstadoPerfil;
  original: string | null;
  perfil: string | null;          // adaptado, o el original si se rechazó
  indiceLinea: number | null;     // línea del perfil en cv.split("\n")
  oraciones: Oracion[];           // aceptadas
  descartadas: OracionDescartada[];
  reintentos: 0 | 1;
  problemas: string[];            // por qué se rechazó el armado (último intento)
  keywordsEliminadas?: number;
  respuestas: unknown[];          // crudas, para re-verificar sin API
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

// ─── verificación por oración (sin API) ──────────────────────────────────────

const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();
const contarPalabras = (s: string) => s.split(/\s+/).filter(Boolean).length;
const raiz5 = (p: string) => p.slice(0, 5);

// Conectores neutros y palabras gramaticales sin contenido: no necesitan respaldo en el CV.
export const RELLENO_NEUTRO = /^(maneja|manejo|maneje|manejan|posee|poseo|poseen|cuenta|cuento|cuentan|experiencia|orientad[oa]s?|como|asi|entre|sus|su|ello)$/;
// Intensificadores de nivel: solo si el CV ya los dice (la palabra o su variante de género/número).
export const INTENSIFICADOR = /^(domin|solid|ampli|profund|expert|especialista|avanzad)/; // grupo 1: raíz
const variantes = (p: string) => { const b = p.replace(/(as|os|a|o|es|s)$/, ""); return [p, b, b + "a", b + "o", b + "as", b + "os", b + "es", b + "s"]; };

// Palabras de contenido que comparten (igual o raíz no genérica) dos textos.
function compartenContenido(a: string, b: string): boolean {
  const ib = indice(b);
  return palabrasContenido(a).some(p => ib.set.has(p) || (p.length >= 6 && !RAICES_GENERICAS.has(raiz5(p)) && ib.raices.has(raiz5(p))));
}

export function verificarOracion(o: Oracion, original: string, input: InputPerfil): string[] {
  const { cv, mapeo } = input;
  const problemas: string[] = [];
  const palabras = [...new Set(palabrasContenido(o.texto))];

  // Citas: al menos una, literal en el CV y, si viene por número de línea, compartiendo contenido con la oración.
  const cvCol = colapsar(cv);
  if (o.citas.length === 0) problemas.push("sin cita");
  const noLiterales = o.citas.filter(c => !c || !cvCol.includes(colapsar(c)));
  if (noLiterales.length > 0) problemas.push(`citas que no existen literal en el CV: ${noLiterales.map(c => `"${c}"`).join(" | ")}`);
  const ajenas = o.lineas ? o.citas.filter(c => c && !compartenContenido(c, o.texto)) : [];
  if (ajenas.length > 0) problemas.push(`líneas citadas que no comparten contenido: ${ajenas.map(c => `"${c}"`).join(" | ")}`);

  // Palabras: en el CV o en una keyword con match (literal o semántico).
  const ixCV = indice(cv);
  const ixKw = indice([...mapeo.matches_directos, ...mapeo.matches_relacionados].map(m => m.keyword_jd).join(" "));
  const sinRespaldo = palabras.filter(p => !/\d/.test(p) && !RELLENO_NEUTRO.test(p) && !presente(p, ixCV.set, ixCV.raices) && !presente(p, ixKw.set, ixKw.raices));
  if (sinRespaldo.length > 0) problemas.push(`palabras sin respaldo en el CV: ${sinRespaldo.join(", ")}`);
  const intensificadores = palabras.filter(p => INTENSIFICADOR.test(p) && !variantes(p).some(v => ixCV.set.has(v)));
  if (intensificadores.length > 0) problemas.push(`intensificadores sin respaldo: ${intensificadores.join(", ")}`);

  const cifras = cifrasSinRespaldo(o.texto, cv);
  if (cifras.length > 0) problemas.push(`cifras que no están en el CV: ${cifras.join(", ")}`);

  // Verbos de escalada: su prefijo de 6 letras debe aparecer en el CV (misma regla que verboEscalado).
  const cvNorm = norm(cv);
  const raicesCV = cvNorm.split(/[^a-zñ]+/).filter(Boolean).map(raizVerbo);
  const respaldado = (p: string) => {
    const prefijo = raizVerbo(p).slice(0, 6);
    return cvNorm.includes(prefijo) || raicesCV.some(r => r.startsWith(prefijo)); // "Dirijo" → dirig
  };
  const escaladas = palabras.filter(p => VERBOS_ESCALADA.test(raizVerbo(p)) && !respaldado(p));
  if (escaladas.length > 0) problemas.push(`verbos de escalada sin respaldo: ${escaladas.join(", ")}`);

  // Keywords de brecha: ninguna que no estuviera ya en el perfil original.
  const ixO = indice(o.texto), ixOrig = indice(original);
  const gaps = mapeo.gap_keywords.filter(g => {
    const k = palabrasContenido(g.keyword);
    return k.length > 0 && k.every(p => presente(p, ixO.set, ixO.raices)) && !k.every(p => presente(p, ixOrig.set, ixOrig.raices));
  });
  if (gaps.length > 0) problemas.push(`keywords de brecha: ${gaps.map(g => g.keyword).join(", ")}`);

  return problemas;
}

// ─── traza de keywords (sin API) ──────────────────────────────────────────────

// Una keyword queda en la traza solo si la oración la contiene: sus palabras de raíz no genérica (igual o misma
// raíz), o la mitad de las palabras de la cita de un match semántico ya aceptado.
export function verificarTraza(oraciones: Oracion[], mapeo: ResultadoMapeo): { oraciones: Oracion[]; eliminadas: number } {
  const semanticos = [...mapeo.matches_directos, ...mapeo.matches_relacionados].filter(m => m.origen === "semantico" && m.cita);
  let eliminadas = 0;
  const out = oraciones.map(o => {
    const ix = indice(o.texto);
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
    const keywords = o.keywords.filter(contiene);
    const fuera = o.keywords.filter(k => !keywords.includes(k));
    eliminadas += fuera.length;
    return { ...o, keywords, ...(fuera.length ? { keywordsEliminadas: fuera } : {}) };
  });
  return { oraciones: out, eliminadas };
}

// ─── armado por oración ──────────────────────────────────────────────────────

export interface Armado {
  aceptado: boolean;
  perfil: string;
  oraciones: Oracion[];
  descartadas: OracionDescartada[];
  problemas: string[];
}

export function armarPerfil(oraciones: Oracion[], original: string, input: InputPerfil): Armado {
  const aceptadas: Oracion[] = [];
  const descartadas: OracionDescartada[] = [];
  oraciones.forEach(o => {
    const p = verificarOracion(o, original, input);
    if (p.length === 0) aceptadas.push(o); else descartadas.push({ texto: o.texto, problemas: p });
  });
  const perfil = colapsar(aceptadas.map(o => o.texto).join(" "));
  const problemas: string[] = [];
  if (oraciones.length === 0) problemas.push("sin oraciones");
  else if (!aceptadas.includes(oraciones[0])) problemas.push("la primera oración no pasa la verificación");
  const n = contarPalabras(perfil), n0 = contarPalabras(original);
  if (n < LARGO_MIN * n0 || n > LARGO_MAX * n0) problemas.push(`largo ${n} palabras fuera de ${Math.round(LARGO_MIN * 100)}–${Math.round(LARGO_MAX * 100)}% de ${n0}`);
  return { aceptado: problemas.length === 0, perfil, oraciones: aceptadas, descartadas, problemas };
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
- Mismo registro y persona gramatical que el original. Oraciones naturales, sin listas de keywords pegadas.
- Usa palabras que estén en el CV. No uses intensificadores de nivel (domina, sólida, amplia, profunda, experto, especialista, avanzado) salvo que el CV ya los diga, ni sustantivos de relleno (entornos, contextos, ámbitos).
- Entrega el perfil como una lista de ORACIONES COMPLETAS (cada una termina en punto; juntas forman el perfil). Cada oración indica los NÚMEROS DE LÍNEA del CV (el CV viene numerado) que respaldan lo que dice, y las keywords de la oferta que contiene.
Responde SOLO con JSON: {"oraciones":[{"texto":"...","lineas":[12,40],"keywords":["..."]}]}`;

export function numerarCV(cv: string): string {
  return cv.split("\n").map((l, i) => (l.trim() ? `${i + 1}| ${l.trim()}` : "")).filter(Boolean).join("\n");
}

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

const listaStrings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((k): k is string => typeof k === "string" && k.trim().length > 0) : []);

// Oraciones de una respuesta. Formato actual: { oraciones: [{ texto, lineas, keywords }] }; las citas se arman desde el
// CV (un número fuera de rango queda como cita vacía, inválida). Formato anterior { perfil, afirmaciones }: se usa solo
// si las afirmaciones son oraciones completas que, juntas, forman el perfil; si no, null (no convertible).
export function parsearOraciones(raw: unknown, cv: string): Oracion[] | null {
  const lineasCV = cv.split("\n");
  const citaDe = (n: number) => (n >= 1 && n <= lineasCV.length ? lineasCV[n - 1].replace(/^\s*[-•]\s+/, "").trim() : "");
  const j = raw as { oraciones?: unknown; perfil?: unknown; afirmaciones?: unknown } | null;
  if (!j) return null;
  if (Array.isArray(j.oraciones)) {
    return j.oraciones
      .filter((o: Record<string, unknown>) => typeof o?.texto === "string" && o.texto.trim())
      .map((o: Record<string, unknown>) => {
        const lineas = (Array.isArray(o.lineas) ? o.lineas : []).map(Number).filter(Number.isInteger);
        return { texto: colapsar(o.texto as string), lineas, citas: lineas.map(citaDe), keywords: listaStrings(o.keywords) };
      });
  }
  if (typeof j.perfil === "string" && Array.isArray(j.afirmaciones)) {
    const afs = j.afirmaciones as Record<string, unknown>[];
    const oraciones: Oracion[] = afs.map(a => {
      const texto = colapsar(typeof a?.frase === "string" ? a.frase : "");
      if (Array.isArray(a?.lineas)) {
        const lineas = a.lineas.map(Number).filter(Number.isInteger);
        return { texto, lineas, citas: lineas.map(citaDe), keywords: listaStrings(a.keywords) };
      }
      return { texto, citas: listaStrings(a?.citas), keywords: listaStrings(a?.keywords) };
    });
    const sinPunto = (s: string) => norm(s).replace(/[^a-z0-9ñ]+/g, " ").trim();
    const completas = oraciones.every(o => /[.!?]$/.test(o.texto)) && sinPunto(oraciones.map(o => o.texto).join(" ")) === sinPunto(j.perfil);
    return completas ? oraciones : null;
  }
  return null;
}

// Aplica la regla de intentos a respuestas ya obtenidas (del modelo o guardadas).
export function evaluarRespuestas(input: InputPerfil, respuestas: unknown[]): Omit<ResultadoPerfil, "usage"> & { noConvertibles: number } {
  const det = detectarPerfil(input.cv);
  const base = { original: det?.texto ?? null, indiceLinea: det?.indice ?? null, respuestas };
  if (!det) return { ...base, estado: "sin_perfil", perfil: null, oraciones: [], descartadas: [], reintentos: 0, problemas: [], noConvertibles: 0 };
  let ultimo: Armado | null = null, noConvertibles = 0;
  for (const [k, raw] of respuestas.slice(0, 2).entries()) {
    const oraciones = parsearOraciones(raw, input.cv);
    if (!oraciones) { noConvertibles++; continue; }
    ultimo = armarPerfil(oraciones, det.texto, input);
    if (ultimo.aceptado) {
      const traza = verificarTraza(ultimo.oraciones, input.mapeo);
      return { ...base, estado: "adaptado", perfil: ultimo.perfil, oraciones: traza.oraciones, descartadas: ultimo.descartadas, reintentos: k as 0 | 1, problemas: [], keywordsEliminadas: traza.eliminadas, noConvertibles };
    }
  }
  return {
    ...base, estado: "rechazado", perfil: det.texto, oraciones: [], descartadas: ultimo?.descartadas ?? [],
    reintentos: respuestas.length > 1 ? 1 : 0, problemas: ultimo?.problemas ?? ["respuestas no convertibles a oraciones"], noConvertibles,
  };
}

// Modo generativo: desactivado hasta PED-24: produce afirmaciones infladas que la verificación por palabras no detecta.
// Usar solo explícitamente (perfilParaOferta con modo: "generativo", o el eval evals/perfil-adaptado.ts).
export async function adaptarPerfil(input: InputPerfil, opts: { client?: Anthropic; maxIntentos?: 1 | 2 } = {}): Promise<ResultadoPerfil> {
  const usage = { input_tokens: 0, output_tokens: 0 };
  const det = detectarPerfil(input.cv);
  if (!det) return { ...evaluarRespuestas(input, []), usage };
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const respuestas: unknown[] = [];
  let problemas: string[] | undefined;
  for (let intento = 0; intento < (opts.maxIntentos ?? 2); intento++) {
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
    const oraciones = parsearOraciones(json, input.cv);
    if (!oraciones) { problemas = ["respuesta sin JSON válido de oraciones"]; continue; }
    const armado = armarPerfil(oraciones, det.texto, input);
    if (armado.aceptado) break;
    problemas = [...armado.problemas, ...armado.descartadas.map(d => `oración descartada "${d.texto}": ${d.problemas.join(", ")}`)];
  }
  return { ...evaluarRespuestas(input, respuestas), usage };
}

// ─── modo priorizado (por defecto, sin API) ──────────────────────────────────

export interface OracionPriorizada { texto: string; de: number; a: number; puntaje: number; keywords: KeywordPuntaje[] } // de/a: 1-based

export interface ResultadoPerfilPriorizado {
  estado: "priorizado" | "sin_perfil";
  original: string | null;
  perfil: string | null;
  indiceLinea: number | null;
  oraciones: OracionPriorizada[]; // en el orden final
}

// Oraciones del párrafo: corte después de . ! ? seguido de espacio y mayúscula ("MM$ 150. Especialista…").
export function dividirOraciones(texto: string): string[] {
  return colapsar(texto).split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).filter(Boolean);
}

export function priorizarPerfil(input: InputPerfil): ResultadoPerfilPriorizado {
  const det = detectarPerfil(input.cv);
  if (!det) return { estado: "sin_perfil", original: null, perfil: null, indiceLinea: null, oraciones: [] };
  const ors = dividirOraciones(det.texto);
  const puntajes = puntuarTextos(ors, input.mapeo, input.keywordsJD);
  const items = ors.map((texto, k) => ({ texto, de: k + 1, ...puntajes[k] }));
  // La primera presenta a la persona: queda fija. El resto, por puntaje descendente; empates, orden original.
  const resto = items.slice(1).sort((a, b) => b.puntaje - a.puntaje || a.de - b.de);
  const ordenadas = [items[0], ...resto].map((o, k) => ({ ...o, a: k + 1 }));
  const antes = [...ors].sort(), despues = ordenadas.map(o => o.texto).sort();
  if (antes.length !== despues.length || antes.some((o, k) => o !== despues[k])) {
    throw new Error("perfil priorizado: el multiconjunto de oraciones cambió");
  }
  return { estado: "priorizado", original: det.texto, perfil: ordenadas.map(o => o.texto).join(" "), indiceLinea: det.indice, oraciones: ordenadas };
}

// Punto de entrada. Por defecto, priorizado. El generativo solo con modo: "generativo" (desactivado hasta PED-24).
export async function perfilParaOferta(
  input: InputPerfil,
  opts: { modo?: "priorizado" | "generativo"; client?: Anthropic } = {},
): Promise<ResultadoPerfilPriorizado | ResultadoPerfil> {
  if (opts.modo === "generativo") return adaptarPerfil(input, { client: opts.client });
  return priorizarPerfil(input);
}

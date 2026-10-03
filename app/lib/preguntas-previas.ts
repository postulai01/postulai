/**
 * Preguntas antes del CV (PED-5). Del informe de fit (informe-fit.ts) elige 1 a 3 preguntas de alto impacto, las
 * redacta cortas y convierte cada "Sí" en un hecho declarado que el reescritor puede usar como fuente.
 *
 * Selección: candidatas = preguntas del informe (visibles y plegadas), sin habilidades blandas, sin "aprenderás en el
 * cargo" (no son preguntas) y sin carrera afín (un "sí" no da material para el CV). Impacto = relevancia × (1 si es
 * requerida, 0.5 si es deseable); solo cuentan las de relevancia ≥ RELEVANCIA_MIN. Desempate por tipo:
 * área del cargo > semántico > años en el área > herramienta/normativa/idioma/concepto/sector > subtarea. Máximo 3.
 *
 * Redacción: plantillas, ≤ 12 palabras (tope duro 15), tuteo, una idea, termina en "?", sin comillas ni
 * instrucciones. Si la pregunta nombra una experiencia del CV, el resumen (≤ 5 palabras, "tu…"/"tus…") sale de UNA
 * llamada a Haiku por CV y se verifica en código: solo palabras de la línea citada. Si falla, plantilla sin resumen.
 * La misma llamada define los términos técnicos que no están en el glosario (marcados revisar: true).
 *
 * Respuestas: "si" → hecho declarado (nunca nivel, años ni cifras); "no" → nada; "no_se" → nada, y el informe lo
 * lista como "por revisar".
 */
import Anthropic from "@anthropic-ai/sdk";
import { normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { definicionValida, definirDesdeGlosario, type Definicion } from "./glosario";
import { traducirKeyword } from "./glosario-en-es";
import type { InformeFit, Pregunta } from "./informe-fit";
import {
  esCarrera, pareceHerramienta, RE_NORMATIVA, RE_SOFTWARE, type KeywordsJD, type MatchDirecto, type ResultadoMapeo,
} from "./mapeo-semantico";
import { bloquesCV } from "./reescritor-contextual";

export const MAX_PREGUNTAS_PREVIAS = 3;
export const RELEVANCIA_MIN = 7;
export const PALABRAS_OBJETIVO = 12;
export const PALABRAS_MAX = 15;
export const PALABRAS_RESUMEN = 7; // y la pregunta completa con resumen ≤ PALABRAS_OBJETIVO
export const RELEVANCIA_MIN_CONTEXTO = 0.6; // una propuesta semántica más débil no se nombra en la pregunta
export const MODELO_PREVIAS = "claude-haiku-4-5-20251001";

const PRIORIDAD: Record<string, number> = {
  area_cargo: 5, semantico: 4, anios_area: 3,
  herramienta: 2, normativa: 2, idioma: 2, concepto: 2, sector: 2,
  subtarea: 1,
};

export type Destino = { tipo: "vineta"; linea: string } | { tipo: "habilidades" };

export interface PreguntaPrevia {
  id: number;
  keyword: string;   // lo que se declara con un "sí" (en años en el área: el área)
  tipo: string;
  impacto: number;
  texto: string;     // pregunta corta
  palabras: number;
  contexto?: string; // línea del CV que la pregunta nombra
  resumen?: string;  // resumen de la experiencia usado en la pregunta (⊂ palabras de `contexto`)
  destino: Destino;
  definicion?: Definicion;
}

export interface AnalisisPrevio { preguntas: PreguntaPrevia[] }

// ─── selección ───────────────────────────────────────────────────────────────

// La keyword sin nivel ya está escrita en alguna línea del CV ("Excel" de "Excel nivel intermedio"): no se pregunta.
function yaEnCV(keyword: string, cv: string): boolean {
  const k = palabrasDe(sinNivel(keyword)).filter(p => !STOP_WORDS_MATCH.has(p));
  return k.length > 0 && cv.split("\n").some(l => { const n = ` ${normalizarParaComparar(l)} `; return k.every(p => n.includes(` ${p} `)); });
}

// Semántico con propuesta débil (relevancia < RELEVANCIA_MIN_CONTEXTO o sin ella): pregunta genérica, sin contexto.
const conContextoFiable = (p: Pregunta): Pregunta =>
  p.tipo === "semantico" && !((p.relevanciaCita ?? 0) >= RELEVANCIA_MIN_CONTEXTO) ? { ...p, contexto: undefined } : p;

export function seleccionarCandidatas(informe: InformeFit, jd: KeywordsJD, cv: string): (Pregunta & { impacto: number })[] {
  const deseable = new Set(jd.deseables.map(k => normalizarParaComparar(k.keyword)));
  return [...informe.preguntas, ...informe.otras_preguntas].map(conContextoFiable)
    .filter(p => p.tipo in PRIORIDAD && p.relevancia >= RELEVANCIA_MIN)
    .filter(p => p.tipo === "anios_area" || !yaEnCV(p.requisito, cv))
    .map(p => ({ ...p, impacto: p.relevancia * (deseable.has(normalizarParaComparar(p.requisito)) ? 0.5 : 1) }))
    .sort((a, b) => b.impacto - a.impacto || PRIORIDAD[b.tipo] - PRIORIDAD[a.tipo])
    .slice(0, MAX_PREGUNTAS_PREVIAS);
}

// ─── redacción ───────────────────────────────────────────────────────────────

export const contarPalabras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (resumen: string) => /^tus\b/i.test(resumen);

// Un "sí" nunca declara nivel: "Excel nivel intermedio" → "Excel".
export const sinNivel = (k: string) => k.replace(/\s*(\bnivel\s+)?\b(b[aá]sico|intermedio|avanzado|experto)\b/gi, "").trim();
const esHerramienta = (k: string) => pareceHerramienta(k) || RE_SOFTWARE.test(normalizarParaComparar(k));

// Plantilla de cada tipo; `resumen` solo para área del cargo y semántico.
function plantilla(p: Pregunta, resumen?: string): string {
  const k = sinNivel(p.requisito);
  if ((p.tipo === "semantico" || p.tipo === "subtarea") && !resumen && esHerramienta(k)) return `¿Has usado ${k}?`;
  switch (p.tipo) {
    case "area_cargo": return resumen ? `¿${mayuscula(resumen)} ${plural(resumen) ? "fueron" : "fue"} trabajo de ${k}?` : `¿Tienes experiencia en ${k}?`;
    case "semantico": return resumen ? `¿${mayuscula(resumen)} ${plural(resumen) ? "cuentan" : "cuenta"} como ${k}?` : `¿Tienes experiencia en ${k}?`;
    case "anios_area": return `¿Tu trabajo como ${p.contexto} fue de ${p.area}?`;
    case "herramienta": return `¿Has usado ${k}?`;
    case "normativa":
    case "concepto": return `¿Has trabajado con ${k}?`;
    case "idioma": return `¿Manejas ${traducirKeyword(k) ?? k} en el trabajo?`; // "English" → "inglés"
    case "sector": return `¿Tienes experiencia en ${k.replace(/^experiencia en\s+/i, "")}?`;
    default: return `¿Tu experiencia incluye ${k}?`;
  }
}

// Una pregunta corta válida: ≤ PALABRAS_MAX, "¿…?", sin comillas ni instrucciones.
export function preguntaValida(t: string): boolean {
  return contarPalabras(t) <= PALABRAS_MAX && /^¿[^¿?]+\?$/.test(t) && !/["“”«»]/.test(t) && !/agr[eé]galo|n[oó]mbralo/i.test(t);
}

const palabrasDe = (t: string) => normalizarParaComparar(t).split(" ").filter(Boolean);

const FINAL_DEBIL = /^(de|del|la|las|el|los|un|una|y|e|o|u|en|para|por|con|a|al|que|sus|su)$/;

// El resumen usa SOLO palabras de la línea citada (más "tu"/"tus"), ≤ PALABRAS_RESUMEN, sin comillas. Sin recortes.
export function resumenValido(resumen: string, linea: string): boolean {
  if (/^[^:]{2,40}:\s/.test(linea)) return false; // lista "Técnicas: Excel, SAP…": recortarla parte nombres propios
  const ps = palabrasDe(resumen);
  if (ps.length === 0 || contarPalabras(resumen) > PALABRAS_RESUMEN || /["“”«»]/.test(resumen)) return false;
  if (!/^(tu|tus)$/.test(ps[0])) return false;
  // Termina en infinitivo o en palabra débil: queda cortado ("tus datos de producción para identificar").
  const ultima = ps[ps.length - 1];
  if (ps.length > 1 && (FINAL_DEBIL.test(ultima) || /(ar|er|ir)$/.test(ultima))) return false;
  const enLinea = new Set(palabrasDe(linea));
  return ps.slice(1).every(p => enLinea.has(p));
}

// Términos técnicos fuera del glosario: siglas o herramientas, inglés, normativas.
function esTecnico(k: string): boolean {
  return pareceHerramienta(k) || traducirKeyword(k) !== null || RE_NORMATIVA.test(normalizarParaComparar(k));
}

// ─── destino de un "sí" ──────────────────────────────────────────────────────

const sinVineta = (l: string) => l.replace(/^\s*[-•]\s*/, "").trim();

// Viñeta del CV para un "sí": la línea citada; en años en el área, la primera viñeta del puesto no contado.
function destinoDe(p: Pregunta, cv: string): Destino {
  if ((p.tipo === "area_cargo" || p.tipo === "semantico") && p.contexto) {
    const linea = cv.split("\n").find(l => sinVineta(l) === p.contexto || sinVineta(l).includes(p.contexto!));
    if (linea) return { tipo: "vineta", linea };
  }
  if (p.tipo === "anios_area" && p.contexto) {
    const b = bloquesCV(cv).find(b => b.tipo === "puesto" && (b.titulo.startsWith(p.contexto!) || b.lineas.some(l => l.startsWith(p.contexto!))));
    const lineas = cv.split("\n");
    const primera = b?.indices.map(i => lineas[i]).find(l => /^\s*[-•]\s+/.test(l));
    if (primera) return { tipo: "vineta", linea: primera };
  }
  return { tipo: "habilidades" };
}

// ─── modelo (una llamada por CV) ─────────────────────────────────────────────

export const SYSTEM_PREVIAS = `Ayudas a redactar preguntas cortas para una persona que postula a un trabajo.
1. RESUMENES: para cada línea de su CV, escribe un resumen de MÁXIMO 5 PALABRAS EN TOTAL, contando "tu"/"tus", que empiece con "tu" o "tus" y use SOLO palabras que aparecen en esa línea (puedes omitir palabras; no agregues, no cambies ni conjugues ninguna; sin cifras). Ejemplo: "Coordinación de ferias gastronómicas regionales para pymes del sur." → "tus ferias para pymes" (4 palabras).
2. DEFINICIONES: para cada término, una definición neutra de MÁXIMO 12 PALABRAS, en lenguaje cotidiano. No hables de la persona (nada de "tú", "tu", "usted").
Responde SOLO con JSON: {"resumenes":[{"id":1,"resumen":"..."}],"definiciones":[{"termino":"...","definicion":"..."}]}`;

export function promptPrevias(resumenes: { id: number; linea: string }[], terminos: string[]): string {
  return `LÍNEAS:\n${resumenes.map(r => `${r.id}. ${r.linea}`).join("\n") || "(ninguna)"}\n\nTÉRMINOS:\n${terminos.map(t => `- ${t}`).join("\n") || "(ninguno)"}`;
}

export interface RespuestaModelo { resumenes?: { id: number; resumen: string }[]; definiciones?: { termino: string; definicion: string }[] }

// Pedido al modelo para un informe (o null si no hace falta llamar).
export function pedidoModelo(informe: InformeFit, jd: KeywordsJD, cv: string): { resumenes: { id: number; linea: string }[]; terminos: string[] } | null {
  const cands = seleccionarCandidatas(informe, jd, cv);
  const resumenes = cands.flatMap((p, i) => ((p.tipo === "area_cargo" || p.tipo === "semantico") && p.contexto ? [{ id: i + 1, linea: p.contexto }] : []));
  const terminos = cands.map(p => p.tipo === "anios_area" ? p.area ?? p.requisito : sinNivel(p.requisito))
    .filter(k => !definirDesdeGlosario(k) && esTecnico(k));
  return resumenes.length || terminos.length ? { resumenes, terminos } : null;
}

export async function llamarModelo(
  pedido: { resumenes: { id: number; linea: string }[]; terminos: string[] }, client?: Anthropic,
): Promise<{ respuesta: RespuestaModelo; usage: Anthropic.Usage }> {
  const c = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await c.messages.create(
    { model: MODELO_PREVIAS, max_tokens: 600, temperature: 0, system: SYSTEM_PREVIAS, messages: [{ role: "user", content: promptPrevias(pedido.resumenes, pedido.terminos) }] },
    { timeout: 30_000, maxRetries: 1 },
  );
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  let respuesta: RespuestaModelo = {};
  try { const m = raw.match(/\{[\s\S]*\}/); respuesta = m ? JSON.parse(m[0]) : {}; } catch { /* plantillas */ }
  return { respuesta, usage: res.usage };
}

// ─── análisis ────────────────────────────────────────────────────────────────

// Arma las preguntas con la respuesta del modelo (o sin ella: solo plantillas y glosario).
export function armarPreguntas(informe: InformeFit, jd: KeywordsJD, cv: string, respuesta: RespuestaModelo = {}): AnalisisPrevio {
  const preguntas: PreguntaPrevia[] = [];
  seleccionarCandidatas(informe, jd, cv).forEach((p, i) => {
    const id = i + 1;
    const propuesto = respuesta.resumenes?.find(r => Number(r.id) === id)?.resumen?.trim();
    // Sin recortes: un resumen que no es válido tal cual se descarta (plantilla genérica y destino Conocimientos).
    const resumen = propuesto && p.contexto && resumenValido(propuesto, p.contexto) ? propuesto : undefined;
    // Con resumen si cabe en el objetivo de palabras; si no, la plantilla sin resumen.
    // Con resumen solo si la pregunta completa cabe en PALABRAS_OBJETIVO; si no, la plantilla genérica.
    const conResumen = resumen ? plantilla(p, resumen) : null;
    const opciones = [conResumen && contarPalabras(conResumen) <= PALABRAS_OBJETIVO ? conResumen : null, plantilla(p)]
      .filter((t): t is string => !!t && preguntaValida(t));
    const texto = opciones.find(t => contarPalabras(t) <= PALABRAS_OBJETIVO) ?? opciones[0];
    if (!texto) return; // ni la plantilla cabe en el tope: la pregunta no se hace
    const keyword = p.tipo === "anios_area" ? p.area ?? p.requisito : sinNivel(p.requisito);
    const delModelo = respuesta.definiciones?.find(d => normalizarParaComparar(d.termino ?? "") === normalizarParaComparar(keyword))?.definicion?.trim();
    const definicion = definirDesdeGlosario(keyword)
      ?? (delModelo && definicionValida(delModelo) ? { termino: keyword, texto: delModelo, revisar: true } : undefined);
    preguntas.push({
      id, keyword, tipo: p.tipo, impacto: p.impacto, texto, palabras: contarPalabras(texto),
      ...(p.contexto ? { contexto: p.contexto } : {}),
      ...(resumen && texto.includes(mayuscula(resumen)) ? { resumen } : {}),
      // Un "sí" solo va a una viñeta si la pregunta la nombró (resumen de la línea, o el puesto en años en el área);
      // a una pregunta genérica le corresponde "Conocimientos:".
      destino: (resumen && texto.includes(mayuscula(resumen))) || p.tipo === "anios_area" ? destinoDe(p, cv) : { tipo: "habilidades" },
      ...(definicion ? { definicion } : {}),
    });
  });
  return { preguntas };
}

// ─── respuestas ──────────────────────────────────────────────────────────────

export type Respuesta = "si" | "no" | "no_se";

export interface HechoDeclarado {
  texto: string;   // la declaración: fuente válida para el reescritor y el validador
  keyword: string;
  destino: Destino;
  origen: "usuario";
  herramienta: boolean; // con destino habilidades: a la línea de habilidades técnicas; si no, a "Conocimientos:"
}

export function aplicarRespuestas(analisis: AnalisisPrevio, respuestas: Record<number, Respuesta>): { hechos: HechoDeclarado[]; porRevisar: string[] } {
  const hechos: HechoDeclarado[] = [];
  const porRevisar: string[] = [];
  for (const p of analisis.preguntas) {
    const r = respuestas[p.id];
    if (r === "no_se") porRevisar.push(p.keyword);
    if (r !== "si") continue;
    // Solo la keyword y la línea a la que se refiere: nunca nivel, años ni cifras.
    const sobre = p.destino.tipo === "vineta" ? ` sobre «${sinVineta(p.destino.linea)}»` : "";
    hechos.push({
      texto: `Declarado por la persona${sobre}: ${p.keyword}`, keyword: p.keyword, destino: p.destino, origen: "usuario",
      herramienta: p.tipo === "herramienta" || esHerramienta(p.keyword),
    });
  }
  return { hechos, porRevisar };
}

// Mapeo con los hechos declarados: la keyword deja de ser brecha y pasa a match directo con origen "usuario";
// un requisito de años en el área declarado pasa a cumplido.
export function mapeoConDeclaraciones(mapeo: ResultadoMapeo, hechos: HechoDeclarado[]): ResultadoMapeo {
  const mismas = (a: string, b: string) => normalizarParaComparar(a) === normalizarParaComparar(b);
  const declarados: MatchDirecto[] = hechos.filter(h => !esCarrera(h.keyword)).map(h => ({
    competencia_cv: h.texto, keyword_jd: h.keyword, relevancia: 0.95, origen: "usuario", cita: h.texto,
    tipo: mapeo.gap_keywords.find(g => mismas(g.keyword, h.keyword))?.tipo ?? "requerido",
  }));
  return {
    ...mapeo,
    matches_directos: [...mapeo.matches_directos, ...declarados.filter(d => mapeo.gap_keywords.some(g => mismas(g.keyword, d.keyword_jd)))],
    gap_keywords: mapeo.gap_keywords.filter(g => !hechos.some(h => mismas(h.keyword, g.keyword))),
    requisitos: mapeo.requisitos?.map(q => {
      const h = hechos.find(h => q.clase === "experiencia" && q.estado === "no_cumple" && normalizarParaComparar(q.descripcion).endsWith(normalizarParaComparar(h.keyword)));
      return h ? { ...q, estado: "cumple" as const, detalle: `${q.detalle} · declarado por ti` } : q;
    }),
  };
}

// Línea de habilidades técnicas (herramientas) y de conocimientos del CV.
const RE_TECNICAS = /^\s*(?:[-•]\s*)?(t[eé]cnicas|herramientas|habilidades t[eé]cnicas|software)\s*:/i;
const RE_CONOCIMIENTOS = /^\s*(?:[-•]\s*)?conocimientos\s*:/i;

// Agrega en código (sin modelo) los hechos con destino "habilidades": las herramientas a la línea de habilidades
// técnicas (si existe) y lo demás a una línea "Conocimientos:" (existente o nueva, después de la última línea de
// habilidades/expertise, o al final).
export function agregarConocimientos(cv: string, hechos: HechoDeclarado[]): string {
  const aHabilidades = hechos.filter(h => h.destino.tipo === "habilidades");
  if (aHabilidades.length === 0) return cv;
  const lineas = cv.split("\n");
  const agregarA = (i: number, items: string[]) => { lineas[i] = lineas[i].replace(/\s*\.?\s*$/, "") + ", " + items.join(", "); };
  const tecnicas = lineas.findIndex(l => RE_TECNICAS.test(l));
  const herramientas = tecnicas >= 0 ? aHabilidades.filter(h => h.herramienta).map(h => h.keyword) : [];
  if (herramientas.length) agregarA(tecnicas, herramientas);
  const resto = aHabilidades.filter(h => !herramientas.includes(h.keyword)).map(h => h.keyword);
  if (resto.length === 0) return lineas.join("\n");
  const conocimientos = lineas.findIndex(l => RE_CONOCIMIENTOS.test(l));
  if (conocimientos >= 0) { agregarA(conocimientos, resto); return lineas.join("\n"); }
  const ancla = lineas.map((l, k) => (/^\s*(?:[-•]\s*)?(áreas de expertise|blandas|t[eé]cnicas|habilidades)\b/i.test(l) ? k : -1)).filter(k => k >= 0).pop();
  const nueva = `Conocimientos: ${resto.join(", ")}`;
  if (ancla === undefined) return [...lineas, "", nueva].join("\n");
  lineas.splice(ancla + 1, 0, nueva);
  return lineas.join("\n");
}

// Inserta en código (sin modelo) cada keyword declarada para una viñeta, entre paréntesis al final de la primera
// cláusula (antes de la primera coma) o, sin coma, al final: "…en los últimos 12 meses (procesos de RRHH), reduciendo…";
// "…para Hellmann's (Trade Marketing).". Nada más cambia en la línea.
export function insertarEnVinetas(cv: string, hechos: HechoDeclarado[]): string {
  const porLinea = new Map<string, string[]>();
  for (const h of hechos) if (h.destino.tipo === "vineta") porLinea.set(h.destino.linea, [...(porLinea.get(h.destino.linea) ?? []), h.keyword]);
  return cv.split("\n").map(l => {
    const kws = porLinea.get(l);
    if (!kws) return l;
    const coma = l.search(/,\s/);
    if (coma >= 0) return `${l.slice(0, coma)} (${kws.join(", ")})${l.slice(coma)}`;
    const m = l.match(/^(.*?)(\.?)(\s*)$/)!;
    return `${m[1]} (${kws.join(", ")})${m[2]}${m[3]}`;
  }).join("\n");
}

// CV con todas las respuestas aplicadas: viñetas con paréntesis y habilidades/conocimientos.
export function cvConDeclaraciones(cv: string, hechos: HechoDeclarado[]): string {
  return agregarConocimientos(insertarEnVinetas(cv, hechos), hechos);
}

// Palabras de contenido (para el chequeo de "0 mentiras" del eval).
export const palabrasSignificativas = (t: string) => palabrasDe(t).filter(p => !STOP_WORDS_MATCH.has(p) && p.length > 1);

/**
 * Informe de fit y brechas para el usuario (PED-33). Sin API: usa el mapeo (literal + semántico), los requisitos
 * estructurados, scoreV2 y alertaNivel que ya existen.
 *
 * Calibración (reglas fijadas antes de mirar resultados; pesos y umbrales de scoreV2 sin cambios):
 * - Normativa: además de lo que ya es preguntable en clasificarBrecha, son preguntables subcontratación,
 *   fiscalizaciones, procesos disciplinarios, jornadas excepcionales y cualquier "Ley …".
 * - Prácticas: si el nivel es practicante, las funciones del cargo son preguntables (aprendibles). Carrera y
 *   requisitos estructurados siguen igual.
 * - Área del cargo: si la brecha es el área del título del cargo ("Trade Marketing" en "Practicante de Trade
 *   Marketing"), nunca es bloqueante: es "preguntable con contexto".
 *
 * Parte 2 (vista del usuario):
 * - Máximo MAX_PREGUNTAS preguntas visibles, por relevancia en la oferta; el resto en otras_preguntas.
 * - Prácticas: las funciones del cargo van a "aprenderas_en_el_cargo" (no son preguntas). Habilidades blandas van a
 *   "para_la_entrevista". Ambas cuentan como preguntables en el score.
 * - Conceptos financieros (P&L, EBITDA, balance, flujo de caja, KPI) son preguntas de conocimiento, no herramientas.
 * - Una brecha con propuesta semántica rechazada cuya cita existe literal en el CV pasa a pregunta con contexto.
 * - Los matches relacionados no son "cumples": van a "relacionado", con la advertencia de no agregar lo que no se hizo.
 *
 * PED-36 (fit justo):
 * - Si la keyword del área del cargo calza con match DIRECTO, las brechas de función pasan a preguntables (50% en el
 *   score) y van plegadas en otras_preguntas. No aplica a herramientas, carreras, años, normativa ni idiomas.
 * - Años en el área no cumplidos con años totales suficientes: pregunta con contexto (el puesto no contado), 50%.
 * - consejo_brecha: periodos de 6+ meses sin puesto (entre puestos o hasta hoy). No cambia el score.
 *
 * Honestidad: nada de lo que no está en el CV se sugiere como afirmación; va como pregunta condicional
 * ("¿Has trabajado con X? Si es así, agrégalo al CV"). Las etiquetas del priorizador solo pueden dar contexto
 * a una pregunta ("¿Tus activaciones de marca… fueron trabajo de trade marketing?").
 */
import { matcheaPalabra, normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { esEncabezado } from "./cv-verificacion";
import {
  alertaNivel, aniosDeExperiencia, puestoComparteArea, type ResultadoRequisito, esCarrera, pareceHerramienta, puestosCV, RAICES_GENERICAS, RE_NORMATIVA, RE_SECTOR,
  PESO_REQUISITO, RE_SOFTWARE, scoreV2, clasificarBrecha, type AlertaNivel, type ClaseFit, type KeywordsJD, type ResultadoMapeo,
} from "./mapeo-semantico";
import type { EtiquetasOrden } from "./priorizador";
import { keywordDelCargo } from "./jd-parser";

export type ClaseBrechaInforme = "bloqueante" | "preguntable" | "preguntable_contexto";
type TipoPregunta = "normativa" | "herramienta" | "oficina" | "idioma" | "concepto" | "sector" | "funcion" | "blanda" | "area_cargo" | "semantico" | "carrera_afin" | "subtarea" | "anios_area";

export interface Cumple { requisito: string; evidencia: string }
export interface Relacionado { requisito: string; evidencia: string; texto: string }
export interface Bloqueante { requisito: string; texto: string }
export interface Pregunta { requisito: string; tipo: TipoPregunta; relevancia: number; texto: string }
export interface SugerenciaLimpieza { tema: "nacimiento" | "estado_civil" | "hijos" | "anios_perfil"; linea: string; texto: string }

export interface InformeFit {
  fit: { clase: ClaseFit; score: number; frase: string };
  cumples: Cumple[];
  relacionado: Relacionado[];
  bloqueantes: Bloqueante[];
  preguntas: Pregunta[];        // visibles, máximo MAX_PREGUNTAS
  otras_preguntas: Pregunta[];  // plegadas
  aprenderas_en_el_cargo: string | null;
  para_la_entrevista: string[];
  consejo_brecha: string[];
  alerta: { nivel: AlertaNivel; texto: string | null };
  limpieza: SugerenciaLimpieza[];
}

// Propuesta semántica que los filtros rechazaron (evals/semantico/ o mapearSemantico): solo sirve de contexto de pregunta.
export interface PropuestaRechazada { keyword: string; cita: string }

export interface InputInforme {
  cv: string;
  mapeo: ResultadoMapeo;
  keywordsJD: KeywordsJD;
  nivelPosicion?: string;
  cargo?: string;
  etiquetas?: EtiquetasOrden;           // solo contexto de preguntas
  rechazadas?: PropuestaRechazada[];    // solo contexto de preguntas; la cita debe existir literal en el CV
}

export const MAX_PREGUNTAS = 5;

// ─── clasificación calibrada ─────────────────────────────────────────────────

const RE_NORMATIVA_EXTRA = /\b(ley|subcontrat\w*|fiscalizacion\w*|disciplinari\w*|jornadas? excepcional\w*)\b/;
const RE_BLANDA = /\b(actitud|adaptabilidad|orientacion al servicio|proactiv\w*|trabajo en equipo|comunicacion|disposicion|tareas operativas|iniciativa|responsabilidad)\b/;
// PED-35: idiomas preguntables; normas y estándares son normativa; herramientas genéricas de oficina no generan pregunta.
const RE_IDIOMA = /\b(english|ingles|portugues|portuguese|frances|french|aleman|german|italiano|italian|mandarin|chino)\b/;
const RE_ESTANDAR = /\b(soc ?2|iso ?\d*|gdpr|hipaa|pci( dss)?|sox)\b/;
const RE_OFICINA = /\b(google drive|drive|gmail|zoom|teams|microsoft teams|google meet|outlook|slack)\b/;
// Herramientas conocidas de RRHH, ERP y oficina (PED-36): no son siglas ni camelCase, pero son herramientas.
const RE_HERRAMIENTA_CONOCIDA = /\b(buk|talana|rex|softland|payroll|sap|meta4|oracle|workday|peoplesoft|successfactors|adp|nubox|defontana|zenda|excel|power bi|tableau|google sheets)\b/;
const RE_CONCEPTO = /(p&l|\bebitda\b|\bbalance\b|flujo de caja|\bkpis?\b|estado de resultados|\bcontabilidad\b)/i;

const singular = (p: string) => p.replace(/ciones$/, "cion").replace(/([aeiou])s$/, "$1");
const palabras = (t: string) => normalizarParaComparar(t).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p)).map(singular);
const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();
const mismaKeyword = (a: string, b: string) => normalizarParaComparar(a) === normalizarParaComparar(b);

// La keyword es el área del título del cargo: todas sus palabras están en el cargo y alguna no es genérica
// ni el nivel ("practicante", "jefe").
function esAreaDelCargo(keyword: string, cargo?: string): boolean {
  if (!cargo) return false;
  const c = new Set(palabras(cargo));
  const k = palabras(keyword);
  const propias = k.filter(p => !RAICES_GENERICAS.has(p.slice(0, 5)) && !/^(practicante|jefe|jefa|gerente|asistente|analista|especialista|associate)$/.test(p));
  return k.length > 0 && propias.length > 0 && k.every(p => c.has(p));
}

function tipoDeBrecha(keyword: string): TipoPregunta | null {
  const n = normalizarParaComparar(keyword);
  if (RE_BLANDA.test(n)) return "blanda";
  if (RE_IDIOMA.test(n)) return "idioma";
  if (RE_ESTANDAR.test(n)) return "normativa";
  if (RE_OFICINA.test(n)) return "oficina";
  if (RE_HERRAMIENTA_CONOCIDA.test(n)) return "herramienta";
  if (RE_CONCEPTO.test(keyword)) return "concepto";
  if (RE_NORMATIVA.test(n) || RE_NORMATIVA_EXTRA.test(n)) return "normativa";
  if (RE_SOFTWARE.test(n) || pareceHerramienta(keyword)) return "herramienta";
  if (RE_SECTOR.test(n)) return "sector";
  return null;
}

export interface ContextoClasificacion {
  nivelPosicion?: string; cargo?: string; conCita?: (keyword: string) => boolean;
  areaCalza?: boolean; // la keyword del área del cargo tiene match directo (PED-36)
}

export function clasificarParaInforme(keyword: string, ctx: ContextoClasificacion = {}): { clase: ClaseBrechaInforme; tipo: TipoPregunta | null } {
  if (esCarrera(keyword)) return { clase: "bloqueante", tipo: null };
  if (esAreaDelCargo(keyword, ctx.cargo)) return { clase: "preguntable_contexto", tipo: "area_cargo" };
  const tipo = tipoDeBrecha(keyword);
  if (tipo === "blanda") return { clase: "preguntable", tipo };
  if (ctx.conCita?.(keyword)) return { clase: "preguntable_contexto", tipo: "semantico" };
  if (tipo) return { clase: "preguntable", tipo };
  if (clasificarBrecha(keyword) === "preguntable") return { clase: "preguntable", tipo: "herramienta" };
  if (ctx.nivelPosicion?.toLowerCase() === "practicante") return { clase: "preguntable", tipo: "funcion" };
  if (ctx.areaCalza) return { clase: "preguntable", tipo: "subtarea" };
  return { clase: "bloqueante", tipo: null };
}

// ─── evidencia ───────────────────────────────────────────────────────────────

const lineasCV = (cv: string) => cv.split("\n").map(l => l.trim()).filter(l => l && !esEncabezado(l));

// Fragmento del CV que respalda alguna de las frases: la cláusula (entre comas, puntos o dos puntos) de la primera
// línea que contiene todas sus palabras significativas; si ninguna cláusula las tiene todas, la línea completa.
// `foco`: las palabras que respaldan, para centrar el recorte.
function lineaQueContiene(cv: string, frases: string[], preferir?: RegExp): { texto: string; foco: string[] } | undefined {
  const todas = lineasCV(cv);
  const lineas = preferir ? [...todas.filter(l => preferir.test(l)), ...todas.filter(l => !preferir.test(l))] : todas;
  for (const f of frases) {
    const k = normalizarParaComparar(f).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p));
    if (k.length === 0) continue;
    const tiene = (t: string) => k.every(p => matcheaPalabra(p, normalizarParaComparar(t)));
    const l = lineas.find(tiene);
    if (l) return { texto: l.split(/(?<=[,;:.])\s+/).map(c => c.replace(/[,;:.]$/, "")).find(tiene) ?? l, foco: k };
  }
  return undefined;
}

// Recorta a `max` caracteres; si hay foco, centra la ventana en la primera palabra del texto que calza con él.
const recortar = (s: string, max = 140, foco: string[] = []) => {
  const t = s.replace(/^[-•]\s*/, "").trim();
  if (t.length <= max) return t;
  let centro = 0;
  for (const m of t.matchAll(/\S+/g)) {
    const w = normalizarParaComparar(m[0]);
    if (foco.some(f => w && (w.startsWith(f.slice(0, 5)) || f.startsWith(w)) && w.length >= 2)) { centro = m.index!; break; }
  }
  let ini = Math.max(0, Math.min(centro - Math.floor(max / 3), t.length - max));
  if (ini > 0) { const esp = t.indexOf(" ", ini); ini = esp >= 0 && esp < centro ? esp + 1 : ini; }
  let fin = Math.min(t.length, ini + max);
  if (fin < t.length) { const esp = t.lastIndexOf(" ", fin); fin = esp > centro ? esp : fin; }
  return `${ini > 0 ? "…" : ""}${t.slice(ini, fin).trim()}${fin < t.length ? "…" : ""}`;
};

// Para citas dentro de preguntas: la(s) cláusula(s) completa(s) (entre comas, puntos o dos puntos) de la línea del
// CV que contienen el fragmento. Si pasan de MAX_CITA_PREGUNTA, queda solo la cláusula con más solapamiento: el corte
// siempre cae en un límite de cláusula, nunca a mitad de frase.
const MAX_CITA_PREGUNTA = 120;
function clausulaCompleta(cv: string, fragmento: string): string {
  const frag = colapsar(fragmento);
  const linea = cv.split("\n").map(l => colapsar(l.replace(/^\s*[-•]\s*/, ""))).find(l => l.includes(frag));
  if (!linea) return frag;
  const ini = linea.indexOf(frag), fin = ini + frag.length;
  const clausulas: { a: number; b: number }[] = [];
  let a = 0;
  for (const m of linea.matchAll(/[,;:.](?=\s|$)/g)) { clausulas.push({ a, b: m.index! }); a = m.index! + 1; }
  if (a < linea.length) clausulas.push({ a, b: linea.length });
  const toca = clausulas.filter(c => c.b > ini && c.a < fin);
  const texto = (cs: typeof clausulas) => linea.slice(cs[0].a, cs[cs.length - 1].b).trim();
  if (toca.length === 0) return frag;
  if (texto(toca).length <= MAX_CITA_PREGUNTA || toca.length === 1) return texto(toca);
  const solape = (c: { a: number; b: number }) => Math.min(c.b, fin) - Math.max(c.a, ini);
  return texto([toca.reduce((x, y) => (solape(y) > solape(x) ? y : x))]);
}

const evidencia = (e: { texto: string; foco: string[] }) => `«${recortar(e.texto, 140, e.foco)}»`;

// ─── informe ─────────────────────────────────────────────────────────────────

export function informeFit(input: InputInforme): InformeFit {
  const { cv, mapeo, keywordsJD: jd, nivelPosicion, cargo, etiquetas } = input;
  const cvPlano = colapsar(cv);
  const citaDe = (k: string) => (input.rechazadas ?? []).find(r => mismaKeyword(r.keyword, k) && r.cita && cvPlano.includes(colapsar(r.cita)))?.cita;
  // Área del cargo: la keyword que el parser deriva del título ("Reclutador Masivo" → "reclutamiento masivo").
  const kwCargo = cargo ? keywordDelCargo(cargo, normalizarParaComparar(cargo)) : null;
  const areaCalza = !!kwCargo && mapeo.matches_directos.some(m => mismaKeyword(m.keyword_jd, kwCargo));
  const ctx: ContextoClasificacion = { nivelPosicion, cargo, conCita: k => !!citaDe(k), areaCalza };
  const clasif = (k: string) => clasificarParaInforme(k, ctx);
  const puestos = puestosCV(cv);
  const aniosTotales = aniosDeExperiencia(puestos);
  // Años en el área no cumplidos, pero los años totales alcanzan: se pregunta por los puestos no contados (PED-36).
  // Solo si algún puesto no contado comparte una palabra propia del área; si no, sigue siendo brecha.
  const areaDe = (q: ResultadoRequisito) => q.descripcion.replace(/^\d+(\.\d+)? años en /, "");
  const noContados = (q: ResultadoRequisito) => { const c = new Set(q.puestos ?? []); return puestos.filter(p => !c.has(p.titulo)); };
  const candidatos = (q: ResultadoRequisito) => noContados(q).filter(p => puestoComparteArea(p, areaDe(q)));
  const aniosPreguntable = (q: ResultadoRequisito) => q.clase === "experiencia" && q.estado === "no_cumple"
    && /del área/.test(q.detalle) && aniosTotales >= Number(q.descripcion.match(/^\d+(\.\d+)?/)?.[0] ?? Infinity)
    && candidatos(q).length > 0;
  const v2 = scoreV2(mapeo, jd, k => (clasif(k).clase === "bloqueante" ? "bloqueante" : "preguntable"), aniosPreguntable);

  const relevancia = new Map(jd.requeridas.map(k => [k.keyword, k.relevancia]));
  const cumples: Cumple[] = [];
  const relacionado: Relacionado[] = [];
  const bloqueantes: Bloqueante[] = [];
  const preguntas: Pregunta[] = [];
  const funciones: string[] = [];
  const blandas: string[] = [];
  const subtareas: Pregunta[] = []; // PED-36: siempre plegadas

  // Directos → cumples; relacionados → "relacionado". Sin evidencia en el CV no se muestran.
  const vistas = new Set<string>();
  for (const [m, nivel] of [...mapeo.matches_directos.map(m => [m, "directo"] as const), ...mapeo.matches_relacionados.map(m => [m, "relacionado"] as const)]) {
    if (!relevancia.has(m.keyword_jd) || vistas.has(m.keyword_jd)) continue;
    vistas.add(m.keyword_jd);
    const e = m.cita ? { texto: m.cita, foco: [] } : lineaQueContiene(cv, [m.keyword_jd, m.competencia_cv]);
    if (!e) continue;
    if (nivel === "directo") cumples.push({ requisito: m.keyword_jd, evidencia: evidencia(e) });
    else {
      const x = recortar(e.texto, 140, e.foco);
      relacionado.push({
        requisito: m.keyword_jd, evidencia: `«${x}»`,
        texto: `Tu «${x}» se relaciona con ${m.keyword_jd}, que pide la oferta. Si de verdad tienes experiencia en ${m.keyword_jd}, nómbralo así; si no, no lo agregues.`,
      });
    }
  }

  // Requisitos estructurados.
  let carreraCumple = false, aniosCumple: boolean | null = null;
  const carrerasCumplidas: string[] = []; // carreras de requisitos ya cumplidos: sus alternativas no son brecha
  const reqs = (mapeo.requisitos ?? []).filter(q => q.tipo === "requerido");
  for (const q of reqs) {
    // Área genérica (sin puestos filtrados por área): "10 años de experiencia profesional".
    const desc = q.clase === "experiencia" && !/del área/.test(q.detalle)
      ? `${q.descripcion.match(/^\d+(\.\d+)?/)?.[0]} años de experiencia profesional`
      : q.descripcion;
    if (q.clase === "experiencia") {
      aniosCumple = (aniosCumple ?? true) && q.estado === "cumple";
      if (q.estado === "cumple") {
        // Solo los puestos que se contaron para el requisito (PED-35).
        const contados = q.puestos ?? puestos.map(p => p.titulo);
        const t = (titulo: string) => `«${recortar(titulo, 80)}»`;
        const rango = contados.length > 1 ? `desde ${t(contados[0])} hasta ${t(contados[contados.length - 1])}` : contados[0] ? t(contados[0]) : "";
        cumples.push({ requisito: desc, evidencia: `${q.detalle}: ${rango}` });
      } else if (aniosPreguntable(q)) {
        const otros = candidatos(q).map(p => cargoDelPuesto(p)).slice(-2).reverse();
        const area = areaDe(q);
        preguntas.push({
          requisito: desc, tipo: "anios_area", relevancia: PESO_REQUISITO,
          texto: `¿Tu trabajo como ${otros.join(" o como ")} fue de ${area}? Si lo fue, deja claro en el CV qué hiciste en esa área.`,
        });
      } else {
        bloqueantes.push({ requisito: desc, texto: `La oferta pide ${desc}; según las fechas de tu CV llevas ${q.detalle.replace(/ en el CV.*/, "")}${/del área/.test(q.detalle) ? " en esa área" : ""}.` });
      }
    } else {
      const carreras = q.descripcion.replace(/ \(o afín\)$/, "").split(" / ");
      // La línea del título (universidad o instituto) antes que una mención en el perfil.
      const e = lineaQueContiene(cv, carreras, /universidad|instituto/i);
      if (q.estado === "cumple" && e) {
        carreraCumple = true;
        carrerasCumplidas.push(...carreras);
        cumples.push({ requisito: `Carrera: ${q.descripcion}`, evidencia: evidencia(e) });
      } else if (q.estado === "afin_a_revisar") {
        preguntas.push({ requisito: q.descripcion, tipo: "carrera_afin", relevancia: PESO_REQUISITO, texto: `¿Tu carrera es afín a ${carreras.join(" / ")}? La oferta acepta carreras afines: si la tuya lo es, deja clara la carrera en el CV.` });
      } else {
        bloqueantes.push({ requisito: q.descripcion, texto: `La oferta pide ${q.descripcion} y tu CV no menciona esa carrera.` });
      }
    }
  }
  if (!carreraCumple) carreraCumple = cumples.some(c => esCarrera(c.requisito));

  // Brechas de keywords requeridas.
  for (const { keyword } of mapeo.gap_keywords.filter(g => g.tipo === "requerido")) {
    // Con el requisito de carreras cumplido, una keyword con forma de carrera que no está entre sus alternativas es
    // conocimiento ("fundamentos de contabilidad"), no carrera: nunca es brecha; si es un concepto, se pregunta.
    if (esCarrera(keyword) && carrerasCumplidas.length > 0) {
      if (!carrerasCumplidas.some(c => mismaKeyword(c, keyword)) && RE_CONCEPTO.test(keyword)) {
        preguntas.push({ requisito: keyword, tipo: "concepto", relevancia: relevancia.get(keyword) ?? 0, texto: redactarPregunta(keyword, "concepto", cv) });
      }
      continue;
    }
    const { clase, tipo } = clasif(keyword);
    if (clase === "bloqueante") {
      bloqueantes.push({ requisito: keyword, texto: esCarrera(keyword) ? `La oferta pide la carrera ${keyword} y tu CV no la menciona.` : `La oferta pide ${keyword} y tu CV no lo muestra.` });
    } else if (tipo === "funcion") funciones.push(keyword);
    else if (tipo === "blanda") blandas.push(keyword);
    else if (tipo === "oficina") continue; // preguntable en el score, pero no vale una pregunta
    else if (tipo === "subtarea") subtareas.push({ requisito: keyword, tipo, relevancia: relevancia.get(keyword) ?? 0, texto: redactarPregunta(keyword, tipo, cv) });
    else preguntas.push({ requisito: keyword, tipo: tipo!, relevancia: relevancia.get(keyword) ?? 0, texto: redactarPregunta(keyword, tipo!, cv, etiquetas, citaDe(keyword)) });
  }
  preguntas.sort((a, b) => b.relevancia - a.relevancia); // estable: empates en orden de la oferta

  // Frase de fit.
  const kwReq = jd.requeridas.filter(k => !esCarrera(k.keyword));
  const kwCumplidas = kwReq.filter(k => cumples.some(c => c.requisito === k.keyword)).length;
  const partes: string[] = [];
  if (carreraCumple) partes.push("la carrera");
  if (aniosCumple) partes.push("los años de experiencia");
  const ratio = kwReq.length ? kwCumplidas / kwReq.length : 0;
  if (ratio >= 0.7) partes.push("las funciones centrales");
  else if (kwCumplidas > 0) partes.push(`${kwCumplidas} de ${kwReq.length} requisitos del cargo`);
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const faltas: string[] = [];
  if (bloqueantes.length) faltas.push(plural(bloqueantes.length, "requisito que tu CV no muestra", "requisitos que tu CV no muestra"));
  if (preguntas.length) faltas.push(plural(preguntas.length, "punto por confirmar", "puntos por confirmar"));
  const lista = (xs: string[]) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
  const unaSola = faltas.length === 1 && (bloqueantes.length + preguntas.length) === 1;
  const verbo = partes.length ? (unaSola ? "te queda" : "te quedan") : "hay";
  const inicio = partes.length ? `Cumples ${lista(partes)}` : "Tu CV todavía no muestra los requisitos centrales de esta oferta";
  const frase = `${inicio}${faltas.length ? `; ${verbo} ${lista(faltas)}` : ""}.`;

  // Alerta de nivel: información, no resta.
  const a = alertaNivel(cv, jd, nivelPosicion);
  const nivelTxt = nivelPosicion ? `un cargo de nivel ${nivelPosicion}` : "este cargo";
  const alerta = {
    nivel: a.alerta,
    texto: a.alerta === "sobrecalificado"
      ? `Tus ${a.anios_cv} años de experiencia superan lo que suele pedir ${nivelTxt}. No resta puntos: es para que lo consideres (sueldo, expectativas) al postular.`
      : a.alerta === "subcalificado"
        ? `Tus ${a.anios_cv} años de experiencia están bajo lo que pide ${nivelTxt}. No resta puntos: es para que lo tengas en cuenta al postular.`
        : null,
  };

  return {
    fit: { clase: v2.clase, score: v2.score, frase },
    cumples, relacionado, bloqueantes,
    preguntas: preguntas.slice(0, MAX_PREGUNTAS), otras_preguntas: [...preguntas.slice(MAX_PREGUNTAS), ...subtareas],
    aprenderas_en_el_cargo: funciones.length ? `Funciones que se aprenden en la práctica: ${funciones.join(", ")}.` : null,
    para_la_entrevista: blandas.map(b => `La oferta valora ${b}: muéstralo con un ejemplo en la entrevista o en tu carta.`),
    consejo_brecha: consejoBrecha(cv),
    alerta, limpieza: limpiezaCV(cv),
  };
}

function redactarPregunta(keyword: string, tipo: TipoPregunta, cv: string, etiquetas?: EtiquetasOrden, cita?: string): string {
  const si = "Si es así, agrégalo al CV.";
  switch (tipo) {
    case "normativa":
    case "concepto": return `¿Has trabajado con ${keyword}? ${si}`;
    case "herramienta": return `¿Has usado ${keyword}? ${si}`;
    case "idioma": return `¿Manejas ${keyword} a nivel de trabajo? Si es así, agrégalo al CV con tu nivel.`;
    case "sector": return `¿Tienes experiencia en ${keyword.replace(/^experiencia en\s+/i, "")}? ${si}`;
    case "subtarea": return `¿Tu experiencia incluye ${keyword}? Si es así, agrégalo al CV.`;
    case "funcion": return `¿Has hecho ${keyword} en algún trabajo, práctica o proyecto? ${si}`;
    case "semantico": return `¿Tu «${clausulaCompleta(cv, cita!)}» cuenta como ${keyword}? Si es así, nómbralo así en el CV.`;
    case "area_cargo": {
      // Contexto: la viñeta que el priorizador etiquetó con esta keyword (solo para preguntar).
      const lineas = cv.split("\n");
      const idx = Object.entries(etiquetas ?? {}).find(([, kws]) => kws.includes(keyword))?.[0];
      const linea = idx !== undefined ? lineas[Number(idx)] : undefined;
      if (linea) return `¿Tu experiencia en «${clausulaCompleta(cv, linea.replace(/^\s*[-•]\s*/, "").trim())}» fue trabajo de ${keyword}? Si es así, nómbralo así en el CV.`;
      return `¿Has hecho trabajo de ${keyword}, aunque no se llamara así? ${si}`;
    }
    default: return `¿Tienes ${keyword}? ${si}`;
  }
}

// "Analista de Procesos e Ingeniería — Manufactura Austral S.A. — 02/2017 – 02/2021" → "Analista de Procesos e Ingeniería".
const cargoDelPuesto = (p: { titulo: string }) => p.titulo.split(/\s+[—–|]\s+/)[0].trim();

// ─── brechas laborales (sin API, no cambian el score) ───────────────────────

export const MESES_BRECHA = 6;
// Solo puestos con mes en ambas fechas: con "2014 – 2017" no se sabe si hubo brecha.
const RE_MES = /\b\d{1,2}\/\d{4}\b|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b|a la fecha|presente|actualidad/g;
const conMeses = (titulo: string) => (titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(RE_MES) ?? []).length >= 2;

export function consejoBrecha(cv: string, ahora = new Date()): string[] {
  const mesAhora = ahora.getFullYear() * 12 + ahora.getMonth() + 1;
  const ps = puestosCV(cv, ahora).filter(p => conMeses(p.titulo)).sort((a, b) => a.inicio - b.inicio);
  const out: string[] = [];
  let hasta = -Infinity, anterior: typeof ps[number] | null = null;
  for (const p of ps) {
    const meses = p.inicio - hasta - 1;
    if (anterior && meses >= MESES_BRECHA) {
      out.push(`Entre tu trabajo como ${cargoDelPuesto(anterior)} y el de ${cargoDelPuesto(p)} hay ~${meses} meses sin puesto. Si te lo preguntan, basta una explicación breve (estudios, cuidado familiar, búsqueda) y lo que hiciste en ese tiempo.`);
    }
    if (p.fin > hasta) { hasta = p.fin; anterior = p; }
  }
  const desdeUltimo = mesAhora - hasta;
  if (anterior && desdeUltimo >= MESES_BRECHA) {
    out.push(`Llevas ~${desdeUltimo} meses desde tu último trabajo. Es más común de lo que parece: prepara una explicación breve (estudios, cuidado familiar, búsqueda) y menciona lo que hiciste en ese tiempo.`);
  }
  return out;
}

// ─── limpieza del CV (sin API) ───────────────────────────────────────────────

const RE_NACIMIENTO = /(fecha de nac(imiento|\.)?\b|nacimiento\s*:|nacid[oa] el|\bedad\s*:|\b\d{2}\s*años de edad)/i;
const RE_ESTADO_CIVIL = /(estado civil|\b(solter|casad|divorciad|viud|separad)[oa]\b)/i;
const RE_HIJOS = /\bhij[oa]s?\b/i;
const RE_ANIOS_PERFIL = /(\d{1,2})\+?\s*años de (experiencia|trayectoria)/i;

export function limpiezaCV(cv: string): SugerenciaLimpieza[] {
  const out: SugerenciaLimpieza[] = [];
  const lineas = cv.split("\n").map(l => l.trim()).filter(Boolean);
  const buscar = (re: RegExp) => lineas.find(l => re.test(l));
  const nac = buscar(RE_NACIMIENTO);
  if (nac) out.push({ tema: "nacimiento", linea: nac, texto: "Quita la fecha de nacimiento o la edad: no la piden y puede generar sesgo por edad antes de que lean tu experiencia." });
  const civil = buscar(RE_ESTADO_CIVIL);
  if (civil) out.push({ tema: "estado_civil", linea: civil, texto: "Quita el estado civil: no aporta al cargo y puede generar sesgos." });
  const hijos = buscar(RE_HIJOS);
  if (hijos) out.push({ tema: "hijos", linea: hijos, texto: "Quita la información sobre hijos: es personal, no aporta al cargo y puede jugar en contra por sesgos." });
  const perfil = buscar(RE_ANIOS_PERFIL);
  if (perfil) {
    const declarados = Number(perfil.match(RE_ANIOS_PERFIL)![1]);
    const fechas = aniosDeExperiencia(puestosCV(cv));
    if (fechas > 0 && Math.abs(fechas - declarados) >= 3) {
      out.push({
        tema: "anios_perfil", linea: recortar(perfil, 140, [String(declarados)]),
        texto: `Tu perfil dice ${declarados} años, pero las fechas de tus puestos suman ~${Math.round(fechas)}. Un reclutador lo nota: alinea el número con las fechas (o aclara desde cuándo cuentas).`,
      });
    }
  }
  return out;
}

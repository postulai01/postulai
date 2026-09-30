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
 * Honestidad: nada de lo que no está en el CV se sugiere como afirmación; va como pregunta condicional
 * ("¿Has trabajado con X? Si es así, agrégalo al CV"). Las etiquetas del priorizador solo pueden dar contexto
 * a una pregunta ("¿Tus activaciones de marca… fueron trabajo de trade marketing?").
 */
import { matcheaPalabra, normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { esEncabezado } from "./cv-verificacion";
import {
  alertaNivel, aniosDeExperiencia, esCarrera, pareceHerramienta, puestosCV, RAICES_GENERICAS, RE_NORMATIVA, RE_SECTOR,
  RE_SOFTWARE, scoreV2, clasificarBrecha, type AlertaNivel, type ClaseFit, type KeywordsJD, type ResultadoMapeo,
} from "./mapeo-semantico";
import type { EtiquetasOrden } from "./priorizador";

export type ClaseBrechaInforme = "bloqueante" | "preguntable" | "preguntable_contexto";
type TipoPregunta = "normativa" | "herramienta" | "sector" | "funcion" | "area_cargo" | "carrera_afin";

export interface Cumple { requisito: string; evidencia: string }
export interface Bloqueante { requisito: string; texto: string }
export interface Pregunta { requisito: string; tipo: TipoPregunta; texto: string }
export interface SugerenciaLimpieza { tema: "nacimiento" | "estado_civil" | "hijos" | "anios_perfil"; linea: string; texto: string }

export interface InformeFit {
  fit: { clase: ClaseFit; score: number; frase: string };
  cumples: Cumple[];
  bloqueantes: Bloqueante[];
  preguntas: Pregunta[];
  alerta: { nivel: AlertaNivel; texto: string | null };
  limpieza: SugerenciaLimpieza[];
}

export interface InputInforme {
  cv: string;
  mapeo: ResultadoMapeo;
  keywordsJD: KeywordsJD;
  nivelPosicion?: string;
  cargo?: string;
  etiquetas?: EtiquetasOrden; // solo contexto de preguntas
}

// ─── clasificación calibrada ─────────────────────────────────────────────────

const RE_NORMATIVA_EXTRA = /\b(ley|subcontrat\w*|fiscalizacion\w*|disciplinari\w*|jornadas? excepcional\w*)\b/;

const singular = (p: string) => p.replace(/ciones$/, "cion").replace(/([aeiou])s$/, "$1");
const palabras = (t: string) => normalizarParaComparar(t).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p)).map(singular);

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
  if (RE_NORMATIVA.test(n) || RE_NORMATIVA_EXTRA.test(n)) return "normativa";
  if (RE_SOFTWARE.test(n) || pareceHerramienta(keyword)) return "herramienta";
  if (RE_SECTOR.test(n)) return "sector";
  return null;
}

export function clasificarParaInforme(keyword: string, nivelPosicion?: string, cargo?: string): { clase: ClaseBrechaInforme; tipo: TipoPregunta | null } {
  if (esCarrera(keyword)) return { clase: "bloqueante", tipo: null };
  if (esAreaDelCargo(keyword, cargo)) return { clase: "preguntable_contexto", tipo: "area_cargo" };
  const tipo = tipoDeBrecha(keyword);
  if (tipo) return { clase: "preguntable", tipo };
  if (clasificarBrecha(keyword) === "preguntable") return { clase: "preguntable", tipo: "herramienta" };
  if (nivelPosicion?.toLowerCase() === "practicante") return { clase: "preguntable", tipo: "funcion" };
  return { clase: "bloqueante", tipo: null };
}

// ─── evidencia ───────────────────────────────────────────────────────────────

const lineasCV = (cv: string) => cv.split("\n").map(l => l.trim()).filter(l => l && !esEncabezado(l));

// Fragmento del CV que respalda alguna de las frases: la cláusula (entre comas, puntos o dos puntos) de la primera
// línea que contiene todas sus palabras significativas; si ninguna cláusula las tiene todas, la línea completa.
function lineaQueContiene(cv: string, frases: string[]): string | undefined {
  const lineas = lineasCV(cv);
  for (const f of frases) {
    const k = normalizarParaComparar(f).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p));
    if (k.length === 0) continue;
    const tiene = (t: string) => k.every(p => matcheaPalabra(p, normalizarParaComparar(t)));
    const l = lineas.find(tiene);
    if (l) return l.split(/(?<=[,;:.])\s+/).map(c => c.replace(/[,;:.]$/, "")).find(tiene) ?? l;
  }
  return undefined;
}

const recortar = (s: string, max = 140) => {
  const t = s.replace(/^[-•]\s*/, "").trim();
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, "") + "…";
};

// ─── informe ─────────────────────────────────────────────────────────────────

export function informeFit(input: InputInforme): InformeFit {
  const { cv, mapeo, keywordsJD: jd, nivelPosicion, cargo, etiquetas } = input;
  const clasif = (k: string) => clasificarParaInforme(k, nivelPosicion, cargo);
  const v2 = scoreV2(mapeo, jd, k => (clasif(k).clase === "bloqueante" ? "bloqueante" : "preguntable"));

  const requeridas = new Set(jd.requeridas.map(k => k.keyword));
  const cumples: Cumple[] = [];
  const bloqueantes: Bloqueante[] = [];
  const preguntas: Pregunta[] = [];

  // Keywords requeridas cumplidas, con la cita semántica o la línea del CV que las respalda.
  const vistas = new Set<string>();
  for (const [m, nivel] of [...mapeo.matches_directos.map(m => [m, "directo"] as const), ...mapeo.matches_relacionados.map(m => [m, "relacionado"] as const)]) {
    if (!requeridas.has(m.keyword_jd) || vistas.has(m.keyword_jd)) continue;
    vistas.add(m.keyword_jd);
    const linea = m.cita ?? lineaQueContiene(cv, [m.keyword_jd, m.competencia_cv]);
    if (!linea) continue; // sin evidencia en el CV no se afirma que cumple
    cumples.push({ requisito: `${m.keyword_jd}${nivel === "relacionado" ? " (en parte)" : ""}`, evidencia: `«${recortar(linea)}»` });
  }

  // Requisitos estructurados.
  const puestos = puestosCV(cv);
  let carreraCumple = false, aniosCumple: boolean | null = null;
  for (const q of (mapeo.requisitos ?? []).filter(q => q.tipo === "requerido")) {
    if (q.clase === "experiencia") {
      aniosCumple = (aniosCumple ?? true) && q.estado === "cumple";
      if (q.estado === "cumple") {
        const rango = puestos.length > 1 ? `desde «${recortar(puestos[0].titulo, 80)}» hasta «${recortar(puestos[puestos.length - 1].titulo, 80)}»` : puestos[0] ? `«${recortar(puestos[0].titulo, 80)}»` : "";
        cumples.push({ requisito: q.descripcion, evidencia: `${q.detalle}: ${rango}` });
      } else {
        bloqueantes.push({ requisito: q.descripcion, texto: `La oferta pide ${q.descripcion}; según las fechas de tu CV llevas ${q.detalle.replace(/ en el CV.*/, "")}${/puesto\(s\) del área/.test(q.detalle) ? " en esa área" : ""}.` });
      }
    } else {
      const carreras = q.descripcion.replace(/ \(o afín\)$/, "").split(" / ");
      const linea = lineaQueContiene(cv, carreras);
      if (q.estado === "cumple" && linea) {
        carreraCumple = true;
        cumples.push({ requisito: `Carrera: ${q.descripcion}`, evidencia: `«${recortar(linea)}»` });
      } else if (q.estado === "afin_a_revisar") {
        preguntas.push({ requisito: q.descripcion, tipo: "carrera_afin", texto: `¿Tu carrera es afín a ${q.descripcion.replace(/ \(o afín\)$/, "")}? La oferta acepta carreras afines: si la tuya lo es, deja clara la carrera en el CV.` });
      } else {
        bloqueantes.push({ requisito: q.descripcion, texto: `La oferta pide ${q.descripcion} y tu CV no menciona esa carrera.` });
      }
    }
  }
  // Carrera como keyword (sin requisito estructurado).
  if (!carreraCumple) carreraCumple = cumples.some(c => esCarrera(c.requisito));

  // Brechas de keywords requeridas: bloqueante o pregunta.
  const brechas = mapeo.gap_keywords.filter(g => g.tipo === "requerido");
  for (const { keyword } of brechas) {
    const { clase, tipo } = clasif(keyword);
    if (clase === "bloqueante") {
      bloqueantes.push({ requisito: keyword, texto: esCarrera(keyword) ? `La oferta pide la carrera ${keyword} y tu CV no la menciona.` : `La oferta pide ${keyword} y tu CV no lo muestra.` });
      continue;
    }
    preguntas.push({ requisito: keyword, tipo: tipo!, texto: redactarPregunta(keyword, tipo!, cv, etiquetas) });
  }

  // Frase de fit.
  const kwReq = jd.requeridas.filter(k => !esCarrera(k.keyword));
  const kwCumplidas = kwReq.filter(k => vistas.has(k.keyword)).length;
  const partes: string[] = [];
  if (carreraCumple) partes.push("la carrera");
  if (aniosCumple) partes.push("los años de experiencia");
  const ratio = kwReq.length ? kwCumplidas / kwReq.length : 0;
  if (ratio >= 0.7) partes.push("las funciones centrales");
  else if (kwCumplidas > 0) partes.push(`${kwCumplidas} de ${kwReq.length} requisitos del cargo`);
  const faltas: string[] = [];
  if (bloqueantes.length) faltas.push(`${bloqueantes.length} ${bloqueantes.length === 1 ? "requisito que tu CV no muestra" : "requisitos que tu CV no muestra"}`);
  if (preguntas.length) faltas.push(`${preguntas.length} ${preguntas.length === 1 ? "punto por confirmar" : "puntos por confirmar"} (cosas que quizás tienes y no aparecen)`);
  const lista = (xs: string[]) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
  const inicio = partes.length ? `Cumples ${lista(partes)}` : "Tu CV todavía no muestra los requisitos centrales de esta oferta";
  const frase = `${inicio}${faltas.length ? `; ${partes.length ? "te quedan" : "hay"} ${lista(faltas)}` : ""}.`;

  // Alerta de nivel: información, no resta.
  const a = alertaNivel(cv, jd, nivelPosicion);
  const nivelTxt = nivelPosicion ? `un cargo de nivel ${nivelPosicion}` : "este cargo";
  const alerta = {
    nivel: a.alerta,
    texto: a.alerta === "sobrecalificado"
      ? `Tus ${a.anios_cv} años de experiencia superan lo que suele pedir ${nivelTxt}. No resta puntos: es para que lo consideres (sueldo, expectativas) al postular.`
      : a.alerta === "subcalificado"
        ? `Tus ${a.anios_cv} años de experiencia están bajo lo que pide ${nivelTxt}. No resta puntos aparte: es para que lo tengas en cuenta.`
        : null,
  };

  return { fit: { clase: v2.clase, score: v2.score, frase }, cumples, bloqueantes, preguntas, alerta, limpieza: limpiezaCV(cv) };
}

function redactarPregunta(keyword: string, tipo: TipoPregunta, cv: string, etiquetas?: EtiquetasOrden): string {
  const si = "Si es así, agrégalo al CV.";
  switch (tipo) {
    case "normativa": return `¿Has trabajado con ${keyword}? ${si}`;
    case "herramienta": return `¿Has usado ${keyword}? ${si}`;
    case "sector": return `¿Tienes experiencia en ${keyword.replace(/^experiencia en\s+/i, "")}? ${si}`;
    case "funcion": return `¿Has hecho o demostrado «${keyword}» en prácticas, trabajos o proyectos? ${si}`;
    case "area_cargo": {
      // Contexto: la viñeta que el priorizador etiquetó con esta keyword (solo para preguntar).
      const lineas = cv.split("\n");
      const idx = Object.entries(etiquetas ?? {}).find(([, kws]) => kws.includes(keyword))?.[0];
      const linea = idx !== undefined ? lineas[Number(idx)] : undefined;
      if (linea) return `¿Tu experiencia en «${recortar(linea, 100)}» fue trabajo de ${keyword}? Si es así, nómbralo así en el CV.`;
      return `¿Has hecho trabajo de ${keyword}, aunque no se llamara así? ${si}`;
    }
    default: return `¿Tienes ${keyword}? ${si}`;
  }
}

// ─── limpieza del CV (sin API) ───────────────────────────────────────────────

const RE_NACIMIENTO = /(fecha de nacimiento|nacimiento\s*:|nacid[oa] el|\bedad\s*:|\b\d{2}\s*años de edad)/i;
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
  if (civil) out.push({ tema: "estado_civil", linea: civil, texto: "Quita el estado civil: no tiene que ver con el cargo y puede generar sesgos." });
  const hijos = buscar(RE_HIJOS);
  if (hijos) out.push({ tema: "hijos", linea: hijos, texto: "Quita la información sobre hijos: es personal, no la piden y puede jugar en contra por sesgos." });
  const perfil = buscar(RE_ANIOS_PERFIL);
  if (perfil) {
    const declarados = Number(perfil.match(RE_ANIOS_PERFIL)![1]);
    const fechas = aniosDeExperiencia(puestosCV(cv));
    if (fechas > 0 && Math.abs(fechas - declarados) >= 3) {
      out.push({
        tema: "anios_perfil", linea: recortar(perfil),
        texto: `Tu perfil dice ${declarados} años, pero las fechas de tus puestos suman ~${Math.round(fechas)}. Un reclutador lo nota: alinea el número con las fechas (o aclara desde cuándo cuentas).`,
      });
    }
  }
  return out;
}

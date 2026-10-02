/**
 * Glosario EN→ES de términos laborales frecuentes (PED-36), revisado a mano. Solo sirve para que la capa semántica
 * del mapeo vea la keyword en inglés junto a su traducción: "process mapping (mapeo de procesos)". No agrega matches
 * por sí solo; el match sigue exigiendo una cita literal del CV.
 */
import { normalizarParaComparar } from "./cv-postprocess";

// Frases primero (las más largas ganan), luego palabras sueltas.
const GLOSARIO: [string, string][] = [
  ["process mapping", "mapeo de procesos"],
  ["process improvement", "mejora de procesos"],
  ["continuous improvement", "mejora continua"],
  ["root cause analysis", "análisis de causa raíz"],
  ["data analysis", "análisis de datos"],
  ["data modeling", "modelamiento de datos"],
  ["stakeholder management", "gestión de partes interesadas"],
  ["stakeholder interviews", "entrevistas con partes interesadas"],
  ["requirements documentation", "documentación de requerimientos"],
  ["requirements gathering", "levantamiento de requerimientos"],
  ["business analyst", "analista de negocios"],
  ["product analyst", "analista de producto"],
  ["project management", "gestión de proyectos"],
  ["user stories", "historias de usuario"],
  ["acceptance criteria", "criterios de aceptación"],
  ["discovery sessions", "sesiones de levantamiento"],
  ["user acceptance testing", "pruebas de aceptación de usuario"],
  ["standard operating procedures", "procedimientos estándar de trabajo"],
  ["key performance indicators", "indicadores clave de desempeño"],
  ["supply chain", "cadena de suministro"],
  ["customer service", "atención al cliente"],
  ["talent acquisition", "atracción de talento"],
  ["employer branding", "marca empleadora"],
  ["people analytics", "analítica de personas"],
  ["people operations", "operaciones de personas"],
  ["performance management", "gestión del desempeño"],
  ["workforce planning", "planificación de dotación"],
  ["financial modeling", "modelamiento financiero"],
  ["stakeholders", "partes interesadas"],
  ["stakeholder", "partes interesadas"],
  ["requirements", "requerimientos"],
  ["recruiting", "reclutamiento"],
  ["recruitment", "reclutamiento"],
  ["onboarding", "inducción"],
  ["offboarding", "desvinculación"],
  ["integrations", "integraciones"],
  ["databases", "bases de datos"],
  ["workshops", "talleres"],
  ["compliance", "cumplimiento normativo"],
  ["budgeting", "presupuestos"],
  ["forecasting", "proyecciones"],
  ["reporting", "reportes"],
  ["english", "inglés"],
];

// Traducción de una keyword en inglés, o null si no hay término del glosario en ella.
export function traducirKeyword(keyword: string): string | null {
  let n = normalizarParaComparar(keyword);
  let cambio = false;
  for (const [en, es] of GLOSARIO) {
    const re = new RegExp(`\\b${en}\\b`, "g");
    if (re.test(n)) { n = n.replace(re, es); cambio = true; }
  }
  return cambio ? n : null;
}

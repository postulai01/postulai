/**
 * Glosario de términos frecuentes en las ofertas del set (PED-5). Definiciones de ≤ 15 palabras, en lenguaje
 * cotidiano y NEUTRAS: explican el término, nunca dicen qué hizo la persona. Revisadas a mano.
 */
import { normalizarParaComparar } from "./cv-postprocess";

export interface Definicion { termino: string; texto: string; revisar: boolean }

const GLOSARIO: [string, string][] = [
  ["trade marketing", "Marketing en el punto de venta: exhibición, promociones y material en tiendas."],
  ["people analytics", "Uso de datos del personal, como rotación o desempeño, para decidir mejor."],
  ["hr analytics", "Uso de datos del personal, como rotación o desempeño, para decidir mejor."],
  ["people operations", "Gestión diaria de procesos de personas: contratos, remuneraciones, beneficios y políticas."],
  ["onboarding", "Bienvenida e inducción de un nuevo trabajador en sus primeras semanas."],
  ["offboarding", "Proceso de salida de un trabajador: entrega del puesto, finiquito y entrevista de salida."],
  ["ley karin", "Ley chilena 21.643 que previene y sanciona el acoso laboral y sexual."],
  ["ley de subcontratacion", "Ley chilena 20.123, que regula el trabajo de empresas contratistas y subcontratistas."],
  ["20.123", "Ley chilena que regula el trabajo de empresas contratistas y subcontratistas."],
  ["20 123", "Ley chilena que regula el trabajo de empresas contratistas y subcontratistas."],
  ["fp&a", "Planificación y análisis financiero: presupuestos, proyecciones y seguimiento de resultados."],
  ["fp a", "Planificación y análisis financiero: presupuestos, proyecciones y seguimiento de resultados."],
  ["p&l", "Estado de resultados: ingresos, costos y utilidad de un periodo."],
  ["p l", "Estado de resultados: ingresos, costos y utilidad de un periodo."],
  ["ats", "Software para publicar vacantes y seguir a los candidatos durante la selección."],
  ["oee", "Indicador de eficiencia de una máquina o línea: disponibilidad, rendimiento y calidad."],
  ["kaizen", "Mejoras pequeñas y continuas hechas por el equipo, por ejemplo en talleres cortos."],
  ["gemba", "Ir al lugar donde ocurre el trabajo para observar el proceso y mejorarlo."],
  ["soc 2", "Estándar de auditoría sobre seguridad y manejo de datos en empresas de software."],
  ["employer branding", "Imagen de la empresa como buen lugar para trabajar, por ejemplo en redes sociales."],
  ["headhunting", "Búsqueda activa de candidatos que no están postulando, por ejemplo por LinkedIn."],
  ["business analyst", "Rol que traduce necesidades del negocio en requerimientos claros para el equipo técnico."],
  ["user stories", "Descripción breve de una función desde la mirada del usuario, usada en desarrollo ágil."],
  ["scrum", "Forma de trabajo ágil en ciclos cortos, con reuniones breves cada día."],
  ["jira", "Software para organizar tareas y proyectos de equipos, muy usado en tecnología."],
  ["figma", "Herramienta en línea para diseñar pantallas y prototipos de aplicaciones."],
  ["lean six sigma", "Métodos para eliminar desperdicios y reducir errores en los procesos."],
  ["5s", "Método de orden y limpieza del puesto de trabajo en cinco pasos."],
  ["wms", "Software para gestionar una bodega: ubicaciones, inventario y despachos."],
  ["lms", "Software que mide la productividad y asignación del personal de bodega."],
  ["dax", "Lenguaje de fórmulas de Power BI para crear cálculos e indicadores."],
  ["sql", "Lenguaje para consultar y ordenar datos guardados en una base de datos."],
  ["bigquery", "Base de datos de Google en la nube para analizar grandes volúmenes de datos."],
  ["talana", "Software chileno de RRHH para remuneraciones, contratos y asistencia."],
  ["buk", "Software chileno de RRHH para remuneraciones, contratos y asistencia."],
  ["reglamento interno", "Documento de la empresa con normas de orden, higiene y seguridad para el personal."],
  ["portal mi dt", "Sitio de la Dirección del Trabajo para hacer trámites laborales en línea."],
  ["jornadas excepcionales", "Turnos especiales autorizados por la Dirección del Trabajo, como 7x7 en faena."],
  ["acreditacion minera", "Requisitos y documentos para que un trabajador pueda ingresar a una faena minera."],
  ["webcontrol", "Plataforma para acreditar a empresas contratistas y a su personal ante el mandante."],
  ["siga", "Plataforma para acreditar a empresas contratistas y a su personal ante el mandante."],
];

// Definición del término del glosario que aparece en la keyword (el más largo gana), o null.
export function definirDesdeGlosario(keyword: string): Definicion | null {
  const n = ` ${normalizarParaComparar(keyword)} `;
  const hit = [...GLOSARIO].sort((a, b) => b[0].length - a[0].length)
    .find(([t]) => n.includes(` ${normalizarParaComparar(t)} `) || n.includes(` ${t} `));
  return hit ? { termino: keyword, texto: hit[1], revisar: false } : null;
}

// Una definición válida: ≤ 15 palabras, sin tuteo ni "usted", sin comillas.
export function definicionValida(texto: string): boolean {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  return palabras.length > 0 && palabras.length <= 15 && !/\b(tú|tu|tus|usted|hiciste)\b/i.test(texto) && !/["“”«»]/.test(texto);
}

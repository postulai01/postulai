/**
 * Mapeo CV → oferta (PED-22, base de v11.0).
 * Cruza lo que sale del extractor de competencias (competencia-extractor.ts) con las keywords del parser
 * de ofertas (jd-parser.ts). Sin API: comparación por palabras normalizadas y raíces, conservadora.
 * Cada keyword de la oferta recibe a lo más un match (el mejor); si no hay, va a gap_keywords.
 *
 * Niveles:
 * - directo (0.95): la keyword está contenida en una competencia, variante, herramienta, certificación
 *   o idioma del CV ("Excel" ← "Microsoft Excel"); 0.9 si solo aparece completa en una línea del CV
 *   original (carreras, que el extractor no devuelve como competencia).
 * - relacionado (0.7–0.85): al menos la mitad de las raíces de la keyword están en una competencia, y
 *   una de ellas no es genérica ("gestión de ventas" ← "ventas directas"; "análisis financiero" ←
 *   "análisis de datos" no, porque "análisis" es genérica). Nunca por sinónimos.
 */
import { matcheaPalabra, normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import type { Competencia } from "./competencia-extractor";

export type TipoKeyword = "requerido" | "deseable";

export interface KeywordsJD {
  requeridas: { keyword: string; relevancia: number }[];
  deseables: { keyword: string; relevancia: number }[];
}

export interface ExtrasCV {
  herramientas?: string[];
  certificaciones?: string[];
  idiomas?: string[];
  cvTexto?: string; // CV original, para keywords que el extractor no devuelve (carreras, instituciones)
}

export interface MatchDirecto { competencia_cv: string; keyword_jd: string; relevancia: number; tipo: TipoKeyword }
export interface MatchRelacionado { competencia_cv: string; keyword_jd: string; relevancia: number; tipo: TipoKeyword }

export interface ResultadoMapeo {
  matches_directos: MatchDirecto[];
  matches_relacionados: MatchRelacionado[];
  gap_keywords: { keyword: string; tipo: TipoKeyword }[];
  score_adaptacion: number; // 0–1, solo keywords requeridas
}

export const RELEVANCIA_DIRECTO = 0.95;
export const RELEVANCIA_TEXTO = 0.9;
const PESO_RELACIONADO_EN_SCORE = 0.5;

// Raíces que no bastan por sí solas para un match relacionado: aparecen en cualquier función.
const RAICES_GENERICAS = new Set(["gesti", "manej", "desar", "proce", "admin", "contr", "anali", "trabaj", "equip", "servi", "clien"]
  .map(r => r.slice(0, 5)));

const singular = (p: string) => p.replace(/ciones$/, "cion").replace(/([aeiou])s$/, "$1");

function palabras(texto: string): string[] {
  return normalizarParaComparar(texto).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p)).map(singular);
}

const raiz = (p: string) => p.slice(0, 5);

// La keyword está contenida en el nombre: todas sus palabras significativas aparecen en él.
function contiene(nombre: string, keyword: string): boolean {
  const n = new Set(palabras(nombre));
  const k = palabras(keyword);
  return k.length > 0 && k.every(p => n.has(p));
}

// Fracción de raíces no genéricas de la keyword que aparecen en el nombre; 0 si ninguna raíz no genérica coincide.
function afinidad(nombre: string, keyword: string): number {
  const rn = new Set(palabras(nombre).map(raiz));
  const rk = [...new Set(palabras(keyword).map(raiz))];
  if (rk.length === 0) return 0;
  const comunes = rk.filter(r => rn.has(r));
  if (!comunes.some(r => !RAICES_GENERICAS.has(r))) return 0;
  return comunes.length / rk.length;
}

function lineaConKeyword(cvTexto: string, keyword: string): boolean {
  const k = normalizarParaComparar(keyword).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p));
  if (k.length === 0) return false;
  return cvTexto.split("\n").some(l => {
    const n = normalizarParaComparar(l);
    return k.every(p => matcheaPalabra(p, n));
  });
}

export async function mapearCompetencias(
  competenciasCV: Competencia[],
  keywordsJD: KeywordsJD,
  extras: ExtrasCV = {}
): Promise<ResultadoMapeo> {
  // Nombres del CV que cuentan para un match directo: competencias con sus variantes, y extras.
  const nombresDirectos: { etiqueta: string; nombre: string }[] = [
    ...competenciasCV.flatMap(c => [c.nombre, ...(c.variantes ?? [])].map(n => ({ etiqueta: c.nombre, nombre: n }))),
    ...[...(extras.herramientas ?? []), ...(extras.certificaciones ?? []), ...(extras.idiomas ?? [])]
      .map(n => ({ etiqueta: n, nombre: n.replace(/\s*\(.*\)$/, "") })), // "Inglés (avanzado)" → "Inglés"
  ];

  const matches_directos: MatchDirecto[] = [];
  const matches_relacionados: MatchRelacionado[] = [];
  const gap_keywords: { keyword: string; tipo: TipoKeyword }[] = [];
  let cubiertasRequeridas = 0;

  const todas: { keyword: string; tipo: TipoKeyword }[] = [
    ...keywordsJD.requeridas.map(k => ({ keyword: k.keyword, tipo: "requerido" as const })),
    ...keywordsJD.deseables.map(k => ({ keyword: k.keyword, tipo: "deseable" as const })),
  ];

  for (const { keyword, tipo } of todas) {
    const directo = nombresDirectos.find(d => contiene(d.nombre, keyword));
    if (directo) {
      matches_directos.push({ competencia_cv: directo.etiqueta, keyword_jd: keyword, relevancia: RELEVANCIA_DIRECTO, tipo });
      if (tipo === "requerido") cubiertasRequeridas += 1;
      continue;
    }
    if (extras.cvTexto && lineaConKeyword(extras.cvTexto, keyword)) {
      matches_directos.push({ competencia_cv: "(texto del CV)", keyword_jd: keyword, relevancia: RELEVANCIA_TEXTO, tipo });
      if (tipo === "requerido") cubiertasRequeridas += 1;
      continue;
    }

    let mejor: { nombre: string; af: number } | null = null;
    for (const c of competenciasCV) {
      for (const n of [c.nombre, ...(c.variantes ?? [])]) {
        const af = afinidad(n, keyword);
        if (af >= 0.5 && (!mejor || af > mejor.af)) mejor = { nombre: c.nombre, af };
      }
    }
    if (mejor) {
      const relevancia = Math.round((0.7 + 0.15 * mejor.af) * 100) / 100;
      matches_relacionados.push({ competencia_cv: mejor.nombre, keyword_jd: keyword, relevancia, tipo });
      if (tipo === "requerido") cubiertasRequeridas += PESO_RELACIONADO_EN_SCORE;
      continue;
    }
    gap_keywords.push({ keyword, tipo });
  }

  const total = keywordsJD.requeridas.length;
  const score_adaptacion = total === 0 ? 0 : Math.round((cubiertasRequeridas / total) * 100) / 100;
  return { matches_directos, matches_relacionados, gap_keywords, score_adaptacion };
}

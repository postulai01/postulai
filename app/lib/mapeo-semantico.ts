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
 * Carreras: las ofertas listan carreras alternativas ("Ingeniería Comercial, Industrial o afines"). Todas las
 * carreras requeridas cuentan como UN requisito en el score; si una calza, las demás no aparecen como brecha.
 *
 * - relacionado (0.7–0.85): al menos la mitad de las raíces de la keyword están en una competencia, y
 *   una de ellas no es genérica ("gestión de ventas" ← "ventas directas"; "análisis financiero" ←
 *   "análisis de datos" no, porque "análisis" es genérica). Nunca por sinónimos.
 *
 * PED-30:
 * - Requisitos estructurados del parser: años de experiencia (calculados desde las fechas de cada puesto, sin API)
 *   y carreras alternativas (un solo requisito; si la carrera del CV no está y la oferta acepta afín → "afin_a_revisar").
 * - Capa semántica (mapearSemantico): UNA llamada a Haiku por caso sobre las brechas de la capa literal. Cada match
 *   trae una cita exacta del CV; en código se exige que la cita exista literal, que no calce solo por raíces
 *   genéricas y una relevancia mínima. Cruza español-inglés y sinónimos obvios.
 */
import Anthropic from "@anthropic-ai/sdk";
import { matcheaPalabra, normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { esEncabezado } from "./cv-verificacion";
import type { Competencia } from "./competencia-extractor";
import { traducirKeyword } from "./glosario-en-es";
import type { RequisitoCarreras, RequisitoExperiencia } from "./jd-parser";

export type TipoKeyword = "requerido" | "deseable";

export interface KeywordsJD {
  requeridas: { keyword: string; relevancia: number }[];
  deseables: { keyword: string; relevancia: number }[];
  experiencia?: RequisitoExperiencia[];
  carreras?: RequisitoCarreras[];
}

export type OrigenMatch = "literal" | "semantico";

export interface ExtrasCV {
  herramientas?: string[];
  certificaciones?: string[];
  idiomas?: string[];
  cvTexto?: string; // CV original, para keywords que el extractor no devuelve (carreras, instituciones)
}

export interface MatchDirecto {
  competencia_cv: string; keyword_jd: string; relevancia: number; tipo: TipoKeyword;
  origen?: OrigenMatch; // ausente = literal
  cita?: string;        // semántico: fragmento exacto del CV que lo respalda
}
export type MatchRelacionado = MatchDirecto;

export type EstadoRequisito = "cumple" | "no_cumple" | "afin_a_revisar";
export interface ResultadoRequisito {
  clase: "experiencia" | "carrera";
  descripcion: string; // "5 años en relaciones laborales" · "Derecho / Ingeniería / Psicología (o afín)"
  tipo: TipoKeyword;
  estado: EstadoRequisito;
  detalle: string;     // "18 años en el CV" · "carrera del CV: Administración Pública"
  puestos?: string[];  // experiencia: títulos de los puestos que se contaron
}

export interface ResultadoMapeo {
  matches_directos: MatchDirecto[];
  matches_relacionados: MatchRelacionado[];
  gap_keywords: { keyword: string; tipo: TipoKeyword }[];
  requisitos?: ResultadoRequisito[];
  score_adaptacion: number; // 0–1, keywords y requisitos requeridos
}

export const RELEVANCIA_DIRECTO = 0.95;
export const RELEVANCIA_TEXTO = 0.9;
const PESO_RELACIONADO_EN_SCORE = 0.5;

// Raíces que no bastan por sí solas para un match (literal relacionado, semántico, o que una keyword toque una
// línea en el reescritor): aparecen en cualquier función. "organ", "inter" y "publi" (PED-30) cortan falsos como
// "Desarrollo Organizacional" ← "planificación y organización", "Reglamento Interno" ← "equidad interna"
// y "Mercado Público" ← "publicidad".
export const RAICES_GENERICAS = new Set([
  "gesti", "opera", "desar", "proce", "admin", "manej", "traba", "equip", "servi", "clien", "contr",
  "imple", "apoya", "apoyo", "estra", "anali", "defin", "plani", "respo", "funci", "activ", "organ",
  "inter", "publi",
]);
export const RELEVANCIA_MIN_SEMANTICO = 0.75;
export const RELEVANCIA_MIN_SEMANTICO_RELACIONADO = 0.8; // un relacionado semántico necesita más certeza que un directo
export const MODELO_MAPEO = "claude-haiku-4-5-20251001";

// Nombres de carreras chilenas frecuentes en ofertas, sobre texto normalizado.
const PATRON_CARRERA = new RegExp("^(" + [
  "ingenieria", "ingeniero", "licenciatura", "psicologia", "derecho", "economia", "contador", "contabilidad",
  "auditoria", "administracion (publica|de empresas)", "periodismo", "arquitectura", "medicina", "enfermeria",
  "kinesiologia", "sociologia", "trabajo social", "tecnico (en|de)", "diseno", "pedagogia", "agronomia",
  "geologia", "bioquimica", "quimica", "nutricion", "fonoaudiologia", "terapia ocupacional", "odontologia",
].join("|") + ")\\b");

// Profesión ↔ carrera y género (PED-35): "Psicóloga" ↔ "Psicología", "Ingeniero/a" ↔ "Ingeniería",
// "Abogado" ↔ "Derecho", "Administradora" ↔ "Administración", "Técnica" ↔ "Técnico". Solo para comparar carreras.
const FORMAS_CARRERA: [RegExp, string][] = [
  [/\bpsicolog(o|a|os|as|ia)\b/g, "psicologia"],
  [/\bingenier(o|a|os|as|ia)\b/g, "ingenieria"],
  [/\babogad(o|a|os|as)\b/g, "derecho"],
  [/\badministrador(a|es|as)?\b/g, "administracion"],
  [/\btecnic(o|a|os|as)\b/g, "tecnico"],
];
export function canonCarrera(texto: string): string {
  return FORMAS_CARRERA.reduce((n, [re, c]) => n.replace(re, c), normalizarParaComparar(texto));
}

// Una línea del CV menciona la carrera, comparando en forma canónica.
function lineaConCarrera(cvTexto: string, carrera: string): boolean {
  const k = canonCarrera(carrera).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p));
  if (k.length === 0) return false;
  return cvTexto.split("\n").some(l => { const n = canonCarrera(l); return k.every(p => matcheaPalabra(p, n)); });
}

export function esCarrera(keyword: string): boolean {
  return PATRON_CARRERA.test(normalizarParaComparar(keyword));
}

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
  const gapCarreras: { keyword: string; tipo: TipoKeyword }[] = [];
  let cubiertasRequeridas = 0;
  let coberturaCarreras = 0; // 1 si alguna carrera requerida calza directo, 0.5 si solo relacionada
  let hayCarrerasRequeridas = false;

  // Suma la cobertura de una keyword requerida al score; las carreras van como un solo requisito.
  const cubrir = (keyword: string, tipo: TipoKeyword, cobertura: number) => {
    if (tipo !== "requerido") return;
    if (esCarrera(keyword)) coberturaCarreras = Math.max(coberturaCarreras, cobertura);
    else cubiertasRequeridas += cobertura;
  };

  const todas: { keyword: string; tipo: TipoKeyword }[] = [
    ...keywordsJD.requeridas.map(k => ({ keyword: k.keyword, tipo: "requerido" as const })),
    ...keywordsJD.deseables.map(k => ({ keyword: k.keyword, tipo: "deseable" as const })),
  ];

  for (const { keyword, tipo } of todas) {
    if (tipo === "requerido" && esCarrera(keyword)) hayCarrerasRequeridas = true;
    const directo = nombresDirectos.find(d => contiene(d.nombre, keyword));
    if (directo) {
      matches_directos.push({ competencia_cv: directo.etiqueta, keyword_jd: keyword, relevancia: RELEVANCIA_DIRECTO, tipo });
      cubrir(keyword, tipo, 1);
      continue;
    }
    if (extras.cvTexto && lineaConKeyword(extras.cvTexto, keyword)) {
      matches_directos.push({ competencia_cv: "(texto del CV)", keyword_jd: keyword, relevancia: RELEVANCIA_TEXTO, tipo });
      cubrir(keyword, tipo, 1);
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
      cubrir(keyword, tipo, PESO_RELACIONADO_EN_SCORE);
      continue;
    }
    (tipo === "requerido" && esCarrera(keyword) ? gapCarreras : gap_keywords).push({ keyword, tipo });
  }

  // Si ninguna carrera requerida calza, todas son brecha; si alguna calza, las demás eran alternativas.
  if (coberturaCarreras === 0) gap_keywords.push(...gapCarreras);
  cubiertasRequeridas += coberturaCarreras;
  const noCarreras = keywordsJD.requeridas.filter(k => !esCarrera(k.keyword)).length;
  const total = noCarreras + (hayCarrerasRequeridas ? 1 : 0);
  const requisitos = evaluarRequisitos(keywordsJD, extras.cvTexto ?? "");
  const r = { matches_directos, matches_relacionados, gap_keywords, requisitos, score_adaptacion: 0 };
  r.score_adaptacion = calcularScore(r, keywordsJD, { cubiertas: cubiertasRequeridas, total });
  return r;
}

// Score: keywords requeridas (directo 1, relacionado 0.5, carreras-keyword como un requisito) más requisitos
// estructurados requeridos (cumple 1, afín a revisar 0.5).
const COBERTURA_REQUISITO: Record<EstadoRequisito, number> = { cumple: 1, afin_a_revisar: 0.5, no_cumple: 0 };
function calcularScore(r: ResultadoMapeo, _jd: KeywordsJD, kw: { cubiertas: number; total: number }): number {
  const req = (r.requisitos ?? []).filter(q => q.tipo === "requerido");
  const cubiertas = kw.cubiertas + req.reduce((s, q) => s + COBERTURA_REQUISITO[q.estado], 0);
  const total = kw.total + req.length;
  return total === 0 ? 0 : Math.round((cubiertas / total) * 100) / 100;
}

// ─── requisitos estructurados (sin API) ──────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
export const RE_EXPERIENCIA = /^(experiencia|antecedentes laborales|trayectoria)/;

export interface PuestoCV { titulo: string; texto: string; inicio: number; fin: number } // meses absolutos

// Una fecha de la línea de un puesto: "Abril 2025", "06/2022", "2014" → mes absoluto (año*12 + mes).
function mesAbsoluto(frag: string, esFin: boolean, ahora: number): number | null {
  const n = normalizarParaComparar(frag);
  if (/\b(a la fecha|presente|actualidad|actual|hoy)\b/.test(n)) return ahora;
  const mmaaaa = n.match(/\b(\d{1,2}) (\d{4})\b/);
  if (mmaaaa) return Number(mmaaaa[2]) * 12 + Number(mmaaaa[1]);
  const anio = n.match(/\b(19|20)\d{2}\b/);
  if (!anio) return null;
  const mes = Object.keys(MESES).find(m => new RegExp(`\\b${m}\\b`).test(n));
  return Number(anio[0]) * 12 + (mes ? MESES[mes] : esFin ? 12 : 1);
}

// Puestos de la sección de experiencia: línea no-viñeta con año, más las líneas hasta el próximo puesto o sección.
export function puestosCV(cv: string, ahora = new Date()): PuestoCV[] {
  const mesAhora = ahora.getFullYear() * 12 + ahora.getMonth() + 1;
  const puestos: PuestoCV[] = [];
  let enExperiencia = false;
  for (const cruda of cv.split("\n")) {
    const l = cruda.trim();
    if (!l) continue;
    if (esEncabezado(l)) { enExperiencia = RE_EXPERIENCIA.test(normalizarParaComparar(l)); continue; }
    if (!enExperiencia) continue;
    const esVineta = /^[-•]/.test(l);
    if (!esVineta && /\b(19|20)\d{2}\b/.test(l)) {
      // "2014 – 2017", "Mayo 2025 – A la fecha", "06/2022 – Presente", "2024 · 3 meses", "2025"
      const rango = l.match(/((?:[a-záéíóú]+ )?(?:\d{1,2}\/)?(?:19|20)\d{2})\s*[–—-]\s*((?:[a-záéíóú]+ )?(?:\d{1,2}\/)?(?:19|20)\d{2}|a la fecha|presente|actualidad)/i);
      let inicio: number | null, fin: number | null;
      if (rango) {
        inicio = mesAbsoluto(rango[1], false, mesAhora);
        fin = mesAbsoluto(rango[2], true, mesAhora);
      } else {
        inicio = mesAbsoluto(l, false, mesAhora);
        const meses = normalizarParaComparar(l).match(/\b(\d{1,2}) mes(es)?\b/);
        fin = inicio === null ? null : inicio + (meses ? Number(meses[1]) : 6) - 1; // un año suelto: medio año
      }
      if (inicio !== null && fin !== null && fin >= inicio) { puestos.push({ titulo: l, texto: l, inicio, fin }); continue; }
    }
    if (puestos.length > 0) puestos[puestos.length - 1].texto += "\n" + l;
  }
  return puestos;
}

// Años cubiertos por los puestos, sin contar dos veces los períodos que se traslapan.
export function aniosDeExperiencia(puestos: PuestoCV[]): number {
  const rangos = puestos.map(p => [p.inicio, p.fin + 1] as const).sort((a, b) => a[0] - b[0]);
  let meses = 0, hasta = -Infinity;
  for (const [ini, fin] of rangos) {
    if (fin <= hasta) continue;
    meses += fin - Math.max(ini, hasta);
    hasta = fin;
  }
  return Math.round((meses / 12) * 10) / 10;
}

// El área se divide en alternativas ("minería, construcción o servicios industriales", "Capital Humano / RRHH");
// de cada una quedan las palabras propias del tema: sin stop words, sin genéricas ("experiencia", "profesional",
// "rol", "similar", "proyectos"…), sin raíces genéricas. Sin ninguna palabra propia → experiencia total.
// Los niveles ("gerencias", "jefaturas") tampoco son área: "Gerencias de Capital Humano" → "capital humano".
const GENERICAS_AREA = /^(experiencia|profesional|general|area|cargo|similar|relacionad|empresa|rol|role|proyecto|project|afin|equivalente|otro|personal|gerenc|gerent|subgeren|jefatur|jefe|direcc|director)/;
// Nombres equivalentes del área de personas: el CV dice "Recursos Humanos" y la oferta "Capital Humano / RRHH".
const canonArea = (n: string) => n.replace(/\b(recursos humanos|capital humano|gestion de personas|personas( y)? organizacion|rr hh)\b/g, "rrhh");

function segmentosArea(area: string | null): string[][] {
  if (!area) return [];
  return area.split(/,|\/|\s+o\s+|\s+y\s+|\s+or\s+/i)
    .map(seg => palabras(canonArea(normalizarParaComparar(seg))).filter(p => !GENERICAS_AREA.test(p) && !RAICES_GENERICAS.has(raiz(p))))
    .filter(seg => seg.length > 0);
}

// El puesto es del área si TODAS las palabras propias de alguna alternativa están en el cargo o sus viñetas (PED-35:
// antes bastaba la mitad, y "Product Analyst" calzaba con "productivo").
function puestoEnArea(p: PuestoCV, segmentos: string[][]): boolean {
  const t = canonArea(normalizarParaComparar(p.texto));
  const esta = (w: string) => matcheaPalabra(w, t) || t.split(" ").some(x => x.length >= 6 && x.startsWith(raiz(w)));
  return segmentos.some(seg => seg.every(esta));
}

export function evaluarRequisitos(jd: KeywordsJD, cvTexto: string): ResultadoRequisito[] {
  const out: ResultadoRequisito[] = [];
  if (!cvTexto) return out;
  const puestos = puestosCV(cvTexto);
  for (const e of jd.experiencia ?? []) {
    const clave = segmentosArea(e.area);
    // Área genérica o sin palabras propias → experiencia total. Si no, solo puestos cuyo cargo/viñetas la mencionan.
    const enArea = clave.length === 0 ? puestos : puestos.filter(p => puestoEnArea(p, clave));
    const anios = aniosDeExperiencia(enArea);
    out.push({
      clase: "experiencia",
      descripcion: `${e.anios_minimos} años${e.area ? ` en ${e.area}` : ""}`,
      tipo: e.tipo,
      estado: anios >= e.anios_minimos ? "cumple" : "no_cumple",
      detalle: `${anios} años en el CV${clave.length ? ` (${enArea.length} puesto(s) del área)` : ""}`,
      puestos: enArea.map(p => p.titulo),
    });
  }
  for (const c of jd.carreras ?? []) {
    const calza = c.carreras.find(k => lineaConCarrera(cvTexto, k));
    out.push({
      clase: "carrera",
      descripcion: `${c.carreras.join(" / ")}${c.acepta_afin ? " (o afín)" : ""}`,
      tipo: c.tipo,
      estado: calza ? "cumple" : c.acepta_afin ? "afin_a_revisar" : "no_cumple",
      detalle: calza ? `el CV menciona ${calza}` : c.acepta_afin ? "carrera del CV no listada: afín a revisar" : "carrera del CV no listada",
    });
  }
  return out;
}

// ─── capa semántica (una llamada a Haiku por caso) ───────────────────────────

export const SYSTEM_MAPEO_SEMANTICO = `Comparas las brechas de una oferta de trabajo con un CV. Para cada keyword de la oferta que el CV demuestre con otras palabras, propón un match con una cita EXACTA del CV.
Reglas:
- Vale: traducción español-inglés ("stakeholder management" ↔ "gestión de stakeholders"), sinónimo obvio ("herramientas de office" ↔ "Microsoft Office"), o la misma función descrita con otras palabras.
- No vale: parecido de palabras sin el mismo significado, competencias vecinas, ni inferir lo que el CV no dice.
- cita: copia literal de 2 a 15 palabras del CV, sin cambiar nada (ni tildes ni mayúsculas).
- nivel: "directo" si el CV dice lo mismo; "relacionado" si demuestra una parte clara.
- relevancia: de 0 a 1, cuán seguro estás de que un reclutador lo daría por cumplido.
- Si una keyword no tiene respaldo, no la incluyas. Es mejor no proponer que proponer algo dudoso.
Responde SOLO con JSON: {"matches":[{"keyword":"...","cita":"...","nivel":"directo","relevancia":0.9}]}`;

// Las keywords en inglés van con su traducción del glosario entre paréntesis (PED-36): "process mapping (mapeo de procesos)".
export function promptSemantico(brechas: { keyword: string }[], cvTexto: string): string {
  const linea = (k: string) => { const t = traducirKeyword(k); return t ? `- ${k} (${t})` : `- ${k}`; };
  return `KEYWORDS SIN MATCH:\n${brechas.map(b => linea(b.keyword)).join("\n")}\n\nCV:\n${cvTexto}`;
}

export const MOTIVO_CITA = "la cita no existe literal en el CV";

export interface Rechazo { keyword: string; cita: string; motivo: string; relevancia?: number }
// Lo que propuso el modelo, tal cual: se guarda para re-aplicar los filtros sin volver a llamar a la API.
export interface PropuestaSemantica { keyword: string; cita: string; nivel?: string; relevancia?: number | null }

const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();

// Filtros duros sobre lo que propone el modelo.
export function filtrarSemanticos(
  propuestos: unknown,
  brechas: { keyword: string; tipo: TipoKeyword }[],
  cvTexto: string,
  relevanciaMin = RELEVANCIA_MIN_SEMANTICO,
): { aceptados: (MatchDirecto & { nivel: "directo" | "relacionado" })[]; rechazos: Rechazo[] } {
  const aceptados: (MatchDirecto & { nivel: "directo" | "relacionado" })[] = [];
  const rechazos: Rechazo[] = [];
  const cv = colapsar(cvTexto);
  for (const m of Array.isArray(propuestos) ? propuestos : []) {
    // El modelo puede devolver la keyword con la traducción del prompt: "process mapping (mapeo de procesos)".
    const keyword = typeof m?.keyword === "string" ? m.keyword.replace(/\s*\([^)]*\)\s*$/, "").trim() : "";
    const cita = typeof m?.cita === "string" ? colapsar(m.cita) : "";
    const relevancia = m?.relevancia == null ? NaN : Number(m.relevancia);
    const rechazar = (motivo: string) => rechazos.push({ keyword, cita, motivo, ...(Number.isFinite(relevancia) ? { relevancia } : {}) });
    const brecha = brechas.find(b => normalizarParaComparar(b.keyword) === normalizarParaComparar(keyword));
    if (!brecha) { rechazar("keyword que no era brecha"); continue; }
    if (aceptados.some(a => a.keyword_jd === brecha.keyword)) continue;
    if (!cita || !cv.includes(cita)) { rechazar(MOTIVO_CITA); continue; }
    // Si keyword y cita comparten raíces y todas son genéricas, es un parecido de palabras, no un match.
    const rk = new Set(palabras(brecha.keyword).map(raiz));
    const comunes = [...new Set(palabras(cita).map(raiz))].filter(r => rk.has(r));
    if (comunes.length > 0 && comunes.every(r => RAICES_GENERICAS.has(r))) { rechazar(`solo comparte raíces genéricas (${comunes.join(", ")})`); continue; }
    if (!Number.isFinite(relevancia) || relevancia < relevanciaMin) { rechazar(`relevancia ${m?.relevancia} < ${relevanciaMin}`); continue; }
    if (m?.nivel !== "directo" && relevancia < RELEVANCIA_MIN_SEMANTICO_RELACIONADO) {
      rechazar(`relacionado con relevancia ${relevancia} < ${RELEVANCIA_MIN_SEMANTICO_RELACIONADO}`);
      continue;
    }
    const nivel = m?.nivel === "directo" ? "directo" : "relacionado";
    aceptados.push({
      competencia_cv: cita, keyword_jd: brecha.keyword, tipo: brecha.tipo, nivel,
      relevancia: Math.round(Math.min(1, relevancia) * 100) / 100, origen: "semantico", cita,
    });
  }
  return { aceptados, rechazos };
}

// Segunda capa: toma el resultado literal y mueve a matches las brechas que el modelo respalda con una cita válida.
// Las carreras quedan fuera (van por requisitos estructurados o por la lógica literal de carreras).
// Si alguna cita no existe literal, UN reintento solo para esas keywords pidiendo la cita copiada textual.
// El filtro no se afloja: la cita del reintento también debe existir literal.
export async function mapearSemantico(
  literal: ResultadoMapeo,
  keywordsJD: KeywordsJD,
  cvTexto: string,
  opts: { client?: Anthropic; relevanciaMin?: number } = {},
): Promise<{
  resultado: ResultadoMapeo; rechazos: Rechazo[]; propuestos: PropuestaSemantica[];
  reintento: { pedidas: string[]; recuperadas: string[] } | null; usage: { input_tokens: number; output_tokens: number };
}> {
  const usage = { input_tokens: 0, output_tokens: 0 };
  const brechas = literal.gap_keywords.filter(g => !esCarrera(g.keyword));
  if (brechas.length === 0) return { resultado: literal, rechazos: [], propuestos: [], reintento: null, usage };
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const pedir = async (contenido: string): Promise<PropuestaSemantica[] | null> => {
    const res = await client.messages.create(
      { model: MODELO_MAPEO, max_tokens: 1500, temperature: 0, system: SYSTEM_MAPEO_SEMANTICO, messages: [{ role: "user", content: contenido }] },
      { timeout: 30_000, maxRetries: 1 },
    );
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : null;
      return Array.isArray(j?.matches) ? j.matches : [];
    } catch {
      console.warn("[postulai] Mapeo semántico: respuesta sin JSON válido");
      return null;
    }
  };

  let propuestos = await pedir(promptSemantico(brechas, cvTexto));
  if (!propuestos) return { resultado: literal, rechazos: [], propuestos: [], reintento: null, usage };
  let aplicado = aplicarSemanticos(literal, keywordsJD, cvTexto, propuestos, opts.relevanciaMin);

  const sinCita = aplicado.rechazos.filter(r => r.motivo === MOTIVO_CITA);
  let reintento: { pedidas: string[]; recuperadas: string[] } | null = null;
  if (sinCita.length > 0) {
    const pedidas = sinCita.map(r => r.keyword);
    const nuevas = await pedir(`${promptSemantico(brechas.filter(b => pedidas.includes(b.keyword)), cvTexto)}

Tus citas anteriores para estas keywords no existen textualmente en el CV:
${sinCita.map(r => `- ${r.keyword}: "${r.cita}"`).join("\n")}
Copia la cita carácter por carácter desde el CV (un fragmento continuo, sin saltar palabras). Si no hay un fragmento continuo que la respalde, omite la keyword.`);
    if (nuevas) {
      // Las propuestas del reintento reemplazan a las de citas inexistentes; el resto queda igual.
      propuestos = [...propuestos.filter(p => !pedidas.includes(p.keyword)), ...nuevas.filter(p => pedidas.includes(p.keyword))];
      aplicado = aplicarSemanticos(literal, keywordsJD, cvTexto, propuestos, opts.relevanciaMin);
    }
    const aceptadas = new Set([...aplicado.resultado.matches_directos, ...aplicado.resultado.matches_relacionados].map(m => m.keyword_jd));
    reintento = { pedidas, recuperadas: pedidas.filter(k => aceptadas.has(k)) };
  }
  return { ...aplicado, propuestos, reintento, usage };
}

// Aplica los filtros a propuestas ya obtenidas (del modelo o guardadas) y mueve a matches las brechas aceptadas.
export function aplicarSemanticos(
  literal: ResultadoMapeo,
  keywordsJD: KeywordsJD,
  cvTexto: string,
  propuestos: unknown,
  relevanciaMin?: number,
): { resultado: ResultadoMapeo; rechazos: Rechazo[] } {
  const brechas = literal.gap_keywords.filter(g => !esCarrera(g.keyword));
  const { aceptados, rechazos } = filtrarSemanticos(propuestos, brechas, cvTexto, relevanciaMin);
  const resueltas = new Set(aceptados.map(a => a.keyword_jd));
  const sinNivel = ({ nivel: _n, ...m }: MatchDirecto & { nivel: string }) => m;
  const resultado: ResultadoMapeo = {
    ...literal,
    matches_directos: [...literal.matches_directos, ...aceptados.filter(a => a.nivel === "directo").map(sinNivel)],
    matches_relacionados: [...literal.matches_relacionados, ...aceptados.filter(a => a.nivel === "relacionado").map(sinNivel)],
    gap_keywords: literal.gap_keywords.filter(g => !resueltas.has(g.keyword)),
  };
  resultado.score_adaptacion = scoreDesdeResultado(resultado, keywordsJD);
  return { resultado, rechazos };
}

// Recalcula el score desde un resultado ya armado (misma regla que mapearCompetencias).
export function scoreDesdeResultado(r: ResultadoMapeo, jd: KeywordsJD): number {
  const requeridas = jd.requeridas.map(k => k.keyword);
  const esReq = (k: string) => requeridas.includes(k);
  let cubiertas = 0, carreraCob = 0;
  const cubrir = (k: string, c: number) => {
    if (!esReq(k)) return;
    if (esCarrera(k)) carreraCob = Math.max(carreraCob, c); else cubiertas += c;
  };
  r.matches_directos.forEach(m => cubrir(m.keyword_jd, 1));
  r.matches_relacionados.forEach(m => cubrir(m.keyword_jd, PESO_RELACIONADO_EN_SCORE));
  const hayCarreras = requeridas.some(esCarrera);
  const total = requeridas.filter(k => !esCarrera(k)).length + (hayCarreras ? 1 : 0);
  return calcularScore(r, jd, { cubiertas: cubiertas + carreraCob, total });
}

// ─── score v2 (PED-30, sin API) ──────────────────────────────────────────────
// Pesos y umbrales fijados antes de mirar los resultados; no se ajustan caso a caso.
// - Cada keyword requerida pesa su relevancia del parser (1–10). Años y carrera pesan PESO_REQUISITO.
// - Cobertura: directo o cumple 1; relacionado o afín a revisar 0.5; brecha 0.
// - Brecha preguntable (leyes/normativas, plataformas/software, sectores, certificaciones): su peso cuenta 50%.
// - Brecha bloqueante: carrera, años o función central (todo lo que no es preguntable).

export const PESO_REQUISITO = 10;
export const PESO_BRECHA_PREGUNTABLE = 0.5;
export const UMBRAL_CLASE = { alto: 0.6, medio: 0.35 }; // alto ≥ 0.60 · medio 0.35–0.60 · bajo < 0.35

export type ClaseBrecha = "bloqueante" | "preguntable";
export type ClaseFit = "alto" | "medio" | "bajo";

export const RE_NORMATIVA = /\b(ley|leyes|normativa|normativas|norma|normas|reglamento|reglamentos|legislacion|compliance|iso|certificacion|certificaciones|certificado|acreditacion)\b/;
export const RE_SOFTWARE = /\b(excel|office|word|powerpoint|power bi|python|sql|sheets|canva|google|microsoft|portal|plataforma|plataformas|software|herramienta|herramientas|erp|crm|sistema|sistemas)\b/;
export const RE_SECTOR = /\b(sector|industria|rubro|fintech|mineria|minera|retail|startup|tecnologia|tecnologico|ciberseguridad|banca|seguros|construccion|faena|experiencia en)\b/;

// Nombre propio de herramienta: sigla en mayúsculas (SAP, SIGA, DAX, M&A) o camelCase (WebControl, BigQuery).
// Las siglas de área (RRHH, RR.HH., RRLL, TI) no son herramientas.
const SIGLAS_AREA = new Set(["RRHH", "RRLL", "TI", "HR", "DO"]);
export const pareceHerramienta = (k: string) => k.split(/\s+/)
  .filter(t => !SIGLAS_AREA.has(t.replace(/[.,;:()]/g, "")))
  .some(t => /^[A-Z0-9&.]{2,}$/.test(t) || /[a-z][A-Z]/.test(t));

export function clasificarBrecha(keyword: string): ClaseBrecha {
  const n = normalizarParaComparar(keyword);
  if (RE_NORMATIVA.test(n) || RE_SOFTWARE.test(n) || RE_SECTOR.test(n) || pareceHerramienta(keyword)) return "preguntable";
  return "bloqueante";
}

export interface BrechaV2 { descripcion: string; peso: number; clase: ClaseBrecha }

export interface ScoreV2 {
  score: number;
  clase: ClaseFit;
  bloqueantes: BrechaV2[];
  preguntables: BrechaV2[];
}

export function claseFit(score: number): ClaseFit {
  return score >= UMBRAL_CLASE.alto ? "alto" : score >= UMBRAL_CLASE.medio ? "medio" : "bajo";
}

// `clasificar` permite otra clasificación de brechas (PED-33, informe-fit.ts) con los mismos pesos y umbrales.
// `requisitoPreguntable` (PED-36): un requisito no cumplido que el informe convierte en pregunta pesa 50%, como una
// brecha preguntable.
export function scoreV2(
  r: ResultadoMapeo, jd: KeywordsJD, clasificar: (keyword: string) => ClaseBrecha = clasificarBrecha,
  requisitoPreguntable: (q: ResultadoRequisito) => boolean = () => false,
): ScoreV2 {
  const cobertura = new Map<string, number>();
  r.matches_directos.forEach(m => cobertura.set(m.keyword_jd, 1));
  r.matches_relacionados.forEach(m => { if (!cobertura.has(m.keyword_jd)) cobertura.set(m.keyword_jd, PESO_RELACIONADO_EN_SCORE); });

  let cubierto = 0, total = 0;
  const bloqueantes: BrechaV2[] = [], preguntables: BrechaV2[] = [];
  for (const k of jd.requeridas) {
    const cob = cobertura.get(k.keyword) ?? 0;
    if (cob > 0) { cubierto += k.relevancia * cob; total += k.relevancia; continue; }
    const clase = esCarrera(k.keyword) ? "bloqueante" : clasificar(k.keyword);
    const peso = k.relevancia * (clase === "preguntable" ? PESO_BRECHA_PREGUNTABLE : 1);
    total += peso;
    (clase === "preguntable" ? preguntables : bloqueantes).push({ descripcion: k.keyword, peso: k.relevancia, clase });
  }
  for (const q of (r.requisitos ?? []).filter(q => q.tipo === "requerido")) {
    const cob = COBERTURA_REQUISITO[q.estado];
    const preguntable = cob === 0 && requisitoPreguntable(q);
    total += PESO_REQUISITO * (preguntable ? PESO_BRECHA_PREGUNTABLE : 1);
    cubierto += PESO_REQUISITO * cob;
    if (cob === 0) (preguntable ? preguntables : bloqueantes).push({ descripcion: q.descripcion, peso: PESO_REQUISITO, clase: preguntable ? "preguntable" : "bloqueante" });
  }
  const score = total === 0 ? 0 : Math.round((cubierto / total) * 100) / 100;
  return { score, clase: claseFit(score), bloqueantes, preguntables };
}

// ─── alerta de nivel (no cambia el score) ────────────────────────────────────
// Rango de años esperado por nivel de la posición. Sobrecalificado: más de 3 años sobre el tope del rango,
// o al menos el triple del mínimo pedido. Subcalificado: menos que el mínimo pedido o que el piso del rango.

const RANGO_NIVEL: Record<string, [number, number]> = {
  practicante: [0, 1], junior: [0, 3], "semi-senior": [2, 6], senior: [5, Infinity], jefatura: [5, Infinity],
};

export type AlertaNivel = "sobrecalificado" | "subcalificado" | null;

export function alertaNivel(cvTexto: string, jd: KeywordsJD, nivelPosicion?: string): { alerta: AlertaNivel; anios_cv: number; detalle: string } {
  const anios = aniosDeExperiencia(puestosCV(cvTexto));
  const minimo = Math.max(0, ...(jd.experiencia ?? []).filter(e => e.tipo === "requerido").map(e => e.anios_minimos));
  const rango = nivelPosicion ? RANGO_NIVEL[nivelPosicion.toLowerCase()] : undefined;
  const base = `${anios} años en el CV · pide ${minimo || "—"} · nivel ${nivelPosicion ?? "?"}`;
  if (anios < minimo || (rango && anios < rango[0])) return { alerta: "subcalificado", anios_cv: anios, detalle: base };
  if ((rango && Number.isFinite(rango[1]) && anios > rango[1] + 3) || (minimo > 0 && anios >= 3 * minimo)) {
    return { alerta: "sobrecalificado", anios_cv: anios, detalle: base };
  }
  return { alerta: null, anios_cv: anios, detalle: base };
}

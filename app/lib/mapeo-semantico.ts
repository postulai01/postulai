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
export const MODELO_MAPEO = "claude-haiku-4-5-20251001";

// Nombres de carreras chilenas frecuentes en ofertas, sobre texto normalizado.
const PATRON_CARRERA = new RegExp("^(" + [
  "ingenieria", "ingeniero", "licenciatura", "psicologia", "derecho", "economia", "contador", "contabilidad",
  "auditoria", "administracion (publica|de empresas)", "periodismo", "arquitectura", "medicina", "enfermeria",
  "kinesiologia", "sociologia", "trabajo social", "tecnico (en|de)", "diseno", "pedagogia", "agronomia",
  "geologia", "bioquimica", "quimica", "nutricion", "fonoaudiologia", "terapia ocupacional", "odontologia",
].join("|") + ")\\b");

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
const RE_EXPERIENCIA = /^(experiencia|antecedentes laborales|trayectoria)/;

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
// de cada una quedan las palabras que identifican el tema: sin stop words, sin "experiencia/profesional/general",
// sin raíces genéricas. Sin ninguna palabra propia → experiencia total.
function segmentosArea(area: string | null): string[][] {
  if (!area) return [];
  return area.split(/,|\/|\s+o\s+|\s+y\s+/i)
    .map(seg => palabras(seg).filter(p => !/^(experiencia|profesional|general|area|cargo|similar|relacionad|empresa)/.test(p) && !RAICES_GENERICAS.has(raiz(p))))
    .filter(seg => seg.length > 0);
}

// El puesto es del área si alguna alternativa tiene al menos la mitad de sus palabras en el cargo o las viñetas.
function puestoEnArea(p: PuestoCV, segmentos: string[][]): boolean {
  const t = normalizarParaComparar(p.texto);
  const esta = (w: string) => matcheaPalabra(w, t) || t.split(" ").some(x => x.length >= 6 && x.startsWith(raiz(w)));
  return segmentos.some(seg => seg.filter(esta).length >= Math.ceil(seg.length / 2));
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
    });
  }
  for (const c of jd.carreras ?? []) {
    const calza = c.carreras.find(k => lineaConKeyword(cvTexto, k));
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

export function promptSemantico(brechas: { keyword: string }[], cvTexto: string): string {
  return `KEYWORDS SIN MATCH:\n${brechas.map(b => `- ${b.keyword}`).join("\n")}\n\nCV:\n${cvTexto}`;
}

export interface Rechazo { keyword: string; cita: string; motivo: string }

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
    const keyword = typeof m?.keyword === "string" ? m.keyword.trim() : "";
    const cita = typeof m?.cita === "string" ? colapsar(m.cita) : "";
    const relevancia = Number(m?.relevancia);
    const rechazar = (motivo: string) => rechazos.push({ keyword, cita, motivo });
    const brecha = brechas.find(b => normalizarParaComparar(b.keyword) === normalizarParaComparar(keyword));
    if (!brecha) { rechazar("keyword que no era brecha"); continue; }
    if (aceptados.some(a => a.keyword_jd === brecha.keyword)) continue;
    if (!cita || !cv.includes(cita)) { rechazar("la cita no existe literal en el CV"); continue; }
    if (!Number.isFinite(relevancia) || relevancia < relevanciaMin) { rechazar(`relevancia ${m?.relevancia} < ${relevanciaMin}`); continue; }
    // Si keyword y cita comparten raíces y todas son genéricas, es un parecido de palabras, no un match.
    const rk = new Set(palabras(brecha.keyword).map(raiz));
    const comunes = [...new Set(palabras(cita).map(raiz))].filter(r => rk.has(r));
    if (comunes.length > 0 && comunes.every(r => RAICES_GENERICAS.has(r))) { rechazar(`solo comparte raíces genéricas (${comunes.join(", ")})`); continue; }
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
export async function mapearSemantico(
  literal: ResultadoMapeo,
  keywordsJD: KeywordsJD,
  cvTexto: string,
  opts: { client?: Anthropic; relevanciaMin?: number } = {},
): Promise<{ resultado: ResultadoMapeo; rechazos: Rechazo[]; usage?: Anthropic.Usage }> {
  const brechas = literal.gap_keywords.filter(g => !esCarrera(g.keyword));
  if (brechas.length === 0) return { resultado: literal, rechazos: [] };
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create(
    {
      model: MODELO_MAPEO,
      max_tokens: 1500,
      temperature: 0,
      system: SYSTEM_MAPEO_SEMANTICO,
      messages: [{ role: "user", content: promptSemantico(brechas, cvTexto) }],
    },
    { timeout: 30_000, maxRetries: 1 },
  );
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  let propuestos: unknown = [];
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    propuestos = m ? JSON.parse(m[0]).matches : [];
  } catch {
    console.warn("[postulai] Mapeo semántico: respuesta sin JSON válido; se conserva el mapeo literal");
    return { resultado: literal, rechazos: [], usage: res.usage };
  }
  const { aceptados, rechazos } = filtrarSemanticos(propuestos, brechas, cvTexto, opts.relevanciaMin);
  const resueltas = new Set(aceptados.map(a => a.keyword_jd));
  const sinNivel = ({ nivel: _n, ...m }: MatchDirecto & { nivel: string }) => m;
  const resultado: ResultadoMapeo = {
    ...literal,
    matches_directos: [...literal.matches_directos, ...aceptados.filter(a => a.nivel === "directo").map(sinNivel)],
    matches_relacionados: [...literal.matches_relacionados, ...aceptados.filter(a => a.nivel === "relacionado").map(sinNivel)],
    gap_keywords: literal.gap_keywords.filter(g => !resueltas.has(g.keyword)),
  };
  resultado.score_adaptacion = scoreDesdeResultado(resultado, keywordsJD);
  return { resultado, rechazos, usage: res.usage };
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

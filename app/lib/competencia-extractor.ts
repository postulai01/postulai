/**
 * Extractor de competencias del CV original (PED-20, base de v11.0).
 * Numera las líneas del CV con su sección y envía TODAS en una sola llamada a Haiku, que devuelve
 * competencias, herramientas y certificaciones por línea. Una llamada por CV en vez de una por bullet:
 * menos latencia y el mismo costo o menor (el system prompt se paga una vez).
 * Lo que devuelve el modelo se valida contra la línea citada; lo que no tiene respaldo se descarta.
 * Los idiomas se detectan sin API.
 */
import Anthropic from "@anthropic-ai/sdk";
import { herramientaTieneRespaldo, normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { BLANDAS_PROHIBIDAS, esEncabezado, esSeparador, FRASES_CV, FRASES_PERFIL } from "./cv-verificacion";

export const MODELO_EXTRACCION = "claude-haiku-4-5-20251001";

export interface Competencia {
  nombre: string;
  tipo: "tecnica" | "blanda";
  fuente: string;    // primera línea del CV que la respalda
  menciones: number; // cantidad de líneas distintas que la respaldan
  variantes?: string[]; // otros nombres fusionados en esta competencia (sirven para el matching)
}

export interface ResultadoExtraccion {
  competencias: Competencia[];
  herramientas: string[];
  idiomas: string[];
  certificaciones: string[];
  descartadas: string[]; // elementos del modelo sin respaldo en su línea
  usage?: Anthropic.Usage;
}

export interface LineaCV {
  id: string;
  seccion: string;
  texto: string;
}

const SYSTEM_EXTRACCION = `Extraes las competencias de un CV en español. Recibes sus líneas numeradas, cada una con la sección donde aparece. Para cada línea identifica solo lo que esa línea dice explícitamente:
- competencias: capacidades profesionales que la línea declara o demuestra (por ejemplo: negociación colectiva, reclutamiento y selección, análisis de datos, liderazgo de equipos). tipo "tecnica" si es un conocimiento o función propia del oficio; "blanda" si es interpersonal o de autogestión (comunicación, trabajo en equipo, liderazgo, adaptabilidad). Nombre breve, de 1 a 4 palabras, en minúscula salvo nombres propios, sin nivel ni adjetivos (nada de "amplia experiencia en", "avanzado", "sólido").
- herramientas: software, plataformas, lenguajes o sistemas con nombre propio, escritos como aparecen en la línea.
- certificaciones: certificaciones, diplomados o cursos con nombre, escritos como aparecen en la línea.

Reglas:
- No infieras lo que la línea no dice: un cargo no implica sus competencias y una carrera no implica sus ramos.
- Los nombres de empresa, fechas y títulos de cargo no tienen competencias.
- Usa exactamente el mismo nombre para la misma competencia en distintas líneas.
- Omite las líneas que no tienen nada.

Responde ÚNICAMENTE con un JSON válido: {"lineas":[{"id":"L3","competencias":[{"nombre":"...","tipo":"tecnica"}],"herramientas":["..."],"certificaciones":["..."]}]}`;

const LINEA_CONTACTO = /@|\+\s?56|m[oó]vil|tel[eé]fono|linkedin\.com/i;

// ─── líneas numeradas ────────────────────────────────────────────────────────
// Misma detección de encabezados que cv-verificacion.ts, pero sobre el CV original: las líneas antes
// del primer encabezado (resumen, stack) van a la sección INICIO en vez de perderse.

export function lineasCV(cv: string): LineaCV[] {
  const lineas = cv.split("\n");
  const primera = lineas.findIndex(l => l.trim().length > 0); // nombre del candidato
  const out: LineaCV[] = [];
  let seccion = "INICIO";
  for (let i = primera + 1; i < lineas.length; i++) {
    const t = lineas[i].trim();
    if (!t || esSeparador(t) || LINEA_CONTACTO.test(t)) continue;
    if (esEncabezado(t)) { seccion = t; continue; }
    out.push({ id: `L${i}`, seccion, texto: t.replace(/^[-•]\s+/, "") });
  }
  return out;
}

// ─── idiomas (sin API) ───────────────────────────────────────────────────────

const IDIOMAS: [RegExp, string][] = [
  [/\bespanol\b/, "Español"], [/\bingles\b/, "Inglés"], [/\bportugues\b/, "Portugués"],
  [/\bfrances\b/, "Francés"], [/\baleman\b/, "Alemán"], [/\bitaliano\b/, "Italiano"],
  [/\b(mandarin|chino)\b/, "Chino"], [/\bjapones\b/, "Japonés"], [/\bcoreano\b/, "Coreano"],
];
const NIVEL_IDIOMA = /\b(nativo|nativa|materno|basico|intermedio|avanzado|fluido|bilingue|[abc][12])\b/;

export function extraerIdiomas(cv: string): string[] {
  const niveles = new Map<string, string | null>();
  for (const linea of cv.split("\n")) {
    const n = normalizarParaComparar(linea);
    for (const [re, idioma] of IDIOMAS) {
      if (!re.test(n)) continue;
      const nivel = n.match(NIVEL_IDIOMA)?.[1] ?? null;
      if (!niveles.get(idioma)) niveles.set(idioma, nivel);
    }
  }
  return [...niveles].map(([idioma, nivel]) => (nivel ? `${idioma} (${nivel})` : idioma));
}

// ─── respaldo de lo que devuelve el modelo ───────────────────────────────────

// Una competencia tiene respaldo si cada una de sus palabras de 5+ letras aparece (por sus primeras
// 5 letras) al inicio de una palabra de la línea: "liderazgo" ← "Lideré", "negociación" ← "negociación".
export function competenciaTieneRespaldo(nombre: string, lineaNorm: string): boolean {
  const palabras = normalizarParaComparar(nombre).split(" ").filter(p => p.length >= 5);
  if (palabras.length === 0) return lineaNorm.includes(normalizarParaComparar(nombre));
  return palabras.every(p => new RegExp(`\\b${p.slice(0, 5)}`).test(lineaNorm));
}

interface RespuestaLinea {
  id?: unknown;
  competencias?: { nombre?: unknown; tipo?: unknown }[];
  herramientas?: unknown[];
  certificaciones?: unknown[];
}

export function consolidar(lineas: LineaCV[], respuesta: RespuestaLinea[]): Omit<ResultadoExtraccion, "idiomas" | "usage"> {
  const porId = new Map(lineas.map(l => [l.id, l]));
  const competencias = new Map<string, Competencia & { ids: Set<string> }>();
  const herramientas = new Map<string, string>();
  const certificaciones = new Map<string, string>();
  const descartadas: string[] = [];

  for (const r of respuesta) {
    const linea = typeof r.id === "string" ? porId.get(r.id) : undefined;
    if (!linea) continue;
    const lineaNorm = normalizarParaComparar(linea.texto);

    for (const c of r.competencias ?? []) {
      if (typeof c.nombre !== "string" || !c.nombre.trim()) continue;
      const nombre = c.nombre.trim();
      if (!competenciaTieneRespaldo(nombre, lineaNorm)) { descartadas.push(`competencia "${nombre}" (${linea.id})`); continue; }
      const clave = normalizarParaComparar(nombre);
      const previa = competencias.get(clave);
      if (previa) { previa.ids.add(linea.id); continue; }
      competencias.set(clave, {
        nombre, tipo: c.tipo === "blanda" ? "blanda" : "tecnica", fuente: linea.texto, menciones: 0, ids: new Set([linea.id]),
      });
    }

    for (const [lista, destino, etiqueta] of [
      [r.herramientas, herramientas, "herramienta"], [r.certificaciones, certificaciones, "certificación"],
    ] as const) {
      for (const h of lista ?? []) {
        if (typeof h !== "string" || !h.trim()) continue;
        if (!herramientaTieneRespaldo(h, lineaNorm)) { descartadas.push(`${etiqueta} "${h}" (${linea.id})`); continue; }
        const clave = normalizarParaComparar(h);
        if (!destino.has(clave)) destino.set(clave, h.trim());
      }
    }
  }

  const fusion = fusionarCompetencias([...competencias.values()]);
  descartadas.push(...fusion.descartadas);

  return {
    competencias: fusion.competencias,
    herramientas: [...herramientas.values()],
    certificaciones: [...certificaciones.values()],
    descartadas,
  };
}

// ─── casi-duplicados y frases prohibidas (sin API) ───────────────────────────
// Dos competencias se fusionan si las palabras significativas de una están todas en la otra:
// "reclutamiento" ⊂ "reclutamiento y selección"; "evaluación del desempeño" = "evaluación de desempeño".
// La fusión es transitiva: "compensaciones" y "remuneraciones" se unen a través de
// "compensaciones y remuneraciones". Los demás nombres quedan en `variantes` para el matching.

// Frases que el CV adaptado no puede usar (cv-verificacion.ts). Los verbos de soporte no aplican a un
// nombre de competencia: descartarían "trabajo colaborativo".
const FRASES_PROHIBIDAS = [...BLANDAS_PROHIBIDAS, ...FRASES_CV, ...FRASES_PERFIL]
  .filter(([, nombre]) => !["verbo de soporte", "asistir", "gerundio de soporte"].includes(nombre));

export function fraseProhibida(nombre: string): string | null {
  const n = normalizarParaComparar(nombre);
  return FRASES_PROHIBIDAS.find(([re]) => re.test(n))?.[1] ?? null;
}

// Palabras significativas en singular: "negociaciones colectivas" → {negociacion, colectiva}.
function palabrasClave(nombre: string): Set<string> {
  return new Set(normalizarParaComparar(nombre).split(" ")
    .filter(p => p && !STOP_WORDS_MATCH.has(p))
    .map(p => p.replace(/ciones$/, "cion").replace(/([aeiou])s$/, "$1")));
}

const contenida = (a: Set<string>, b: Set<string>) => [...a].every(p => b.has(p));

interface CompetenciaInterna extends Competencia {
  ids?: Set<string>; // líneas que la respaldan; sin ids (resultados guardados) se suman las menciones
}

export function fusionarCompetencias(items: CompetenciaInterna[]): { competencias: Competencia[]; descartadas: string[] } {
  const claves = items.map(c => palabrasClave(c.nombre));
  const padre = items.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (claves[i].size === 0 || claves[j].size === 0) continue;
      if (contenida(claves[i], claves[j]) || contenida(claves[j], claves[i])) padre[raiz(j)] = raiz(i);
    }
  }
  const grupos = new Map<number, number[]>();
  items.forEach((_, i) => grupos.set(raiz(i), [...(grupos.get(raiz(i)) ?? []), i]));

  const competencias: Competencia[] = [];
  const descartadas: string[] = [];
  for (const miembros of grupos.values()) {
    const validos = miembros.filter(i => {
      const motivo = fraseProhibida(items[i].nombre);
      if (motivo) descartadas.push(`competencia "${items[i].nombre}" (frase prohibida: ${motivo})`);
      return !motivo;
    });
    if (validos.length === 0) continue;

    // Nombre del grupo: el de menos palabras; si empatan, el que respaldan más menciones de los miembros
    // que lo contienen ("compensaciones" gana a "remuneraciones" por "compensaciones y beneficios").
    const respaldo = (i: number) => miembros.filter(k => contenida(claves[i], claves[k])).reduce((s, k) => s + items[k].menciones, 0);
    const [canon] = [...validos].sort((a, b) =>
      claves[a].size - claves[b].size
      || respaldo(b) - respaldo(a)
      || items[b].menciones - items[a].menciones
      || a - b);

    // Las líneas de una variante prohibida también respaldan al grupo ("emprendimiento end-to-end" → emprendimiento).
    const conIds = miembros.every(i => items[i].ids);
    const ids = new Set(miembros.flatMap(i => [...(items[i].ids ?? [])]));
    const menciones = conIds ? ids.size : miembros.reduce((s, i) => s + items[i].menciones, 0);
    const variantes = validos.filter(i => i !== canon).map(i => items[i].nombre);
    const { nombre, tipo, fuente } = items[canon];
    competencias.push({ nombre, tipo, fuente, menciones, ...(variantes.length ? { variantes } : {}) });
  }
  return { competencias: competencias.sort((a, b) => b.menciones - a.menciones), descartadas };
}

// ─── función principal ───────────────────────────────────────────────────────

export async function extraerCompetencias(
  cvOriginal: string,
  opts: { client?: Anthropic } = {}
): Promise<ResultadoExtraccion> {
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const lineas = lineasCV(cvOriginal);
  const idiomas = extraerIdiomas(cvOriginal);
  if (lineas.length === 0) return { competencias: [], herramientas: [], idiomas, certificaciones: [], descartadas: [] };

  const res = await client.messages.create(
    {
      model: MODELO_EXTRACCION,
      max_tokens: 4000,
      temperature: 0,
      system: SYSTEM_EXTRACCION,
      messages: [{ role: "user", content: `LÍNEAS DEL CV:\n${JSON.stringify(lineas, null, 1)}` }],
    },
    { timeout: 30_000, maxRetries: 1 }
  );
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("la respuesta del extractor no contiene JSON");
  const parsed = JSON.parse(m[0]) as { lineas?: RespuestaLinea[] };

  const resultado = consolidar(lineas, parsed.lineas ?? []);
  if (resultado.descartadas.length > 0) {
    console.warn(`[postulai] Extractor: descartadas sin respaldo en su línea: ${resultado.descartadas.join("; ")}`);
  }
  return { ...resultado, idiomas, usage: res.usage };
}

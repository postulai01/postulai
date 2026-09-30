/**
 * Priorizador (PED-31): reordena el CV según la oferta sin escribir ni borrar texto.
 * - Viñetas: se reordenan SOLO dentro de su puesto; los puestos no se mueven (la cronología se respeta).
 * - Listas en línea ("Áreas de Expertise: A, B, C", líneas del stack, habilidades): se reordenan sus ítems.
 *   Solo se corrige un separador faltante evidente (dos frases conocidas pegadas) y se reporta.
 * - Puntaje por tema central: relevancia máxima de las keywords que respalda + 0.25 × la suma de las demás.
 *   Requeridas pesan su relevancia; deseables, la mitad. Respaldo completo si la línea contiene la keyword, o la
 *   competencia/cita de un match directo; la mitad si contiene la competencia/cita de un match relacionado.
 * - Una palabra de la keyword está en la línea si aparece igual o comparte una raíz no genérica ("presupuestario" ↔
 *   "presupuestos"). Las palabras con raíz genérica (RAICES_GENERICAS) no se exigen ni cuentan.
 * - Modo por defecto: tema central + raíces + etiquetas (EtiquetasOrden, de etiquetarVinetas: una llamada a Haiku
 *   por CV, cacheada en los evals). Las etiquetas solo suman al puntaje para ORDENAR; nunca cambian el texto, el
 *   mapeo ni el score. Sin etiquetas, ordena solo por reglas.
 * - Viñetas casi duplicadas entre puestos: se conserva la copia que puntúa más alto; la otra queda como candidata.
 * - Empates: orden original (orden estable).
 * - Invariante: el multiconjunto de líneas es idéntico antes y después (las listas se comparan por sus palabras).
 */
import Anthropic from "@anthropic-ai/sdk";
import { normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { RAICES_GENERICAS, type KeywordsJD, type ResultadoMapeo } from "./mapeo-semantico";
import { bloquesCV } from "./reescritor-contextual";

export interface KeywordPuntaje { keyword: string; puntaje: number }

export interface Movimiento {
  bloque: string;            // título del puesto o de la lista
  tipo: "vineta" | "item";
  texto: string;
  de: number;                // posición 1-based dentro del puesto o la lista
  a: number;
  puntaje: number;
  keywords: KeywordPuntaje[];
}

export interface CorreccionSeparador { linea: number; antes: string; despues: string }
export interface CandidataAcortar { texto: string; puesto: string; motivo: string }

export interface ResultadoPriorizacion {
  cv: string;
  movimientos: Movimiento[];
  separadores: CorreccionSeparador[];
  candidatas: CandidataAcortar[];   // viñetas casi duplicadas entre puestos
  sinPuntaje: CandidataAcortar[];   // informativo: viñetas que no respaldan ninguna keyword
  primeras: { puesto: string; antes: string; despues: string; puntaje: number }[]; // primera viñeta de cada puesto
  puestos: { puesto: string; vinetas: VinetaOrdenada[] }[]; // viñetas de cada puesto en el orden final
}

// Etiquetas de Haiku: índice de línea en cv.split("\n") → keywords de la oferta que esa viñeta evidencia.
// SOLO sirven para ORDENAR viñetas dentro de su puesto. No son evidencia para el mapeo, el score ni el reescritor,
// y ningún otro módulo debe importarlas: el modelo solo las filtra por keyword válida y número de viñeta.
export type EtiquetasOrden = Record<number, string[]>;

export interface VinetaOrdenada { texto: string; puntaje: number; keywords: KeywordPuntaje[] }

export interface InputPriorizacion {
  cv: string;
  mapeo: ResultadoMapeo;
  keywordsJD: KeywordsJD;
  frasesConocidas?: string[]; // competencias del CV y keywords: sirven para detectar separadores faltantes
  etiquetas?: EtiquetasOrden; // solo afectan el orden (ver EtiquetasOrden)
  puntaje?: "tema" | "suma";  // "suma": variante anterior (suma simple), para comparar
  raices?: boolean;           // false: sin match por raíz (variante anterior)
}

export const PESO_SECUNDARIAS = 0.25;

const SIMILITUD_REPETIDA = 0.6;

// ─── palabras ────────────────────────────────────────────────────────────────

const singular = (p: string) => p.replace(/ciones$/, "cion").replace(/([aeiou])s$/, "$1");
const contenido = (t: string) => normalizarParaComparar(t).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p)).map(singular);
const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();

const raiz = (p: string) => p.slice(0, 5);

// Con raíces: se exigen las palabras de raíz no genérica (igual o misma raíz); si la frase solo tiene palabras
// genéricas, se exigen todas literales.
function contiene(texto: string, frase: string, conRaices = true): boolean {
  const t = contenido(texto);
  const ts = new Set(t);
  const f = contenido(frase);
  if (f.length === 0) return false;
  if (!conRaices) return f.every(p => ts.has(p));
  const propias = f.filter(p => !RAICES_GENERICAS.has(raiz(p)));
  if (propias.length === 0) return f.every(p => ts.has(p));
  const raices = new Set(t.filter(p => p.length >= 5).map(raiz));
  return propias.every(p => ts.has(p) || (p.length >= 5 && raices.has(raiz(p))));
}

// ─── puntaje ─────────────────────────────────────────────────────────────────

interface Respaldo { keyword: string; peso: number; frases: { texto: string; factor: number }[] }

function respaldos(mapeo: ResultadoMapeo, jd: KeywordsJD): Respaldo[] {
  const peso = new Map<string, number>();
  for (const k of jd.deseables) peso.set(k.keyword, k.relevancia / 2);
  for (const k of jd.requeridas) peso.set(k.keyword, k.relevancia);
  return [...peso].map(([keyword, p]) => {
    const frases: { texto: string; factor: number }[] = [{ texto: keyword, factor: 1 }];
    for (const [lista, factor] of [[mapeo.matches_directos, 1], [mapeo.matches_relacionados, 0.5]] as const) {
      for (const m of lista.filter(m => m.keyword_jd === keyword)) {
        if (m.cita) frases.push({ texto: m.cita, factor });
        else if (m.competencia_cv !== "(texto del CV)") frases.push({ texto: m.competencia_cv, factor });
      }
    }
    return { keyword, peso: p, frases };
  });
}

// La cita de un match semántico cuenta si está dentro de la línea (o la línea dentro de la cita); el resto, por palabras.
// Las etiquetas del modelo cuentan como respaldo completo de esa keyword.
function puntuar(
  texto: string, rs: Respaldo[], opts: { etiquetas?: string[]; modo?: "tema" | "suma"; raices?: boolean } = {},
): { puntaje: number; keywords: KeywordPuntaje[] } {
  const col = colapsar(texto);
  const keywords: KeywordPuntaje[] = [];
  for (const r of rs) {
    let factor = opts.etiquetas?.includes(r.keyword) ? 1 : 0;
    for (const f of r.frases) {
      const esta = f.texto.split(/\s+/).length >= 5
        ? col.includes(colapsar(f.texto)) || colapsar(f.texto).includes(col)
        : contiene(texto, f.texto, opts.raices !== false);
      if (esta) factor = Math.max(factor, f.factor);
    }
    if (factor > 0) keywords.push({ keyword: r.keyword, puntaje: Math.round(r.peso * factor * 10) / 10 });
  }
  keywords.sort((a, b) => b.puntaje - a.puntaje);
  const total = opts.modo === "suma"
    ? keywords.reduce((s, k) => s + k.puntaje, 0)
    : (keywords[0]?.puntaje ?? 0) + PESO_SECUNDARIAS * keywords.slice(1).reduce((s, k) => s + k.puntaje, 0);
  return { puntaje: Math.round(total * 10) / 10, keywords };
}

// Orden estable por puntaje descendente.
function ordenar<T extends { puntaje: number; pos: number }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => b.puntaje - a.puntaje || a.pos - b.pos);
}

// ─── listas en línea ─────────────────────────────────────────────────────────

const RE_LISTA = /^(\s*(?:[-•]\s+)?[^:]{2,60}:\s*)(.+?)(\.?)\s*$/;
const CONECTORES_FINALES = /(\b(de|del|y|e|o|u|con|en|para|a|la|el)|&)$/i;

// "Desarrollo Organizacional Presupuestos y Control de Gestión": si un ítem termina en una frase conocida y lo que
// queda antes tiene 2+ palabras y no termina en conector, falta una coma entre ambos.
function separarPegados(items: string[], frases: string[]): { items: string[]; corregido: boolean } {
  let corregido = false;
  const out = items.flatMap(item => {
    for (const f of frases) {
      const nf = normalizarParaComparar(f);
      if (nf.split(" ").length < 2) continue;
      const palabras = item.split(/\s+/);
      for (let i = 2; i < palabras.length; i++) {
        const cola = palabras.slice(i).join(" ");
        if (!/^\p{L}/u.test(cola) || normalizarParaComparar(cola) !== nf) continue; // "& HR Analytics" ya está separado
        const cabeza = palabras.slice(0, i).join(" ");
        if (CONECTORES_FINALES.test(cabeza)) continue;
        corregido = true;
        return [cabeza, cola];
      }
    }
    return [item];
  });
  return { items: out, corregido };
}

const canonica = (l: string) => normalizarParaComparar(l).split(" ").filter(Boolean).sort().join(" ");

// ─── función principal ───────────────────────────────────────────────────────

export function priorizarCV(input: InputPriorizacion): ResultadoPriorizacion {
  const { cv, mapeo, keywordsJD } = input;
  const lineas = cv.split("\n");
  const nuevas = [...lineas];
  const rs = respaldos(mapeo, keywordsJD);
  const frases = [...new Set([...(input.frasesConocidas ?? []), ...keywordsJD.requeridas.map(k => k.keyword), ...keywordsJD.deseables.map(k => k.keyword)])]
    .sort((a, b) => b.length - a.length);
  const bloques = bloquesCV(cv);
  const movimientos: Movimiento[] = [];
  const separadores: CorreccionSeparador[] = [];
  const candidatas: CandidataAcortar[] = [];
  const sinPuntaje: CandidataAcortar[] = [];
  const opcionesPuntaje = (i?: number) => ({ etiquetas: i === undefined ? undefined : input.etiquetas?.[i], modo: input.puntaje, raices: input.raices });
  const primeras: ResultadoPriorizacion["primeras"] = [];
  const indicesLista = new Set<number>();
  const esVineta = (i: number) => /^\s*[-•]\s+/.test(lineas[i]);

  // Viñetas dentro de cada puesto.
  const vinetasPorPuesto: { puesto: string; texto: string; puntaje: number }[] = [];
  const puestos: ResultadoPriorizacion["puestos"] = [];
  for (const b of bloques.filter(b => b.tipo === "puesto")) {
    const pos = b.indices.filter(esVineta);
    if (pos.length === 0) continue;
    const vs = pos.map((i, k) => ({ i, pos: k, texto: lineas[i], ...puntuar(lineas[i], rs, opcionesPuntaje(i)) }));
    const ordenadas = ordenar(vs);
    ordenadas.forEach((v, k) => {
      nuevas[pos[k]] = v.texto;
      if (k !== v.pos) movimientos.push({ bloque: b.titulo, tipo: "vineta", texto: v.texto.trim(), de: v.pos + 1, a: k + 1, puntaje: v.puntaje, keywords: v.keywords });
      if (v.puntaje === 0) sinPuntaje.push({ texto: v.texto.trim(), puesto: b.titulo, motivo: "no respalda ninguna keyword de la oferta" });
    });
    primeras.push({ puesto: b.titulo, antes: vs[0].texto.trim(), despues: ordenadas[0].texto.trim(), puntaje: ordenadas[0].puntaje });
    puestos.push({ puesto: b.titulo, vinetas: ordenadas.map(v => ({ texto: v.texto.trim(), puntaje: v.puntaje, keywords: v.keywords })) });
    for (const v of vs) vinetasPorPuesto.push({ puesto: b.titulo, texto: v.texto.replace(/^\s*[-•]\s+/, "").trim(), puntaje: v.puntaje });
  }

  // Viñetas casi idénticas en distintos puestos.
  for (let a = 0; a < vinetasPorPuesto.length; a++) {
    for (let b = a + 1; b < vinetasPorPuesto.length; b++) {
      const x = vinetasPorPuesto[a], y = vinetasPorPuesto[b];
      if (x.puesto === y.puesto) continue;
      const sx = new Set(contenido(x.texto)), sy = new Set(contenido(y.texto));
      const inter = [...sx].filter(p => sy.has(p)).length;
      const jaccard = inter / (sx.size + sy.size - inter);
      if (jaccard >= SIMILITUD_REPETIDA) {
        // Se conserva la copia que puntúa más alto (empate: la del puesto más reciente, que aparece primero).
        const [queda, sobra] = y.puntaje > x.puntaje ? [y, x] : [x, y];
        candidatas.push({ texto: sobra.texto, puesto: sobra.puesto, motivo: `casi idéntica (${Math.round(jaccard * 100)}%) a la de ${queda.puesto}, que puntúa ${queda.puntaje} (esta: ${sobra.puntaje})` });
      }
    }
  }

  // Listas en línea fuera de los puestos.
  for (const b of bloques.filter(b => b.tipo !== "puesto")) {
    for (const i of b.indices) {
      const m = lineas[i].match(RE_LISTA);
      if (!m) continue;
      const [, prefijo, cuerpo, punto] = m;
      const originales = cuerpo.split(/\s*,\s*/).filter(Boolean);
      const { items, corregido } = separarPegados(originales, frases);
      if (items.length < 3) continue;
      const puntuados = items.map((t, k) => ({ t, pos: k, ...puntuar(t, rs, opcionesPuntaje()) }));
      const ordenados = ordenar(puntuados);
      const linea = `${prefijo}${ordenados.map(x => x.t).join(", ")}${punto}`;
      if (linea === lineas[i]) continue;
      indicesLista.add(i);
      nuevas[i] = linea;
      if (corregido) separadores.push({ linea: i + 1, antes: lineas[i].trim(), despues: `${prefijo}${items.join(", ")}${punto}`.trim() });
      const titulo = prefijo.replace(/^\s*[-•]\s+/, "").replace(/:\s*$/, "");
      ordenados.forEach((x, k) => {
        if (k !== x.pos) movimientos.push({ bloque: titulo, tipo: "item", texto: x.t, de: x.pos + 1, a: k + 1, puntaje: x.puntaje, keywords: x.keywords });
      });
    }
  }

  const resultado = nuevas.join("\n");
  verificarInvariante(lineas, nuevas, indicesLista);
  return { cv: resultado, movimientos, separadores, candidatas, sinPuntaje, primeras, puestos };
}

// Mismo multiconjunto de líneas; las listas reordenadas se comparan en su posición por sus palabras.
export function verificarInvariante(antes: string[], despues: string[], indicesLista: Set<number>): void {
  if (antes.length !== despues.length) throw new Error("priorizador: cambió la cantidad de líneas");
  for (const i of indicesLista) {
    if (canonica(antes[i]) !== canonica(despues[i])) throw new Error(`priorizador: la lista de la línea ${i + 1} cambió de contenido`);
  }
  const resto = (ls: string[]) => ls.filter((_, i) => !indicesLista.has(i)).sort();
  const a = resto(antes), d = resto(despues);
  if (a.some((l, k) => l !== d[k])) throw new Error("priorizador: el multiconjunto de líneas cambió");
}

// ─── etiquetado con Haiku (opcional) ─────────────────────────────────────────

export const MODELO_ETIQUETAS = "claude-haiku-4-5-20251001";

export const SYSTEM_ETIQUETAS = `Recibes viñetas numeradas de un CV y la lista de keywords de una oferta de trabajo.
Para cada viñeta, indica qué keywords de la lista evidencia: lo que la viñeta hace o logra demuestra esa keyword,
aunque use otras palabras. No etiquetes por parecido de palabras ni por lo que la persona "probablemente" hizo.
Usa las keywords exactamente como aparecen en la lista. Omite las viñetas sin keywords.
Responde SOLO con JSON: {"etiquetas":[{"vineta":1,"keywords":["..."]}]}`;

export interface VinetaNumerada { indice: number; texto: string } // indice = línea en cv.split("\n")

// Viñetas de los puestos, numeradas desde 1, para el prompt de etiquetado.
export function vinetasParaEtiquetar(cv: string): VinetaNumerada[] {
  const lineas = cv.split("\n");
  return bloquesCV(cv).filter(b => b.tipo === "puesto")
    .flatMap(b => b.indices.filter(i => /^\s*[-•]\s+/.test(lineas[i])))
    .map(i => ({ indice: i, texto: lineas[i].replace(/^\s*[-•]\s+/, "").trim() }));
}

export function promptEtiquetas(vinetas: VinetaNumerada[], jd: KeywordsJD): string {
  const kws = [...jd.requeridas, ...jd.deseables].map(k => `- ${k.keyword}`).join("\n");
  return `KEYWORDS DE LA OFERTA:\n${kws}\n\nVIÑETAS:\n${vinetas.map((v, k) => `${k + 1}. ${v.texto}`).join("\n")}`;
}

// Filtros: la keyword debe estar en la oferta y el número de viñeta debe existir. Nada más se usa del modelo.
export function filtrarEtiquetas(respuesta: unknown, vinetas: VinetaNumerada[], jd: KeywordsJD): EtiquetasOrden {
  const validas = new Map([...jd.requeridas, ...jd.deseables].map(k => [normalizarParaComparar(k.keyword), k.keyword]));
  const out: EtiquetasOrden = {};
  for (const e of Array.isArray(respuesta) ? respuesta : []) {
    const n = Number(e?.vineta);
    if (!Number.isInteger(n) || n < 1 || n > vinetas.length) continue;
    const crudas: unknown[] = Array.isArray(e?.keywords) ? e.keywords : [];
    const kws = crudas
      .map(k => (typeof k === "string" ? validas.get(normalizarParaComparar(k)) : undefined))
      .filter((k): k is string => !!k);
    if (kws.length > 0) out[vinetas[n - 1].indice] = [...new Set(kws)];
  }
  return out;
}

export async function etiquetarVinetas(
  cv: string, jd: KeywordsJD, client?: Anthropic,
): Promise<{ etiquetas: EtiquetasOrden; respuesta: unknown; usage?: Anthropic.Usage }> {
  const vinetas = vinetasParaEtiquetar(cv);
  if (vinetas.length === 0) return { etiquetas: {}, respuesta: [] };
  const c = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await c.messages.create(
    { model: MODELO_ETIQUETAS, max_tokens: 2000, temperature: 0, system: SYSTEM_ETIQUETAS, messages: [{ role: "user", content: promptEtiquetas(vinetas, jd) }] },
    { timeout: 30_000, maxRetries: 1 },
  );
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  let respuesta: unknown = [];
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    respuesta = m ? JSON.parse(m[0]).etiquetas ?? [] : [];
  } catch {
    console.warn("[postulai] Priorizador: etiquetas sin JSON válido; se ordena solo por reglas");
  }
  return { etiquetas: filtrarEtiquetas(respuesta, vinetas, jd), respuesta, usage: res.usage };
}

/**
 * Priorizador (PED-31): reordena el CV según la oferta sin escribir ni borrar texto.
 * - Viñetas: se reordenan SOLO dentro de su puesto; los puestos no se mueven (la cronología se respeta).
 * - Listas en línea ("Áreas de Expertise: A, B, C", líneas del stack, habilidades): se reordenan sus ítems.
 *   Solo se corrige un separador faltante evidente (dos frases conocidas pegadas) y se reporta.
 * - Puntaje de una línea o ítem = suma de la relevancia de las keywords de la oferta que respalda: requeridas pesan
 *   su relevancia; deseables, la mitad. Respaldo completo si la línea contiene la keyword, o la competencia/cita de un
 *   match directo; la mitad si contiene la competencia/cita de un match relacionado.
 * - Empates: orden original (orden estable).
 * - Invariante: el multiconjunto de líneas es idéntico antes y después (las listas se comparan por sus palabras).
 */
import { normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import type { KeywordsJD, ResultadoMapeo } from "./mapeo-semantico";
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
  candidatas: CandidataAcortar[];
  primeras: { puesto: string; antes: string; despues: string; puntaje: number }[]; // primera viñeta de cada puesto
}

export interface InputPriorizacion {
  cv: string;
  mapeo: ResultadoMapeo;
  keywordsJD: KeywordsJD;
  frasesConocidas?: string[]; // competencias del CV y keywords: sirven para detectar separadores faltantes
}

const SIMILITUD_REPETIDA = 0.6;

// ─── palabras ────────────────────────────────────────────────────────────────

const singular = (p: string) => p.replace(/ciones$/, "cion").replace(/([aeiou])s$/, "$1");
const contenido = (t: string) => normalizarParaComparar(t).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p)).map(singular);
const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();

function contiene(texto: string, frase: string): boolean {
  const t = new Set(contenido(texto));
  const f = contenido(frase);
  return f.length > 0 && f.every(p => t.has(p));
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
function puntuar(texto: string, rs: Respaldo[]): { puntaje: number; keywords: KeywordPuntaje[] } {
  const col = colapsar(texto);
  const keywords: KeywordPuntaje[] = [];
  for (const r of rs) {
    let factor = 0;
    for (const f of r.frases) {
      const esta = f.texto.split(/\s+/).length >= 5 ? col.includes(colapsar(f.texto)) || colapsar(f.texto).includes(col) : contiene(texto, f.texto);
      if (esta) factor = Math.max(factor, f.factor);
    }
    if (factor > 0) keywords.push({ keyword: r.keyword, puntaje: Math.round(r.peso * factor * 10) / 10 });
  }
  return { puntaje: Math.round(keywords.reduce((s, k) => s + k.puntaje, 0) * 10) / 10, keywords };
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
  const primeras: ResultadoPriorizacion["primeras"] = [];
  const indicesLista = new Set<number>();
  const esVineta = (i: number) => /^\s*[-•]\s+/.test(lineas[i]);

  // Viñetas dentro de cada puesto.
  const vinetasPorPuesto: { puesto: string; texto: string }[] = [];
  for (const b of bloques.filter(b => b.tipo === "puesto")) {
    const pos = b.indices.filter(esVineta);
    if (pos.length === 0) continue;
    const vs = pos.map((i, k) => ({ i, pos: k, texto: lineas[i], ...puntuar(lineas[i], rs) }));
    const ordenadas = ordenar(vs);
    ordenadas.forEach((v, k) => {
      nuevas[pos[k]] = v.texto;
      if (k !== v.pos) movimientos.push({ bloque: b.titulo, tipo: "vineta", texto: v.texto.trim(), de: v.pos + 1, a: k + 1, puntaje: v.puntaje, keywords: v.keywords });
      if (v.puntaje === 0) candidatas.push({ texto: v.texto.trim(), puesto: b.titulo, motivo: "no respalda ninguna keyword de la oferta" });
    });
    primeras.push({ puesto: b.titulo, antes: vs[0].texto.trim(), despues: ordenadas[0].texto.trim(), puntaje: ordenadas[0].puntaje });
    for (const v of vs) vinetasPorPuesto.push({ puesto: b.titulo, texto: v.texto.replace(/^\s*[-•]\s+/, "").trim() });
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
        candidatas.push({ texto: y.texto, puesto: y.puesto, motivo: `casi idéntica (${Math.round(jaccard * 100)}%) a una viñeta de ${x.puesto}` });
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
      const puntuados = items.map((t, k) => ({ t, pos: k, ...puntuar(t, rs) }));
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
  return { cv: resultado, movimientos, separadores, candidatas, primeras };
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

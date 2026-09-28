/**
 * Detección de violaciones de evals/spec-cv.md sobre el texto de un CV adaptado.
 * Compartido entre route.ts (reparación dirigida) y evals/verificar.ts. Sin llamadas a la API.
 */

// ─── normalización ────────────────────────────────────────────────────────────

export const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const norm = (s: string) => sinTildes(s.toLowerCase());

// ─── estructura del CV ────────────────────────────────────────────────────────

export const ENCABEZADOS = [
  "PERFIL PROFESIONAL", "EXPERIENCIA LABORAL", "EDUCACIÓN", "HABILIDADES", "IDIOMAS", "CERTIFICACIONES",
];

export const esSeparador = (l: string) => l.trim().length > 1 && /^[─━—\-=_*~%]+$/.test(l.trim());
export const esEncabezado = (l: string) => {
  const t = l.trim();
  return t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t) && !/—\s*.+\d/.test(t);
};

export interface Seccion {
  titulo: string;
  lineas: string[];
  indices: number[]; // índice de cada línea de `lineas` en cv.split("\n")
}

export function seccionar(cv: string): Seccion[] {
  const lineas = cv.split("\n");
  const primera = lineas.findIndex(l => l.trim().length > 0); // nombre del candidato
  const secciones: Seccion[] = [];
  for (let i = primera + 1; i < lineas.length; i++) {
    const l = lineas[i];
    if (esSeparador(l)) continue;
    if (esEncabezado(l)) secciones.push({ titulo: l.trim(), lineas: [], indices: [] });
    else if (secciones.length > 0) {
      secciones[secciones.length - 1].lineas.push(l);
      secciones[secciones.length - 1].indices.push(i);
    }
  }
  return secciones;
}

export const esBullet = (l: string) => /^\s*[-•]\s+/.test(l);
export const textoBullet = (l: string) => l.replace(/^\s*[-•]\s+/, "").trim();

// ─── cargos y fechas ──────────────────────────────────────────────────────────

export interface Cargo {
  titulo: string;
  bullets: string[];
  bulletIdx: number[]; // índice de cada bullet en cv.split("\n")
}

export const esLineaCargo = (l: string) => /—\s*.+\d/.test(l) || /per[ií]odo de b[uú]squeda/i.test(l);

export function cargos(secciones: Seccion[]): Cargo[] {
  const exp = secciones.find(s => s.titulo === "EXPERIENCIA LABORAL");
  const out: Cargo[] = [];
  (exp?.lineas ?? []).forEach((l, k) => {
    if (esBullet(l)) {
      if (out.length > 0) {
        out[out.length - 1].bullets.push(textoBullet(l));
        out[out.length - 1].bulletIdx.push(exp!.indices[k]);
      }
    } else if (esLineaCargo(l)) {
      out.push({ titulo: l.trim(), bullets: [], bulletIdx: [] });
    }
  });
  return out;
}

export const esCargoActual = (titulo: string) => /presente|actualidad/i.test(titulo);

// Mes absoluto (año*12 + mes) de inicio y fin; fin null = Presente. null si la línea no tiene MM/AAAA.
export function fechasCargo(linea: string): { inicio: number; fin: number | null } | null {
  const m = linea.match(/(\d{1,2})\/(\d{4})\s*[–-]\s*(?:(\d{1,2})\/(\d{4})|(presente|actualidad))/i);
  if (!m) return null;
  const inicio = Number(m[2]) * 12 + Number(m[1]);
  const fin = m[5] ? null : Number(m[4]) * 12 + Number(m[3]);
  return { inicio, fin };
}

// Estudiante: alguna línea de EDUCACIÓN está en curso.
export function esEstudiante(secciones: Seccion[]): boolean {
  const edu = secciones.find(s => s.titulo === "EDUCACIÓN");
  return (edu?.lineas ?? []).some(l => /presente|actualidad|en curso|cursando/i.test(l));
}

// ─── verbos ───────────────────────────────────────────────────────────────────

const IRREGULARES: Record<string, string> = {
  conduje: "conduc", conduzco: "conduc", reduje: "reduc", reduzco: "reduc", produje: "produc",
  produzco: "produc", introduje: "introduc", introduzco: "introduc", traduje: "traduc", traduzco: "traduc",
  hice: "hac", hago: "hac", puse: "pon", pongo: "pon", estuve: "est", estoy: "est", fui: "ser", soy: "ser",
  tuve: "ten", tengo: "ten", obtuve: "obten", obtengo: "obten", mantuve: "manten", mantengo: "manten",
  dirijo: "dirig", elijo: "elig", exijo: "exig", corrijo: "correg", corregi: "correg",
  construyo: "constru", construi: "constru", contribuyo: "contribu", contribui: "contribu",
  incluyo: "inclu", inclui: "inclu", distribuyo: "distribu", distribui: "distribu",
  comienzo: "comenz", empiezo: "empez", ofrezco: "ofrec", establezco: "establec",
  fortalezco: "fortalec", promuevo: "promov", resuelvo: "resolv", muestro: "mostr",
  demuestro: "demostr", encuentro: "encontr", pruebo: "prob", sostengo: "sosten", sostuve: "sosten",
};

export function raizVerbo(palabra: string): string {
  const n = norm(palabra);
  if (IRREGULARES[n]) return IRREGULARES[n];
  if (n.endsWith("que")) return n.slice(0, -3) + "c";   // busqué → busc
  if (n.endsWith("gue")) return n.slice(0, -3) + "g";   // negué → neg
  if (n.endsWith("ce")) return n.slice(0, -2) + "z";    // comercialicé → comercializ
  if (/[oei]$/.test(n)) return n.slice(0, -1);           // gestioné / gestiono → gestion
  return n;
}

export const primeraPalabra = (b: string) => b.split(/\s+/)[0].replace(/[^\p{L}]/gu, "");

const RAICES_PROHIBIDAS: [RegExp, string][] = [
  [/^realiz/, "realizar"], [/^particip/, "participar"], [/^apoy/, "apoyar"], [/^contribu/, "contribuir"],
  [/^colabor/, "colaborar"], [/^ayud/, "ayudar"], [/^asist/, "asistir"],
];

export function verboProhibido(bullet: string): string | null {
  const n = norm(bullet);
  if (/^(estuve|estoy|estaba) a cargo/.test(n)) return "estar a cargo de";
  if (/^(fui|soy|era) responsable/.test(n)) return "ser responsable de";
  if (/^(encargad[oa]|responsable|a cargo)\b/.test(n)) return "frase nominal";
  const primera = primeraPalabra(bullet);
  const raiz = raizVerbo(primera);
  for (const [re, nombre] of RAICES_PROHIBIDAS) if (re.test(raiz)) return nombre;
  if (/ó$/.test(primera)) return "tercera persona";
  if (/(ar|er|ir)$/i.test(primera)) return "infinitivo";
  return null;
}

// Bullets cuyo verbo inicial ya apareció antes en el mismo cargo (la primera aparición no se marca).
export function verbosRepetidosEnCargo(cargo: Cargo): { idx: number; bullet: string; verbo: string; usados: string[] }[] {
  const usados = cargo.bullets.map(primeraPalabra);
  const vistos = new Set<string>();
  const out: { idx: number; bullet: string; verbo: string; usados: string[] }[] = [];
  cargo.bullets.forEach((b, k) => {
    const raiz = raizVerbo(usados[k]);
    if (!raiz) return;
    if (vistos.has(raiz)) out.push({ idx: cargo.bulletIdx[k], bullet: b, verbo: usados[k], usados });
    vistos.add(raiz);
  });
  return out;
}

// ─── frases prohibidas ────────────────────────────────────────────────────────

export const FRASES_CV: [RegExp, string][] = [
  [/\bmultifuncional/, "multifuncional"], [/\bproactiv/, "proactivo"], [/\bdinamic[oa]s?\b/, "dinámico"],
  [/\bsinergia/, "sinergia"], [/\bpotenciando\b/, "potenciando"], [/\bresguardando\b/, "resguardando"],
  [/\bgestion integral\b/, "gestión integral"], [/\bciclo completo\b/, "ciclo completo"],
  [/\bend[- ]to[- ]end\b/, "end-to-end"], [/\bde principio a fin\b/, "de principio a fin"],
  [/\bcubriendo todas las etapas\b/, "cubriendo todas las etapas"],
  [/\bdesde\b[^.;\n]{1,60}?\bhasta\b/, "desde X hasta Y"],
  [/\b(apoyando|contribuyendo|colaborando|aportando|participando)\b/, "gerundio de soporte"],
];

export const FRASES_PERFIL: [RegExp, string][] = [
  [/\bapasionad[oa]/, "apasionado"], [/\binnovador/, "innovador"], [/\borientad[oa] a resultados\b/, "orientado a resultados"],
  [/\bnuevos desafios\b/, "nuevos desafíos"], [/\bganas de aprender\b/, "ganas de aprender"],
  [/\bsoy una persona\b/, "soy una persona"], [/\bme considero\b/, "me considero"], [/\byo\b/, "yo"],
  [/\bbusc[oa]\b/, "busco/busca"], [/\ben busqueda de\b/, "en búsqueda de"],
  [/\b(apoy|aport|contribu|colabor)(?!ador|acion|ucion)\w*/, "verbo de soporte"], [/\basist(?!ente|encia)\w*/, "asistir"],
  [/\bproductivo-comercial\b/, "productivo-comercial"], [/\boperativo-comercial\b/, "operativo-comercial"],
  [/\bha (liderado|desarrollado|gestionado|dirigido|coordinado|implementado)\b/, "tercera persona"],
  [/\b(candidat[oa]|postulante)s? (a|al|para|como)\b/, "fórmula de postulación"],
];

// Frases prohibidas en "Habilidades blandas:" (R-62). Se comparan sobre texto normalizado.
export const BLANDAS_PROHIBIDAS: [RegExp, string][] = [
  [/\bproactiv/, "proactivo"], [/\bdinamic/, "dinámico"], [/\borientacion a resultados\b/, "orientación a resultados"],
  [/\borientad[oa] a resultados\b/, "orientado a resultados"], [/\bdisposicion al aprendizaje\b/, "disposición al aprendizaje"],
  [/\baprendizaje rapido\b/, "aprendizaje rápido"], [/\bmultifuncional/, "multifuncional"],
];

export const FUNCION_EN_TECNICAS = /\b(seleccion|reclutamiento|entrevista|analisis|gestion|atencion|psicometri|negociacion|liderazgo|planificacion|evaluacion|coordinacion|comunicacion|ventas|capacitacion|administracion de|control de)/;

// ─── cargo de la oferta en el perfil (R-20) ──────────────────────────────────

const STOP_CARGO = new Set(["para", "con", "del", "las", "los", "and", "the", "en", "de", "y", "e", "o"]);

// Cargo desde titulo_postulacion: "CV para [Empresa] · [Cargo]" o "CV para [Cargo]". null sin oferta.
export function cargoDesdeTitulo(titulo: unknown): string | null {
  if (typeof titulo !== "string" || !titulo.trim()) return null;
  if (/^CV Profesional\b/i.test(titulo.trim())) return null;
  const partes = titulo.split("·").map(p => p.trim()).filter(Boolean);
  const cargo = (partes.length > 1 ? partes[partes.length - 1] : partes[0]).replace(/^CV para\s+/i, "").trim();
  return cargo || null;
}

// El perfil nombra el cargo si contiene al menos 2/3 de las palabras significativas del cargo
// (comparadas por sus primeras 5 letras, para tolerar "practicante" / "práctica").
export function perfilNombraCargo(perfil: string, cargo: string): boolean {
  const pal = (s: string) => norm(s).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length >= 3 && !STOP_CARGO.has(w));
  const clave = pal(cargo);
  if (clave.length === 0) return true;
  const perfilPref = new Set(pal(perfil).map(w => w.slice(0, 5)));
  const presentes = clave.filter(w => perfilPref.has(w.slice(0, 5))).length;
  return presentes >= Math.ceil((clave.length * 2) / 3);
}

// ─── líneas extra bajo EDUCACIÓN (R-51) ──────────────────────────────────────

const EXCEPCION_EDUCACION = /premio|publicaci|promedio|beca/i;

// Líneas de EDUCACIÓN que no son "Carrera | Institución — fechas" ni una excepción de R-51.
export function lineasExtraEducacion(secciones: Seccion[]): { idx: number; texto: string }[] {
  const edu = secciones.find(s => s.titulo === "EDUCACIÓN");
  const out: { idx: number; texto: string }[] = [];
  (edu?.lineas ?? []).forEach((l, k) => {
    const t = l.trim();
    if (!t) return;
    const esLineaCarrera = !esBullet(t) && (t.includes("|") || /—/.test(t));
    if (esLineaCarrera || EXCEPCION_EDUCACION.test(t)) return;
    out.push({ idx: edu!.indices[k], texto: t });
  });
  return out;
}

// ─── violaciones reparables (reparación dirigida) ─────────────────────────────

export type TipoReparable = "verbo_prohibido" | "verbo_repetido" | "perfil_sin_cargo" | "educacion_extra";

export interface ViolacionReparable {
  id: string;            // "L<índice de la primera línea>"
  tipo: TipoReparable;
  indices: number[];     // líneas que se reemplazan (perfil: todas sus líneas; resto: una)
  texto: string;         // texto actual, sin "- "
  detalle: string;       // dato para la instrucción (verbo, cargo, verbos usados, etc.)
  cargoActual?: boolean; // para bullets: si el cargo termina en Presente
  otrosVerbos?: string[]; // para bullets: verbos iniciales de los demás bullets del mismo cargo
}

export function detectarReparables(cv: string, cargoOferta: string | null): ViolacionReparable[] {
  const secciones = seccionar(cv);
  const out: ViolacionReparable[] = [];
  const yaMarcadas = new Set<number>();

  for (const c of cargos(secciones)) {
    const actual = esCargoActual(c.titulo);
    c.bullets.forEach((b, k) => {
      const motivo = verboProhibido(b);
      if (!motivo) return;
      const idx = c.bulletIdx[k];
      yaMarcadas.add(idx);
      out.push({
        id: `L${idx}`, tipo: "verbo_prohibido", indices: [idx], texto: b,
        detalle: `${motivo}; verbos ya usados en este cargo: ${c.bullets.map(primeraPalabra).join(", ")}`, cargoActual: actual,
        otrosVerbos: c.bullets.filter((_, j) => j !== k).map(primeraPalabra),
      });
    });
    for (const r of verbosRepetidosEnCargo(c)) {
      if (yaMarcadas.has(r.idx)) continue;
      yaMarcadas.add(r.idx);
      out.push({
        id: `L${r.idx}`, tipo: "verbo_repetido", indices: [r.idx], texto: r.bullet,
        detalle: `verbo repetido: ${r.verbo}; verbos ya usados en este cargo: ${r.usados.join(", ")}`, cargoActual: actual,
        otrosVerbos: c.bullets.filter((_, j) => c.bulletIdx[j] !== r.idx).map(primeraPalabra),
      });
    }
  }

  const perfilSec = secciones.find(s => s.titulo === "PERFIL PROFESIONAL");
  if (cargoOferta && perfilSec) {
    const idxs = perfilSec.indices.filter((_, k) => perfilSec.lineas[k].trim());
    const texto = perfilSec.lineas.filter(l => l.trim()).join(" ").trim();
    if (texto && !perfilNombraCargo(texto, cargoOferta)) {
      out.push({ id: `L${idxs[0]}`, tipo: "perfil_sin_cargo", indices: idxs, texto, detalle: cargoOferta });
    }
  }

  for (const e of lineasExtraEducacion(secciones)) {
    out.push({ id: `L${e.idx}`, tipo: "educacion_extra", indices: [e.idx], texto: textoBullet(e.texto) || e.texto, detalle: "" });
  }
  return out;
}

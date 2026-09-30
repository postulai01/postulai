/**
 * Validador de fidelidad (PED-24): detecta oraciones que afirman más que las líneas del CV que citan.
 *
 * Capa 1, código ($0):
 * - escalada_rol: jerarquía apoyo < gestión < responsabilidad. El nivel del rol de la oración se compara con el de la
 *   línea citada que respalda su objeto (las palabras que siguen al rol hasta la primera coma); si ninguna línea con rol
 *   comparte ≥2 palabras con ese objeto, con el máximo de las líneas citadas.
 * - tiempo_verbal: la oración usa presente ("lidera", "gestiona") y todas sus líneas citadas son de puestos terminados
 *   (bloquesCV + fechas, sin "a la fecha"/"actual"/"presente"). Requiere el CV.
 *
 * Capa 2, juicio del modelo: UNA llamada por texto (todas las oraciones juntas). Por oración responde
 * { veredicto: "fiel" | "exagera", tipo, explicacion, natural }. "natural" es informativo, no bloquea.
 *
 * Una oración se rechaza si CUALQUIERA de las dos capas la marca. No está conectado a perfil-adaptado ni al reescritor.
 */
import Anthropic from "@anthropic-ai/sdk";
import { norm } from "./cv-verificacion";
import { RAICES_GENERICAS } from "./mapeo-semantico";
import { INTENSIFICADOR, RELLENO_NEUTRO } from "./perfil-adaptado";
import { bloquesCV, indice, palabrasContenido, presenteEstricto } from "./reescritor-contextual";

export interface LineaCitada { linea: number; texto: string } // linea: 1-based, como numerarCV
export interface OracionAValidar { oracion: string; lineas_citadas: LineaCitada[] }

export type TipoCodigo = "escalada_rol" | "tiempo_verbal" | "palabra_fuera_de_cita" | "calificativo_trasladado";
export interface HallazgoCodigo { tipo: TipoCodigo; detalle: string }

// ─── capa 1: código ──────────────────────────────────────────────────────────

const V = "(e|o|a|ar|ando|aba|ado|ada)";
const NIVELES: [number, RegExp][] = [
  [3, new RegExp(`^(responsables?|lider${V}|dirig\\w*|dirij\\w*|encabez\\w*|encabece|comand${V})$`)],
  [2, new RegExp(`^(coordin${V}|gestion${V}|administr${V}|ejecut${V})$`)],
  [1, new RegExp(`^(apoy${V}?|particip\\w*|colabor${V})$`)],
];

const tokens = (s: string) => norm(s).split(/[^a-zñ]+/).filter(Boolean);

function nivelPalabra(p: string): number {
  return NIVELES.find(([, re]) => re.test(p))?.[0] ?? 0;
}

// Nivel máximo de rol en un texto; 0 si no tiene palabra de rol.
export function nivelRol(texto: string): number {
  return Math.max(0, ...tokens(texto).map(nivelPalabra));
}

// Palabra de rol de mayor nivel en la oración y su objeto (hasta la primera coma o punto, máx. 8 palabras de contenido).
function rolYObjeto(oracion: string): { palabra: string; nivel: number; objeto: string[] } | null {
  const partes = oracion.split(/\s+/);
  let mejor: { i: number; nivel: number } | null = null;
  partes.forEach((p, i) => {
    const n = Math.max(0, ...tokens(p).map(nivelPalabra));
    if (n > 0 && (!mejor || n > mejor.nivel)) mejor = { i, nivel: n };
  });
  if (!mejor) return null;
  const { i, nivel } = mejor as { i: number; nivel: number };
  const resto = partes.slice(i + 1).join(" ").split(/[,.;:]/)[0];
  return { palabra: partes[i], nivel, objeto: palabrasContenido(resto).slice(0, 8) };
}

const r5 = (p: string) => p.slice(0, 5);
const solape = (objeto: string[], texto: string) => {
  const raices = new Set(palabrasContenido(texto).map(r5));
  return new Set(objeto.map(r5).filter(r => raices.has(r))).size;
};

export function escaladaRol(o: OracionAValidar): HallazgoCodigo | null {
  const rol = rolYObjeto(o.oracion);
  if (!rol) return null;
  const conRol = o.lineas_citadas.map(l => ({ ...l, nivel: nivelRol(l.texto) })).filter(l => l.nivel > 0);
  if (conRol.length === 0) return null; // sin roles en las citas no hay contra qué comparar
  const ranking = conRol.map(l => ({ ...l, s: solape(rol.objeto, l.texto) })).sort((a, b) => b.s - a.s || b.nivel - a.nivel);
  const ref = ranking[0].s >= 2 ? ranking[0] : null;
  const nivelRef = ref ? ref.nivel : Math.max(...conRol.map(l => l.nivel));
  if (rol.nivel <= nivelRef) return null;
  return {
    tipo: "escalada_rol",
    detalle: ref
      ? `"${rol.palabra}" (nivel ${rol.nivel}) sobre lo que la línea ${ref.linea} dice con nivel ${ref.nivel}`
      : `"${rol.palabra}" (nivel ${rol.nivel}) supera el máximo de las líneas citadas (${nivelRef})`,
  };
}

const PRESENTE = /^(lidera|dirige|gestiona|coordina|administra|ejecuta|conduce|encabeza|comanda|implementa|automatiza|disena|desarrolla|supervisa|maneja)$/;
const ACTUAL = /a la fecha|actual|presente/i;

// Puesto (bloque de bloquesCV) de cada línea 1-based: "terminado", "actual" o null si la línea no es de un puesto.
export function estadoPuestos(cv: string): Map<number, "terminado" | "actual"> {
  const m = new Map<number, "terminado" | "actual">();
  for (const b of bloquesCV(cv)) {
    if (b.tipo !== "puesto") continue;
    const estado = ACTUAL.test(b.titulo) || !/\b(19|20)\d{2}\b/.test(b.titulo) ? "actual" : "terminado";
    b.indices.forEach(i => m.set(i + 1, estado));
  }
  return m;
}

export function tiempoVerbal(o: OracionAValidar, puestos: Map<number, "terminado" | "actual">): HallazgoCodigo | null {
  const verbo = tokens(o.oracion).find(p => PRESENTE.test(p));
  if (!verbo || o.lineas_citadas.length === 0) return null;
  if (!o.lineas_citadas.every(l => puestos.get(l.linea) === "terminado")) return null;
  return { tipo: "tiempo_verbal", detalle: `"${verbo}" en presente; todas las líneas citadas son de puestos terminados` };
}

// Igual (o plural), o misma raíz de 5 letras no genérica en palabras largas.
function respaldada(p: string, ix: { set: Set<string>; raices: Set<string> }): boolean {
  return presenteEstricto(p, ix.set) || (p.length >= 6 && !/\d/.test(p) && !RAICES_GENERICAS.has(r5(p)) && ix.raices.has(r5(p)));
}

// Palabras escritas con mayúscula que no abren la oración (nombres propios, herramientas), normalizadas.
function nombresPropios(oracion: string): Set<string> {
  const out = new Set<string>();
  oracion.split(/\s+/).forEach((w, i) => {
    if (i > 0 && /^[A-ZÁÉÍÓÚÑ]/.test(w.replace(/^[("'“]+/, ""))) palabrasContenido(w).forEach(p => out.add(p));
  });
  return out;
}

// Bloque (índice en bloquesCV) de cada línea 1-based.
function bloquePorLinea(cv: string): Map<number, number> {
  const m = new Map<number, number>();
  bloquesCV(cv).forEach((b, k) => b.indices.forEach(i => m.set(i + 1, k)));
  return m;
}

// Cada palabra de contenido debe estar en las LÍNEAS CITADAS. Excepción: nombres propios/herramientas que están en
// una línea del CV del mismo bloque que alguna línea citada.
export function palabraFueraDeCita(o: OracionAValidar, cv?: string): HallazgoCodigo | null {
  const ix = indice(o.lineas_citadas.map(l => l.texto).join(" "));
  const propios = nombresPropios(o.oracion);
  const bloques = cv ? bloquePorLinea(cv) : null;
  const lineasCV = cv ? cv.split("\n") : [];
  const bloquesCitados = new Set(o.lineas_citadas.map(l => bloques?.get(l.linea)));
  const enMismoBloque = (p: string) => lineasCV.some((t, i) =>
    bloquesCitados.has(bloques!.get(i + 1)) && presenteEstricto(p, new Set(palabrasContenido(t))));
  const fuera = [...new Set(palabrasContenido(o.oracion))].filter(p =>
    !RELLENO_NEUTRO.test(p) && !respaldada(p, ix) && !(bloques && propios.has(p) && enMismoBloque(p)));
  return fuera.length ? { tipo: "palabra_fuera_de_cita", detalle: `no están en las líneas citadas: ${fuera.join(", ")}` } : null;
}

const SIGUIENTES = 6;

// Palabras de contenido que siguen a cada aparición del intensificador (misma raíz) en un texto.
function trasIntensificador(texto: string, prefijo: string): string[][] {
  const ps = palabrasContenido(texto);
  return ps.flatMap((p, i) => (p.startsWith(prefijo) ? [ps.slice(i + 1, i + 1 + SIGUIENTES)] : []));
}

// Un intensificador debe calificar lo mismo que en el CV: lo que lo sigue comparte ≥1 palabra con lo que lo sigue allí.
export function calificativoTrasladado(o: OracionAValidar, cv?: string): HallazgoCodigo | null {
  const fuente = cv ?? o.lineas_citadas.map(l => l.texto).join("\n");
  for (const p of new Set(palabrasContenido(o.oracion))) {
    const prefijo = p.match(INTENSIFICADOR)?.[1];
    if (!prefijo) continue;
    const enOracion = trasIntensificador(o.oracion, prefijo);
    const enCV = trasIntensificador(fuente, prefijo);
    const ok = enOracion.every(obj => enCV.some(cvObj => obj.some(w => respaldada(w, indice(cvObj.join(" "))))));
    if (!ok) {
      return {
        tipo: "calificativo_trasladado",
        detalle: `"${p}" califica "${enOracion.map(x => x.join(" ")).join(" | ")}"; en el CV califica ${enCV.length ? enCV.map(x => `"${x.join(" ")}"`).join(" | ") : "nada (no aparece)"}`,
      };
    }
  }
  return null;
}

export function validarCodigo(o: OracionAValidar, cv?: string): HallazgoCodigo[] {
  const out: HallazgoCodigo[] = [];
  const e = escaladaRol(o);
  if (e) out.push(e);
  if (cv) {
    const t = tiempoVerbal(o, estadoPuestos(cv));
    if (t) out.push(t);
  }
  const f = palabraFueraDeCita(o, cv);
  if (f) out.push(f);
  const c = calificativoTrasladado(o, cv);
  if (c) out.push(c);
  return out;
}

// ─── capa 2: juicio del modelo ───────────────────────────────────────────────

export const MODELOS_VALIDADOR = { haiku: "claude-haiku-4-5", sonnet: "claude-sonnet-5-5" } as const;

export interface JuicioOracion {
  veredicto: "fiel" | "exagera";
  tipo: "rol" | "alcance" | "relacion" | "tiempo" | "contenido" | null;
  explicacion: string;
  natural: boolean;
}

export const SYSTEM_VALIDADOR = `Eres un verificador estricto de fidelidad de CVs. Recibes oraciones escritas para un perfil profesional y, para cada una, las líneas del CV que la respaldan. Decide si cada oración afirma algo MÁS FUERTE que sus líneas citadas en alguno de estos ejes:
- rol: sube la responsabilidad (p. ej. "Apoyé" → "Responsable de", "participé" → "lideré").
- alcance: traslada un calificativo a otra cosa ("a gran escala", "experto", "estratégico" aplicados a algo que el CV no califica así) o amplía el alcance ("zona" → "organización").
- relacion: une hechos separados del CV como si fueran uno (herramientas de una línea usadas en el logro de otra, etc.).
- tiempo: presenta en presente algo que el CV muestra como pasado o terminado.
- contenido: agrega algo que ninguna línea citada dice (términos nuevos, aunque sean sinónimos cercanos que cambian el significado).
Parafrasear, resumir, omitir o reordenar NO es exagerar. Si todo lo afirmado está en las líneas con igual o menor fuerza, es "fiel".
"natural": false solo si la oración suena a lista de keywords pegadas (keyword stuffing); no afecta el veredicto.
Responde SOLO con JSON: {"oraciones":[{"i":1,"veredicto":"fiel"|"exagera","tipo":"rol"|"alcance"|"relacion"|"tiempo"|"contenido"|null,"explicacion":"máx. 25 palabras, cita la frase exagerada","natural":true|false}]}`;

export function promptValidador(oraciones: OracionAValidar[]): string {
  return oraciones.map((o, k) =>
    `[${k + 1}] ORACIÓN: ${o.oracion}\nLÍNEAS CITADAS:\n${o.lineas_citadas.map(l => `- (${l.linea}) ${l.texto}`).join("\n")}`,
  ).join("\n\n");
}

export function parsearJuicios(raw: string, n: number): (JuicioOracion | null)[] {
  const out: (JuicioOracion | null)[] = Array(n).fill(null);
  let json: any = null;
  try { json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { /* respuesta inválida */ }
  for (const j of json?.oraciones ?? []) {
    const k = Number(j?.i) - 1;
    if (k < 0 || k >= n || (j.veredicto !== "fiel" && j.veredicto !== "exagera")) continue;
    out[k] = { veredicto: j.veredicto, tipo: j.tipo ?? null, explicacion: String(j.explicacion ?? ""), natural: j.natural !== false };
  }
  return out;
}

// Parámetros de la llamada. Sonnet 5.5 no acepta temperature ≠ default: se apaga el razonamiento con between_tools.
export function paramsValidador(oraciones: OracionAValidar[], modelo: string): Anthropic.MessageCreateParamsNonStreaming {
  const base = { model: modelo, max_tokens: 4000, system: SYSTEM_VALIDADOR, messages: [{ role: "user" as const, content: promptValidador(oraciones) }] };
  return modelo.startsWith("claude-haiku") ? { ...base, temperature: 0 }
    : { ...base, thinking: { type: "between_tools" } } as unknown as Anthropic.MessageCreateParamsNonStreaming;
}

export interface ResultadoModelo { juicios: (JuicioOracion | null)[]; raw: string; usage: { input_tokens: number; output_tokens: number } }

export async function juzgarConModelo(oraciones: OracionAValidar[], opts: { client?: Anthropic; modelo?: string } = {}): Promise<ResultadoModelo> {
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create(paramsValidador(oraciones, opts.modelo ?? MODELOS_VALIDADOR.haiku), { timeout: 60_000, maxRetries: 1 });
  const raw = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
  return { juicios: parsearJuicios(raw, oraciones.length), raw, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens } };
}

// ─── combinación ─────────────────────────────────────────────────────────────

export interface ValidacionOracion { rechazada: boolean; codigo: HallazgoCodigo[]; modelo: JuicioOracion | null }

export function combinar(codigo: HallazgoCodigo[], modelo: JuicioOracion | null): ValidacionOracion {
  return { rechazada: codigo.length > 0 || modelo?.veredicto === "exagera", codigo, modelo };
}

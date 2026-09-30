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
import {
  detectarPerfil, INTENSIFICADOR, LARGO_MAX, LARGO_MIN, parsearOraciones, RELLENO_NEUTRO, verificarOracion,
  type InputPerfil, type Oracion,
} from "./perfil-adaptado";
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
Omitir detalles, resumir o ser menos específico que la línea citada es FIEL. Solo es "exagera" si la oración afirma MÁS que las líneas citadas (rol, alcance, relación, tiempo o contenido nuevo).
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

// ─── pipeline del perfil generativo con validador (solo para evals; no activo por defecto) ──────────────────

export interface DescarteCapa { texto: string; capa: "verificacion" | "codigo" | "modelo"; motivos: string[] }
export interface PerfilValidado {
  estado: "adaptado" | "rechazado" | "sin_perfil";
  original: string | null;
  perfil: string | null;          // adaptado, o el original si se rechazó
  aceptadas: string[];
  descartadas: DescarteCapa[];
  problemas: string[];            // por qué se rechazó el armado
  respuesta: number | null;       // índice de la respuesta guardada usada (0/1)
  usage: { input_tokens: number; output_tokens: number };
}

type Juez = (oraciones: OracionAValidar[]) => Promise<ResultadoModelo>;

const contar = (s: string) => s.split(/\s+/).filter(Boolean).length;

// Por respuesta (máx. 2, como evaluarRespuestas): verificación PED-32 → código del validador → juez SOLO sobre las que
// pasaron el código → armado (primera oración debe pasar, largo 70–120%). Se usa la primera respuesta aceptada.
export async function perfilValidado(input: InputPerfil, respuestas: unknown[], juez: Juez): Promise<PerfilValidado> {
  const usage = { input_tokens: 0, output_tokens: 0 };
  const det = detectarPerfil(input.cv);
  const vacio = { aceptadas: [], descartadas: [], problemas: [], respuesta: null, usage };
  if (!det) return { estado: "sin_perfil", original: null, perfil: null, ...vacio };
  let ultimo: Omit<PerfilValidado, "usage" | "estado" | "original" | "perfil"> | null = null;
  for (const [k, raw] of respuestas.slice(0, 2).entries()) {
    const oraciones = parsearOraciones(raw, input.cv);
    if (!oraciones) continue;
    const descartadas: DescarteCapa[] = [];
    const tras: { o: Oracion; v: OracionAValidar }[] = [];
    for (const o of oraciones) {
      const p = verificarOracion(o, det.texto, input);
      if (p.length) { descartadas.push({ texto: o.texto, capa: "verificacion", motivos: p }); continue; }
      const v = { oracion: o.texto, lineas_citadas: (o.lineas ?? []).map((n, i) => ({ linea: n, texto: o.citas[i] })) };
      const c = validarCodigo(v, input.cv);
      if (c.length) { descartadas.push({ texto: o.texto, capa: "codigo", motivos: c.map(h => `${h.tipo}: ${h.detalle}`) }); continue; }
      tras.push({ o, v });
    }
    const aceptadas: Oracion[] = [];
    if (tras.length) {
      const r = await juez(tras.map(t => t.v));
      usage.input_tokens += r.usage.input_tokens; usage.output_tokens += r.usage.output_tokens;
      tras.forEach((t, i) => {
        const j = r.juicios[i];
        if (j?.veredicto === "fiel") aceptadas.push(t.o);
        else descartadas.push({ texto: t.o.texto, capa: "modelo", motivos: [j ? `${j.tipo}: ${j.explicacion}` : "sin juicio"] });
      });
    }
    const perfil = aceptadas.map(o => o.texto).join(" ").replace(/\s+/g, " ").trim();
    const problemas: string[] = [];
    if (oraciones.length === 0) problemas.push("sin oraciones");
    else if (!aceptadas.includes(oraciones[0])) problemas.push("la primera oración no pasa");
    const n = contar(perfil), n0 = contar(det.texto);
    if (n < LARGO_MIN * n0 || n > LARGO_MAX * n0) problemas.push(`largo ${n} palabras fuera de ${Math.round(LARGO_MIN * 100)}–${Math.round(LARGO_MAX * 100)}% de ${n0}`);
    ultimo = { aceptadas: aceptadas.map(o => o.texto), descartadas, problemas, respuesta: k };
    if (problemas.length === 0) return { estado: "adaptado", original: det.texto, perfil, ...ultimo, usage };
  }
  return { estado: "rechazado", original: det.texto, perfil: det.texto, ...(ultimo ?? { ...vacio, problemas: ["respuestas no convertibles"] }), usage };
}

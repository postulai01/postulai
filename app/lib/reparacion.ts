/**
 * Reparación dirigida (evals/spec-cv.md §13, v10.4): detecta con cv-verificacion.ts las violaciones
 * que el modelo principal no corrigió y envía SOLO esas líneas a Haiku para reescribirlas.
 * Si la reparación introduce una cifra sin respaldo en la fuente, se descarta completa.
 * Compartido entre route.ts y los evals.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { cifrasSinRespaldo } from "./cv-postprocess";
import {
  detectarReparables, type ViolacionReparable, verboProhibido, raizVerbo, primeraPalabra, perfilNombraCargo,
  FRASES_CV, FRASES_PERFIL, norm,
} from "./cv-verificacion";

export const MODELO_REPARACION = "claude-haiku-4-5-20251001";

export interface ResultadoReparacion {
  cv: string;
  estado: "sin_violaciones" | "aplicada" | "descartada";
  detalle: string[];
  usage?: Anthropic.Usage;
}

const SYSTEM_REPARACION = `Corriges líneas puntuales de un CV en español. Recibes el CV original del candidato, que es la única fuente de hechos, y una lista de líneas del CV adaptado que incumplen una regla. Reescribe solo esas líneas.

Reglas para todas las líneas:
- No agregues hechos, responsabilidades, herramientas, cifras ni resultados que no estén en el CV original.
- Conserva todas las cifras que ya tiene la línea, sin cambiarlas ni redondearlas.
- Mantén el contenido y el nivel de detalle; cambia solo lo necesario para cumplir la regla.
- No subas el nivel de responsabilidad ni de dominio: participar o apoyar no se convierte en coordinar, liderar, dirigir, gestionar ni supervisar, y un nivel declarado (básico, intermedio) no se convierte en dominio ni en avanzado.
- No uses términos internos ni nombres de reglas.

Responde ÚNICAMENTE con un JSON válido: {"lineas":[{"id":"<id>","texto":"<línea corregida>"}]}, con un elemento por cada id recibido. El texto va sin guion inicial.`;

function instruccion(v: ViolacionReparable): string {
  const tiempo = v.cargoActual ? "presente (es el cargo actual)" : "pasado (es un cargo anterior)";
  switch (v.tipo) {
    case "verbo_prohibido":
      return `El bullet empieza con un verbo o construcción prohibida (${v.detalle}). Reescríbelo empezando con un verbo de acción en primera persona singular, en ${tiempo}, que describa exactamente la misma acción que el CV original, con el mismo nivel de responsabilidad y distinto de los verbos ya usados en este cargo. No uses: realizar, participar, apoyar, contribuir, colaborar, ayudar, asistir, estar a cargo de, ser responsable de. Si el original indica participación, apoyo o colaboración, usa un verbo equivalente que no suba el nivel de responsabilidad, como integrar o formar parte de (${v.cargoActual ? "integro, formo parte de" : "integré, formé parte de"}); nunca coordinar, liderar, dirigir, gestionar ni supervisar.`;
    case "verbo_repetido":
      return `El bullet repite un verbo inicial dentro del mismo cargo (${v.detalle}). Cambia el verbo inicial por otro verbo de acción en primera persona singular, en ${tiempo}, distinto de los ya usados en el cargo, y ajusta solo lo necesario para que la frase quede correcta.`;
    case "perfil_sin_cargo":
      return `El perfil profesional no nombra el cargo al que se postula: "${v.detalle}". Devuelve el perfil completo: ajusta solo su primera oración para que integre ese cargo de forma natural, como el cargo hacia el que se orienta el perfil, sin fórmulas como "candidato a" o "postulante a", sin nombrar la empresa y sin presentar al candidato como si ya ocupara ese cargo. Conserva todas las demás frases y datos tal como están (institución, niveles, cifras); no resumas ni acortes. Debe quedar entre 50 y 100 palabras, en redacción impersonal con frases nominales.`;
    case "educacion_extra":
      return `En EDUCACIÓN solo va la línea de carrera e institución con sus fechas. Esta línea extra se conserva solo si es un premio nacional, una publicación académica, un promedio sobre 6.0 o una beca competitiva; en ese caso devuélvela igual. Si no lo es, devuelve texto vacío "" para eliminarla.`;
  }
}

export async function repararCV(opts: {
  client: Anthropic;
  cv: string;
  fuente: string;
  cargoOferta: string | null;
}): Promise<ResultadoReparacion> {
  const { client, cv, fuente, cargoOferta } = opts;
  const violaciones = detectarReparables(cv, cargoOferta);
  if (violaciones.length === 0) return { cv, estado: "sin_violaciones", detalle: [] };

  const resumen = violaciones.map(v => `${v.tipo} (${v.id})`);
  const fuenteNorm = norm(fuente);

  // Primer intento: todas las líneas afectadas.
  let usage: Anthropic.Usage | undefined;
  let respuesta: Record<string, string>;
  try {
    const r = await llamarHaiku(client, fuente, violaciones.map(v => ({ id: v.id, regla: instruccion(v), texto: v.texto })));
    usage = r.usage;
    respuesta = r.respuesta;
  } catch (err) {
    const detalle = [`error: ${(err as Error).message}`, ...resumen];
    console.warn(`[postulai] Reparación descartada (${detalle.join("; ")})`);
    return { cv, estado: "descartada", detalle, usage };
  }

  // Validación línea por línea: una línea reparada que no pasa se rechaza y queda la original.
  const aceptadas = new Map<string, string>(); // id → texto aceptado ("" = eliminar, solo EDUCACIÓN)
  let rechazos = new Map<string, { motivo: string; propuesta: string }>();
  const evaluar = (v: ViolacionReparable, texto: string | undefined) => {
    if (texto === undefined) return;
    const limpio = texto.replace(/^\s*[-•]\s+/, "").trim();
    if (v.tipo === "educacion_extra") { if (limpio === "") aceptadas.set(v.id, ""); return; }
    if (!limpio || limpio === v.texto) return;
    const motivo = motivoRechazo(v, limpio, fuenteNorm);
    if (motivo) rechazos.set(v.id, { motivo, propuesta: limpio });
    else { aceptadas.set(v.id, limpio); rechazos.delete(v.id); }
  };
  for (const v of violaciones) evaluar(v, respuesta[v.id]);

  // Un único reintento, solo para las líneas rechazadas, con el motivo del rechazo.
  if (rechazos.size > 0) {
    const pendientes = violaciones.filter(v => rechazos.has(v.id));
    console.warn(`[postulai] Reparación: reintentando líneas rechazadas (${pendientes.map(v => `${v.tipo} (${v.id}): ${rechazos.get(v.id)!.motivo}`).join("; ")})`);
    try {
      const r = await llamarHaiku(client, fuente, pendientes.map(v => ({
        id: v.id,
        regla: `${instruccion(v)} Tu propuesta anterior fue rechazada por este motivo: ${rechazos.get(v.id)!.motivo}. Propuesta rechazada: "${rechazos.get(v.id)!.propuesta}".`,
        texto: v.texto,
      })));
      usage = sumarUsage(usage, r.usage);
      const previos = rechazos;
      rechazos = new Map();
      for (const v of pendientes) {
        evaluar(v, r.respuesta[v.id]);
        if (!aceptadas.has(v.id) && !rechazos.has(v.id)) rechazos.set(v.id, previos.get(v.id)!);
      }
    } catch (err) {
      console.warn(`[postulai] Reparación: el reintento falló (${(err as Error).message}); se conservan las líneas originales`);
    }
  }

  const rechazadas = violaciones.filter(v => rechazos.has(v.id)).map(v => `${v.tipo} (${v.id}): ${rechazos.get(v.id)!.motivo}`);
  if (rechazadas.length > 0) console.warn(`[postulai] Reparación: líneas rechazadas (${rechazadas.join("; ")})`);

  // Aplicar: reemplazos por índice de línea; null = eliminar la línea.
  const lineas = cv.split("\n");
  const reemplazos = new Map<number, string | null>();
  const aplicadas: string[] = [];
  for (const v of violaciones) {
    const texto = aceptadas.get(v.id);
    if (texto === undefined) continue;
    if (v.tipo === "educacion_extra") {
      reemplazos.set(v.indices[0], null);
      aplicadas.push(`${v.tipo} (${v.id}): eliminada`);
    } else if (v.tipo === "perfil_sin_cargo") {
      reemplazos.set(v.indices[0], texto);
      for (const i of v.indices.slice(1)) reemplazos.set(i, null);
      aplicadas.push(`${v.tipo} (${v.id})`);
    } else {
      const prefijo = lineas[v.indices[0]].match(/^\s*[-•]\s+/)?.[0] ?? "- ";
      reemplazos.set(v.indices[0], prefijo + texto);
      aplicadas.push(`${v.tipo} (${v.id})`);
    }
  }
  if (reemplazos.size === 0) {
    const detalle = ["sin cambios utilizables en la respuesta", ...rechazadas.map(r => `rechazada ${r}`), ...resumen];
    console.warn(`[postulai] Reparación descartada (${detalle.join("; ")})`);
    return { cv, estado: "descartada", detalle, usage };
  }

  const reparado = lineas
    .map((l, i) => (reemplazos.has(i) ? reemplazos.get(i)! : l))
    .filter((l): l is string => l !== null)
    .join("\n");

  // Red de seguridad: ninguna cifra nueva sin respaldo.
  const antes = new Set(cifrasSinRespaldo(cv, fuente));
  const nuevas = cifrasSinRespaldo(reparado, fuente).filter(c => !antes.has(c));
  if (nuevas.length > 0) {
    const detalle = [`cifras nuevas sin respaldo: ${nuevas.join(", ")}`, ...aplicadas, ...rechazadas.map(r => `rechazada ${r}`)];
    console.warn(`[postulai] Reparación descartada (${detalle.join("; ")})`);
    return { cv, estado: "descartada", detalle, usage };
  }

  const detalle = [...aplicadas, ...rechazadas.map(r => `rechazada ${r}`)];
  console.warn(`[postulai] Reparación aplicada: ${detalle.join("; ")}`);
  return { cv: reparado, estado: "aplicada", detalle, usage };
}

async function llamarHaiku(
  client: Anthropic,
  fuente: string,
  items: { id: string; regla: string; texto: string }[]
): Promise<{ respuesta: Record<string, string>; usage: Anthropic.Usage }> {
  const res = await client.messages.create(
    {
      model: MODELO_REPARACION,
      max_tokens: 2000,
      temperature: 0,
      system: SYSTEM_REPARACION,
      messages: [{
        role: "user",
        content: `CV ORIGINAL:\n${fuente}\n\nLÍNEAS A CORREGIR:\n${JSON.stringify(items, null, 2)}`,
      }],
    },
    { timeout: 20_000, maxRetries: 1 }
  );
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("la respuesta no contiene JSON");
  const parsed = JSON.parse(m[0]) as { lineas?: { id?: unknown; texto?: unknown }[] };
  const respuesta: Record<string, string> = {};
  for (const l of parsed.lineas ?? []) {
    if (typeof l.id === "string" && typeof l.texto === "string") respuesta[l.id] = l.texto.trim();
  }
  return { respuesta, usage: res.usage };
}

function sumarUsage(a: Anthropic.Usage | undefined, b: Anthropic.Usage): Anthropic.Usage {
  if (!a) return b;
  return { ...a, input_tokens: a.input_tokens + b.input_tokens, output_tokens: a.output_tokens + b.output_tokens };
}

// ─── validación de líneas reparadas ──────────────────────────────────────────

// Verbos que suben el nivel de responsabilidad; solo se aceptan si su raíz aparece en la fuente.
const VERBOS_ESCALADA = /^(coordin|lider|dirig|gestion|supervis|encabez|administr|conduc|jefatur)/;
// Palabras que suben el nivel de dominio o experiencia; no pueden aparecer si no estaban en la línea.
const PALABRAS_NIVEL = /\b(dominio|experto|experta|avanzad[oa]|solid[oa]|amplia experiencia|especialista)\b/g;

function frasesProhibidas(texto: string): Set<string> {
  const n = norm(texto);
  return new Set([...FRASES_CV, ...FRASES_PERFIL].filter(([re]) => re.test(n)).map(([, nombre]) => nombre));
}

function motivoRechazo(v: ViolacionReparable, nuevo: string, fuenteNorm: string): string | null {
  const antes = frasesProhibidas(v.texto);
  const agregadas = [...frasesProhibidas(nuevo)].filter(f => !antes.has(f));
  if (agregadas.length > 0) return `agrega frases prohibidas (${agregadas.join(", ")})`;

  const nivelAntes = new Set(norm(v.texto).match(PALABRAS_NIVEL) ?? []);
  const nivelNuevo = (norm(nuevo).match(PALABRAS_NIVEL) ?? []).filter(w => !nivelAntes.has(w));
  if (nivelNuevo.length > 0) return `sube el nivel declarado (${nivelNuevo.join(", ")})`;

  if (v.tipo === "verbo_prohibido" || v.tipo === "verbo_repetido") {
    if (verboProhibido(nuevo)) return "sigue empezando con un verbo prohibido";
    const raiz = raizVerbo(primeraPalabra(nuevo));
    if (VERBOS_ESCALADA.test(raiz) && !fuenteNorm.includes(raiz.slice(0, 6))) return `escala la responsabilidad ("${primeraPalabra(nuevo)}" sin respaldo en la fuente)`;
    if ((v.otrosVerbos ?? []).some(o => raizVerbo(o) === raiz)) return `repite un verbo del mismo cargo ("${primeraPalabra(nuevo)}")`;
  }
  if (v.tipo === "perfil_sin_cargo") {
    const palabras = nuevo.split(/\s+/).filter(Boolean).length;
    if (palabras < 50 || palabras > 100) return `perfil de ${palabras} palabras (fuera de 50–100)`;
    if (!perfilNombraCargo(nuevo, v.detalle)) return "el perfil sigue sin nombrar el cargo";
  }
  return null;
}

/**
 * Reparación dirigida (evals/spec-cv.md §13, v10.4): detecta con cv-verificacion.ts las violaciones
 * que el modelo principal no corrigió y envía SOLO esas líneas a Haiku para reescribirlas.
 * Si la reparación introduce una cifra sin respaldo en la fuente, se descarta completa.
 * Compartido entre route.ts y los evals.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { cifrasSinRespaldo } from "./cv-postprocess";
import { detectarReparables, type ViolacionReparable } from "./cv-verificacion";

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
- No uses términos internos ni nombres de reglas.

Responde ÚNICAMENTE con un JSON válido: {"lineas":[{"id":"<id>","texto":"<línea corregida>"}]}, con un elemento por cada id recibido. El texto va sin guion inicial.`;

function instruccion(v: ViolacionReparable): string {
  const tiempo = v.cargoActual ? "presente (es el cargo actual)" : "pasado (es un cargo anterior)";
  switch (v.tipo) {
    case "verbo_prohibido":
      return `El bullet empieza con un verbo o construcción prohibida (${v.detalle}). Reescríbelo empezando con un verbo de acción en primera persona singular, en ${tiempo}. No uses: realizar, participar, apoyar, contribuir, colaborar, ayudar, asistir, estar a cargo de, ser responsable de.`;
    case "verbo_repetido":
      return `El bullet repite un verbo inicial dentro del mismo cargo (${v.detalle}). Cambia el verbo inicial por otro verbo de acción en primera persona singular, en ${tiempo}, distinto de los ya usados en el cargo, y ajusta solo lo necesario para que la frase quede correcta.`;
    case "perfil_sin_cargo":
      return `El perfil profesional no nombra el cargo al que se postula: "${v.detalle}". Reescríbelo para que su primera frase nombre ese cargo como el cargo al que se postula, sin nombrar la empresa y sin presentar al candidato como si ya ocupara ese cargo si el CV original no lo respalda. Mantén el resto del contenido, entre 50 y 100 palabras, en redacción impersonal con frases nominales (sin primera ni tercera persona).`;
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
  const items = violaciones.map(v => ({ id: v.id, regla: instruccion(v), texto: v.texto }));

  let usage: Anthropic.Usage | undefined;
  let respuesta: Record<string, string>;
  try {
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
    usage = res.usage;
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("la respuesta no contiene JSON");
    const parsed = JSON.parse(m[0]) as { lineas?: { id?: unknown; texto?: unknown }[] };
    respuesta = {};
    for (const l of parsed.lineas ?? []) {
      if (typeof l.id === "string" && typeof l.texto === "string") respuesta[l.id] = l.texto.trim();
    }
  } catch (err) {
    const detalle = [`error: ${(err as Error).message}`, ...resumen];
    console.warn(`[postulai] Reparación descartada (${detalle.join("; ")})`);
    return { cv, estado: "descartada", detalle, usage };
  }

  // Aplicar: reemplazos por índice de línea; null = eliminar la línea.
  const lineas = cv.split("\n");
  const reemplazos = new Map<number, string | null>();
  const aplicadas: string[] = [];
  for (const v of violaciones) {
    const texto = respuesta[v.id];
    if (texto === undefined) continue;
    const limpio = texto.replace(/^\s*[-•]\s+/, "").trim();
    if (v.tipo === "educacion_extra") {
      if (limpio === "") { reemplazos.set(v.indices[0], null); aplicadas.push(`${v.tipo} (${v.id}): eliminada`); }
      continue;
    }
    if (!limpio || limpio === v.texto) continue;
    if (v.tipo === "perfil_sin_cargo") {
      reemplazos.set(v.indices[0], limpio);
      for (const i of v.indices.slice(1)) reemplazos.set(i, null);
    } else {
      const prefijo = lineas[v.indices[0]].match(/^\s*[-•]\s+/)?.[0] ?? "- ";
      reemplazos.set(v.indices[0], prefijo + limpio);
    }
    aplicadas.push(`${v.tipo} (${v.id})`);
  }
  if (reemplazos.size === 0) {
    const detalle = ["sin cambios utilizables en la respuesta", ...resumen];
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
    const detalle = [`cifras nuevas sin respaldo: ${nuevas.join(", ")}`, ...aplicadas];
    console.warn(`[postulai] Reparación descartada (${detalle.join("; ")})`);
    return { cv, estado: "descartada", detalle, usage };
  }

  console.warn(`[postulai] Reparación aplicada: ${aplicadas.join("; ")}`);
  return { cv: reparado, estado: "aplicada", detalle: aplicadas, usage };
}

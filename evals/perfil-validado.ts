/**
 * Perfil generativo + validador de fidelidad (PED-24) sobre las respuestas guardadas de evals/perfil/<caso>.json.
 * No genera perfiles nuevos. Flujo: verificación PED-32 → código del validador → Haiku (solo las que pasan el código)
 * → armado. El modo generativo sigue desactivado en la app; esto vive solo en el eval.
 *
 * Uso:
 *   npx tsx evals/perfil-validado.ts [caso ...]                       # juicios guardados ($0)
 *   npx tsx evals/perfil-validado.ts [caso ...] --estimar             # costo estimado del juicio (count_tokens)
 *   npx tsx evals/perfil-validado.ts [caso ...] --ejecutar [--presupuesto=0.06]
 * Juicios guardados en evals/validador/perfiles/<caso>.json, por texto del prompt (cambia el prompt → sin juicio).
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import {
  juzgarConModelo, MODELOS_VALIDADOR, paramsValidador, parsearJuicios, perfilValidado, promptValidador,
  type OracionAValidar, type ResultadoModelo,
} from "../app/lib/validador";
import { loadEnv, mapeoDelCaso } from "./lib-casos";

const PRECIO_IN = 1, PRECIO_OUT = 5; // Haiku 4.5
const DIR = path.join(process.cwd(), "evals/validador/perfiles");
const costo = (u: { input_tokens: number; output_tokens: number }) => (u.input_tokens * PRECIO_IN + u.output_tokens * PRECIO_OUT) / 1e6;

// Costo promedio guardado de las otras etapas por CV (evals/*/<caso>.json, campo costo).
function promedio(dir: string): number {
  const c = fs.readdirSync(path.join(process.cwd(), dir)).filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(process.cwd(), dir, f), "utf-8")).costo).filter((x: unknown) => typeof x === "number");
  return c.length ? c.reduce((a: number, b: number) => a + b, 0) / c.length : 0;
}

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar"), estimar = args.includes("--estimar");
  const presupuesto = Number(args.find(a => a.startsWith("--presupuesto="))?.split("=")[1] ?? 0.06);
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length ? pedidos : fs.readdirSync(path.join(process.cwd(), "evals/perfil")).map(f => f.replace(/\.json$/, ""));
  if (ejecutar || estimar) loadEnv();
  const client = ejecutar || estimar ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
  const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals/validador/inflados-ped32.json"), "utf-8"));

  let gastado = 0, estimado = 0;
  const filas: { caso: string; r: Awaited<ReturnType<typeof perfilValidado>>; c: number }[] = [];
  for (const caso of casos) {
    const { ctx, resultado } = await mapeoDelCaso(caso);
    const input = { cv: ctx.casoJson.cv_texto as string, mapeo: resultado, keywordsJD: ctx.keywordsJD };
    const respuestas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals/perfil", `${caso}.json`), "utf-8")).respuestas;
    const archivo = path.join(DIR, `${caso}.json`);
    const guardados: Record<string, { raw: string; usage: ResultadoModelo["usage"] }> = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, "utf-8")) : {};
    let c = 0;
    const juez = async (os: OracionAValidar[]): Promise<ResultadoModelo> => {
      const clave = promptValidador(os);
      if (estimar) {
        const p = paramsValidador(os, MODELOS_VALIDADOR.haiku);
        const { input_tokens } = await client!.messages.countTokens({ model: p.model, system: p.system, messages: p.messages });
        estimado += costo({ input_tokens, output_tokens: os.length * 70 });
        return { juicios: os.map(() => ({ veredicto: "fiel", tipo: null, explicacion: "(estimación)", natural: true })), raw: "", usage: { input_tokens: 0, output_tokens: 0 } };
      }
      const g = guardados[clave];
      if (g) { c += costo(g.usage); return { juicios: parsearJuicios(g.raw, os.length), raw: g.raw, usage: { input_tokens: 0, output_tokens: 0 } }; }
      if (!client || gastado + 0.006 > presupuesto) return { juicios: os.map(() => null), raw: "", usage: { input_tokens: 0, output_tokens: 0 } };
      const r = await juzgarConModelo(os, { client, modelo: MODELOS_VALIDADOR.haiku });
      gastado += costo(r.usage); c += costo(r.usage);
      guardados[clave] = { raw: r.raw, usage: r.usage };
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(archivo, JSON.stringify(guardados, null, 2) + "\n");
      return r;
    };
    filas.push({ caso, r: await perfilValidado(input, respuestas, juez), c });
  }
  if (estimar) { console.log(`Costo estimado del juicio (9 perfiles, sin reintentos de armado adicionales): ~$${estimado.toFixed(4)}`); return; }

  console.log(`\n${"caso".padEnd(26)} estado      resp  verif  código  modelo  aceptadas  juicio`);
  for (const { caso, r, c } of filas) {
    const n = (capa: string) => r.descartadas.filter(d => d.capa === capa).length;
    console.log(`${caso.padEnd(26)} ${r.estado.padEnd(11)} ${String(r.respuesta ?? "—").padStart(4)}  ${String(n("verificacion")).padStart(5)}  ${String(n("codigo")).padStart(6)}  ${String(n("modelo")).padStart(6)}  ${String(r.aceptadas.length).padStart(9)}  $${c.toFixed(4)}`);
  }

  for (const { caso, r } of filas) {
    console.log(`\n═══ ${caso} · ${r.estado}${r.respuesta ? " (respuesta 2)" : ""}`);
    console.log(`  ORIGINAL: ${r.original}`);
    if (r.estado === "adaptado") console.log(`  FINAL:    ${r.perfil}`);
    if (r.problemas.length) console.log(`  armado rechazado: ${r.problemas.join(" | ")}`);
    for (const d of r.descartadas) console.log(`  ✗ [${d.capa}] ${d.texto}\n      ${d.motivos.join(" | ")}`);
  }

  // Ningún inflado del fixture puede sobrevivir en un perfil final adaptado.
  const sobreviven = fixture.inflados.filter((i: { caso: string; oracion: string }) => {
    const f = filas.find(x => x.caso === i.caso);
    return f?.r.estado === "adaptado" && f.r.aceptadas.includes(i.oracion);
  });
  const presentes = fixture.inflados.filter((i: { caso: string; oracion: string }) => filas.some(x => x.caso === i.caso)).length;
  console.log(`\nInflados del fixture en perfiles finales: ${sobreviven.length}/${presentes} ${sobreviven.length === 0 ? "✅" : "❌"}`);
  sobreviven.forEach((i: { caso: string; oracion: string }) => console.log(`  ${i.caso}: ${i.oracion}`));

  const juicioProm = filas.reduce((s, f) => s + f.c, 0) / Math.max(1, filas.length);
  const perfilProm = promedio("evals/perfil");
  const etapas: [string, number][] = [
    ["parseo oferta (evals/ofertas)", promedio("evals/ofertas")], ["extracción competencias CV (evals/competencias)", promedio("evals/competencias")],
    ["mapeo semántico (evals/semantico)", promedio("evals/semantico")], ["etiquetas priorizador (evals/priorizar)", promedio("evals/priorizar")],
    ["perfil generativo, 1-2 intentos (evals/perfil)", perfilProm], ["juicio validador (este eval)", juicioProm],
  ];
  const total = etapas.reduce((s, [, c]) => s + c, 0);
  console.log("\nCosto por CV (promedios guardados):");
  etapas.forEach(([n, c]) => console.log(`  ${n.padEnd(48)} $${c.toFixed(4)}`));
  console.log(`  ${"TOTAL".padEnd(48)} $${total.toFixed(4)} ${total <= 0.03 ? "✅" : "❌"} tope PED-28 $0.03`);
  if (ejecutar) console.log(`\nCosto real de esta corrida: $${gastado.toFixed(4)}`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

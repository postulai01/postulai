/**
 * Eval del validador de fidelidad (app/lib/validador.ts) contra evals/validador/inflados-ped32.json.
 *
 * Uso:
 *   npx tsx evals/validador.ts                       # solo capa de código + respuestas guardadas ($0)
 *   npx tsx evals/validador.ts --estimar             # costo estimado de --ejecutar (count_tokens, gratis)
 *   npx tsx evals/validador.ts --ejecutar [--modelos=haiku,sonnet] [--corridas=3] [--presupuesto=0.10]
 *
 * Una llamada por modelo y corrida con todas las oraciones únicas del fixture (el fixture repite la misma oración en
 * varios inflados). Las respuestas se guardan en evals/validador/respuestas/<modelo>-<n>.json.
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import {
  combinar, juzgarConModelo, MODELOS_VALIDADOR, paramsValidador, parsearJuicios, validarCodigo,
  type JuicioOracion, type OracionAValidar,
} from "../app/lib/validador";
import { loadEnv } from "./lib-casos";

const PRECIOS: Record<string, [number, number]> = { haiku: [1, 5], sonnet: [2, 10] };
const TOKENS_OUT = 1500;
const DIR = path.join(process.cwd(), "evals/validador");
const RESP = path.join(DIR, "respuestas");

interface Caso extends OracionAValidar { caso: string; tipo?: string; nota?: string }

const costo = (m: string, u: { input_tokens: number; output_tokens: number }) =>
  (u.input_tokens * PRECIOS[m][0] + u.output_tokens * PRECIOS[m][1]) / 1e6;

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar"), estimar = args.includes("--estimar");
  const modelos = (args.find(a => a.startsWith("--modelos="))?.split("=")[1] ?? "haiku,sonnet").split(",");
  const corridas = Number(args.find(a => a.startsWith("--corridas="))?.split("=")[1] ?? 3);
  const presupuesto = Number(args.find(a => a.startsWith("--presupuesto="))?.split("=")[1] ?? 0.10);

  const fx = JSON.parse(fs.readFileSync(path.join(DIR, "inflados-ped32.json"), "utf-8"));
  const inflados: Caso[] = fx.inflados, honestas: Caso[] = fx.honestas;
  const todos = [...inflados, ...honestas];
  const clave = (c: Caso) => `${c.caso}::${c.oracion}`;
  const unicas: Caso[] = [];
  for (const c of todos) if (!unicas.some(u => clave(u) === clave(c))) unicas.push(c);
  const idx = (c: Caso) => unicas.findIndex(u => clave(u) === clave(c));
  const cvs = new Map<string, string>();
  for (const c of unicas) if (!cvs.has(c.caso)) cvs.set(c.caso, JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals/casos", `${c.caso}.json`), "utf-8")).cv_texto);
  const codigo = unicas.map(u => validarCodigo(u, cvs.get(u.caso)));

  if (ejecutar || estimar) loadEnv();
  const client = ejecutar || estimar ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  if (estimar) {
    let total = 0;
    for (const m of modelos) {
      const p = paramsValidador(unicas, MODELOS_VALIDADOR[m as keyof typeof MODELOS_VALIDADOR]);
      const { input_tokens } = await client!.messages.countTokens({ model: p.model, system: p.system, messages: p.messages });
      const c = costo(m, { input_tokens, output_tokens: TOKENS_OUT });
      total += c * corridas;
      console.log(`${m}: ${input_tokens} tokens de entrada, ~$${c.toFixed(4)} por llamada × ${corridas}`);
    }
    console.log(`Total estimado: ~$${total.toFixed(4)} (salida supuesta ${TOKENS_OUT} tokens por llamada)`);
    return;
  }

  // Juicios por modelo y corrida: de la API (--ejecutar) o guardados.
  const juicios: Record<string, (JuicioOracion | null)[][]> = {};
  const costos: Record<string, number[]> = {};
  let gastado = 0;
  for (const m of modelos) {
    juicios[m] = []; costos[m] = [];
    for (let n = 1; n <= corridas; n++) {
      const archivo = path.join(RESP, `${m}-${n}.json`);
      if (client) {
        const previo = costos[m][costos[m].length - 1] ?? (PRECIOS[m][0] * 5000 + PRECIOS[m][1] * TOKENS_OUT) / 1e6; // ~5k tokens de entrada
        if (gastado + previo > presupuesto) { console.log(`⏸  ${m} #${n}: presupuesto agotado ($${gastado.toFixed(4)})`); continue; }
        const r = await juzgarConModelo(unicas, { client, modelo: MODELOS_VALIDADOR[m as keyof typeof MODELOS_VALIDADOR] });
        const c = costo(m, r.usage);
        gastado += c;
        fs.mkdirSync(RESP, { recursive: true });
        fs.writeFileSync(archivo, JSON.stringify({ modelo: m, corrida: n, costo: c, usage: r.usage, raw: r.raw }, null, 2) + "\n");
        juicios[m].push(r.juicios); costos[m].push(c);
      } else if (fs.existsSync(archivo)) {
        const g = JSON.parse(fs.readFileSync(archivo, "utf-8"));
        juicios[m].push(parsearJuicios(g.raw, unicas.length)); costos[m].push(g.costo);
      }
    }
  }

  const esGrave = (c: Caso) => c.tipo !== "leve";
  const graves = inflados.filter(esGrave), leves = inflados.filter(c => !esGrave(c));
  const rech = (c: Caso, j: (JuicioOracion | null)[] | null) => combinar(codigo[idx(c)], j ? j[idx(c)] : null).rechazada;

  console.log(`\nSolo código: graves ${graves.filter(c => rech(c, null)).length}/${graves.length} · leves ${leves.filter(c => rech(c, null)).length}/${leves.length} · falsos positivos ${honestas.filter(c => rech(c, null)).length}/${honestas.length}`);
  console.log(`\n${"modelo".padEnd(8)} corrida  graves  leves  FP     sin juicio  costo`);
  for (const m of modelos) juicios[m].forEach((j, n) => {
    const nulos = j.filter(x => !x).length;
    console.log(`${m.padEnd(8)} ${String(n + 1).padStart(7)}  ${`${graves.filter(c => rech(c, j)).length}/${graves.length}`.padStart(6)}  ${`${leves.filter(c => rech(c, j)).length}/${leves.length}`.padStart(5)}  ${`${honestas.filter(c => rech(c, j)).length}/${honestas.length}`.padEnd(5)}  ${String(nulos).padStart(10)}  $${costos[m][n].toFixed(4)}`);
  });
  for (const m of modelos) {
    if (juicios[m].length < 2) continue;
    const cambian = unicas.filter((_, k) => new Set(juicios[m].map(j => j[k]?.veredicto ?? "—")).size > 1);
    console.log(`${m}: estabilidad ${cambian.length === 0 ? "✅ ningún veredicto cambia" : `❌ cambian ${cambian.length}: ${cambian.map(u => `"${u.oracion.slice(0, 50)}…"`).join(" | ")}`}`);
  }

  console.log("\n═══ Inflados: qué capa los atrapa");
  for (const c of inflados) {
    const k = idx(c), cod = codigo[k];
    console.log(`\n[${c.tipo}] ${c.caso} — ${c.nota}`);
    console.log(`  código: ${cod.length ? cod.map(h => `${h.tipo}: ${h.detalle}`).join(" | ") : "—"}`);
    for (const m of modelos) juicios[m].forEach((j, n) => {
      const x = j[k];
      console.log(`  ${m} #${n + 1}: ${x ? `${x.veredicto}${x.tipo ? ` (${x.tipo})` : ""} — ${x.explicacion}${x.natural ? "" : " [no natural]"}` : "sin juicio"}`);
    });
  }

  console.log("\n═══ Honestas marcadas");
  let alguna = false;
  for (const c of honestas) {
    const k = idx(c);
    if (codigo[k].length) { alguna = true; console.log(`  código · "${c.oracion}"\n     ${codigo[k].map(h => h.detalle).join(" | ")}`); }
    for (const m of modelos) juicios[m].forEach((j, n) => {
      if (j[k]?.veredicto === "exagera") { alguna = true; console.log(`  ${m} #${n + 1} · "${c.oracion}"\n     (${j[k]!.tipo}) ${j[k]!.explicacion}`); }
    });
  }
  if (!alguna) console.log("  ninguna");
  const noNat = unicas.filter((_, k) => modelos.some(m => juicios[m].some(j => j[k] && !j[k]!.natural)));
  if (noNat.length) console.log(`\nMarcadas no naturales (informativo): ${noNat.map(u => `"${u.oracion.slice(0, 60)}…"`).join(" | ")}`);
  if (ejecutar) console.log(`\nCosto real: $${gastado.toFixed(4)}`);
  console.log("");
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

/**
 * Corre parsearJD (app/lib/jd-parser.ts) sobre las ofertas de evals/casos/.
 * Guarda cada resultado en evals/ofertas/.
 *
 * Uso:
 *   npx tsx evals/parsear-jd.ts [caso ...]             # sin API: costo estimado + validación con una respuesta simulada
 *   npx tsx evals/parsear-jd.ts [caso ...] --ejecutar  # llama a Haiku, una vez por oferta
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { consolidarJD, parsearJD, SYSTEM_JD } from "../app/lib/jd-parser";

// Haiku 4.5: $1 / $5 por MTok (misma tabla que reparar-guardados.ts)
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const TOKENS_OUT = 700; // ~15 keywords con relevancia + nivel + industria

// Respuesta simulada para probar la validación sin API (caso pedro_cencomalls).
// "liderazgo" no está en esa oferta: debe quedar en descartadas. "Excel" repetida en deseables se ignora.
const RESPUESTA_SIMULADA = {
  requeridas: [
    { keyword: "Excel", relevancia: 9 },
    { keyword: "facturación", relevancia: 10 },
    { keyword: "Power BI", relevancia: 6 },
    { keyword: "Ingeniería Comercial", relevancia: 7 },
  ],
  deseables: [
    { keyword: "liderazgo", relevancia: 3 },
    { keyword: "Excel", relevancia: 2 },
  ],
  nivel: "practicante",
  industria: "retail inmobiliario",
};

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : ["pedro_cencomalls"];

  const trabajos = casos.map(caso => {
    const oferta: string = JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals/casos", `${caso}.json`), "utf-8")).oferta_texto;
    const tokIn = (SYSTEM_JD.length + oferta.length + 30) / CHARS_POR_TOKEN;
    return { caso, oferta, estimado: (tokIn * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6 };
  });

  console.log("\nCaso                     caracteres  estimado");
  for (const t of trabajos) console.log(`${t.caso.padEnd(24)} ${String(t.oferta.length).padStart(10)}  $${t.estimado.toFixed(4)}`);
  const total = trabajos.reduce((s, t) => s + t.estimado, 0);
  console.log(`\n💰  Costo estimado total: $${total.toFixed(4)} USD (${trabajos.length} llamada(s) a Haiku)`);

  if (!ejecutar) {
    const t = trabajos[0];
    const { texto_limpio: _t, ...simulado } = consolidarJD(t.oferta, RESPUESTA_SIMULADA);
    console.log(`\nValidación con respuesta SIMULADA (${t.caso}), no es salida del modelo:`);
    console.log(JSON.stringify(simulado, null, 2));
    console.log("\n    Sin --ejecutar: no se llamó a la API.\n");
    return;
  }

  loadEnv();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const outDir = path.join(process.cwd(), "evals/ofertas");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  let costoTotal = 0;

  for (const t of trabajos) {
    let r;
    try {
      r = await parsearJD(t.oferta, { client });
    } catch (err) {
      console.error(`❌  ${t.caso}: ${(err as Error).message}`);
      continue;
    }
    const u = r.usage;
    const costo = u ? (u.input_tokens * PRECIO_IN + u.output_tokens * PRECIO_OUT) / 1e6 : 0;
    costoTotal += costo;
    fs.writeFileSync(path.join(outDir, `${t.caso}-${ts}.json`), JSON.stringify({ caso: t.caso, ts, costo, ...r }, null, 2));
    const { texto_limpio: _t, usage: _u, ...resumen } = r;
    console.log(`\n=== ${t.caso}  ${r.keywords_requeridas.length} requeridas · ${r.keywords_deseables.length} deseables · ${r.descartadas.length} descartadas · $${costo.toFixed(4)}`);
    console.log(JSON.stringify(resumen, null, 2));
  }
  console.log(`\n💰  Costo real total: $${costoTotal.toFixed(4)} USD\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

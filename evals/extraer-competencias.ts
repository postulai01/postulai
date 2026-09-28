/**
 * Corre extraerCompetencias (app/lib/competencia-extractor.ts) sobre los CVs de evals/casos/.
 * Guarda cada resultado en evals/competencias/.
 *
 * Uso:
 *   npx tsx evals/extraer-competencias.ts [caso ...]             # solo estima el costo (sin API)
 *   npx tsx evals/extraer-competencias.ts [caso ...] --ejecutar  # llama a Haiku, una vez por CV
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { extraerCompetencias, extraerIdiomas, lineasCV } from "../app/lib/competencia-extractor";

// Haiku 4.5: $1 / $5 por MTok (misma tabla que reparar-guardados.ts)
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const CHARS_SYSTEM = 1900;
const TOKENS_OUT_POR_LINEA = 60; // medido: 9.556 tokens de salida en 156 líneas (2026-09-28)

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
  const dirCasos = path.join(process.cwd(), "evals/casos");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : fs.readdirSync(dirCasos).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));

  const trabajos = casos.map(caso => {
    const cv: string = JSON.parse(fs.readFileSync(path.join(dirCasos, `${caso}.json`), "utf-8")).cv_texto;
    const lineas = lineasCV(cv);
    const tokIn = (CHARS_SYSTEM + JSON.stringify(lineas, null, 1).length) / CHARS_POR_TOKEN;
    const tokOut = lineas.length * TOKENS_OUT_POR_LINEA;
    return { caso, cv, lineas, estimado: (tokIn * PRECIO_IN + tokOut * PRECIO_OUT) / 1e6 };
  });

  console.log("\nCaso                     líneas  idiomas (sin API)                     estimado");
  for (const t of trabajos) {
    console.log(`${t.caso.padEnd(24)} ${String(t.lineas.length).padStart(6)}  ${extraerIdiomas(t.cv).join(", ").padEnd(36).slice(0, 36)}  $${t.estimado.toFixed(4)}`);
  }
  const total = trabajos.reduce((s, t) => s + t.estimado, 0);
  console.log(`\n💰  Costo estimado total: $${total.toFixed(4)} USD (${trabajos.length} llamada(s) a Haiku)`);
  if (!ejecutar) { console.log("    Sin --ejecutar: no se llamó a la API.\n"); return; }

  loadEnv();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const outDir = path.join(process.cwd(), "evals/competencias");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  let costoTotal = 0, tokIn = 0, tokOut = 0, vacios = 0;

  for (const t of trabajos) {
    let r;
    try {
      r = await extraerCompetencias(t.cv, { client });
    } catch (err) {
      console.error(`❌  ${t.caso}: ${(err as Error).message}`);
      continue;
    }
    const u = r.usage;
    const costo = u ? (u.input_tokens * PRECIO_IN + u.output_tokens * PRECIO_OUT) / 1e6 : 0;
    costoTotal += costo; tokIn += u?.input_tokens ?? 0; tokOut += u?.output_tokens ?? 0;
    const vacio = r.competencias.length === 0;
    if (vacio) vacios++;
    fs.writeFileSync(path.join(outDir, `${t.caso}-${ts}.json`), JSON.stringify({ caso: t.caso, ts, costo, ...r }, null, 2));
    console.log(`\n=== ${t.caso}  ${vacio ? "❌ VACÍO" : "✓"}  ${r.competencias.length} competencias · ${r.herramientas.length} herramientas · ${r.descartadas.length} descartadas · $${costo.toFixed(4)}`);
    const { usage: _u, ...sinUsage } = r;
    console.log(JSON.stringify(sinUsage, null, 2));
  }
  console.log(`\n💰  Costo real total: $${costoTotal.toFixed(4)} USD · ${tokIn} tokens de entrada · ${tokOut} de salida`);
  console.log(`${vacios === 0 ? "✓" : "❌"}  ${trabajos.length - vacios}/${trabajos.length} CVs con competencias\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

/**
 * Aplica el post-procesamiento actual y la reparación dirigida (app/lib/reparacion.ts) a adaptaciones
 * ya guardadas en evals/resultados/, sin regenerarlas. Solo llama a Haiku en los CVs con violaciones
 * reparables. Guarda el resultado en evals/reparaciones/ (no en evals/resultados/, para que
 * critico-reclutador.ts no lo confunda con una generación del prompt actual).
 *
 * Uso:
 *   npx tsx evals/reparar-guardados.ts evals/resultados/<archivo>.json [...]            # solo estima el costo
 *   npx tsx evals/reparar-guardados.ts evals/resultados/<archivo>.json [...] --ejecutar # llama a la API
 *
 * La estimación cubre el primer intento; si alguna línea se rechaza, un reintento puede sumar ~$0.0025 por CV.
 *
 * Después: npx tsx evals/verificar.ts evals/reparaciones/<archivo>.json [...]
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { postprocesarCV } from "../app/lib/cv-postprocess";
import { cargoDesdeTitulo, detectarReparables } from "../app/lib/cv-verificacion";
import { repararCV } from "../app/lib/reparacion";

// Haiku 4.5: $1 / $5 por MTok (misma tabla que critico-reclutador.ts)
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1; // español, medido con el caché del SYSTEM_PROMPT

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
  const archivos = args.filter(a => !a.startsWith("--"));
  if (archivos.length === 0) { console.error("❌  Indica al menos un archivo de evals/resultados/."); process.exit(1); }

  const trabajos = archivos.map(archivo => {
    const resultado = JSON.parse(fs.readFileSync(archivo, "utf-8"));
    const caso: string = resultado.caso ?? path.basename(archivo).replace(/-\d{4}-\d{2}-\d{2}T.*$/, "");
    const casoJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals/casos", `${caso}.json`), "utf-8"));
    const fuente: string = casoJson.cv_texto;
    const cargo: string | null = cargoDesdeTitulo(resultado.titulo_postulacion) ?? casoJson.cargo_oferta ?? null;
    const cv = postprocesarCV(resultado.cv_adaptado ?? "", fuente);
    const violaciones = detectarReparables(cv, cargo);
    const tokIn = violaciones.length ? Math.round((fuente.length + 1800 + violaciones.reduce((s, v) => s + v.texto.length + 500, 0)) / CHARS_POR_TOKEN) : 0;
    const tokOut = violaciones.reduce((s, v) => s + (v.tipo === "perfil_sin_cargo" ? 250 : 60), violaciones.length ? 30 : 0);
    return { archivo, resultado, caso, fuente, cargo, cv, violaciones, estimado: (tokIn * PRECIO_IN + tokOut * PRECIO_OUT) / 1e6 };
  });

  const total = trabajos.reduce((s, t) => s + t.estimado, 0);
  console.log("\nCaso                     violaciones reparables                                llamada  estimado");
  for (const t of trabajos) {
    const v = t.violaciones.map(x => x.tipo).join(", ") || "—";
    console.log(`${t.caso.padEnd(24)} ${v.padEnd(52).slice(0, 52)}  ${t.violaciones.length ? "sí" : "no"}       $${t.estimado.toFixed(4)}`);
  }
  console.log(`\n💰  Costo estimado total: $${total.toFixed(4)} USD (${trabajos.filter(t => t.violaciones.length).length} llamada(s) a Haiku)`);
  if (!ejecutar) { console.log("    Sin --ejecutar: no se llamó a la API.\n"); return; }

  loadEnv();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const outDir = path.join(process.cwd(), "evals/reparaciones");
  fs.mkdirSync(outDir, { recursive: true });
  let costoTotal = 0;
  console.log("");
  for (const t of trabajos) {
    const r = await repararCV({ client, cv: t.cv, fuente: t.fuente, cargoOferta: t.cargo });
    const u = r.usage;
    const costo = u ? (u.input_tokens * PRECIO_IN + u.output_tokens * PRECIO_OUT) / 1e6 : 0;
    costoTotal += costo;
    const outPath = path.join(outDir, path.basename(t.archivo));
    fs.writeFileSync(outPath, JSON.stringify({
      ...t.resultado, caso: t.caso, cv_adaptado: r.cv, costo_reparacion: costo,
      reparacion: { estado: r.estado, detalle: r.detalle, usage: u ?? null },
    }, null, 2));
    console.log(`${t.caso.padEnd(24)} ${r.estado.padEnd(16)} $${costo.toFixed(4)}  ${r.detalle.join("; ")}`);
  }
  console.log(`\n💰  Costo real total: $${costoTotal.toFixed(4)} USD · promedio por CV: $${(costoTotal / trabajos.length).toFixed(4)}\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

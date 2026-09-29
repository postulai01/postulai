/**
 * Eval del mapeo (PED-30) sobre todos los casos con oferta parseada: capa literal + requisitos estructurados
 * (sin API) y capa semántica (una llamada a Haiku por caso, mapearSemantico).
 *
 * Uso:
 *   npx tsx evals/mapear-set.ts [caso ...]             # dry-run: capa literal, brechas que irían a Haiku y costo estimado
 *   npx tsx evals/mapear-set.ts [caso ...] --ejecutar  # llama a Haiku una vez por caso con brechas
 *
 * Criterio de éxito: todo fit alto con score mayor que todo fit medio, y todo medio mayor que todo bajo.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import {
  esCarrera, mapearCompetencias, mapearSemantico, promptSemantico, SYSTEM_MAPEO_SEMANTICO,
  type ResultadoMapeo, type Rechazo,
} from "../app/lib/mapeo-semantico";
import { cargarContexto, casosConOferta, loadEnv } from "./lib-casos";

// Haiku 4.5: $1 / $5 por MTok
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const TOKENS_OUT = 500;

const ORDEN_FIT: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };

interface Fila {
  caso: string; fit: string; literal: number; despues: number;
  directos: number; relLit: number; relSem: number; dirSem: number; brechas: number;
  resultado: ResultadoMapeo; rechazos: Rechazo[]; costo: number;
}

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : casosConOferta();
  if (ejecutar) loadEnv();
  const client = ejecutar ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  const filas: Fila[] = [];
  let estimado = 0;
  for (const caso of casos) {
    const ctx = cargarContexto(caso);
    if (!ctx.keywordsJD.experiencia && !ctx.keywordsJD.carreras) console.log(`⚠️  ${caso}: la oferta guardada no tiene requisitos estructurados (re-parsear)`);
    const literal = await mapearCompetencias(ctx.competencias, ctx.keywordsJD, ctx.extras);
    const brechas = literal.gap_keywords.filter(g => !esCarrera(g.keyword));
    const fit = ctx.casoJson.fit_esperado ?? "?";

    let resultado = literal, rechazos: Rechazo[] = [], costo = 0;
    if (brechas.length > 0) {
      const tokIn = (SYSTEM_MAPEO_SEMANTICO.length + promptSemantico(brechas, ctx.casoJson.cv_texto).length) / CHARS_POR_TOKEN;
      const est = (tokIn * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6;
      estimado += est;
      if (client) {
        const r = await mapearSemantico(literal, ctx.keywordsJD, ctx.casoJson.cv_texto, { client });
        resultado = r.resultado;
        rechazos = r.rechazos;
        costo = r.usage ? (r.usage.input_tokens * PRECIO_IN + r.usage.output_tokens * PRECIO_OUT) / 1e6 : 0;
      } else {
        console.log(`${caso.padEnd(26)} ${String(brechas.length).padStart(2)} brechas a Haiku · ~$${est.toFixed(4)}: ${brechas.map(b => b.keyword).join(", ")}`);
      }
    }
    const sem = (m: { origen?: string }) => m.origen === "semantico";
    filas.push({
      caso, fit, literal: literal.score_adaptacion, despues: resultado.score_adaptacion,
      directos: resultado.matches_directos.filter(m => !sem(m)).length,
      dirSem: resultado.matches_directos.filter(sem).length,
      relLit: resultado.matches_relacionados.filter(m => !sem(m)).length,
      relSem: resultado.matches_relacionados.filter(sem).length,
      brechas: resultado.gap_keywords.length, resultado, rechazos, costo,
    });
  }

  filas.sort((a, b) => (ORDEN_FIT[b.fit] ?? 0) - (ORDEN_FIT[a.fit] ?? 0) || b.despues - a.despues);
  const col = ejecutar ? "semántico" : "(dry-run)";
  console.log(`\n${"caso".padEnd(26)} fit    literal  ${col.padEnd(9)}  dir(lit+sem)  rel(lit+sem)  brechas`);
  for (const f of filas) {
    console.log(`${f.caso.padEnd(26)} ${f.fit.padEnd(6)} ${f.literal.toFixed(2).padStart(7)}  ${(ejecutar ? f.despues.toFixed(2) : "—").padStart(9)}  ${`${f.directos}+${f.dirSem}`.padStart(12)}  ${`${f.relLit}+${f.relSem}`.padStart(12)}  ${String(f.brechas).padStart(7)}`);
  }

  console.log("\nRequisitos estructurados:");
  for (const f of filas) for (const q of f.resultado.requisitos ?? []) {
    console.log(`  ${f.caso.padEnd(26)} ${q.descripcion.padEnd(50).slice(0, 50)} ${q.tipo.padEnd(9)} ${q.estado.padEnd(15)} ${q.detalle}`);
  }

  // Criterio de éxito sobre el score final (semántico si se ejecutó, literal si no).
  const score = (f: Fila) => (ejecutar ? f.despues : f.literal);
  const grupo = (fit: string) => filas.filter(f => f.fit === fit).map(score);
  const [alto, medio, bajo] = ["alto", "medio", "bajo"].map(grupo);
  const ok1 = Math.min(...alto) > Math.max(...medio), ok2 = Math.min(...medio) > Math.max(...bajo);
  console.log(`\nCriterio: min(alto) ${Math.min(...alto)} > max(medio) ${Math.max(...medio)} ${ok1 ? "✅" : "❌"} · min(medio) ${Math.min(...medio)} > max(bajo) ${Math.max(...bajo)} ${ok2 ? "✅" : "❌"}`);

  if (!ejecutar) {
    console.log(`\nCosto estimado de la capa semántica: ~$${estimado.toFixed(4)}. Corre con --ejecutar.\n`);
    return;
  }

  console.log("\nMatches semánticos (revisión manual):");
  for (const f of filas) {
    const sem = [...f.resultado.matches_directos.map(m => ({ ...m, n: "directo" })), ...f.resultado.matches_relacionados.map(m => ({ ...m, n: "relacionado" }))]
      .filter(m => m.origen === "semantico");
    for (const m of sem) console.log(`  ${f.caso.padEnd(26)} "${m.keyword_jd}" (${m.n}, ${m.relevancia}) ← "${m.cita}"`);
  }
  console.log("\nPropuestas rechazadas por los filtros:");
  for (const f of filas) for (const r of f.rechazos) console.log(`  ${f.caso.padEnd(26)} "${r.keyword}" ← "${r.cita}" · ${r.motivo}`);

  console.log("\nCosto real por caso:");
  for (const f of filas) console.log(`  ${f.caso.padEnd(26)} $${f.costo.toFixed(4)}`);
  console.log(`  total                      $${filas.reduce((s, f) => s + f.costo, 0).toFixed(4)}`);

  const dir = path.join(process.cwd(), "evals/resultados");
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `mapear-set-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
  fs.writeFileSync(archivo, JSON.stringify(filas, null, 2));
  console.log(`\nGuardado en ${path.relative(process.cwd(), archivo)}\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

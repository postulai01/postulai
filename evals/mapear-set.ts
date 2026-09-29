/**
 * Eval del mapeo (PED-30) sobre todos los casos con oferta parseada: capa literal + requisitos estructurados,
 * capa semántica, score v1 y v2, alerta de nivel y clase por umbrales fijos.
 * Usa las ofertas fijadas (evals/ofertas/fijadas.json) y las propuestas semánticas guardadas (evals/semantico/),
 * así que por defecto no llama a la API y es determinista.
 *
 * Uso:
 *   npx tsx evals/mapear-set.ts [caso ...]              # sin API: re-aplica los filtros a las propuestas guardadas
 *   npx tsx evals/mapear-set.ts [caso ...] --ejecutar   # pide propuestas nuevas a Haiku (una llamada por caso) y las guarda
 *   npx tsx evals/mapear-set.ts [caso ...] --estimar    # costo estimado de --ejecutar
 *
 * Criterio de éxito (PED-30): 0 relacionados falsos, casos de control OK, 0 citas inexistentes aceptadas.
 * Experimental (PED-33): orden por fit y clase por umbrales fijos (UMBRAL_CLASE).
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import {
  alertaNivel, aplicarSemanticos, claseFit, esCarrera, mapearCompetencias, mapearSemantico, promptSemantico,
  scoreV2, SYSTEM_MAPEO_SEMANTICO, UMBRAL_CLASE, type Rechazo, type ResultadoMapeo, type ScoreV2,
} from "../app/lib/mapeo-semantico";
import { cargarContexto, casosConOferta, loadEnv } from "./lib-casos";

// Haiku 4.5: $1 / $5 por MTok
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const TOKENS_OUT = 500;

const ORDEN_FIT: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
const DIR_SEMANTICO = path.join(process.cwd(), "evals/semantico");

interface Fila {
  caso: string; fit: string; v1: number; v2: ScoreV2; alerta: ReturnType<typeof alertaNivel>;
  resultado: ResultadoMapeo; rechazos: Rechazo[]; costo: number; fuente: string;
}

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar"), estimar = args.includes("--estimar");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : casosConOferta();
  if (ejecutar) loadEnv();
  const client = ejecutar ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  const filas: Fila[] = [];
  let estimado = 0;
  for (const caso of casos) {
    const ctx = cargarContexto(caso);
    const cv: string = ctx.casoJson.cv_texto;
    const literal = await mapearCompetencias(ctx.competencias, ctx.keywordsJD, ctx.extras);
    const brechas = literal.gap_keywords.filter(g => !esCarrera(g.keyword));
    const cache = path.join(DIR_SEMANTICO, `${caso}.json`);

    let resultado = literal, rechazos: Rechazo[] = [], costo = 0, fuente = "sin brechas";
    if (brechas.length > 0 && (ejecutar || estimar)) {
      estimado += ((SYSTEM_MAPEO_SEMANTICO.length + promptSemantico(brechas, cv).length) / CHARS_POR_TOKEN * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6;
    }
    if (brechas.length > 0 && client) {
      const r = await mapearSemantico(literal, ctx.keywordsJD, cv, { client });
      ({ resultado, rechazos } = r);
      costo = (r.usage.input_tokens * PRECIO_IN + r.usage.output_tokens * PRECIO_OUT) / 1e6;
      if (r.reintento) console.log(`↻  ${caso}: reintento de citas para ${r.reintento.pedidas.join(", ")} → recuperadas: ${r.reintento.recuperadas.join(", ") || "ninguna"}`);
      fs.mkdirSync(DIR_SEMANTICO, { recursive: true });
      fs.writeFileSync(cache, JSON.stringify({ caso, oferta: path.basename(ctx.archivoOferta), costo, reintento: r.reintento, propuestos: r.propuestos }, null, 2) + "\n");
      fuente = "Haiku";
    } else if (brechas.length > 0 && fs.existsSync(cache)) {
      const guardado = JSON.parse(fs.readFileSync(cache, "utf-8"));
      if (guardado.oferta !== path.basename(ctx.archivoOferta)) console.log(`⚠️  ${caso}: las propuestas guardadas son de otra oferta (${guardado.oferta})`);
      ({ resultado, rechazos } = aplicarSemanticos(literal, ctx.keywordsJD, cv, guardado.propuestos));
      fuente = "guardado";
    } else if (brechas.length > 0) {
      fuente = "solo literal (sin propuestas guardadas)";
    }
    filas.push({
      caso, fit: ctx.casoJson.fit_esperado ?? "?", v1: resultado.score_adaptacion, v2: scoreV2(resultado, ctx.keywordsJD),
      alerta: alertaNivel(cv, ctx.keywordsJD, ctx.nivelPosicion), resultado, rechazos, costo, fuente,
    });
  }

  if (estimar) { console.log(`\nCosto estimado de --ejecutar: ~$${estimado.toFixed(4)}\n`); return; }

  filas.sort((a, b) => (ORDEN_FIT[b.fit] ?? 0) - (ORDEN_FIT[a.fit] ?? 0) || b.v2.score - a.v2.score);
  console.log(`\n${"caso".padEnd(26)} fit    v1    v2    clase v2*  alerta de nivel   bloq  preg  semántico`);
  for (const f of filas) {
    const ok = f.v2.clase === f.fit ? "✓" : "✗";
    console.log(`${f.caso.padEnd(26)} ${f.fit.padEnd(6)} ${f.v1.toFixed(2)}  ${f.v2.score.toFixed(2)}  ${`${f.v2.clase} ${ok}`.padEnd(9)} ${(f.alerta.alerta ?? "—").padEnd(17)} ${String(f.v2.bloqueantes.length).padStart(4)}  ${String(f.v2.preguntables.length).padStart(4)}  ${f.fuente}`);
  }

  console.log("\nBrechas (requeridas) por caso:");
  for (const f of filas) {
    console.log(`  ${f.caso}`);
    console.log(`    bloqueantes:  ${f.v2.bloqueantes.map(b => `${b.descripcion} (${b.peso})`).join(" · ") || "—"}`);
    console.log(`    preguntables: ${f.v2.preguntables.map(b => `${b.descripcion} (${b.peso})`).join(" · ") || "—"}`);
    console.log(`    nivel: ${f.alerta.alerta ?? "sin alerta"} · ${f.alerta.detalle}`);
  }

  console.log("\nMatches semánticos aceptados:");
  for (const f of filas) {
    for (const [lista, n] of [[f.resultado.matches_directos, "directo"], [f.resultado.matches_relacionados, "relacionado"]] as const) {
      for (const m of lista.filter(m => m.origen === "semantico")) console.log(`  ${f.caso.padEnd(26)} "${m.keyword_jd}" (${n}, ${m.relevancia}) ← "${m.cita}"`);
    }
  }
  console.log("\nPropuestas rechazadas:");
  for (const f of filas) for (const r of f.rechazos) {
    console.log(`  ${f.caso.padEnd(26)} "${r.keyword}" ← "${r.cita}" · ${r.relevancia ?? "—"} · ${r.motivo}`);
  }

  // Criterio de éxito de PED-30.
  const todos = (f: Fila) => [...f.resultado.matches_directos, ...f.resultado.matches_relacionados];
  const FALSOS: [string, string][] = [["Mercado Público", "publicidad"], ["Reglamento Interno", "equidad interna"], ["Desarrollo Organizacional", "planificación y organización"]];
  const falsos = filas.flatMap(f => todos(f).filter(m => FALSOS.some(([k, c]) => m.keyword_jd === k && m.competencia_cv.includes(c))).map(m => `${f.caso}: ${m.keyword_jd} ← ${m.competencia_cv}`));
  const citasMalas = filas.flatMap(f => {
    const cv = cargarContexto(f.caso).casoJson.cv_texto.replace(/\s+/g, " ");
    return todos(f).filter(m => m.origen === "semantico" && !cv.includes(m.cita ?? "")).map(m => `${f.caso}: ${m.keyword_jd}`);
  });
  const fila = (c: string) => filas.find(f => f.caso === c);
  const req = (c: string, clase: string) => fila(c)?.resultado.requisitos?.filter(q => q.clase === clase) ?? [];
  const controles: [string, boolean | undefined][] = [
    ["vallenar: años de experiencia cumplen", req("andres_vallenar", "experiencia").length > 0 && req("andres_vallenar", "experiencia").every(q => q.estado === "cumple")],
    ["vallenar: carreras = 1 requisito, afín a revisar", req("andres_vallenar", "carrera").length === 1 && req("andres_vallenar", "carrera")[0].estado === "afin_a_revisar"],
    ["tricolor: herramientas de office cumple", fila("pedro_tricolor") && todos(fila("pedro_tricolor")!).some(m => m.keyword_jd === "herramientas de office")],
    ["cencomalls y xepelin bajo 0.35 (v1 y v2)", ["pedro_cencomalls", "pedro_xepelin"].every(c => { const f = fila(c); return f && f.v1 < 0.35 && f.v2.score < 0.35; })],
  ];
  console.log("\nCriterio de éxito de PED-30:");
  console.log(`  relacionados falsos: ${falsos.length} ${falsos.length === 0 ? "✅" : "❌ " + falsos.join("; ")}`);
  for (const [n, ok] of controles) console.log(`  ${n}: ${ok ? "✅" : "❌"}`);
  console.log(`  citas inexistentes aceptadas: ${citasMalas.length} ${citasMalas.length === 0 ? "✅" : "❌ " + citasMalas.join("; ")}`);

  // Experimental (PED-33): clase por umbrales fijos y orden por fit. No es criterio de éxito de PED-30.
  const criterio = (score: (f: Fila) => number, nombre: string) => {
    const g = (fit: string) => filas.filter(f => f.fit === fit).map(score);
    const [alto, medio, bajo] = ["alto", "medio", "bajo"].map(g);
    const ok1 = Math.min(...alto) > Math.max(...medio), ok2 = Math.min(...medio) > Math.max(...bajo);
    const enClase = filas.filter(f => claseFit(score(f)) === f.fit).length;
    console.log(`  ${nombre}: orden alto>medio ${ok1 ? "sí" : "no"} (${Math.min(...alto)} vs ${Math.max(...medio)}) · medio>bajo ${ok2 ? "sí" : "no"} (${Math.min(...medio)} vs ${Math.max(...bajo)}) · en su clase: ${enClase}/${filas.length}`);
  };
  console.log(`\nExperimental, calibración para PED-33 (clase: alto ≥ ${UMBRAL_CLASE.alto}, medio ${UMBRAL_CLASE.medio}–${UMBRAL_CLASE.alto}, bajo < ${UMBRAL_CLASE.medio}):`);
  criterio(f => f.v1, "v1");
  criterio(f => f.v2.score, "v2");

  if (ejecutar) console.log(`\nCosto real: $${filas.reduce((s, f) => s + f.costo, 0).toFixed(4)}`);
  const dir = path.join(process.cwd(), "evals/resultados");
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `mapear-set-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
  fs.writeFileSync(archivo, JSON.stringify(filas, null, 2));
  console.log(`\nGuardado en ${path.relative(process.cwd(), archivo)}\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

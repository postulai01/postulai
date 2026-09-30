/**
 * Eval del priorizador (app/lib/priorizador.ts). Sin API por defecto: usa las ofertas fijadas, las propuestas
 * semánticas guardadas (evals/semantico/) y las etiquetas guardadas (evals/priorizar/).
 *
 * Uso:
 *   npx tsx evals/priorizar.ts [caso ...]              # sin API
 *   npx tsx evals/priorizar.ts [caso ...] --estimar    # costo estimado del etiquetado
 *   npx tsx evals/priorizar.ts [caso ...] --etiquetar  # UNA llamada a Haiku por caso; guarda en evals/priorizar/
 *
 * Variantes: "anterior" (suma simple, sin raíces), "reglas" (tema central + raíces no genéricas) y
 * "reglas + etiquetas" (si hay etiquetas guardadas). andres_senior se compara con la referencia de PED-28.
 * El invariante se verifica dentro de priorizarCV (lanza error si falla).
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import {
  etiquetarVinetas, filtrarEtiquetas, priorizarCV, promptEtiquetas, SYSTEM_ETIQUETAS, vinetasParaEtiquetar,
  type InputPriorizacion, type ResultadoPriorizacion,
} from "../app/lib/priorizador";
import type { KeywordsJD } from "../app/lib/mapeo-semantico";
import { casosConOferta, loadEnv, mapeoDelCaso } from "./lib-casos";

// Haiku 4.5: $1 / $5 por MTok
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const TOKENS_OUT = 600;
const DIR_ETIQUETAS = path.join(process.cwd(), "evals/priorizar");

// Referencia de PED-28: fragmento de la viñeta que debería quedar primera en cada puesto de andres_senior.
const REFERENCIA_ANDRES: [string, string][] = [
  ["Servicios de Consultoría", "negociaciones colectivas y relaciones laborales"],
  ["SERVIMAULE", "las relaciones sindicales y los comités de gestión de crisis"],
  ["CLINICA SANTA MARIA", "Encabecé los procesos de negociación colectiva"],
  ["BUILDTEK", "relaciones laborales a nivel nacional"],
  ["GRUPO COPESA", "Conduje con éxito múltiples procesos de negociación colectiva"],
  ["COEXPAN", "negociación colectiva con el sindicato de la compañía"],
  ["CIA MINERA MANTOS DE LA LUNA", "Monitoreé el control presupuestario y financiero de la gerencia"],
];

const RELEVANCIA_CENTRAL = 9;

// Criterio de éxito: en cada puesto donde alguna viñeta evidencia una keyword requerida de relevancia ≥ 9,
// la primera viñeta evidencia al menos una de ese nivel.
function aceptables(r: ResultadoPriorizacion, jd: KeywordsJD): { ok: number; total: number; fallos: string[] } {
  const centrales = new Set(jd.requeridas.filter(k => k.relevancia >= RELEVANCIA_CENTRAL).map(k => k.keyword));
  const evidencia = (v: { keywords: { keyword: string }[] }) => v.keywords.some(k => centrales.has(k.keyword));
  let ok = 0, total = 0;
  const fallos: string[] = [];
  for (const p of r.puestos) {
    if (!p.vinetas.some(evidencia)) continue;
    total++;
    if (evidencia(p.vinetas[0])) ok++;
    else fallos.push(p.puesto);
  }
  return { ok, total, fallos };
}

const corta = (s: string, n = 95) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function aciertosAndres(r: ResultadoPriorizacion): { n: number; detalle: string[] } {
  const detalle: string[] = [];
  let n = 0;
  for (const [puesto, ref] of REFERENCIA_ANDRES) {
    const p = r.primeras.find(x => x.puesto.includes(puesto));
    const ok = !!p && p.despues.includes(ref);
    if (ok) n++;
    detalle.push(`${ok ? "✅" : "❌"} ${puesto.padEnd(30)} (${p?.puntaje ?? "—"}) ${corta(p?.despues.replace(/^- /, "") ?? "—", 80)}`);
  }
  return { n, detalle };
}

async function main() {
  const args = process.argv.slice(2);
  const etiquetar = args.includes("--etiquetar"), estimar = args.includes("--estimar");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : casosConOferta();
  if (etiquetar) loadEnv();
  const client = etiquetar ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  let estimado = 0, costo = 0;
  const invariantes: string[] = [];
  const informes: { caso: string; jd: KeywordsJD; reglas: ResultadoPriorizacion; etiq?: ResultadoPriorizacion; etiquetas?: Record<number, string[]> }[] = [];

  for (const caso of casos) {
    const { ctx, resultado } = await mapeoDelCaso(caso);
    const cv: string = ctx.casoJson.cv_texto;
    const vinetas = vinetasParaEtiquetar(cv);
    estimado += ((SYSTEM_ETIQUETAS.length + promptEtiquetas(vinetas, ctx.keywordsJD).length) / CHARS_POR_TOKEN * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6;
    if (estimar) continue;

    const cache = path.join(DIR_ETIQUETAS, `${caso}.json`);
    let etiquetas: Record<number, string[]> | undefined;
    if (client) {
      const r = await etiquetarVinetas(cv, ctx.keywordsJD, client);
      etiquetas = r.etiquetas;
      const c = r.usage ? (r.usage.input_tokens * PRECIO_IN + r.usage.output_tokens * PRECIO_OUT) / 1e6 : 0;
      costo += c;
      fs.mkdirSync(DIR_ETIQUETAS, { recursive: true });
      fs.writeFileSync(cache, JSON.stringify({ caso, oferta: path.basename(ctx.archivoOferta), costo: c, respuesta: r.respuesta }, null, 2) + "\n");
    } else if (fs.existsSync(cache)) {
      // Se guarda la respuesta cruda del modelo; los filtros se re-aplican con el código actual.
      etiquetas = filtrarEtiquetas(JSON.parse(fs.readFileSync(cache, "utf-8")).respuesta, vinetas, ctx.keywordsJD);
    }

    const base: InputPriorizacion = {
      cv, mapeo: resultado, keywordsJD: ctx.keywordsJD,
      frasesConocidas: ctx.competencias.flatMap(c => [c.nombre, ...(c.variantes ?? [])]),
    };
    try {
      const anterior = priorizarCV({ ...base, puntaje: "suma", raices: false });
      const reglas = priorizarCV(base);
      const etiq = etiquetas ? priorizarCV({ ...base, etiquetas }) : undefined;
      invariantes.push(`${caso}: ✅`);
      informes.push({ caso, jd: ctx.keywordsJD, reglas, etiq, etiquetas });

      if (caso === "andres_senior") {
        console.log(`\n═══ andres_senior vs referencia de PED-28 (informativo)`);
        for (const [nombre, r] of [["anterior (suma, sin raíces)", anterior], ["reglas (tema + raíces)", reglas], ["reglas + etiquetas", etiq]] as const) {
          if (!r) { console.log(`\n  ${nombre}: sin etiquetas guardadas`); continue; }
          const a = aciertosAndres(r);
          console.log(`\n  ${nombre}: ${a.n}/${REFERENCIA_ANDRES.length}`);
          for (const d of a.detalle) console.log(`    ${d}`);
        }
      }
    } catch (err) {
      invariantes.push(`${caso}: ❌ ${(err as Error).message}`);
    }
  }

  if (estimar) { console.log(`\nCosto estimado de --etiquetar: ~$${estimado.toFixed(4)} (${casos.length} llamadas)\n`); return; }

  console.log("\n═══ Primera viñeta por puesto (otros casos): reglas | reglas + etiquetas");
  for (const { caso, reglas, etiq } of informes.filter(x => x.caso !== "andres_senior")) {
    console.log(`\n  ${caso}`);
    reglas.primeras.forEach((p, k) => {
      const e = etiq?.primeras[k];
      console.log(`    ${corta(p.puesto, 55)}`);
      console.log(`      original:  ${corta(p.antes.replace(/^- /, ""), 85)}`);
      console.log(`      reglas:    ${p.despues === p.antes ? "=" : corta(p.despues.replace(/^- /, ""), 85)} (${p.puntaje})`);
      if (e) console.log(`      etiquetas: ${e.despues === p.despues ? "= reglas" : corta(e.despues.replace(/^- /, ""), 85)} (${e.puntaje})`);
    });
  }

  console.log("\n═══ Etiquetas de Haiku por caso (revisión manual)");
  for (const { caso, etiquetas } of informes) {
    if (!etiquetas) { console.log(`\n  ${caso}: sin etiquetas`); continue; }
    const lineas = fs.readFileSync(path.join(process.cwd(), "evals/casos", `${caso}.json`), "utf-8");
    const cv: string = JSON.parse(lineas).cv_texto;
    const ls = cv.split("\n");
    console.log(`\n  ${caso}: ${Object.keys(etiquetas).length} viñetas etiquetadas`);
    for (const [i, kws] of Object.entries(etiquetas)) console.log(`    ${corta(ls[Number(i)].replace(/^\s*- /, ""), 70)} → ${kws.join(", ")}`);
  }

  // Modo por defecto: reglas + etiquetas (si hay etiquetas guardadas); si no, solo reglas.
  console.log(`\n═══ Criterio de éxito: primera viñeta con keyword requerida de relevancia ≥ ${RELEVANCIA_CENTRAL} (cuando el puesto tiene una)`);
  console.log(`  ${"caso".padEnd(26)} reglas   reglas+etiquetas  fallos (modo por defecto)`);
  let okR = 0, okE = 0, totR = 0, totE = 0;
  for (const x of informes) {
    const a = aceptables(x.reglas, x.jd), e = aceptables(x.etiq ?? x.reglas, x.jd);
    okR += a.ok; totR += a.total; okE += e.ok; totE += e.total;
    console.log(`  ${x.caso.padEnd(26)} ${`${a.ok}/${a.total}`.padEnd(8)} ${`${e.ok}/${e.total}`.padEnd(17)} ${e.fallos.map(f => corta(f, 30)).join(" · ") || "—"}`);
  }
  console.log(`  ${"total".padEnd(26)} ${`${okR}/${totR}`.padEnd(8)} ${okE}/${totE}`);

  console.log("\n═══ Candidatas a acortar (casi duplicadas entre puestos)");
  for (const { caso, reglas, etiq } of informes) for (const c of (etiq ?? reglas).candidatas) console.log(`  ${caso.padEnd(24)} ${corta(c.texto, 70)} · ${c.motivo}`);
  console.log("\n  Informativo, viñetas sin puntaje (reglas): " + informes.map(x => `${x.caso} ${x.reglas.sinPuntaje.length}`).join(" · "));

  console.log("\n═══ Invariante");
  for (const i of invariantes) console.log(`  ${i}`);
  if (etiquetar) console.log(`\nCosto real del etiquetado: $${costo.toFixed(4)}`);
  console.log("");
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

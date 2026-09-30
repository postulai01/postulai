/**
 * Eval del perfil adaptado (app/lib/perfil-adaptado.ts). Sin API por defecto: re-verifica las respuestas guardadas
 * en evals/perfil/<caso>.json con el código actual.
 *
 * Uso:
 *   npx tsx evals/perfil-adaptado.ts [caso ...]              # sin API
 *   npx tsx evals/perfil-adaptado.ts [caso ...] --estimar    # costo estimado de --ejecutar
 *   npx tsx evals/perfil-adaptado.ts [caso ...] --ejecutar   # UNA llamada a Haiku por caso (+1 reintento si falla)
 *     --presupuesto=0.10: antes de cada caso, sin reintento si lo que queda no alcanza para dos intentos
 *     estimados; se salta el caso si no alcanza para uno.
 *
 * Métricas: adaptados / rechazados / sin_perfil, afirmaciones sin cita válida (debe ser 0) y cobertura de keywords
 * requeridas en el perfil, antes → después. andres_senior se muestra junto a la referencia de PED-28 (comparación
 * manual, no criterio automático).
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import type { KeywordsJD } from "../app/lib/mapeo-semantico";
import {
  adaptarPerfil, detectarPerfil, evaluarRespuestas, promptPerfil, SYSTEM_PERFIL, type ResultadoPerfil,
} from "../app/lib/perfil-adaptado";
import { indice, palabrasContenido, presente } from "../app/lib/reescritor-contextual";
import { casosConOferta, loadEnv, mapeoDelCaso } from "./lib-casos";

// Haiku 4.5: $1 / $5 por MTok
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const TOKENS_OUT = 700;
const DIR = path.join(process.cwd(), "evals/perfil");

// Perfil ideal de Andrés × Cóndor (documento de referencia de PED-28, Palanca A; "Dominio de" corregido a "Experiencia en").
const REFERENCIA_ANDRES = "Ejecutivo Senior con 18 años de trayectoria liderando las áreas de Recursos Humanos y Relaciones Laborales en empresas de servicios industriales, minería y salud, con dotaciones de hasta 5.000 colaboradores. Especialista en el diseño e implementación de estrategias de capital humano alineadas a los objetivos del negocio y la rentabilidad, y en la conducción de negociaciones colectivas con múltiples sindicatos. Experiencia en relaciones laborales a nivel nacional, incluidas faenas de la zona norte, gestión de crisis, y transformación digital de procesos de personas mediante HR Analytics y automatización con Inteligencia Artificial. Experiencia en BUK, Talana y SAP.";

// Keywords requeridas cuyas palabras están todas en el texto.
function cubiertas(texto: string | null, jd: KeywordsJD): string[] {
  if (!texto) return [];
  const ix = indice(texto);
  return jd.requeridas.filter(k => {
    const p = palabrasContenido(k.keyword);
    return p.length > 0 && p.every(w => presente(w, ix.set, ix.raices));
  }).map(k => k.keyword);
}

const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar"), estimar = args.includes("--estimar");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : casosConOferta();
  if (ejecutar) loadEnv();
  const client = ejecutar ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
  const presupuesto = Number(args.find(a => a.startsWith("--presupuesto="))?.split("=")[1] ?? Infinity);

  let estimado = 0, costo = 0;
  const filas: { caso: string; fit: string; r: Omit<ResultadoPerfil, "usage"> & { noConvertibles?: number }; antes: string[]; despues: string[]; total: number; citasInvalidas: number }[] = [];

  for (const caso of casos) {
    const { ctx, resultado } = await mapeoDelCaso(caso);
    const input = { cv: ctx.casoJson.cv_texto as string, mapeo: resultado, keywordsJD: ctx.keywordsJD };
    const det = detectarPerfil(input.cv);
    const estCaso = det ? ((SYSTEM_PERFIL.length + promptPerfil(det.texto, input).length) / CHARS_POR_TOKEN * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6 : 0;
    estimado += estCaso;
    if (estimar) continue;

    const cache = path.join(DIR, `${caso}.json`);
    let r: Omit<ResultadoPerfil, "usage"> & { noConvertibles?: number };
    const queda = presupuesto - costo;
    if (client && queda < estCaso) { console.log(`⏸  ${caso}: se salta, quedan $${queda.toFixed(4)} del presupuesto`); continue; }
    if (client) {
      const maxIntentos = queda < 2 * estCaso ? 1 : 2;
      if (maxIntentos === 1) console.log(`⏸  ${caso}: sin reintento, quedan $${queda.toFixed(4)} del presupuesto`);
      const res = await adaptarPerfil(input, { client, maxIntentos });
      const c = (res.usage.input_tokens * PRECIO_IN + res.usage.output_tokens * PRECIO_OUT) / 1e6;
      costo += c;
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(cache, JSON.stringify({ caso, oferta: path.basename(ctx.archivoOferta), costo: c, respuestas: res.respuestas }, null, 2) + "\n");
      r = res;
    } else if (fs.existsSync(cache)) {
      r = evaluarRespuestas(input, JSON.parse(fs.readFileSync(cache, "utf-8")).respuestas);
    } else {
      console.log(`⚠️  ${caso}: sin respuestas guardadas (corre con --ejecutar)`);
      continue;
    }
    // Métrica independiente: oraciones del perfil final con alguna cita que no existe literal en el CV.
    const cvCol = colapsar(input.cv);
    const citasInvalidas = r.estado === "adaptado"
      ? r.oraciones.filter(o => o.citas.length === 0 || o.citas.some(c => !c || !cvCol.includes(colapsar(c)))).length : 0;
    filas.push({
      caso, fit: ctx.casoJson.fit_esperado ?? "?", r, citasInvalidas, total: ctx.keywordsJD.requeridas.length,
      antes: cubiertas(r.original, ctx.keywordsJD), despues: cubiertas(r.perfil, ctx.keywordsJD),
    });
  }

  if (estimar) { console.log(`\nCosto estimado de --ejecutar: ~$${estimado.toFixed(4)} sin reintentos, ~$${(estimado * 2).toFixed(4)} con todos\n`); return; }

  console.log(`\n${"caso".padEnd(26)} fit    estado      reint  acept/desc  citas mal  kw fuera  cobertura req. antes → después`);
  for (const f of filas) {
    console.log(`${f.caso.padEnd(26)} ${f.fit.padEnd(6)} ${f.r.estado.padEnd(11)} ${String(f.r.reintentos).padStart(5)}  ${`${f.r.oraciones.length}/${f.r.descartadas.length}`.padStart(10)}  ${String(f.citasInvalidas).padStart(9)}  ${String(f.r.keywordsEliminadas ?? 0).padStart(8)}  ${f.antes.length}/${f.total} → ${f.despues.length}/${f.total}`);
  }

  for (const f of filas) {
    console.log(`\n═══ ${f.caso} (${f.fit}) · ${f.r.estado}${f.r.reintentos ? " tras 1 reintento" : ""}`);
    if (f.r.estado === "sin_perfil") continue;
    console.log(`  ORIGINAL: ${f.r.original}`);
    if (f.r.estado === "adaptado") console.log(`  NUEVO:    ${f.r.perfil}`);
    if (f.caso === "andres_senior") console.log(`  REFERENCIA PED-28: ${REFERENCIA_ANDRES}`);
    if (f.r.noConvertibles) console.log(`  respuestas guardadas no convertibles a oraciones: ${f.r.noConvertibles}`);
    if (f.r.problemas.length) console.log(`  armado rechazado: ${f.r.problemas.join(" | ")}`);
    for (const o of f.r.oraciones) {
      console.log(`  ✓ ${o.texto}`);
      o.citas.forEach((c, k) => console.log(`      cita${o.lineas ? ` (línea ${o.lineas[k]})` : ""}: "${c}"`));
      if (o.keywords.length) console.log(`      keywords: ${o.keywords.join(", ")}`);
      if (o.keywordsEliminadas?.length) console.log(`      eliminadas de la traza: ${o.keywordsEliminadas.join(", ")}`);
    }
    for (const d of f.r.descartadas) console.log(`  ✗ ${d.texto}\n      ${d.problemas.join(" | ")}`);
    const ganadas = f.despues.filter(k => !f.antes.includes(k)), perdidas = f.antes.filter(k => !f.despues.includes(k));
    console.log(`  keywords requeridas: +${ganadas.join(", ") || "—"} · −${perdidas.join(", ") || "—"}`);
  }

  const cuenta = (e: string) => filas.filter(f => f.r.estado === e).length;
  const invalidas = filas.reduce((s, f) => s + f.citasInvalidas, 0);
  console.log(`\nResumen: adaptados ${cuenta("adaptado")} · rechazados ${cuenta("rechazado")} · sin_perfil ${cuenta("sin_perfil")} · oraciones aceptadas sin cita válida ${invalidas} ${invalidas === 0 ? "✅" : "❌"}`);
  if (ejecutar) console.log(`Costo real: $${costo.toFixed(4)}`);
  console.log("");
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

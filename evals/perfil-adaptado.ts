/**
 * Eval del perfil adaptado (app/lib/perfil-adaptado.ts). Sin API por defecto: re-verifica las respuestas guardadas
 * en evals/perfil/<caso>.json con el código actual.
 *
 * Uso:
 *   npx tsx evals/perfil-adaptado.ts [caso ...]              # sin API
 *   npx tsx evals/perfil-adaptado.ts [caso ...] --estimar    # costo estimado de --ejecutar
 *   npx tsx evals/perfil-adaptado.ts [caso ...] --ejecutar   # UNA llamada a Haiku por caso (+1 reintento si falla)
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

// Perfil ideal de Andrés × Cóndor (documento de referencia de PED-28, Palanca A).
const REFERENCIA_ANDRES = "Ejecutivo Senior con 18 años de trayectoria liderando las áreas de Recursos Humanos y Relaciones Laborales en empresas de servicios industriales, minería y salud, con dotaciones de hasta 5.000 colaboradores. Especialista en el diseño e implementación de estrategias de capital humano alineadas a los objetivos del negocio y la rentabilidad, y en la conducción de negociaciones colectivas con múltiples sindicatos. Experiencia en relaciones laborales a nivel nacional, incluidas faenas de la zona norte, gestión de crisis, y transformación digital de procesos de personas mediante HR Analytics y automatización con Inteligencia Artificial. Dominio de BUK, Talana y SAP.";

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

  let estimado = 0, costo = 0;
  const filas: { caso: string; fit: string; r: Omit<ResultadoPerfil, "usage">; antes: string[]; despues: string[]; total: number; citasInvalidas: number }[] = [];

  for (const caso of casos) {
    const { ctx, resultado } = await mapeoDelCaso(caso);
    const input = { cv: ctx.casoJson.cv_texto as string, mapeo: resultado, keywordsJD: ctx.keywordsJD };
    const det = detectarPerfil(input.cv);
    if (det) estimado += ((SYSTEM_PERFIL.length + promptPerfil(det.texto, input).length) / CHARS_POR_TOKEN * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6;
    if (estimar) continue;

    const cache = path.join(DIR, `${caso}.json`);
    let r: Omit<ResultadoPerfil, "usage">;
    if (client) {
      const res = await adaptarPerfil(input, { client });
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
    // Métrica independiente: citas de las afirmaciones del perfil final que no existen literal en el CV.
    const cvCol = colapsar(input.cv);
    const citasInvalidas = r.estado === "adaptado"
      ? r.afirmaciones.filter(a => a.citas.length === 0 || a.citas.some(c => !cvCol.includes(colapsar(c)))).length : 0;
    filas.push({
      caso, fit: ctx.casoJson.fit_esperado ?? "?", r, citasInvalidas, total: ctx.keywordsJD.requeridas.length,
      antes: cubiertas(r.original, ctx.keywordsJD), despues: cubiertas(r.perfil, ctx.keywordsJD),
    });
  }

  if (estimar) { console.log(`\nCosto estimado de --ejecutar: ~$${estimado.toFixed(4)} sin reintentos, ~$${(estimado * 2).toFixed(4)} con todos\n`); return; }

  console.log(`\n${"caso".padEnd(26)} fit    estado      reint  afirm  citas mal  cobertura req. antes → después`);
  for (const f of filas) {
    console.log(`${f.caso.padEnd(26)} ${f.fit.padEnd(6)} ${f.r.estado.padEnd(11)} ${String(f.r.reintentos).padStart(5)}  ${String(f.r.afirmaciones.length).padStart(5)}  ${String(f.citasInvalidas).padStart(9)}  ${f.antes.length}/${f.total} → ${f.despues.length}/${f.total}`);
  }

  for (const f of filas) {
    console.log(`\n═══ ${f.caso} (${f.fit}) · ${f.r.estado}${f.r.reintentos ? " tras 1 reintento" : ""}`);
    if (f.r.estado === "sin_perfil") continue;
    console.log(`  ORIGINAL: ${f.r.original}`);
    if (f.r.estado === "adaptado") console.log(`  NUEVO:    ${f.r.perfil}`);
    if (f.caso === "andres_senior") console.log(`  REFERENCIA PED-28: ${REFERENCIA_ANDRES}`);
    if (f.r.problemas.length) console.log(`  problemas del último intento: ${f.r.problemas.join(" | ")}`);
    for (const a of f.r.afirmaciones) {
      console.log(`  · ${a.frase}`);
      for (const c of a.citas) console.log(`      cita: "${c}"`);
      if (a.keywords.length) console.log(`      keywords: ${a.keywords.join(", ")}`);
    }
    const ganadas = f.despues.filter(k => !f.antes.includes(k)), perdidas = f.antes.filter(k => !f.despues.includes(k));
    console.log(`  keywords requeridas: +${ganadas.join(", ") || "—"} · −${perdidas.join(", ") || "—"}`);
  }

  const cuenta = (e: string) => filas.filter(f => f.r.estado === e).length;
  const invalidas = filas.reduce((s, f) => s + f.citasInvalidas, 0);
  console.log(`\nResumen: adaptados ${cuenta("adaptado")} · rechazados ${cuenta("rechazado")} · sin_perfil ${cuenta("sin_perfil")} · afirmaciones sin cita válida ${invalidas} ${invalidas === 0 ? "✅" : "❌"}`);
  if (ejecutar) console.log(`Costo real: $${costo.toFixed(4)}`);
  console.log("");
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

/**
 * Eval de reescribirLinea (app/lib/reescritor-contextual.ts): 10 líneas del CV de cada caso × su oferta guardada.
 * Usa las salidas guardadas del extractor (evals/competencias/) y del parser (evals/ofertas/), como mapear-jd.ts.
 *
 * Uso:
 *   npx tsx evals/reescribir-lineas.ts [caso ...]             # --dry-run (por defecto): qué líneas llamarían a la API, sin gastar
 *   npx tsx evals/reescribir-lineas.ts [caso ...] --ejecutar  # llama a Haiku, una vez por línea con keywords (más reintentos)
 *   Sin casos: todos los de evals/casos/. Las líneas salen del CV de cada caso (lineasDelCaso).
 */

import { competenciasDelCaso, ofertaDelCaso } from "./lib-casos";
import * as fs from "fs";
import * as path from "path";
import { fusionarCompetencias } from "../app/lib/competencia-extractor";
import { consolidarJD } from "../app/lib/jd-parser";
import { mapearCompetencias, type KeywordsJD, type ResultadoMapeo } from "../app/lib/mapeo-semantico";
import {
  MAX_PALABRAS_NUEVAS, MAX_USOS_KEYWORD, planificarLineaDetalle, verificarFidelidad, reescribirCV, SYSTEM_REESCRITOR, verificarAdaptacion, type ResultadoLinea,
} from "../app/lib/reescritor-contextual";

// Haiku 4.5: $1 / $5 por MTok
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const TOKENS_OUT = 120;

// Las 10 primeras líneas de contenido del CV del caso: párrafo de perfil y viñetas, con al menos 6 palabras.
const N_LINEAS = 10;
function lineasDelCaso(cv: string): string[] {
  return cv.split("\n").map(l => l.trimEnd()).filter(l => {
    const t = l.trim();
    if (/^[-•]\s+/.test(t)) return t.split(/\s+/).length >= 6;
    return t.length > 120; // párrafo de perfil
  }).slice(0, N_LINEAS).map(l => l.trim());
}

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

const masReciente = (dir: string, caso: string) => {
  const archivos = fs.readdirSync(dir).filter(f => f.startsWith(`${caso}-`)).sort();
  return archivos.length === 0 ? null : path.join(dir, archivos[archivos.length - 1]);
};

async function contexto(caso: string): Promise<{ cv: string; mapeo: ResultadoMapeo; keywordsJD: KeywordsJD } | string> {
  const raiz = process.cwd();
  const casoJson = JSON.parse(fs.readFileSync(path.join(raiz, "evals/casos", `${caso}.json`), "utf-8"));
  // Competencias del mismo CV y oferta fijada, como el resto de los evals (lib-casos.ts).
  let archComp: string | null = null, archOferta: string | null = null;
  try { archComp = competenciasDelCaso(raiz, caso, casoJson.cv_texto); } catch { /* sin competencias */ }
  try { archOferta = ofertaDelCaso(raiz, caso); } catch { /* sin oferta */ }
  if (!archComp) return `no hay competencias guardadas (npx tsx evals/extraer-competencias.ts ${caso} --ejecutar)`;
  if (!archOferta) return `no hay oferta parseada (npx tsx evals/parsear-jd.ts ${caso} --ejecutar, ~$0.003)`;
  const comp = JSON.parse(fs.readFileSync(archComp, "utf-8"));
  const oferta = JSON.parse(fs.readFileSync(archOferta, "utf-8"));
  const { competencias } = fusionarCompetencias(comp.competencias);
  const jd = consolidarJD(casoJson.oferta_texto, { requeridas: oferta.keywords_requeridas, deseables: oferta.keywords_deseables });
  const keywordsJD = { requeridas: jd.keywords_requeridas, deseables: jd.keywords_deseables };
  const mapeo = await mapearCompetencias(competencias, keywordsJD, {
    herramientas: comp.herramientas, certificaciones: comp.certificaciones, idiomas: comp.idiomas, cvTexto: casoJson.cv_texto,
  });
  return { cv: casoJson.cv_texto, mapeo, keywordsJD };
}

const corta = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : fs.readdirSync(path.join(process.cwd(), "evals/casos")).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort();
  if (ejecutar) loadEnv();

  const resultados: { caso: string; r: ResultadoLinea; mentira: string[] }[] = [];
  let llamadas = 0, costo = 0;
  const porCaso: { caso: string; llamadas: number; costo: number }[] = [];

  for (const caso of casos) {
    const ctx = await contexto(caso);
    if (typeof ctx === "string") { console.log(`\n⚠️  ${caso}: ${ctx} — se omite\n`); continue; }
    const llamadasAntes = llamadas, costoAntes = costo;
    console.log(`\n═══ ${caso} · ${ctx.mapeo.matches_directos.length} directos, ${ctx.mapeo.matches_relacionados.length} relacionados, ${ctx.mapeo.gap_keywords.length} brechas ═══`);

    const lineas = lineasDelCaso(ctx.cv);
    // Con --ejecutar se usa reescribirCV, que aplica el límite de MAX_USOS_KEYWORD por keyword.
    const reescritas = ejecutar ? await reescribirCV(lineas, { cvCompleto: ctx.cv, mapeo: ctx.mapeo, keywordsJD: ctx.keywordsJD }) : [];
    for (const [i, linea] of lineas.entries()) {
      const input = { lineaOriginal: linea, cvCompleto: ctx.cv, mapeo: ctx.mapeo, keywordsJD: ctx.keywordsJD };
      const { permitidas, descartadas } = planificarLineaDetalle(input);
      console.log(`\n[${i + 1}] ${corta(linea)}`);
      if (!ejecutar) for (const d of descartadas) console.log(`      ✗ "${d.keyword}": ${d.motivo}`);

      if (!ejecutar) {
        if (permitidas.length === 0) { console.log("    → sin_cambios (no llama a la API)"); continue; }
        llamadas++;
        const tokIn = (SYSTEM_REESCRITOR.length + linea.length + permitidas.reduce((s, p) => s + p.keyword.length + p.fuente.length + 40, 0)) / CHARS_POR_TOKEN;
        costo += (tokIn * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6;
        console.log("    → llamaría a la API con:");
        for (const p of permitidas) {
          const pal = p.tipo_match === "relacionado" ? ` [solo: ${p.palabras.join(", ")}]` : "";
          console.log(`      · "${p.keyword}" (${p.tipo_match} ← ${p.competencia_cv})${pal} · fuente: "${corta(p.fuente, 80)}"`);
        }
        continue;
      }

      const r = reescritas[i];
      // Conteo de mentiras independiente del estado: re-verifica la salida final sin el límite de fuerzo.
      const palabras = permitidas.filter(p => r.keywords_agregadas.includes(p.keyword)).flatMap(p => p.palabras);
      const v = verificarAdaptacion(r.original, r.adaptada, palabras, ctx.cv, ctx.mapeo, Infinity);
      // Más la capa de código del validador (PED-35), con las fuentes de las keywords que la línea dice agregar.
      const kws = permitidas.filter(p => r.keywords_agregadas.includes(p.keyword));
      const sinVineta = (t: string) => t.replace(/^\s*[-•]\s+/, "");
      const fidelidad = r.estado === "adaptada" ? verificarFidelidad(sinVineta(r.original), sinVineta(r.adaptada), kws) : [];
      v.problemas.push(...fidelidad);
      resultados.push({ caso, r, mentira: v.problemas });
      if (r.usage) { llamadas++; costo += (r.usage.input_tokens * PRECIO_IN + r.usage.output_tokens * PRECIO_OUT) / 1e6; }
      if (r.estado === "adaptada" || r.estado === "rechazada_forzada") console.log(`    original: ${linea}`);
      console.log(`    estado: ${r.estado}${r.reintentos ? " (1 reintento)" : ""}${r.motivo ? ` · ${r.motivo}` : ""}`);
      if (r.estado === "adaptada") {
        console.log(`    adaptada: ${r.adaptada}`);
        r.keywords_agregadas.forEach((k, j) => console.log(`      + "${k}" · fuente: "${corta(r.fuente_en_cv[j], 80)}"`));
        console.log(`    palabras nuevas: ${r.palabras_nuevas}`);
      }
      if (v.problemas.length > 0) console.log(`    ❌ MENTIRA: ${v.problemas.join("; ")}`);
    }
    porCaso.push({ caso, llamadas: llamadas - llamadasAntes, costo: costo - costoAntes });
  }

  console.log(`\n${ejecutar ? "Costo real" : "Costo estimado (sin reintentos)"} por CV:`);
  for (const c of porCaso) console.log(`  ${c.caso.padEnd(26)} ${String(c.llamadas).padStart(2)} líneas a la API · $${c.costo.toFixed(4)}`);

  if (!ejecutar) {
    console.log(`\nDry-run: ${llamadas} líneas llamarían a la API (+ reintentos si superan ${MAX_PALABRAS_NUEVAS} palabras nuevas).`);
    console.log(`Costo estimado: ~$${costo.toFixed(4)} sin reintentos, ~$${(costo * 2).toFixed(4)} en el peor caso. Corre con --ejecutar.\n`);
    return;
  }

  const cuenta = (e: string) => resultados.filter(x => x.r.estado === e).length;
  const mentiras = resultados.filter(x => x.mentira.length > 0).length;
  console.log(`\nResumen (${resultados.length} iteraciones): adaptadas ${cuenta("adaptada")} · sin_cambios ${cuenta("sin_cambios")} · rechazadas ${cuenta("rechazada_forzada")} · reintentos ${resultados.filter(x => x.r.reintentos).length}`);
  console.log(`Líneas enviadas a la API: ${llamadas} · costo real: $${costo.toFixed(4)}`);
  const usos = new Map<string, number>();
  for (const x of resultados) for (const k of x.r.keywords_agregadas) usos.set(`${x.caso}: ${k}`, (usos.get(`${x.caso}: ${k}`) ?? 0) + 1);
  const excedidas = [...usos].filter(([, n]) => n > MAX_USOS_KEYWORD);
  console.log(`Usos por keyword: ${[...usos].map(([k, n]) => `${k} ×${n}`).join(" · ") || "—"}${excedidas.length ? ` ❌ exceden ${MAX_USOS_KEYWORD}` : ""}`);
  console.log(`Mentiras: ${mentiras} ${mentiras === 0 ? "✅" : "❌"}\n`);

  const dir = path.join(process.cwd(), "evals/resultados");
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `reescribir-lineas-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
  fs.writeFileSync(archivo, JSON.stringify(resultados, null, 2));
  console.log(`Guardado en ${path.relative(process.cwd(), archivo)}\n`);
  if (mentiras > 0) process.exit(1);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

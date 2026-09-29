/**
 * Eval de reescribirLinea (app/lib/reescritor-contextual.ts): 10 líneas del CV de Pedro × las ofertas guardadas.
 * Usa las salidas guardadas del extractor (evals/competencias/) y del parser (evals/ofertas/), como mapear-jd.ts.
 *
 * Uso:
 *   npx tsx evals/reescribir-lineas.ts [caso ...]             # --dry-run (por defecto): qué líneas llamarían a la API, sin gastar
 *   npx tsx evals/reescribir-lineas.ts [caso ...] --ejecutar  # llama a Haiku, una vez por línea con keywords (más reintentos)
 *   Sin casos: pedro_cencomalls y pedro_xepelin (mismo CV, dos ofertas).
 */

import * as fs from "fs";
import * as path from "path";
import { fusionarCompetencias } from "../app/lib/competencia-extractor";
import { consolidarJD } from "../app/lib/jd-parser";
import { mapearCompetencias, type KeywordsJD, type ResultadoMapeo } from "../app/lib/mapeo-semantico";
import {
  MAX_PALABRAS_NUEVAS, planificarLinea, reescribirLinea, SYSTEM_REESCRITOR, verificarAdaptacion, type ResultadoLinea,
} from "../app/lib/reescritor-contextual";

// Haiku 4.5: $1 / $5 por MTok
const PRECIO_IN = 1, PRECIO_OUT = 5;
const CHARS_POR_TOKEN = 2.1;
const TOKENS_OUT = 120;

// 10 líneas reales del CV (perfil, bullets de experiencia y competencias).
const LINEAS = [
  "Estudiante de cuarto año de Ingeniería Comercial con mención en Finanzas Cuantitativas en la Universidad Adolfo Ibáñez. Con experiencia en ventas directas, promoción de productos y emprendimiento. Orientado a resultados, con habilidades de comunicación, trabajo en equipo y manejo de herramientas digitales. Inglés avanzado.",
  "- Ejecución de activaciones de marca en puntos de venta para Hellmann's.",
  "- Demostración de producto e impulso de ventas mediante atención directa al cliente.",
  "- Participación en 3 campañas promocionales con distintos equipos de trabajo.",
  "- Co fundé y operé un emprendimiento de snacks y alimentos para perros como proyecto académico universitario.",
  "- Gestioné actividades de producción, ventas directas en plazas y espacios públicos, y creación de anuncios publicitarios.",
  "- Desarrollé habilidades de emprendimiento end-to-end: desde la producción hasta la comercialización del producto.",
  "- Microsoft Excel (nivel intermedio): análisis de datos, tablas, fórmulas.",
  "- Ventas directas y atención al cliente.",
  "- Pensamiento analítico y orientación a resultados.",
];

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
  const archComp = masReciente(path.join(raiz, "evals/competencias"), caso);
  const archOferta = masReciente(path.join(raiz, "evals/ofertas"), caso);
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
  const casos = pedidos.length > 0 ? pedidos : ["pedro_cencomalls", "pedro_xepelin"];
  if (ejecutar) loadEnv();

  const resultados: { caso: string; r: ResultadoLinea; mentira: string[] }[] = [];
  let llamadas = 0, costo = 0;

  for (const caso of casos) {
    const ctx = await contexto(caso);
    if (typeof ctx === "string") { console.log(`\n⚠️  ${caso}: ${ctx} — se omite\n`); continue; }
    console.log(`\n═══ ${caso} · ${ctx.mapeo.matches_directos.length} directos, ${ctx.mapeo.matches_relacionados.length} relacionados, ${ctx.mapeo.gap_keywords.length} brechas ═══`);

    for (const [i, linea] of LINEAS.entries()) {
      const input = { lineaOriginal: linea, cvCompleto: ctx.cv, mapeo: ctx.mapeo, keywordsJD: ctx.keywordsJD };
      const permitidas = planificarLinea(input);
      console.log(`\n[${i + 1}] ${corta(linea)}`);

      if (!ejecutar) {
        if (permitidas.length === 0) { console.log("    → sin_cambios (no llama a la API)"); continue; }
        llamadas++;
        const tokIn = (SYSTEM_REESCRITOR.length + linea.length + permitidas.reduce((s, p) => s + p.keyword.length + p.fuente.length + 40, 0)) / CHARS_POR_TOKEN;
        costo += (tokIn * PRECIO_IN + TOKENS_OUT * PRECIO_OUT) / 1e6;
        console.log("    → llamaría a la API con:");
        for (const p of permitidas) console.log(`      · "${p.keyword}" (← ${p.competencia_cv}) · fuente: "${corta(p.fuente, 80)}"`);
        continue;
      }

      const r = await reescribirLinea(input);
      // Conteo de mentiras independiente del estado: re-verifica la salida final sin el límite de fuerzo.
      const v = verificarAdaptacion(r.original, r.adaptada, r.keywords_agregadas, ctx.cv, ctx.mapeo, Infinity);
      resultados.push({ caso, r, mentira: v.problemas });
      if (r.usage) { llamadas++; costo += (r.usage.input_tokens * PRECIO_IN + r.usage.output_tokens * PRECIO_OUT) / 1e6; }
      console.log(`    estado: ${r.estado}${r.reintentos ? " (1 reintento)" : ""}${r.motivo ? ` · ${r.motivo}` : ""}`);
      if (r.estado === "adaptada") {
        console.log(`    adaptada: ${r.adaptada}`);
        r.keywords_agregadas.forEach((k, j) => console.log(`      + "${k}" · fuente: "${corta(r.fuente_en_cv[j], 80)}"`));
        console.log(`    palabras nuevas: ${r.palabras_nuevas}`);
      }
      if (v.problemas.length > 0) console.log(`    ❌ MENTIRA: ${v.problemas.join("; ")}`);
    }
  }

  if (!ejecutar) {
    console.log(`\nDry-run: ${llamadas} líneas llamarían a la API (+ reintentos si superan ${MAX_PALABRAS_NUEVAS} palabras nuevas).`);
    console.log(`Costo estimado: ~$${costo.toFixed(4)} sin reintentos, ~$${(costo * 2).toFixed(4)} en el peor caso. Corre con --ejecutar.\n`);
    return;
  }

  const cuenta = (e: string) => resultados.filter(x => x.r.estado === e).length;
  const mentiras = resultados.filter(x => x.mentira.length > 0).length;
  console.log(`\nResumen (${resultados.length} iteraciones): adaptadas ${cuenta("adaptada")} · sin_cambios ${cuenta("sin_cambios")} · rechazadas ${cuenta("rechazada_forzada")} · reintentos ${resultados.filter(x => x.r.reintentos).length}`);
  console.log(`Líneas enviadas a la API: ${llamadas} · costo real: $${costo.toFixed(4)}`);
  console.log(`Mentiras: ${mentiras} ${mentiras === 0 ? "✅" : "❌"}\n`);

  const dir = path.join(process.cwd(), "evals/resultados");
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `reescribir-lineas-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
  fs.writeFileSync(archivo, JSON.stringify(resultados, null, 2));
  console.log(`Guardado en ${path.relative(process.cwd(), archivo)}\n`);
  if (mentiras > 0) process.exit(1);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

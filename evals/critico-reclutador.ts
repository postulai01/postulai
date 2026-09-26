/**
 * Evalúa la calidad del CV adaptado por Postulai (crítico reclutador).
 *
 * Uso:
 *   npx tsx evals/critico-reclutador.ts --caso=andres_senior
 *   npx tsx evals/critico-reclutador.ts --caso=pedro_xepelin --repeticiones=3
 *   npx tsx evals/critico-reclutador.ts --caso=pedro_xepelin --con-pdf --template=moderno
 *   npx tsx evals/critico-reclutador.ts --caso=pedro_xepelin --forzar-regen
 *
 * Flags:
 *   --template=<moderno|tradicional|ejecutivo>  Solo con --con-pdf; default: los 3
 *   --modelo-completo                           Usa claude-sonnet-5 para el crítico (default: haiku)
 *   --forzar-regen                              Fuerza regenerar aunque SYSTEM_PROMPT no cambió
 *   --con-pdf                                   Genera PDF y evalúa criterios D1-D4 (default: texto solo)
 *   --repeticiones=N                            Corre el crítico N veces; reporta avg/min/max (default: 1)
 */

import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import * as fs from "fs";
import * as path from "path";
import {
  limpiarConocimientosEnDesarrollo,
  limpiarHabilidadesTecnicas,
  calcularMatch,
} from "../app/lib/cv-postprocess";

// ─── modelos y costos ─────────────────────────────────────────────────────────

const MODELO_ITERACION = "claude-haiku-4-5-20251001";
const MODELO_COMPLETO  = "claude-sonnet-5";

// [input $/MTok, output $/MTok]  — precios base
const PRECIOS: Record<string, [number, number]> = {
  [MODELO_ITERACION]: [0.8, 4],
  [MODELO_COMPLETO]:  [3, 15],
  "claude-sonnet-5-regen": [3, 15],
};
const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT  = 0.10;

interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

function calcularCostoReal(modelo: string, u: UsageInfo): number {
  const [inP, outP] = PRECIOS[modelo] ?? [3, 15];
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cacheRead  = u.cache_read_input_tokens ?? 0;
  const normalIn   = u.input_tokens ?? 0;
  return (
    normalIn  * inP +
    cacheWrite * inP * CACHE_WRITE_MULT +
    cacheRead  * inP * CACHE_READ_MULT +
    (u.output_tokens ?? 0) * outP
  ) / 1_000_000;
}

function estimarCostoTotal(args: Args): string {
  const modC = args.modeloCompleto ? MODELO_COMPLETO : MODELO_ITERACION;
  const [inC, outC] = PRECIOS[modC];
  const [inS, outS] = PRECIOS[MODELO_COMPLETO];

  // Adaptación (sonnet-5): ~7000 sys (cached) + ~1200 user + ~2500 output
  // Con cache: primera llamada paga write (~7000 × inS × 1.25), resto paga read (~7000 × inS × 0.10)
  const sysAdapt   = 7000;
  const varAdapt   = 1200;
  const outAdapt   = 2500;
  const costoAdaptPrimera = (sysAdapt * inS * CACHE_WRITE_MULT + varAdapt * inS + outAdapt * outS) / 1e6;
  // Si hay regen necesaria eso se calcula al correr; estimamos 1 regen
  const costoRegen = costoAdaptPrimera;

  // Crítico: ~4000 sys (cached) + ~2000 var + ~1500 output
  const sysC  = 4000;
  const varC  = 2000;
  const outCr = 1500;
  const nCriticas = args.repeticiones * (args.conPdf ? (args.template ? 1 : 3) : 1);
  const costoCriticoPrimera  = (sysC * inC * CACHE_WRITE_MULT + varC * inC + outCr * outC) / 1e6;
  const costoCriticoResto    = nCriticas > 1
    ? (nCriticas - 1) * (sysC * inC * CACHE_READ_MULT + varC * inC + outCr * outC) / 1e6
    : 0;

  const total = costoRegen + costoCriticoPrimera + costoCriticoResto;
  return `~$${total.toFixed(3)} USD (estimado con cache; regen + ${nCriticas} llamada(s) crítico)`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌  .env.local no encontrado en la raíz del proyecto.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

function parseJsonFromText(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No se encontró JSON en la respuesta");
  try { return JSON.parse(m[0]); }
  catch { return JSON.parse(jsonrepair(m[0])); }
}

interface Args {
  caso?: string;
  cvAntes?: string; cvDespues?: string; oferta?: string; etiqueta?: string;
  template?: string;
  modeloCompleto: boolean;
  forzarRegen: boolean;
  conPdf: boolean;
  repeticiones: number;
}

function parseArgs(): Args {
  const args: Record<string, string> = {};
  const flags = new Set<string>();
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) args[m[1]] = m[2];
    else if (arg.startsWith("--")) flags.add(arg.slice(2));
  }
  return {
    caso:           args["caso"],
    cvAntes:        args["cv-antes"],
    cvDespues:      args["cv-despues"],
    oferta:         args["oferta"],
    etiqueta:       args["etiqueta"],
    template:       args["template"],
    modeloCompleto: flags.has("modelo-completo"),
    forzarRegen:    flags.has("forzar-regen"),
    conPdf:         flags.has("con-pdf"),
    repeticiones:   Math.max(1, parseInt(args["repeticiones"] ?? "1", 10)),
  };
}

function findLatestResult(resultadosDir: string, caso: string): string | null {
  if (!fs.existsSync(resultadosDir)) return null;
  const files = fs
    .readdirSync(resultadosDir)
    .filter(f => f.startsWith(`${caso}-`) && f.endsWith(".json") && !f.includes("-eval"))
    .sort().reverse();
  return files.length ? path.join(resultadosDir, files[0]) : null;
}

function extractSystemPrompt(): string {
  const src = fs.readFileSync(path.join(process.cwd(), "app/api/process-cv/route.ts"), "utf-8");
  const START = "const SYSTEM_PROMPT = `";
  const END   = "`;\n\n// ─── identity helpers";
  const s = src.indexOf(START);
  const e = src.indexOf(END);
  if (s === -1 || e === -1) throw new Error("No se pudo extraer SYSTEM_PROMPT de route.ts");
  return src.slice(s + START.length, e);
}

function resultadoEsFresco(resultPath: string): boolean {
  const routeMtime = fs.statSync(path.join(process.cwd(), "app/api/process-cv/route.ts")).mtimeMs;
  return fs.statSync(resultPath).mtimeMs > routeMtime;
}

// ─── adaptación ───────────────────────────────────────────────────────────────

interface ResultadoAdaptacion {
  cv_adaptado: string;
  carta_presentacion: string;
  palabras_clave_oferta: string[];
  sugerencias: string[];
}

async function generateAdaptacion(
  client: Anthropic,
  systemPrompt: string,
  cvTexto: string,
  ofertaTexto: string,
  caso: string,
  resultadosDir: string
): Promise<ResultadoAdaptacion> {
  console.log(`  🔄  Generando nueva adaptación con ${MODELO_COMPLETO}...`);

  const res = await client.messages.create({
    model: MODELO_COMPLETO,
    max_tokens: 8000,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `MODO: ADAPTAR\n\nCV ORIGINAL:\n${cvTexto}\n\nOFERTA DE TRABAJO:\n${ofertaTexto}`,
    }],
  });

  const costo = calcularCostoReal(MODELO_COMPLETO, res.usage as UsageInfo);
  console.log(`  💰  Costo adaptación: $${costo.toFixed(4)} USD (cache_write=${res.usage.cache_creation_input_tokens ?? 0}, cache_read=${res.usage.cache_read_input_tokens ?? 0})`);

  const rawText = res.content[0].type === "text" ? res.content[0].text : "";
  const parsed = parseJsonFromText(rawText);
  if (typeof parsed.cv_adaptado !== "string") throw new Error("cv_adaptado no es string");

  // Post-procesamiento (igual que producción)
  let cvAdaptado = parsed.cv_adaptado as string;
  cvAdaptado = limpiarConocimientosEnDesarrollo(cvAdaptado, cvTexto);
  cvAdaptado = limpiarHabilidadesTecnicas(cvAdaptado, cvTexto);

  const resultado: ResultadoAdaptacion = {
    cv_adaptado:          cvAdaptado,
    carta_presentacion:   (parsed.carta_presentacion as string) ?? "",
    palabras_clave_oferta: (parsed.palabras_clave_oferta as string[]) ?? [],
    sugerencias:          (parsed.sugerencias as string[]) ?? [],
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(resultadosDir, `${caso}-${ts}.json`);
  fs.mkdirSync(resultadosDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ caso, ts, costo_adaptacion: costo, ...resultado }, null, 2));
  console.log(`  ✓  Adaptación guardada: ${path.basename(outPath)}`);
  return resultado;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;

async function generatePDF(cvText: string, formato: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pdf } = require("@react-pdf/renderer");

  let element: PdfDoc;
  if (formato === "tradicional") {
    const { default: T } = await import("../app/components/CVDocumentTradicional");
    element = React.createElement(T, { cvText });
  } else if (formato === "ejecutivo") {
    const { default: E } = await import("../app/components/CVDocumentEjecutivo");
    element = React.createElement(E, { cvText });
  } else {
    const { default: M } = await import("../app/components/CVDocumentModerno");
    element = React.createElement(M, { cvText });
  }

  const blob = await pdf(element).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

// ─── types ────────────────────────────────────────────────────────────────────

interface Problema {
  id: string;
  criterio: string;
  descripcion: string;
  por_que_esta_mal: string;
  como_corregirlo: string;
  severidad: "crítico" | "importante" | "menor";
}

interface CriticaResult {
  primera_impresion: string;
  resumen_ejecutivo: string;
  problemas: Problema[];
  delta_evaluacion: {
    mejoras_reales: string[];
    oportunidades_perdidas: string[];
    cambios_superficiales: string[];
  };
  nota_final: { puntaje: number; justificacion: string };
  template_fit: { template_usado: string; es_correcto: boolean; razon: string };
  gap_de_perfil: string[];
  limitaciones_cv_original: string[];
}

// ─── critic call ──────────────────────────────────────────────────────────────

async function criticarCV(
  client: Anthropic,
  criticaSystemPrompt: string,
  modelo: string,
  cvAntes: string,
  resultado: ResultadoAdaptacion,
  oferta: string,
  conPdf: boolean,
  template: string,
): Promise<{ critica: CriticaResult; costo: number }> {
  type ContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam;
  const userContent: ContentBlock[] = [];

  const modoTexto = conPdf
    ? `El PDF adjunto muestra el CV renderizado en template "${template}". Evalúa contenido Y presentación visual (incluyendo D1-D4).`
    : `EVALUACIÓN DE TEXTO ÚNICAMENTE: No hay PDF. Los criterios D1-D4 (diseño visual) no aplican — omítelos de "problemas" y en template_fit usa es_correcto: true, razon: "Sin PDF — criterios visuales no evaluados".`;

  userContent.push({
    type: "text",
    text:
      `${modoTexto}\n\n` +
      `TEMPLATE: ${template}\n\n` +
      `CV ORIGINAL (antes de la adaptación):\n${cvAntes}\n\n` +
      `CV ADAPTADO (texto, post-procesamiento aplicado):\n${resultado.cv_adaptado}\n\n` +
      `CARTA DE PRESENTACIÓN:\n${resultado.carta_presentacion}\n\n` +
      `OFERTA DE TRABAJO:\n${oferta}`,
  });

  if (conPdf) {
    const pdfBuffer = await generatePDF(resultado.cv_adaptado, template);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userContent.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdfBuffer.toString("base64") },
    } as unknown as ContentBlock);
  }

  const res = await client.messages.create({
    model: modelo,
    max_tokens: 8000,
    ...(modelo === MODELO_COMPLETO ? { thinking: { type: "disabled" as const } } : {}),
    system: [{ type: "text", text: criticaSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });

  const raw = res.content[0].type === "text" ? res.content[0].text : "";
  const critica = parseJsonFromText(raw) as unknown as CriticaResult;
  const costo = calcularCostoReal(modelo, res.usage as UsageInfo);
  return { critica, costo };
}

// ─── reporting ────────────────────────────────────────────────────────────────

interface RunResult {
  critica: CriticaResult;
  costo: number;
  template: string;
}

function printReporte(
  runs: RunResult[],
  noUsadas: string[],
  costoTotal: number,
) {
  const notas = runs.map(r => r.critica.nota_final.puntaje);
  const avg   = notas.reduce((s, n) => s + n, 0) / notas.length;
  const min   = Math.min(...notas);
  const max   = Math.max(...notas);

  const sep = "─".repeat(90);
  console.log(`\n${sep}`);
  console.log(`  NOTA: avg=${avg.toFixed(1)}  min=${min}  max=${max}  (${runs.length} corrida(s))`);
  if (noUsadas.length > 0) {
    console.log(`  ⚠️   no_usadas_con_evidencia (${noUsadas.length}): ${noUsadas.join(", ")}`);
  } else {
    console.log(`  ✓   no_usadas_con_evidencia: ninguna`);
  }
  console.log(`  💰  Costo total sesión: $${costoTotal.toFixed(4)} USD`);
  console.log(sep);

  // Problemas consistentes: aparecen en mayoría de corridas
  const umbral = Math.ceil(runs.length / 2);
  const conteo: Record<string, { count: number; prob: Problema }> = {};
  for (const { critica } of runs) {
    for (const p of critica.problemas) {
      const key = `${p.id}::${p.criterio}`;
      if (!conteo[key]) conteo[key] = { count: 0, prob: p };
      conteo[key].count++;
    }
  }
  const consistentes = Object.values(conteo)
    .filter(v => v.count >= umbral)
    .sort((a, b) => {
      const sev = { crítico: 0, importante: 1, menor: 2 };
      return (sev[a.prob.severidad] - sev[b.prob.severidad]) || (b.count - a.count);
    });

  if (consistentes.length === 0) {
    console.log("\n  Sin problemas consistentes en la mayoría de corridas.");
  } else {
    console.log(`\n  PROBLEMAS CONSISTENTES (${umbral}+ de ${runs.length} corridas):`);
    for (const { count, prob } of consistentes) {
      const sev = prob.severidad === "crítico" ? "🔴" : prob.severidad === "importante" ? "🟡" : "⚪";
      console.log(`\n  ${sev} [${prob.id}] ${prob.criterio}  (${count}/${runs.length} corridas)`);
      console.log(`     ${prob.descripcion}`);
      if (prob.severidad !== "menor") console.log(`     Fix: ${prob.como_corregirlo}`);
    }
  }

  // Primera corrida: impresión + resumen + delta
  const { critica } = runs[0];
  console.log(`\n  PRIMERA IMPRESIÓN (corrida 1): ${critica.primera_impresion}`);
  console.log(`  RESUMEN: ${critica.resumen_ejecutivo}`);

  if (critica.delta_evaluacion.oportunidades_perdidas.length > 0) {
    console.log(`\n  OPORTUNIDADES PERDIDAS:`);
    for (const o of critica.delta_evaluacion.oportunidades_perdidas) console.log(`    - ${o}`);
  }
  if (critica.gap_de_perfil?.length > 0) {
    console.log(`\n  GAP DE PERFIL (informativo, no penaliza):`);
    for (const g of critica.gap_de_perfil) console.log(`    · ${g}`);
  }

  console.log(`\n${sep}\n`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("❌  ANTHROPIC_API_KEY no encontrada en .env.local"); process.exit(1); }

  const client = new Anthropic({ apiKey });
  const args   = parseArgs();

  const ALL_TEMPLATES = ["moderno", "tradicional", "ejecutivo"] as const;
  type Template = (typeof ALL_TEMPLATES)[number];

  let templates: readonly Template[];
  if (args.conPdf) {
    if (args.template) {
      if (!ALL_TEMPLATES.includes(args.template as Template)) {
        console.error(`❌  Template desconocido: "${args.template}". Opciones: ${ALL_TEMPLATES.join(", ")}`);
        process.exit(1);
      }
      templates = [args.template as Template];
    } else {
      templates = ALL_TEMPLATES;
    }
  } else {
    templates = ["moderno"]; // texto solo — template nominal para template_fit
  }

  const modeloCritico = args.modeloCompleto ? MODELO_COMPLETO : MODELO_ITERACION;

  // ── cargar datos del caso ──────────────────────────────────────────────────
  let cvAntes: string;
  let adaptacion: ResultadoAdaptacion;
  let oferta: string;
  let etiqueta: string;

  const resultadosDir = path.join(process.cwd(), "evals/resultados");
  const criticasDir   = path.join(process.cwd(), "evals/criticas");
  fs.mkdirSync(criticasDir, { recursive: true });

  if (args.caso) {
    const casoPath = path.join(process.cwd(), "evals/casos", `${args.caso}.json`);
    if (!fs.existsSync(casoPath)) { console.error(`❌  Caso no encontrado: ${casoPath}`); process.exit(1); }
    const caso = JSON.parse(fs.readFileSync(casoPath, "utf-8"));
    cvAntes  = caso.cv_texto;
    oferta   = caso.oferta_texto;
    etiqueta = args.caso;

    const latest    = findLatestResult(resultadosDir, args.caso);
    const needsRegen = args.forzarRegen || !latest || !resultadoEsFresco(latest);

    console.log(`\n📋  Caso: ${args.caso}`);
    console.log(`💰  Costo estimado: ${estimarCostoTotal(args)}`);
    console.log(`🤖  Crítico: ${modeloCritico}${args.modeloCompleto ? " (completo)" : ""} · ${args.conPdf ? "con PDF" : "texto solo"} · ${args.repeticiones} rep(s)\n`);

    if (needsRegen) {
      const reason = args.forzarRegen ? "--forzar-regen activo"
        : !latest ? "no hay resultado previo"
        : "SYSTEM_PROMPT cambió desde la última adaptación";
      console.log(`⚠️   Regenerando (${reason})`);
      adaptacion = await generateAdaptacion(
        client, extractSystemPrompt(), cvAntes, oferta, args.caso, resultadosDir
      );
    } else {
      const saved = JSON.parse(fs.readFileSync(latest!, "utf-8"));
      // Compatibilidad: resultados viejos sin carta_presentacion
      if (!saved.cv_adaptado) throw new Error("Resultado guardado no tiene cv_adaptado");
      adaptacion = {
        cv_adaptado:           saved.cv_adaptado,
        carta_presentacion:    saved.carta_presentacion ?? "",
        palabras_clave_oferta: saved.palabras_clave_oferta ?? [],
        sugerencias:           saved.sugerencias ?? [],
      };
      console.log(`✅  Reutilizando: ${path.basename(latest!)}`);
    }
  } else if (args.cvAntes && args.cvDespues && args.oferta) {
    cvAntes  = fs.readFileSync(args.cvAntes, "utf-8");
    oferta   = fs.readFileSync(args.oferta, "utf-8");
    etiqueta = args.etiqueta ?? "custom";
    adaptacion = {
      cv_adaptado:           fs.readFileSync(args.cvDespues, "utf-8"),
      carta_presentacion:    "",
      palabras_clave_oferta: [],
      sugerencias:           [],
    };
    console.log(`\n📋  Caso custom: ${etiqueta}`);
    console.log(`💰  Costo estimado: ${estimarCostoTotal(args)}`);
  } else {
    console.error("❌  Uso: --caso=<nombre> | --cv-antes=<f> --cv-despues=<f> --oferta=<f>");
    process.exit(1);
  }

  // ── calcularMatch para detectar no_usadas ──────────────────────────────────
  const keywords  = adaptacion.palabras_clave_oferta;
  const matchData = keywords.length > 0
    ? calcularMatch(keywords, adaptacion.cv_adaptado, cvAntes)
    : { no_usadas_con_evidencia: [] as string[] };

  // ── críticas ───────────────────────────────────────────────────────────────
  const criticaSystemPrompt = fs.readFileSync(
    path.join(process.cwd(), "evals/critico-reclutador.md"), "utf-8"
  );

  console.log(`\n🔍  Criticando (${templates.length} template(s) × ${args.repeticiones} rep(s))...\n`);

  let costoTotal = 0;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const allRuns: RunResult[] = [];

  for (const template of templates) {
    const runsTemplate: RunResult[] = [];
    for (let rep = 1; rep <= args.repeticiones; rep++) {
      process.stdout.write(`  ⏳ ${template} rep ${rep}/${args.repeticiones}...\n`);
      try {
        const { critica, costo } = await criticarCV(
          client, criticaSystemPrompt, modeloCritico,
          cvAntes, adaptacion, oferta, args.conPdf, template
        );
        costoTotal += costo;
        runsTemplate.push({ critica, costo, template });
        console.log(`  ✓ nota=${critica.nota_final.puntaje} costo=$${costo.toFixed(4)}`);
      } catch (err) {
        console.error(`  ❌ ${template} rep ${rep}: ${(err as Error).message}`);
      }
    }

    if (runsTemplate.length > 0) {
      allRuns.push(...runsTemplate);
      const outPath = path.join(criticasDir, `${etiqueta}-${template}-${ts}.json`);
      fs.writeFileSync(outPath, JSON.stringify({
        etiqueta, template, ts, modelo: modeloCritico,
        repeticiones: runsTemplate.length,
        notas: runsTemplate.map(r => r.critica.nota_final.puntaje),
        runs: runsTemplate.map(r => r.critica),
        match: matchData,
      }, null, 2));
    }
  }

  if (allRuns.length === 0) { console.error("\n❌  Todas las corridas fallaron.\n"); process.exit(1); }

  // Guardar comparación
  const comparacionPath = path.join(criticasDir, `${etiqueta}-${ts}-comparacion.json`);
  fs.writeFileSync(comparacionPath, JSON.stringify({
    etiqueta, ts, modelo: modeloCritico, conPdf: args.conPdf,
    repeticiones: args.repeticiones, costoTotal,
    notas: allRuns.map(r => r.critica.nota_final.puntaje),
    match: matchData,
    runs: allRuns.map(r => ({ template: r.template, nota: r.critica.nota_final.puntaje })),
  }, null, 2));

  printReporte(allRuns, matchData.no_usadas_con_evidencia, costoTotal);

  console.log(`  Críticas en: evals/criticas/`);
  console.log(`  Comparación: ${path.basename(comparacionPath)}\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

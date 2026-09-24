/**
 * Evalúa templates de CV contra un caso dado.
 *
 * Uso:
 *   npx tsx evals/critico-reclutador.ts --caso=andres_senior
 *   npx tsx evals/critico-reclutador.ts --caso=pedro_xepelin --template=moderno
 *   npx tsx evals/critico-reclutador.ts --caso=pedro_xepelin --modelo-completo
 *   npx tsx evals/critico-reclutador.ts --caso=pedro_xepelin --forzar-regen
 *   npx tsx evals/critico-reclutador.ts --cv-antes=f.txt --cv-despues=f.txt --oferta=f.txt --etiqueta=slug
 *
 * Flags:
 *   --template=<moderno|tradicional|ejecutivo>  Evalúa solo ese template (default: los 3)
 *   --modelo-completo                           Usa claude-sonnet-5 para el crítico (default: haiku)
 *   --forzar-regen                              Fuerza regenerar cv_adaptado aunque SYSTEM_PROMPT no cambió
 */

import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import * as fs from "fs";
import * as path from "path";
import React from "react";
import { pdf } from "@react-pdf/renderer";

// ─── modelos y costos ─────────────────────────────────────────────────────────

const MODELO_ITERACION = "claude-haiku-4-5-20251001";
const MODELO_COMPLETO = "claude-sonnet-5";

// Precio por millón de tokens [input, output]
const PRECIOS: Record<string, [number, number]> = {
  [MODELO_ITERACION]: [0.8, 4],
  [MODELO_COMPLETO]: [2, 10],
  "claude-sonnet-5-regen": [2, 10], // adaptación siempre usa sonnet
};

function estimarCosto(
  modeloCritico: string,
  nTemplates: number,
  regenAdaptacion: boolean
): string {
  // Crítico: ~6000 tokens input (system+CV+oferta+PDF), ~2000 output por template
  const [inC, outC] = PRECIOS[modeloCritico] ?? [3, 15];
  const costoCritico = nTemplates * (6000 * inC + 2000 * outC) / 1_000_000;

  // Adaptación (siempre sonnet): ~7000 input, ~2000 output
  const costoRegen = regenAdaptacion
    ? (7000 * PRECIOS["claude-sonnet-5-regen"][0] + 2000 * PRECIOS["claude-sonnet-5-regen"][1]) / 1_000_000
    : 0;

  const total = costoCritico + costoRegen;
  const desglose = regenAdaptacion
    ? `crítico=${(costoCritico).toFixed(3)} + regen=${costoRegen.toFixed(3)}`
    : `crítico=${costoCritico.toFixed(3)}, adaptación reutilizada`;

  return `~$${total.toFixed(3)} USD (${desglose})`;
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
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = val;
  }
}

function parseJsonFromText(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No se encontró JSON en la respuesta");
  try {
    return JSON.parse(m[0]);
  } catch {
    return JSON.parse(jsonrepair(m[0]));
  }
}

function parseArgs(): {
  caso?: string;
  cvAntes?: string;
  cvDespues?: string;
  oferta?: string;
  etiqueta?: string;
  template?: string;
  modeloCompleto: boolean;
  forzarRegen: boolean;
} {
  const args: Record<string, string> = {};
  const flags = new Set<string>();
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) {
      args[m[1]] = m[2];
    } else if (arg.startsWith("--")) {
      flags.add(arg.slice(2));
    }
  }
  return {
    caso: args["caso"],
    cvAntes: args["cv-antes"],
    cvDespues: args["cv-despues"],
    oferta: args["oferta"],
    etiqueta: args["etiqueta"],
    template: args["template"],
    modeloCompleto: flags.has("modelo-completo"),
    forzarRegen: flags.has("forzar-regen"),
  };
}

function findLatestResult(resultadosDir: string, caso: string): string | null {
  if (!fs.existsSync(resultadosDir)) return null;
  const files = fs
    .readdirSync(resultadosDir)
    .filter((f) => f.startsWith(`${caso}-`) && f.endsWith(".json") && !f.includes("-eval"))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return path.join(resultadosDir, files[0]);
}

function extractSystemPrompt(): string {
  const file = path.join(process.cwd(), "app/api/process-cv/route.ts");
  const src = fs.readFileSync(file, "utf-8");
  const START = "const SYSTEM_PROMPT = `";
  const END = "`;\n\nfunction calcularMatch";
  const s = src.indexOf(START);
  const e = src.indexOf(END);
  if (s === -1 || e === -1) throw new Error("No se pudo extraer SYSTEM_PROMPT de route.ts");
  return src.slice(s + START.length, e);
}

// ─── adaptación ───────────────────────────────────────────────────────────────

async function generateAdaptacion(
  client: Anthropic,
  systemPrompt: string,
  cvText: string,
  ofertaText: string,
  caso: string,
  resultadosDir: string
): Promise<string> {
  console.log(`  🔄  Generando nueva adaptación con claude-sonnet-5...`);

  const res = await client.messages.create({
    model: MODELO_COMPLETO,
    max_tokens: 4000,
    thinking: { type: "disabled" },
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content:
          `MODO: ADAPTAR\n\n` +
          `CV ORIGINAL:\n${cvText}\n\n` +
          `OFERTA DE TRABAJO:\n${ofertaText}`,
      },
    ],
  });

  const rawText = res.content[0].type === "text" ? res.content[0].text : "";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("La respuesta del modelo no contiene JSON válido");
  const parsed = JSON.parse(jsonMatch[0]);
  if (typeof parsed.cv_adaptado !== "string") throw new Error("El campo cv_adaptado no es un string");
  const cvAdaptado = parsed.cv_adaptado;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(resultadosDir, `${caso}-${ts}.json`);
  fs.mkdirSync(resultadosDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ caso, ts, cv_adaptado: cvAdaptado }, null, 2));
  console.log(`  ✓  Adaptación guardada: ${path.basename(outPath)}`);
  return cvAdaptado;
}

function isAdaptacionFresca(resultPath: string): boolean {
  const routePath = path.join(process.cwd(), "app/api/process-cv/route.ts");
  const resultMtime = fs.statSync(resultPath).mtimeMs;
  const routeMtime = fs.statSync(routePath).mtimeMs;
  return resultMtime > routeMtime;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

type PdfDoc = React.ReactElement<Record<string, unknown>>;

async function generatePDF(cvText: string, formato: string): Promise<Buffer> {
  let element: PdfDoc;

  if (formato === "tradicional") {
    const { default: Tradicional } = await import("../app/components/CVDocumentTradicional");
    element = React.createElement(Tradicional, { cvText }) as PdfDoc;
  } else if (formato === "ejecutivo") {
    const { default: Ejecutivo } = await import("../app/components/CVDocumentEjecutivo");
    element = React.createElement(Ejecutivo, { cvText }) as PdfDoc;
  } else {
    const { default: Moderno } = await import("../app/components/CVDocumentModerno");
    element = React.createElement(Moderno, { cvText }) as PdfDoc;
  }

  const blob = await pdf(element).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
  nota_final: {
    puntaje: number;
    justificacion: string;
  };
  template_fit: {
    template_usado: string;
    es_correcto: boolean;
    razon: string;
  };
}

// ─── critic call ──────────────────────────────────────────────────────────────

async function criticarTemplate(
  client: Anthropic,
  systemPrompt: string,
  modelo: string,
  template: string,
  cvAntes: string,
  cvDespues: string,
  oferta: string
): Promise<CriticaResult> {
  const pdfBuffer = await generatePDF(cvDespues, template);
  const pdfBase64 = pdfBuffer.toString("base64");

  const userContent: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text:
        `A continuación tienes todos los insumos para evaluar el CV adaptado.\n\n` +
        `TEMPLATE USADO: ${template}\n\n` +
        `CV ORIGINAL (antes de la adaptación):\n${cvAntes}\n\n` +
        `CV ADAPTADO (texto puro):\n${cvDespues}\n\n` +
        `OFERTA DE TRABAJO A LA QUE POSTULA:\n${oferta}\n\n` +
        `El PDF adjunto muestra el CV adaptado renderizado en el template "${template}". ` +
        `Evalúa tanto el contenido textual como la presentación visual.`,
    },
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdfBase64,
      },
    } as unknown as Anthropic.TextBlockParam,
  ];

  const res = await client.messages.create({
    model: modelo,
    max_tokens: 8000,
    // thinking:disabled requerido para sonnet-5 (adaptive thinking activado por defecto)
    ...(modelo === MODELO_COMPLETO ? { thinking: { type: "disabled" as const } } : {}),
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const raw = res.content[0].type === "text" ? res.content[0].text : "";
  return parseJsonFromText(raw) as unknown as CriticaResult;
}

// ─── comparison table ─────────────────────────────────────────────────────────

function printTable(
  results: Array<{ template: string; critica: CriticaResult }>
) {
  const sep = "─".repeat(90);
  console.log(`\n${sep}`);
  console.log(
    "  TEMPLATE       NOTA   CRÍTICOS  IMPORTANTES  MENORES   TEMPLATE_FIT"
  );
  console.log(sep);

  for (const { template, critica } of results) {
    const nota = critica.nota_final.puntaje.toString().padStart(4);
    const criticos = critica.problemas
      .filter((p) => p.severidad === "crítico")
      .length.toString()
      .padStart(7);
    const importantes = critica.problemas
      .filter((p) => p.severidad === "importante")
      .length.toString()
      .padStart(11);
    const menores = critica.problemas
      .filter((p) => p.severidad === "menor")
      .length.toString()
      .padStart(7);
    const fit = critica.template_fit.es_correcto ? "✓ correcto" : "✗ inadecuado";
    console.log(
      `  ${template.padEnd(14)} ${nota}   ${criticos}  ${importantes}  ${menores}   ${fit}`
    );
  }

  console.log(sep);

  for (const { template, critica } of results) {
    console.log(`\n  [${template.toUpperCase()}] ${critica.nota_final.puntaje}/10`);
    console.log(`  Primera impresión: ${critica.primera_impresion}`);
    console.log(`  Resumen: ${critica.resumen_ejecutivo}`);

    const criticos = critica.problemas.filter((p) => p.severidad === "crítico");
    const importantes = critica.problemas.filter((p) => p.severidad === "importante");

    if (criticos.length > 0) {
      console.log(`\n  PROBLEMAS CRÍTICOS:`);
      for (const p of criticos) {
        console.log(`    [${p.id}] ${p.criterio}`);
        console.log(`    → ${p.descripcion}`);
        console.log(`    → Fix: ${p.como_corregirlo}`);
      }
    }
    if (importantes.length > 0) {
      console.log(`\n  PROBLEMAS IMPORTANTES:`);
      for (const p of importantes) {
        console.log(`    [${p.id}] ${p.criterio}`);
        console.log(`    → ${p.descripcion}`);
      }
    }

    const { mejoras_reales, oportunidades_perdidas } = critica.delta_evaluacion;
    if (mejoras_reales.length > 0) {
      console.log(`\n  MEJORAS REALES:`);
      for (const m of mejoras_reales) console.log(`    + ${m}`);
    }
    if (oportunidades_perdidas.length > 0) {
      console.log(`\n  OPORTUNIDADES PERDIDAS:`);
      for (const o of oportunidades_perdidas) console.log(`    - ${o}`);
    }

    console.log(`\n  TEMPLATE FIT: ${critica.template_fit.razon}`);
    console.log(`  JUSTIFICACIÓN NOTA: ${critica.nota_final.justificacion}`);
  }

  console.log(`\n${sep}\n`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌  ANTHROPIC_API_KEY no encontrada en .env.local");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const args = parseArgs();

  const ALL_TEMPLATES = ["moderno", "tradicional", "ejecutivo"] as const;
  type Template = (typeof ALL_TEMPLATES)[number];

  let templates: readonly Template[];
  if (args.template) {
    if (!ALL_TEMPLATES.includes(args.template as Template)) {
      console.error(`❌  Template desconocido: "${args.template}". Opciones: ${ALL_TEMPLATES.join(", ")}`);
      process.exit(1);
    }
    templates = [args.template as Template];
  } else {
    templates = ALL_TEMPLATES;
  }

  const modeloCritico = args.modeloCompleto ? MODELO_COMPLETO : MODELO_ITERACION;

  let cvAntes: string;
  let cvDespues: string;
  let oferta: string;
  let etiqueta: string;

  if (args.caso) {
    const casosDir = path.join(process.cwd(), "evals/casos");
    const resultadosDir = path.join(process.cwd(), "evals/resultados");

    const casoPath = path.join(casosDir, `${args.caso}.json`);
    if (!fs.existsSync(casoPath)) {
      console.error(`❌  Caso no encontrado: ${casoPath}`);
      process.exit(1);
    }
    const caso = JSON.parse(fs.readFileSync(casoPath, "utf-8"));
    cvAntes = caso.cv_texto;
    oferta = caso.oferta_texto;
    etiqueta = args.caso;

    // Determine if we need to regenerate the adaptation
    const latestResult = findLatestResult(resultadosDir, args.caso);
    const needsRegen =
      args.forzarRegen ||
      !latestResult ||
      !isAdaptacionFresca(latestResult);

    if (needsRegen) {
      const reason = args.forzarRegen
        ? "--forzar-regen activo"
        : !latestResult
        ? "no hay resultado previo"
        : "SYSTEM_PROMPT cambió desde la última adaptación";
      console.log(`\n📋  Caso: ${args.caso}`);
      console.log(`⚠️   Regenerando adaptación (${reason})`);
      const systemPrompt = extractSystemPrompt();
      cvDespues = await generateAdaptacion(client, systemPrompt, cvAntes, oferta, args.caso, resultadosDir);
    } else {
      const resultado = JSON.parse(fs.readFileSync(latestResult!, "utf-8"));
      cvDespues = resultado.cv_adaptado;
      console.log(`\n📋  Caso: ${args.caso}`);
      console.log(`✅  Reutilizando adaptación: ${path.basename(latestResult!)}`);
    }
  } else if (args.cvAntes && args.cvDespues && args.oferta) {
    cvAntes = fs.readFileSync(args.cvAntes, "utf-8");
    cvDespues = fs.readFileSync(args.cvDespues, "utf-8");
    oferta = fs.readFileSync(args.oferta, "utf-8");
    etiqueta = args.etiqueta ?? "custom";
  } else {
    console.error(
      "❌  Uso: --caso=<nombre> | --cv-antes=<f> --cv-despues=<f> --oferta=<f> [--etiqueta=<slug>]"
    );
    process.exit(1);
  }

  const criticaSystemPrompt = fs.readFileSync(
    path.join(process.cwd(), "evals/critico-reclutador.md"),
    "utf-8"
  );

  // Cost estimate
  const latestForCost = args.caso ? findLatestResult(path.join(process.cwd(), "evals/resultados"), args.caso ?? "") : null;
  const willRegen = args.caso
    ? (args.forzarRegen || !latestForCost || !isAdaptacionFresca(latestForCost))
    : false;
  console.log(`💰  Costo estimado: ${estimarCosto(modeloCritico, templates.length, willRegen)}`);
  console.log(`🤖  Modelo crítico: ${modeloCritico}${args.modeloCompleto ? " (completo)" : " (iteración)"}`);
  console.log(`📐  Templates: ${templates.join(", ")}\n`);

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const criticasDir = path.join(process.cwd(), "evals/criticas");
  fs.mkdirSync(criticasDir, { recursive: true });

  console.log(`🔍  Criticando ${templates.length} template(s)...\n`);

  const tareas = templates.map(async (template) => {
    process.stdout.write(`  ⏳ ${template}...\n`);
    try {
      const critica = await criticarTemplate(
        client,
        criticaSystemPrompt,
        modeloCritico,
        template,
        cvAntes,
        cvDespues,
        oferta
      );

      const outPath = path.join(criticasDir, `${etiqueta}-${template}-${ts}.json`);
      fs.writeFileSync(
        outPath,
        JSON.stringify({ etiqueta, template, ts, modelo: modeloCritico, ...critica }, null, 2)
      );
      console.log(`  ✓ ${template} → ${critica.nota_final.puntaje}/10`);
      return { template, critica };
    } catch (err) {
      console.error(`  ❌ ${template}: ${(err as Error).message}`);
      return null;
    }
  });

  const resultados = (await Promise.all(tareas)).filter(
    (r): r is Exclude<typeof r, null> => r !== null
  );

  if (resultados.length === 0) {
    console.error("\n❌  Todos los templates fallaron.\n");
    process.exit(1);
  }

  const comparacionPath = path.join(criticasDir, `${etiqueta}-${ts}-comparacion.json`);
  fs.writeFileSync(
    comparacionPath,
    JSON.stringify({ etiqueta, ts, modelo: modeloCritico, resultados }, null, 2)
  );

  printTable(resultados);

  console.log(`  Críticas individuales en: evals/criticas/`);
  console.log(`  Comparación guardada en:  ${path.basename(comparacionPath)}\n`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});

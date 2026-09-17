import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import * as fs from "fs";
import * as path from "path";

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseJsonFromText(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No se encontró JSON en la respuesta");
  try {
    return JSON.parse(m[0]);
  } catch {
    return JSON.parse(jsonrepair(m[0]));
  }
}

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

// ─── types ────────────────────────────────────────────────────────────────────

interface Caso {
  nombre: string;
  cv_texto: string;
  oferta_texto: string;
  perfil_descripcion: string;
  criterios_extra: string[];
}

interface CriterioScore {
  puntaje: number;
  razon: string;
}

type EvalResult = Record<string, CriterioScore>;

// ─── prompt builders ──────────────────────────────────────────────────────────

const CRITERIOS_UNIVERSALES = [
  "perfil_palabras",
  "verbos_accion",
  "resultado_medible",
  "espejo_lenguaje",
  "formato_ats",
  "adecuacion_nivel",
  "carta_presentacion",
  "sugerencias",
];

function buildUserMessage(caso: Caso): string {
  return (
    `MODO: ADAPTAR\n\n` +
    `INSTRUCCIÓN CRÍTICA: El CV del candidato que aparece abajo es el punto de partida. ` +
    `Su contenido, estilo, verbos y estructura original deben ser IGNORADOS. ` +
    `Debes reescribir completamente cada sección aplicando todas las reglas del system prompt. ` +
    `No copies frases del CV original — transforma cada bullet en una acción con resultado medible.\n\n` +
    `CV DEL CANDIDATO (materia prima — reescribir completamente):\n${caso.cv_texto}\n\n` +
    `OFERTA DE TRABAJO (extraer palabras clave e integrarlas):\n${caso.oferta_texto}`
  );
}

function contarPalabrasPerfil(cvText: string): number {
  const lines = cvText.split("\n");
  let inPerfil = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (/PERFIL\s+PROFESIONAL/i.test(line)) { inPerfil = true; continue; }
    if (inPerfil && /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+[—─━\-]{3,}/.test(line)) break;
    if (inPerfil) collected.push(line);
  }
  return collected.join(" ").trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function buildEvaluatorMessage(caso: Caso, resultado: Record<string, unknown>, rubrica: string): string {
  const criterios = [...CRITERIOS_UNIVERSALES, ...caso.criterios_extra];
  const schemaLines = criterios
    .map((c) => `  "${c}": { "puntaje": <entero 1–10>, "razon": "<máximo 20 palabras>" }`)
    .join(",\n");

  const perfilWordCount = contarPalabrasPerfil(resultado.cv_adaptado as string);
  const perfilHint = `DATO PRE-CALCULADO PARA perfil_palabras: el perfil profesional del CV adaptado tiene exactamente ${perfilWordCount} palabras (contadas en código dividiendo el texto por espacios). Usa este número — no vuelvas a contar tú mismo.\n\n`;

  return (
    `Eres un evaluador experto en CVs y empleabilidad chilena. ` +
    `Evalúa el output generado por un sistema de IA según la rúbrica adjunta.\n\n` +
    `RÚBRICA:\n${rubrica}\n\n` +
    perfilHint +
    `PERFIL DEL CASO: ${caso.perfil_descripcion}\n\n` +
    `CV ADAPTADO:\n${resultado.cv_adaptado}\n\n` +
    `CARTA DE PRESENTACIÓN:\n${resultado.carta_presentacion}\n\n` +
    `SUGERENCIAS:\n${JSON.stringify(resultado.sugerencias, null, 2)}\n\n` +
    `Evalúa SOLO estos criterios: ${criterios.join(", ")}.\n\n` +
    `Devuelve ÚNICAMENTE un JSON válido con este formato exacto (sin texto adicional):\n{\n${schemaLines}\n}`
  );
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
  const systemPrompt = extractSystemPrompt();
  const rubrica = fs.readFileSync(path.join(process.cwd(), "evals/rubrica.md"), "utf-8");

  const casosDir = path.join(process.cwd(), "evals/casos");
  const casos: Caso[] = fs
    .readdirSync(casosDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(casosDir, f), "utf-8")));

  const resultadosDir = path.join(process.cwd(), "evals/resultados");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  console.log(`\n🔍  Corriendo evals — ${casos.length} caso(s) — ${ts}\n`);

  type FilaTabla = { nombre: string; promedio: number; fallidos: string[] };
  const tabla: FilaTabla[] = [];

  for (const caso of casos) {
    process.stdout.write(`  → ${caso.nombre.padEnd(28)}`);

    // ── paso 1: generar CV adaptado ──────────────────────────────────────────
    let resultado: Record<string, unknown> | null = null;
    for (let intento = 1; intento <= 2 && resultado === null; intento++) {
      try {
        const res = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: "user", content: buildUserMessage(caso) }],
        });
        const raw = res.content[0].type === "text" ? res.content[0].text : "";
        resultado = parseJsonFromText(raw);
      } catch (err) {
        if (intento < 2) {
          process.stdout.write(`(reintentando) `);
        } else {
          console.log(`❌  Error generando CV: ${(err as Error).message}`);
        }
      }
    }
    if (!resultado) continue;

    fs.writeFileSync(
      path.join(resultadosDir, `${caso.nombre}-${ts}.json`),
      JSON.stringify({ caso: caso.nombre, ts, ...resultado }, null, 2)
    );

    // ── paso 2: evaluar el resultado ─────────────────────────────────────────
    let evalResult: EvalResult;
    try {
      const evalRes = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        temperature: 0,
        messages: [{ role: "user", content: buildEvaluatorMessage(caso, resultado, rubrica) }],
      });
      const evalRaw = evalRes.content[0].type === "text" ? evalRes.content[0].text : "";
      evalResult = parseJsonFromText(evalRaw) as EvalResult;
    } catch (err) {
      console.log(`❌  Error evaluando: ${(err as Error).message}`);
      continue;
    }

    const entradas = Object.entries(evalResult);
    const promedio = entradas.reduce((s, [, v]) => s + v.puntaje, 0) / entradas.length;
    const fallidos = entradas.filter(([, v]) => v.puntaje < 7).map(([k]) => k);

    fs.writeFileSync(
      path.join(resultadosDir, `${caso.nombre}-${ts}-eval.json`),
      JSON.stringify({ caso: caso.nombre, ts, promedio: +promedio.toFixed(1), evalResult }, null, 2)
    );

    tabla.push({ nombre: caso.nombre, promedio, fallidos });
    console.log(`${promedio.toFixed(1)}/10  ${fallidos.length > 0 ? `(bajo 7: ${fallidos.join(", ")})` : "✓"}`);
  }

  // ── tabla resumen ────────────────────────────────────────────────────────────
  if (tabla.length === 0) {
    console.log("\n⚠️   Ningún caso completó el eval.\n");
    return;
  }

  const sep = "─".repeat(72);
  console.log(`\n${sep}`);
  console.log("  CASO                          PROMEDIO   CRITERIOS BAJO 7");
  console.log(sep);
  for (const row of tabla) {
    const n = row.nombre.padEnd(30);
    const p = row.promedio.toFixed(1).padStart(8);
    const f = row.fallidos.length > 0 ? row.fallidos.join(", ") : "ninguno";
    console.log(`  ${n} ${p}   ${f}`);
  }
  console.log(sep);

  const global = tabla.reduce((s, r) => s + r.promedio, 0) / tabla.length;
  console.log(`\n  Promedio global: ${global.toFixed(1)}/10`);
  console.log(`  Resultados en:   evals/resultados/\n`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});

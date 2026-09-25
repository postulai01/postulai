// Offline test for calcularMatch — no API calls.
// Tests the new keyword matching logic against known failure cases from diagnosis session.

// ── Helpers (mirrors route.ts) ────────────────────────────────────────────────

function normalizarParaComparar(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS_MATCH = new Set([
  "de", "del", "en", "con", "por", "para", "a", "al",
  "el", "la", "los", "las", "y", "e", "o", "u",
]);

function matcheaPalabra(palabra, textoNorm) {
  if (new RegExp(`\\b${palabra}\\b`).test(textoNorm)) return true;
  const altS = palabra.endsWith("s") ? palabra.slice(0, -1) : palabra + "s";
  return new RegExp(`\\b${altS}\\b`).test(textoNorm);
}

function calcularMatch(keywords, cvAdaptado, cvOriginal = "") {
  const cvAdaptNorm = normalizarParaComparar(cvAdaptado);
  const cvOrigNorm = normalizarParaComparar(cvOriginal);
  const integradas = [];
  const no_usadas_con_evidencia = [];
  const gap = [];

  for (const kw of keywords) {
    const kwNorm = normalizarParaComparar(kw);
    const palabras = kwNorm.split(/\s+/).filter(p => p.length > 0);
    const significativas = palabras.filter(p => !STOP_WORDS_MATCH.has(p));
    const toCheck = significativas.length > 0 ? significativas : palabras;

    if (toCheck.every(p => matcheaPalabra(p, cvAdaptNorm))) {
      integradas.push(kw);
    } else if (cvOrigNorm && toCheck.every(p => matcheaPalabra(p, cvOrigNorm))) {
      no_usadas_con_evidencia.push(kw);
    } else {
      gap.push(kw);
    }
  }

  if (no_usadas_con_evidencia.length > 0) {
    console.warn(`[warn] no_usadas_con_evidencia: ${no_usadas_con_evidencia.join(", ")}`);
  }

  return { keywords_totales: keywords.length, keywords_encontradas: integradas.length, integradas, no_usadas_con_evidencia, gap };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Simulates production cv_adaptado for pedro_cencomalls AFTER limpiarConocimientosEnDesarrollo.
// In production the model generates "Conocimientos en desarrollo: SQL · Power BI · BigQuery" on
// ONE line. Since Pedro's cv_original has no SQL/Power BI/BigQuery, the filter removes it entirely.
// This fixture has Microsoft PowerPoint to trigger the old "power" substring false positive.
const CV_ADAPTADO_PEDRO = `PEDRO IGNACIO HERESI RIVADENEIRA
Santiago, Chile · +56 9 9551 5072 · pedro.ignacio.heresi@gmail.com

PERFIL PROFESIONAL
———————————————
Estudiante de Ingeniería Comercial (UAI) con experiencia en análisis de datos comerciales, control de flujo de caja y generación de reportería. Formación orientada a Finanzas Cuantitativas con manejo de Excel y exposición a herramientas de visualización de datos. Disponible para incorporación inmediata.

EDUCACIÓN
———————————————
Ingeniería Comercial · Mención Finanzas Cuantitativas | Universidad Adolfo Ibáñez — 2023 – Presente
Enseñanza Media Completa | British Royal School — 2019 – 2022

EXPERIENCIA LABORAL
———————————————
Promotor de Ventas | Claps (campaña Hellmann's) — 03/2025 – Presente
- Ejecuté activaciones de marca en puntos de venta, generando contacto directo con más de 50 clientes por jornada.
- Ejecuté demostraciones de producto en 3 campañas promocionales con equipos distintos.
- Identifiqué patrones de comportamiento de compra en terreno.

Cofundador | Bonapet-eat — 03/2024 – 06/2024
- Fundé y operé un emprendimiento de snacks para mascotas.
- Administré el flujo de caja del emprendimiento durante 3 meses.
- Analicé métricas de venta semanales para ajustar el mix de productos.

HABILIDADES
———————————————
Habilidades técnicas:
Microsoft Excel · Microsoft PowerPoint · Google Sheets

Habilidades blandas:
Comunicación efectiva · Orientación al cliente · Trabajo en equipo

IDIOMAS
———————————————
Español: Nativo · Inglés: Avanzado`;

// cv_original: includes Power BI and cartera de clientes (to test no_usadas_con_evidencia).
const CV_ORIGINAL_PEDRO = `Pedro Heresi · Santiago · pedro@gmail.com
Estudiante Ingeniería Comercial UAI.
Manejo de Excel y Power BI para análisis de datos.
Experiencia en gestión de cartera de clientes en emprendimiento.
Inglés avanzado (TOEFL 98/120).`;

const KEYWORDS_14 = [
  "Excel",
  "Inglés",
  "Power BI",
  "SQL",
  "BigQuery",
  "SAP",
  "cartera de clientes",
  "facturación",
  "automatización",
  "dashboards",
  "aging",
  "deuda vencida",
  "cierre mensual",
  "reuniones de seguimiento",
];

let pass = true;
const assertFalse = (cond, msg) => { if (cond) { console.error("✗ FAIL:", msg); pass = false; } else { console.log("✓ PASS:", msg); } };
const assertTrue  = (cond, msg) => { if (!cond) { console.error("✗ FAIL:", msg); pass = false; } else { console.log("✓ PASS:", msg); } };

// ── TEST 1: Anti-false-positive (sin cv_original) ─────────────────────────────
// This is the core regression test for the bugs we fixed.
console.log("\n=== TEST 1: False-positive regression (cv_adaptado solo) ===");
const r1 = calcularMatch(KEYWORDS_14, CV_ADAPTADO_PEDRO);
console.log("integradas:", r1.integradas);
console.log("gap:       ", r1.gap);

assertFalse(r1.integradas.includes("Power BI"),
  "Power BI NO integrada — 'Microsoft PowerPoint' ya no es falso positivo vía substring");
assertFalse(r1.integradas.includes("cartera de clientes"),
  "cartera de clientes NO integrada — 'de' stopword ya no cuenta como evidencia");
assertTrue(r1.integradas.includes("Excel"),   "Excel integrada");
assertTrue(r1.integradas.includes("Inglés"),  "Inglés integrada (acento normalizado)");
assertTrue(r1.gap.includes("SQL"),            "SQL en gap");
assertTrue(r1.gap.includes("BigQuery"),       "BigQuery en gap");
assertTrue(r1.gap.includes("SAP"),            "SAP en gap");
assertTrue(r1.gap.includes("aging"),          "aging en gap");
assertTrue(r1.gap.includes("deuda vencida"),  "deuda vencida en gap");

// ── TEST 2: Con cv_original → no_usadas_con_evidencia ────────────────────────
console.log("\n=== TEST 2: no_usadas_con_evidencia (con cv_original) ===");
const r2 = calcularMatch(KEYWORDS_14, CV_ADAPTADO_PEDRO, CV_ORIGINAL_PEDRO);
console.log("integradas:             ", r2.integradas);
console.log("no_usadas_con_evidencia:", r2.no_usadas_con_evidencia);
console.log("gap:                    ", r2.gap);
console.log(`UI: ${r2.integradas.length} de ${r2.integradas.length + r2.no_usadas_con_evidencia.length} (denominador = evidencia real)`);

assertTrue(r2.no_usadas_con_evidencia.includes("Power BI"),
  "Power BI en no_usadas (está en original pero adaptado no lo integró)");
assertTrue(r2.no_usadas_con_evidencia.includes("cartera de clientes"),
  "cartera de clientes en no_usadas (está en original pero adaptado no lo integró)");
assertTrue(r2.integradas.includes("Excel"),   "Excel en integradas (test 2)");
assertTrue(r2.integradas.includes("Inglés"),  "Inglés en integradas (test 2)");
assertFalse(r2.gap.includes("Power BI"),      "Power BI NO en gap — tiene evidencia en original");
assertFalse(r2.gap.includes("cartera de clientes"), "cartera de clientes NO en gap — tiene evidencia");

// ── TEST 3: Normalización de acentos ─────────────────────────────────────────
console.log("\n=== TEST 3: Normalización de acentos ===");
const r3a = calcularMatch(["análisis de datos"], "manejo de analisis de datos en empresa");
assertTrue(r3a.integradas.includes("análisis de datos"), "análisis matchea sin tilde en texto");

const r3b = calcularMatch(["análisis de datos"], "manejo de análisis de datos en empresa");
assertTrue(r3b.integradas.includes("análisis de datos"), "análisis matchea con tilde en texto");

// ── TEST 4: Límites de palabra (\b) ───────────────────────────────────────────
console.log("\n=== TEST 4: Word boundary — 'power' no matchea en 'powerpoint' ===");
const r4 = calcularMatch(["power"], "Microsoft PowerPoint y Google Sheets");
assertFalse(r4.integradas.includes("power"),
  "'power' NO matchea dentro de 'powerpoint' con word boundary");

// ── TEST 5: Tolerancia a plurales ────────────────────────────────────────────
console.log("\n=== TEST 5: Tolerancia a plurales ===");
const r5a = calcularMatch(["dashboard"], "generé dashboards mensuales para gerencia");
assertTrue(r5a.integradas.includes("dashboard"), "'dashboard' matchea 'dashboards'");
const r5b = calcularMatch(["dashboards"], "generé un dashboard mensual para gerencia");
assertTrue(r5b.integradas.includes("dashboards"), "'dashboards' matchea 'dashboard'");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(60));
console.log(pass ? "✓ All tests passed" : "✗ Some tests FAILED");

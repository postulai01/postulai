// Offline test for limpiarHabilidadesTecnicas — no API calls.
// Verifica que herramientas sin respaldo en el CV original sean eliminadas
// y que "Microsoft Word" pase cuando el original dice "Microsoft Office (Word, PowerPoint)".

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

const PREFIJOS_MARCA = new Set(["microsoft", "google", "adobe"]);

function herramientaTieneRespaldo(herramienta, fuenteNorm) {
  const hNorm = normalizarParaComparar(herramienta);
  if (!hNorm) return true;
  if (fuenteNorm.includes(hNorm)) return true;
  const palabras = hNorm.split(" ").filter(w => w.length >= 4 && !PREFIJOS_MARCA.has(w));
  if (palabras.length === 0) return false;
  return palabras.every(w => new RegExp(`\\b${w}\\b`).test(fuenteNorm));
}

function limpiarHabilidadesTecnicas(cvText, fuenteOriginal) {
  const fuenteNorm = normalizarParaComparar(fuenteOriginal);
  const lines = cvText.split("\n");
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^(Habilidades|Herramientas) técnicas\s*:/i.test(trimmed)) {
      out.push(line);
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    const prefix = trimmed.slice(0, colonIdx + 1);
    const toolsPart = trimmed.slice(colonIdx + 1).trim();
    const tools = toolsPart
      .split(/\s*·\s*|\s*,\s*/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const validas = tools.filter(tool => {
      const ok = herramientaTieneRespaldo(tool, fuenteNorm);
      if (!ok) console.warn(`[warn] eliminando "${tool}" — sin respaldo`);
      return ok;
    });

    if (validas.length > 0) {
      const indent = line.slice(0, line.length - trimmed.length);
      out.push(`${indent}${prefix} ${validas.join(" · ")}`);
    }
  }

  return out.join("\n");
}

// ── Fixture — CV real de Pedro ─────────────────────────────────────────────────

const CV_REAL_PEDRO = `Pedro Ignacio Heresi Rivadeneira

Estudiante de Ingeniería Comercial | Especialización en Finanzas Cuantitativas

Santiago, Chile  |  +56 9 9551 5072  |  pedro.ignacio.heresi@gmail.com

PERFIL PROFESIONAL

Estudiante de cuarto año de Ingeniería Comercial con mención en Finanzas Cuantitativas en la Universidad Adolfo Ibáñez. Con experiencia en ventas directas, promoción de productos y emprendimiento. Orientado a resultados, con habilidades de comunicación, trabajo en equipo y manejo de herramientas digitales. Inglés avanzado.

EXPERIENCIA

    Promotor de Ventas  |  Claps (campaña Hellmann's)    2025

- Ejecución de activaciones de marca en puntos de venta para Hellmann's.

- Demostración de producto e impulso de ventas mediante atención directa al cliente.

- Participación en 3 campañas promocionales con distintos equipos de trabajo.

    Cofundador y Multifuncional  |  Bonapet-eat (Emprendimiento)    2024  ·  3 meses

- Co fundé y operé un emprendimiento de snacks y alimentos para perros como proyecto académico universitario.

- Gestioné actividades de producción, ventas directas en plazas y espacios públicos, y creación de anuncios publicitarios.

- Desarrollé habilidades de emprendimiento end-to-end: desde la producción hasta la comercialización del producto.

EDUCACIÓN

    Ingeniería Comercial · Mención Finanzas Cuantitativas    2023 y cursando 4to año

Cuarto año en curso · Santiago, Chile

- Programa con especialización en Magíster de Finanzas Cuantitativas integrado a la carrera.

- Exención de inglés universitario por dominio del idioma.

Enseñanza Media

British Royal School · Santiago, Chile

- Formación en inglés como idioma de instrucción durante toda la educación secundaria.

HABILIDADES

Herramientas y software

- Microsoft Excel (nivel intermedio): análisis de datos, tablas, fórmulas.

- Microsoft Office (Word, PowerPoint).

Idiomas

- Español: nativo.

- Inglés: avanzado (educación en colegio bilingüe British Royal School; exento en universidad).

Competencias

- Ventas directas y atención al cliente.

- Trabajo en equipo y comunicación efectiva.

- Pensamiento analítico y orientación a resultados.

- Adaptabilidad y gestión multifuncional.`;

// ── Helpers de test ───────────────────────────────────────────────────────────

let pass = true;
const assertTrue  = (cond, msg) => { if (!cond) { console.error("✗ FAIL:", msg); pass = false; } else { console.log("✓ PASS:", msg); } };
const assertFalse = (cond, msg) => { if (cond)  { console.error("✗ FAIL:", msg); pass = false; } else { console.log("✓ PASS:", msg); } };

// ── TEST 1: Caso central — Google Sheets fabricada, el resto tiene respaldo ───
console.log("\n=== TEST 1: Google Sheets eliminada, Excel/Word/PowerPoint conservados ===");

const CV_CON_GOOGLE_SHEETS = `PEDRO IGNACIO HERESI RIVADENEIRA
Santiago, Chile

HABILIDADES
———————————————
Habilidades técnicas: Microsoft Excel · Google Sheets · Microsoft Word · Microsoft PowerPoint

Habilidades blandas: Trabajo en equipo · Comunicación efectiva`;

const resultado1 = limpiarHabilidadesTecnicas(CV_CON_GOOGLE_SHEETS, CV_REAL_PEDRO);
console.log("Línea resultante:", resultado1.split("\n").find(l => /técnicas/i.test(l)));

assertTrue(resultado1.includes("Microsoft Excel"), "Microsoft Excel conservado");
assertFalse(resultado1.includes("Google Sheets"),  "Google Sheets eliminado — sin respaldo en original");
assertTrue(resultado1.includes("Microsoft Word"),  "Microsoft Word conservado");
assertTrue(resultado1.includes("Microsoft PowerPoint"), "Microsoft PowerPoint conservado");

// ── TEST 2: Microsoft Word pasa via 'Microsoft Office (Word, PowerPoint)' ───
console.log("\n=== TEST 2: herramientaTieneRespaldo individual ===");
const fuenteNorm = normalizarParaComparar(CV_REAL_PEDRO);

assertTrue(herramientaTieneRespaldo("Microsoft Excel", fuenteNorm),
  "'Microsoft Excel' tiene respaldo (mencionado explícitamente)");
assertFalse(herramientaTieneRespaldo("Google Sheets", fuenteNorm),
  "'Google Sheets' sin respaldo");
assertTrue(herramientaTieneRespaldo("Microsoft Word", fuenteNorm),
  "'Microsoft Word' pasa porque original dice 'Microsoft Office (Word, PowerPoint)'");
assertTrue(herramientaTieneRespaldo("Microsoft PowerPoint", fuenteNorm),
  "'Microsoft PowerPoint' pasa por la misma razón");
assertFalse(herramientaTieneRespaldo("Power BI", fuenteNorm),
  "'Power BI' sin respaldo");
assertFalse(herramientaTieneRespaldo("SQL", fuenteNorm),
  "'SQL' sin respaldo");

// ── TEST 3: Variante 'Herramientas técnicas:' también se filtra ──────────────
console.log("\n=== TEST 3: Variante 'Herramientas técnicas:' ===");

const CV_HERRAMIENTAS = `HABILIDADES
———————————————
Herramientas técnicas: Microsoft Excel · Google Sheets · Power BI

Habilidades blandas: Trabajo en equipo`;

const resultado3 = limpiarHabilidadesTecnicas(CV_HERRAMIENTAS, CV_REAL_PEDRO);
console.log("Línea resultante:", resultado3.split("\n").find(l => /técnicas/i.test(l)));

assertTrue(resultado3.includes("Microsoft Excel"),  "Microsoft Excel conservado en variante 'Herramientas'");
assertFalse(resultado3.includes("Google Sheets"),   "Google Sheets eliminado en variante 'Herramientas'");
assertFalse(resultado3.includes("Power BI"),        "Power BI eliminado en variante 'Herramientas'");

// ── TEST 4: Sin fabricación — línea intacta ───────────────────────────────────
console.log("\n=== TEST 4: Línea ya correcta — sin cambios ===");

const CV_CORRECTO = `HABILIDADES
———————————————
Habilidades técnicas: Microsoft Excel · Microsoft Word · Microsoft PowerPoint

Habilidades blandas: Trabajo en equipo`;

const resultado4 = limpiarHabilidadesTecnicas(CV_CORRECTO, CV_REAL_PEDRO);
const lineaTecnicas4 = resultado4.split("\n").find(l => /técnicas/i.test(l));
assertTrue(
  lineaTecnicas4 === "Habilidades técnicas: Microsoft Excel · Microsoft Word · Microsoft PowerPoint",
  "Línea correcta no modificada"
);

// ── TEST 5: Línea de blandas NO se toca ───────────────────────────────────────
console.log("\n=== TEST 5: Habilidades blandas no se tocan ===");
const CV_BLANDAS = `Habilidades blandas: Comunicación efectiva · Trabajo en equipo · Liderazgo`;
const resultado5 = limpiarHabilidadesTecnicas(CV_BLANDAS, CV_REAL_PEDRO);
assertTrue(resultado5 === CV_BLANDAS, "Habilidades blandas sin modificar");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(60));
console.log(pass ? "✓ All tests passed" : "✗ Some tests FAILED");

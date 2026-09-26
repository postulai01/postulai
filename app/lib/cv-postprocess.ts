/**
 * Funciones de post-procesamiento de CV compartidas entre route.ts y los scripts de evals.
 * Importar desde aquí; nunca duplicar estas funciones.
 */

// ─── normalización de texto ──────────────────────────────────────────────────

export function normalizarParaComparar(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── match de keywords ───────────────────────────────────────────────────────

// Palabras vacías excluidas del match de frases; "de" no cuenta como evidencia de "cartera de clientes".
export const STOP_WORDS_MATCH = new Set([
  "de", "del", "en", "con", "por", "para", "a", "al",
  "el", "la", "los", "las", "y", "e", "o", "u",
]);

export function matcheaPalabra(palabra: string, textoNorm: string): boolean {
  // normalizarParaComparar garantiza que textoNorm y palabra solo tengan a-z0-9,
  // por lo que no hay riesgo de inyección de caracteres especiales en la regex.
  if (new RegExp(`\\b${palabra}\\b`).test(textoNorm)) return true;
  const altS = palabra.endsWith("s") ? palabra.slice(0, -1) : palabra + "s";
  return new RegExp(`\\b${altS}\\b`).test(textoNorm);
}

export function calcularMatch(
  keywords: string[],
  cvAdaptado: string,
  cvOriginal = ""
): {
  keywords_totales: number;
  keywords_encontradas: number;
  integradas: string[];
  no_usadas_con_evidencia: string[];
  gap: string[];
} {
  const cvAdaptNorm = normalizarParaComparar(cvAdaptado);
  const cvOrigNorm  = normalizarParaComparar(cvOriginal);

  const integradas: string[] = [];
  const no_usadas_con_evidencia: string[] = [];
  const gap: string[] = [];

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
    console.warn(
      `[postulai] keywords con evidencia en original pero no integradas al CV adaptado: ${no_usadas_con_evidencia.join(", ")}`
    );
  }

  return {
    keywords_totales: keywords.length,
    keywords_encontradas: integradas.length,
    integradas,
    no_usadas_con_evidencia,
    gap,
  };
}

// ─── extracción de perfil profesional ────────────────────────────────────────

export function extraerPerfilProfesional(cvText: string): string | null {
  const lines = cvText.split("\n");
  let inPerfil = false;
  let skippedFirstSep = false;
  const collected: string[] = [];

  const isSepOnly = (l: string) =>
    l.trim().length > 1 && /^[─━—\-=_*~%]+$/.test(l.trim());
  const isNextSectionHeader = (l: string) => {
    const t = l.replace(/[—─━\-=_*~%\s]+$/, "").trim();
    return t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);
  };

  for (const line of lines) {
    if (/PERFIL\s+PROFESIONAL/i.test(line)) { inPerfil = true; continue; }
    if (!inPerfil) continue;

    if (!skippedFirstSep) {
      if (isSepOnly(line)) { skippedFirstSep = true; continue; }
      skippedFirstSep = true;
    }

    if (isNextSectionHeader(line)) break;
    collected.push(line);
  }

  if (!inPerfil) return null;
  return collected.join("\n").trim();
}

// ─── filtros anti-fabricación ────────────────────────────────────────────────

// Prefijos de marca ignorados en el fallback para que "Microsoft Excel"
// pase si el CV dice solo "Excel" o "Microsoft Office".
export const PREFIJOS_MARCA = new Set(["microsoft", "google", "adobe"]);

export function herramientaTieneRespaldo(
  herramienta: string,
  fuenteNorm: string
): boolean {
  const hNorm = normalizarParaComparar(herramienta);
  if (!hNorm) return true;
  if (fuenteNorm.includes(hNorm)) return true;
  // Fallback: todas las palabras significativas (≥4 chars, excl. prefijos de marca)
  // deben aparecer como palabra completa en la fuente.
  const palabras = hNorm.split(" ").filter(w => w.length >= 4 && !PREFIJOS_MARCA.has(w));
  if (palabras.length === 0) return false;
  return palabras.every(w => new RegExp(`\\b${w}\\b`).test(fuenteNorm));
}

export function limpiarHabilidadesTecnicas(
  cvText: string,
  fuenteOriginal: string
): string {
  const fuenteNorm = normalizarParaComparar(fuenteOriginal);
  const lines = cvText.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^(Habilidades|Herramientas) técnicas\s*:/i.test(trimmed)) {
      out.push(line);
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    const prefix    = trimmed.slice(0, colonIdx + 1);
    const toolsPart = trimmed.slice(colonIdx + 1).trim();
    const tools = toolsPart
      .split(/\s*·\s*|\s*,\s*/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const validas = tools.filter(tool => {
      const ok = herramientaTieneRespaldo(tool, fuenteNorm);
      if (!ok) console.warn(`[postulai] Habilidades técnicas: eliminando "${tool}" — sin respaldo en CV original`);
      return ok;
    });

    if (validas.length > 0) {
      const indent = line.slice(0, line.length - trimmed.length);
      out.push(`${indent}${prefix} ${validas.join(" · ")}`);
    }
  }

  return out.join("\n");
}

export function limpiarConocimientosEnDesarrollo(
  cvText: string,
  fuenteOriginal: string
): string {
  const fuenteNorm = normalizarParaComparar(fuenteOriginal);
  const lines = cvText.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^Conocimientos en desarrollo\s*:/i.test(trimmed)) {
      out.push(line);
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    const toolsPart = trimmed.slice(colonIdx + 1).trim();
    const tools = toolsPart
      .split(/\s*·\s*|\s*,\s*/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const validas = tools.filter(tool => {
      const ok = herramientaTieneRespaldo(tool, fuenteNorm);
      if (!ok) console.warn(`[postulai] Conocimientos en desarrollo: eliminando "${tool}" — sin respaldo en CV original`);
      return ok;
    });

    if (validas.length > 0) {
      const indent = line.slice(0, line.length - trimmed.length);
      out.push(`${indent}Conocimientos en desarrollo: ${validas.join(" · ")}`);
    }
  }

  return out.join("\n");
}

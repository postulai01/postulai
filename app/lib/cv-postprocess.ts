/**
 * Funciones de post-procesamiento de CV compartidas entre route.ts y los scripts de evals.
 * Importar desde aquí; nunca duplicar estas funciones.
 */

import { BLANDAS_PROHIBIDAS, esEstudiante, norm, seccionar } from "./cv-verificacion";

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

// ─── cifras sin respaldo ─────────────────────────────────────────────────────
// Compartido con evals/verificar.ts. Ignora fechas (MM/AAAA), años y líneas de contacto.

const LINEA_CONTACTO = /@|\+\s?56|m[oó]vil|tel[eé]fono|linkedin\.com/i;

const NUMEROS_EN_PALABRAS: Record<string, string> = {
  uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7",
  ocho: "8", nueve: "9", diez: "10", once: "11", doce: "12", veinte: "20", cien: "100",
  primer: "1", primero: "1", segundo: "2", tercer: "3", tercero: "3", cuarto: "4",
  quinto: "5", sexto: "6", septimo: "7", octavo: "8", noveno: "9", decimo: "10",
};

export function extraerCifras(texto: string): Set<string> {
  const cifras = new Set<string>();
  for (const linea of texto.split("\n")) {
    if (LINEA_CONTACTO.test(linea)) continue;
    const limpia = linea
      .replace(/\b\d{1,2}\/\d{4}\b/g, " ")        // fechas MM/AAAA
      .replace(/\b(19|20)\d{2}\b/g, " ");          // años
    for (const m of limpia.match(/\d+(?:[.,]\d+)*/g) ?? []) {
      cifras.add(/^\d{1,3}(\.\d{3})+$/.test(m) ? m.replace(/\./g, "") : m);
    }
  }
  return cifras;
}

export function cifraPresente(cifra: string, texto: string, cifrasTexto: Set<string>): boolean {
  if (cifrasTexto.has(cifra)) return true;
  const n = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return Object.entries(NUMEROS_EN_PALABRAS).some(
    ([palabra, valor]) => valor === cifra && new RegExp(`\\b${palabra}\\b`).test(n)
  );
}

export function cifrasSinRespaldo(cvAdaptado: string, fuenteOriginal: string): string[] {
  const cifrasFuente = extraerCifras(fuenteOriginal);
  return [...extraerCifras(cvAdaptado)].filter(c => !cifraPresente(c, fuenteOriginal, cifrasFuente));
}

// ─── disponibilidad inmediata ────────────────────────────────────────────────
// Si ningún cargo de EXPERIENCIA LABORAL dice "Presente", el candidato no es estudiante (ninguna
// línea de EDUCACIÓN en curso) y el perfil no menciona disponibilidad, agrega la frase al final
// del perfil. No revisa si la oferta fija fecha de inicio.

export const FRASE_DISPONIBILIDAD = "Disponible para incorporación inmediata.";

const esEncabezadoSeccion = (l: string) => {
  const t = l.replace(/[—─━\-=_*~%\s]+$/, "").trim();
  return t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t) && !/—\s*.+\d/.test(t);
};
const esSoloSeparador = (l: string) => l.trim().length > 1 && /^[─━—\-=_*~%]+$/.test(l.trim());

export function agregarDisponibilidad(cvText: string): string {
  const lines = cvText.split("\n");

  // ¿Hay algún cargo actual en EXPERIENCIA LABORAL?
  const iExp = lines.findIndex(l => /EXPERIENCIA\s+LABORAL/i.test(l) && esEncabezadoSeccion(l));
  if (iExp === -1) return cvText;
  let hayCargo = false;
  for (const l of lines.slice(iExp + 1)) {
    if (esSoloSeparador(l)) continue;
    if (esEncabezadoSeccion(l)) break;
    if (/—\s*.+\d/.test(l)) {
      hayCargo = true;
      if (/presente|actualidad/i.test(l)) return cvText;
    }
  }
  if (!hayCargo) return cvText;
  if (esEstudiante(seccionar(cvText))) return cvText;

  // Última línea no vacía del perfil
  const iPerfil = lines.findIndex(l => /PERFIL\s+PROFESIONAL/i.test(l));
  if (iPerfil === -1) return cvText;
  let ultima = -1;
  for (let i = iPerfil + 1; i < lines.length; i++) {
    if (esSoloSeparador(lines[i])) continue;
    if (esEncabezadoSeccion(lines[i])) break;
    if (lines[i].trim()) ultima = i;
  }
  if (ultima === -1) return cvText;
  const perfil = lines.slice(iPerfil + 1, ultima + 1).join(" ");
  if (/disponib/i.test(perfil)) return cvText;

  const linea = lines[ultima].replace(/\s+$/, "");
  lines[ultima] = /[.!?]$/.test(linea) ? `${linea} ${FRASE_DISPONIBILIDAD}` : `${linea}. ${FRASE_DISPONIBILIDAD}`;
  return lines.join("\n");
}

// ─── habilidades blandas prohibidas ──────────────────────────────────────────

export function limpiarHabilidadesBlandas(cvText: string): string {
  const out: string[] = [];
  for (const line of cvText.split("\n")) {
    const trimmed = line.trim();
    if (!/^Habilidades blandas\s*:/i.test(trimmed)) {
      out.push(line);
      continue;
    }
    const colonIdx = trimmed.indexOf(":");
    const prefix = trimmed.slice(0, colonIdx + 1);
    const items = trimmed.slice(colonIdx + 1).split(/\s*·\s*|\s*,\s*/).map(t => t.trim()).filter(Boolean);
    const validas = items.filter(item => {
      const prohibida = BLANDAS_PROHIBIDAS.find(([re]) => re.test(norm(item)));
      if (prohibida) console.warn(`[postulai] Habilidades blandas: eliminando "${item}" — frase prohibida (${prohibida[1]})`);
      return !prohibida;
    });
    if (validas.length > 0) {
      const indent = line.slice(0, line.length - trimmed.length);
      out.push(`${indent}${prefix} ${validas.join(" · ")}`);
    }
  }
  return out.join("\n");
}

// ─── términos internos del prompt en textos para el usuario ──────────────────

export function reemplazarTerminosInternos(texto: string): string {
  return texto.replace(/\bLA FUENTE\b/g, "tu CV original");
}

// ─── post-procesamiento determinista completo ────────────────────────────────
// Mismo orden en producción (route.ts) y en los evals.

export function postprocesarCV(cvText: string, fuenteOriginal: string): string {
  let cv = limpiarConocimientosEnDesarrollo(cvText, fuenteOriginal);
  cv = limpiarHabilidadesTecnicas(cv, fuenteOriginal);
  cv = limpiarHabilidadesBlandas(cv);
  cv = quitarDisponibilidadEstudiante(cv);
  cv = agregarDisponibilidad(cv);
  return cv;
}

// R-23: a un estudiante (alguna línea de EDUCACIÓN en curso) no se le indica disponibilidad.
// Elimina del perfil las oraciones que la mencionan.
export function quitarDisponibilidadEstudiante(cvText: string): string {
  if (!esEstudiante(seccionar(cvText))) return cvText;
  const lines = cvText.split("\n");
  const iPerfil = lines.findIndex(l => /PERFIL\s+PROFESIONAL/i.test(l));
  if (iPerfil === -1) return cvText;
  for (let i = iPerfil + 1; i < lines.length; i++) {
    if (esSoloSeparador(lines[i])) continue;
    if (esEncabezadoSeccion(lines[i])) break;
    if (!/disponib/i.test(lines[i])) continue;
    const oraciones = lines[i].match(/[^.!?]+[.!?]*/g) ?? [lines[i]];
    const quedan = oraciones.filter(o => !/disponib/i.test(o));
    console.warn(`[postulai] Perfil: eliminando disponibilidad en candidato estudiante ("${oraciones.filter(o => /disponib/i.test(o)).join(" ").trim()}")`);
    lines[i] = quedan.join("").trim();
  }
  return lines.join("\n");
}

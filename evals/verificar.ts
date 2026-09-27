/**
 * Verificador sin API: compara cada CV adaptado guardado en evals/resultados/
 * contra el CV original del caso y reporta violaciones objetivas de evals/spec-cv.md.
 *
 * Uso:
 *   npx tsx evals/verificar.ts                                  # último resultado de cada caso
 *   npx tsx evals/verificar.ts --hasta=2026-09-27T00-00-00      # último resultado anterior a esa fecha
 *   npx tsx evals/verificar.ts --desde=2026-09-27T01-00-00      # último resultado desde esa fecha
 *   npx tsx evals/verificar.ts --caso=camila_junior
 *   npx tsx evals/verificar.ts evals/resultados/<archivo>.json [...]
 *   npx tsx evals/verificar.ts --sin-detalle                    # solo la tabla
 *   npx tsx evals/verificar.ts --aplicar-postproceso            # aplica antes agregarDisponibilidad (como producción
 *                                                               # desde v10.3) a resultados guardados antes de ese cambio
 *
 * Revisa:
 *   cifras+    cifras del CV adaptado que no están en el original (P2)
 *   cifras-    cifras del original que no aparecen en el CV adaptado (P3). Las que se revisaron a mano y no son
 *              relevantes para la oferta se declaran en "cifras_no_relevantes" del caso y no se cuentan.
 *   verbos     verbo inicial (verbo base, sin importar el tiempo) repetido dentro de un cargo o en más de
 *              3 bullets de todo el CV (R-31)
 *   prohib     bullet que empieza con verbo prohibido, tercera persona, infinitivo o frase nominal (R-33)
 *   frases     frases prohibidas en el perfil (R-24, R-25) y en todo el CV (R-39)
 *   orden      orden de secciones según el nivel del caso y encabezados no estándar (R-10, R-11, R-75)
 *   brechas    brecha de 3+ meses entre dos cargos sin entrada cronológica (R-41, R-42); entrada de búsqueda
 *              en una brecha abierta hasta hoy, o perfil sin disponibilidad cuando no hay cargo actual (R-44, R-23;
 *              no se verifica si la oferta fija fecha de inicio). Solo líneas de cargo con fechas MM/AAAA.
 *   etiquetas  líneas de HABILIDADES sin etiqueta exacta y funciones en Habilidades técnicas (R-60, R-61)
 *   perfil     largo del perfil fuera de 50–100 palabras (R-21)
 *   ≈orig      bullet casi idéntico a una línea débil del original que conserva la debilidad (R-37)
 *              (verbo prohibido o frase prohibida; ese bullet también cuenta en prohib o frases)
 *   ≈info      bullets casi idénticos a una línea del original, débil o no (informativo, no suma al total)
 *
 * El nivel sale del campo "nivel" de evals/casos/<caso>.json: "practicante" (estudiante, practicante o
 * recién egresado con menos de 1 año de experiencia) va con EDUCACIÓN primero; junior, mid y senior, con
 * EXPERIENCIA LABORAL primero.
 */

import * as fs from "fs";
import * as path from "path";
import {
  extraerPerfilProfesional,
  extraerCifras,
  cifraPresente,
  agregarDisponibilidad,
} from "../app/lib/cv-postprocess";

// ─── normalización ────────────────────────────────────────────────────────────

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => sinTildes(s.toLowerCase());

// ─── estructura del CV ────────────────────────────────────────────────────────

const ENCABEZADOS = [
  "PERFIL PROFESIONAL", "EXPERIENCIA LABORAL", "EDUCACIÓN", "HABILIDADES", "IDIOMAS", "CERTIFICACIONES",
];
const ORDEN_EXPERIENCIA_PRIMERO = ENCABEZADOS;
const ORDEN_EDUCACION_PRIMERO = [
  "PERFIL PROFESIONAL", "EDUCACIÓN", "EXPERIENCIA LABORAL", "HABILIDADES", "IDIOMAS", "CERTIFICACIONES",
];

const esSeparador = (l: string) => l.trim().length > 1 && /^[─━—\-=_*~%]+$/.test(l.trim());
const esEncabezado = (l: string) => {
  const t = l.trim();
  return t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t) && !/—\s*.+\d/.test(t);
};

interface Seccion { titulo: string; lineas: string[] }

function seccionar(cv: string): Seccion[] {
  const lineas = cv.split("\n");
  const primera = lineas.findIndex(l => l.trim().length > 0); // nombre del candidato
  const secciones: Seccion[] = [];
  for (const l of lineas.slice(primera + 1)) {
    if (esSeparador(l)) continue;
    if (esEncabezado(l)) secciones.push({ titulo: l.trim(), lineas: [] });
    else if (secciones.length > 0) secciones[secciones.length - 1].lineas.push(l);
  }
  return secciones;
}

const esBullet = (l: string) => /^\s*[-•]\s+/.test(l);
const textoBullet = (l: string) => l.replace(/^\s*[-•]\s+/, "").trim();

// ─── cargos y fechas ──────────────────────────────────────────────────────────

interface Cargo { titulo: string; bullets: string[] }

function cargos(secciones: Seccion[]): Cargo[] {
  const exp = secciones.find(s => s.titulo === "EXPERIENCIA LABORAL");
  const out: Cargo[] = [];
  for (const l of exp?.lineas ?? []) {
    if (esBullet(l)) { if (out.length > 0) out[out.length - 1].bullets.push(textoBullet(l)); }
    else if (/—\s*.+\d/.test(l) || /per[ií]odo de b[uú]squeda/i.test(l)) out.push({ titulo: l.trim(), bullets: [] });
  }
  return out;
}

// Mes absoluto (año*12 + mes) de inicio y fin; fin null = Presente. null si la línea no tiene MM/AAAA.
function fechasCargo(linea: string): { inicio: number; fin: number | null } | null {
  const m = linea.match(/(\d{1,2})\/(\d{4})\s*[–-]\s*(?:(\d{1,2})\/(\d{4})|(presente|actualidad))/i);
  if (!m) return null;
  const inicio = Number(m[2]) * 12 + Number(m[1]);
  const fin = m[5] ? null : Number(m[4]) * 12 + Number(m[3]);
  return { inicio, fin };
}

const mesTexto = (abs: number) => { const y = Math.floor((abs - 1) / 12); const mm = abs - y * 12; return `${String(mm).padStart(2, "0")}/${y}`; };

// ─── verbos ───────────────────────────────────────────────────────────────────

const IRREGULARES: Record<string, string> = {
  conduje: "conduc", conduzco: "conduc", reduje: "reduc", reduzco: "reduc", produje: "produc",
  produzco: "produc", introduje: "introduc", introduzco: "introduc", traduje: "traduc", traduzco: "traduc",
  hice: "hac", hago: "hac", puse: "pon", pongo: "pon", estuve: "est", estoy: "est", fui: "ser", soy: "ser",
  tuve: "ten", tengo: "ten", obtuve: "obten", obtengo: "obten", mantuve: "manten", mantengo: "manten",
  dirijo: "dirig", elijo: "elig", exijo: "exig", corrijo: "correg", corregi: "correg",
  construyo: "constru", construi: "constru", contribuyo: "contribu", contribui: "contribu",
  incluyo: "inclu", inclui: "inclu", distribuyo: "distribu", distribui: "distribu",
  comienzo: "comenz", empiezo: "empez", ofrezco: "ofrec", establezco: "establec",
  fortalezco: "fortalec", promuevo: "promov", resuelvo: "resolv", muestro: "mostr",
  demuestro: "demostr", encuentro: "encontr", pruebo: "prob", sostengo: "sosten", sostuve: "sosten",
};

function raizVerbo(palabra: string): string {
  const n = norm(palabra);
  if (IRREGULARES[n]) return IRREGULARES[n];
  if (n.endsWith("que")) return n.slice(0, -3) + "c";   // busqué → busc
  if (n.endsWith("gue")) return n.slice(0, -3) + "g";   // negué → neg
  if (n.endsWith("ce")) return n.slice(0, -2) + "z";    // comercialicé → comercializ
  if (/[oei]$/.test(n)) return n.slice(0, -1);           // gestioné / gestiono → gestion
  return n;
}

const RAICES_PROHIBIDAS: [RegExp, string][] = [
  [/^realiz/, "realizar"], [/^particip/, "participar"], [/^apoy/, "apoyar"], [/^contribu/, "contribuir"],
  [/^colabor/, "colaborar"], [/^ayud/, "ayudar"], [/^asist/, "asistir"],
];

function verboProhibido(bullet: string): string | null {
  const n = norm(bullet);
  if (/^(estuve|estoy|estaba) a cargo/.test(n)) return "estar a cargo de";
  if (/^(fui|soy|era) responsable/.test(n)) return "ser responsable de";
  if (/^(encargad[oa]|responsable|a cargo)\b/.test(n)) return "frase nominal";
  const primera = bullet.split(/\s+/)[0].replace(/[^\p{L}]/gu, "");
  const raiz = raizVerbo(primera);
  for (const [re, nombre] of RAICES_PROHIBIDAS) if (re.test(raiz)) return nombre;
  if (/ó$/.test(primera)) return "tercera persona";
  if (/(ar|er|ir)$/i.test(primera)) return "infinitivo";
  return null;
}

// ─── frases prohibidas ────────────────────────────────────────────────────────

const FRASES_CV: [RegExp, string][] = [
  [/\bmultifuncional/, "multifuncional"], [/\bproactiv/, "proactivo"], [/\bdinamic[oa]s?\b/, "dinámico"],
  [/\bsinergia/, "sinergia"], [/\bpotenciando\b/, "potenciando"], [/\bresguardando\b/, "resguardando"],
  [/\bgestion integral\b/, "gestión integral"], [/\bciclo completo\b/, "ciclo completo"],
  [/\bend[- ]to[- ]end\b/, "end-to-end"], [/\bde principio a fin\b/, "de principio a fin"],
  [/\bcubriendo todas las etapas\b/, "cubriendo todas las etapas"],
  [/\bdesde\b[^.;\n]{1,60}?\bhasta\b/, "desde X hasta Y"],
  [/\b(apoyando|contribuyendo|colaborando|aportando|participando)\b/, "gerundio de soporte"],
];

const FRASES_PERFIL: [RegExp, string][] = [
  [/\bapasionad[oa]/, "apasionado"], [/\binnovador/, "innovador"], [/\borientad[oa] a resultados\b/, "orientado a resultados"],
  [/\bnuevos desafios\b/, "nuevos desafíos"], [/\bganas de aprender\b/, "ganas de aprender"],
  [/\bsoy una persona\b/, "soy una persona"], [/\bme considero\b/, "me considero"], [/\byo\b/, "yo"],
  [/\bbusc[oa]\b/, "busco/busca"], [/\ben busqueda de\b/, "en búsqueda de"],
  [/\b(apoy|aport|contribu|colabor)(?!ador|acion|ucion)\w*/, "verbo de soporte"], [/\basist(?!ente|encia)\w*/, "asistir"],
  [/\bproductivo-comercial\b/, "productivo-comercial"], [/\boperativo-comercial\b/, "operativo-comercial"],
  [/\bha (liderado|desarrollado|gestionado|dirigido|coordinado|implementado)\b/, "tercera persona"],
];

// ─── funciones en Habilidades técnicas ───────────────────────────────────────

const FUNCION_EN_TECNICAS = /\b(seleccion|reclutamiento|entrevista|analisis|gestion|atencion|psicometri|negociacion|liderazgo|planificacion|evaluacion|coordinacion|comunicacion|ventas|capacitacion|administracion de|control de)/;

// ─── similitud de bullets ─────────────────────────────────────────────────────

const tokens = (s: string) => norm(s).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

function similitud(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const dp: number[] = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return (2 * dp[b.length]) / (a.length + b.length);
}

const UMBRAL_CASI_IDENTICO = 0.8;

// ─── verificación ─────────────────────────────────────────────────────────────

type Nivel = "practicante" | "junior" | "mid" | "senior";

interface Reporte {
  archivo: string;
  caso: string;
  nivel: Nivel | "?";
  costo: number | null;
  palabrasPerfil: number;
  v: Record<string, string[]>;
}

const TIPOS = ["cifras+", "cifras-", "verbos", "prohib", "frases", "orden", "brechas", "etiquetas", "perfil", "≈orig"] as const;
const INFORMATIVOS = ["≈info"] as const;

const esDebil = (linea: string) =>
  verboProhibido(linea) !== null || FRASES_CV.some(([re]) => re.test(norm(linea)));

function verificar(archivo: string): Reporte {
  const resultado = JSON.parse(fs.readFileSync(archivo, "utf-8"));
  const caso: string = resultado.caso ?? path.basename(archivo).replace(/-\d{4}-\d{2}-\d{2}T.*$/, "");
  const casoJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals/casos", `${caso}.json`), "utf-8"));
  const original: string = casoJson.cv_texto;
  const nivel: Nivel | "?" = casoJson.nivel ?? "?";
  const cv: string = APLICAR_POSTPROCESO
    ? agregarDisponibilidad(resultado.cv_adaptado ?? "")
    : (resultado.cv_adaptado ?? "");

  const v: Record<string, string[]> = Object.fromEntries([...TIPOS, ...INFORMATIVOS].map(t => [t, [] as string[]]));
  const secciones = seccionar(cv);
  const bullets = secciones.flatMap(s => s.lineas.filter(esBullet).map(textoBullet));

  // cifras
  const cifrasOrig = extraerCifras(original);
  const cifrasCv = extraerCifras(cv);
  for (const c of cifrasCv) if (!cifraPresente(c, original, cifrasOrig)) v["cifras+"].push(c);
  const noRelevantes = new Set<string>(casoJson.cifras_no_relevantes ?? []);
  for (const c of cifrasOrig) if (!noRelevantes.has(c) && !cifraPresente(c, cv, cifrasCv)) v["cifras-"].push(c);

  // verbos iniciales repetidos: dentro de un cargo, y más de 3 en todo el CV
  const primeraPalabra = (b: string) => b.split(/\s+/)[0].replace(/[^\p{L}]/gu, "");
  const porRaiz = new Map<string, string[]>();
  for (const b of bullets) {
    const primera = primeraPalabra(b);
    if (!primera) continue;
    const raiz = raizVerbo(primera);
    porRaiz.set(raiz, [...(porRaiz.get(raiz) ?? []), primera]);
  }
  for (const usos of porRaiz.values()) if (usos.length > 3) v["verbos"].push(`CV: ${usos.join("/")} (×${usos.length})`);
  for (const cargo of cargos(secciones)) {
    const vistos = new Map<string, string[]>();
    for (const b of cargo.bullets) {
      const primera = primeraPalabra(b);
      if (!primera) continue;
      const raiz = raizVerbo(primera);
      vistos.set(raiz, [...(vistos.get(raiz) ?? []), primera]);
    }
    for (const usos of vistos.values()) {
      if (usos.length > 1) v["verbos"].push(`cargo "${cargo.titulo.slice(0, 40)}": ${usos.join("/")}`);
    }
  }

  // verbos prohibidos al inicio
  for (const b of bullets) {
    const motivo = verboProhibido(b);
    if (motivo) v["prohib"].push(`${motivo}: "${b.slice(0, 70)}"`);
  }

  // frases prohibidas
  const perfil = extraerPerfilProfesional(cv) ?? "";
  const perfilNorm = norm(perfil);
  for (const [re, nombre] of FRASES_PERFIL) {
    const m = perfilNorm.match(re);
    if (m) v["frases"].push(`perfil · ${nombre}: "${m[0]}"`);
  }
  const cuerpo = secciones.flatMap(s => s.lineas).join("\n");
  for (const [re, nombre] of FRASES_CV) {
    for (const linea of cuerpo.split("\n")) {
      const m = norm(linea).match(re);
      if (m) v["frases"].push(`${nombre}: "${m[0]}"`);
    }
  }

  // orden de secciones
  const titulos = secciones.map(s => s.titulo);
  for (const t of titulos) if (!ENCABEZADOS.includes(t)) v["orden"].push(`encabezado no estándar: ${t}`);
  if (!titulos.includes("PERFIL PROFESIONAL")) v["orden"].push("falta PERFIL PROFESIONAL");
  if (nivel !== "?") {
    const esperado = nivel === "practicante" ? ORDEN_EDUCACION_PRIMERO : ORDEN_EXPERIENCIA_PRIMERO;
    const presentes = titulos.filter(t => esperado.includes(t));
    const ordenEsperado = esperado.filter(t => presentes.includes(t));
    if (presentes.join("|") !== ordenEsperado.join("|")) {
      v["orden"].push(`${nivel}: ${presentes.join(" → ")} (esperado ${ordenEsperado.join(" → ")})`);
    }
  }

  // brechas
  const entradas = cargos(secciones).map(c => ({ ...c, fechas: fechasCargo(c.titulo) }));
  const esBusqueda = (t: string) => /per[ií]odo de b[uú]squeda/i.test(t);
  const reales = entradas.filter(e => !esBusqueda(e.titulo) && e.fechas).sort((a, b) => a.fechas!.inicio - b.fechas!.inicio);
  const busquedas = entradas.filter(e => esBusqueda(e.titulo));
  for (let i = 1; i < reales.length; i++) {
    const fin = reales[i - 1].fechas!.fin, inicio = reales[i].fechas!.inicio;
    if (fin === null) continue;
    const meses = inicio - fin - 1;
    if (meses < 3) continue;
    const cubierta = busquedas.some(b => b.fechas && b.fechas.inicio > fin && b.fechas.inicio < inicio);
    if (!cubierta) v["brechas"].push(`brecha de ${meses} meses entre cargos (${mesTexto(fin)} → ${mesTexto(inicio)}) sin entrada cronológica`);
  }
  const hayActual = entradas.some(e => !esBusqueda(e.titulo) && /presente|actualidad/i.test(e.titulo));
  if (!hayActual && reales.length > 0) {
    const ultimoFin = Math.max(...reales.map(r => r.fechas!.fin ?? r.fechas!.inicio));
    for (const b of busquedas) {
      if (!b.fechas || b.fechas.fin === null || b.fechas.inicio > ultimoFin) {
        v["brechas"].push(`entrada de búsqueda en brecha abierta hasta hoy: "${b.titulo.slice(0, 60)}"`);
      }
    }
    if (!/disponib/i.test(perfil)) v["brechas"].push("sin cargo actual y el perfil no indica disponibilidad");
  }

  // etiquetas de habilidades
  const habilidades = secciones.find(s => s.titulo === "HABILIDADES");
  if (!habilidades) v["etiquetas"].push("falta sección HABILIDADES");
  for (const l of habilidades?.lineas ?? []) {
    const t = l.trim();
    if (!t) continue;
    if (!/^(Habilidades técnicas|Habilidades blandas|Conocimientos en desarrollo):/.test(t)) {
      v["etiquetas"].push(`etiqueta no exacta: "${t.slice(0, 50)}"`);
      continue;
    }
    if (t.startsWith("Habilidades técnicas:")) {
      for (const item of t.slice(t.indexOf(":") + 1).split(/\s*·\s*/).map(x => x.trim()).filter(Boolean)) {
        if (FUNCION_EN_TECNICAS.test(norm(item))) v["etiquetas"].push(`función en técnicas: ${item}`);
      }
    }
  }

  // largo del perfil
  const palabrasPerfil = perfil.split(/\s+/).filter(Boolean).length;
  if (palabrasPerfil < 50 || palabrasPerfil > 100) v["perfil"].push(`${palabrasPerfil} palabras`);

  // bullets casi idénticos al original
  const lineasOrig = original.split("\n").map(l => l.replace(/^\s*[-•]\s*/, "").trim()).filter(l => l.length > 20);
  const tokOrig = lineasOrig.map(tokens);
  for (const b of bullets) {
    const tb = tokens(b);
    let mejor = 0, idx = -1;
    tokOrig.forEach((to, i) => { const s = similitud(tb, to); if (s > mejor) { mejor = s; idx = i; } });
    if (mejor < UMBRAL_CASI_IDENTICO) continue;
    const detalleSim = `${mejor.toFixed(2)} "${b.slice(0, 60)}" ≈ "${lineasOrig[idx].slice(0, 60)}"`;
    v["≈info"].push(detalleSim);
    if (esDebil(lineasOrig[idx]) && esDebil(b)) v["≈orig"].push(detalleSim);
  }

  return {
    archivo: path.basename(archivo), caso, nivel,
    costo: typeof resultado.costo_adaptacion === "number" ? resultado.costo_adaptacion : null,
    palabrasPerfil, v,
  };
}

const APLICAR_POSTPROCESO = process.argv.includes("--aplicar-postproceso");

// ─── selección de archivos ────────────────────────────────────────────────────

function seleccionar(): { archivos: string[]; detalle: boolean } {
  const args = process.argv.slice(2);
  const opt = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.split("=")[1];
  const detalle = !args.includes("--sin-detalle");
  const explicitos = args.filter(a => !a.startsWith("--"));
  if (explicitos.length > 0) return { archivos: explicitos, detalle };

  const dir = path.join(process.cwd(), "evals/resultados");
  const desde = opt("desde"), hasta = opt("hasta"), soloCaso = opt("caso");
  const ultimos = new Map<string, { ts: string; archivo: string }>();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    const [, caso, ts] = m;
    if (!fs.existsSync(path.join(process.cwd(), "evals/casos", `${caso}.json`))) continue;
    if (soloCaso && caso !== soloCaso) continue;
    if (desde && ts < desde) continue;
    if (hasta && ts >= hasta) continue;
    const previo = ultimos.get(caso);
    if (!previo || ts > previo.ts) ultimos.set(caso, { ts, archivo: path.join(dir, f) });
  }
  return { archivos: [...ultimos.values()].map(x => x.archivo).sort(), detalle };
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  const { archivos, detalle } = seleccionar();
  if (archivos.length === 0) { console.error("❌  No hay resultados que verificar."); process.exit(1); }

  const reportes = archivos.map(verificar);

  const cols = ["caso", "nivel", ...TIPOS, "total", ...INFORMATIVOS, "costo"];
  const filas = reportes.map(r => {
    const n = TIPOS.map(t => String(r.v[t].length));
    const total = TIPOS.reduce((s, t) => s + r.v[t].length, 0);
    const info = INFORMATIVOS.map(t => String(r.v[t].length));
    return [r.caso, r.nivel, ...n, String(total), ...info, r.costo === null ? "—" : `$${r.costo.toFixed(4)}`];
  });
  const anchos = cols.map((c, i) => Math.max(c.length, ...filas.map(f => f[i].length)));
  const linea = (f: string[]) => f.map((x, i) => x.padEnd(anchos[i])).join("  ");
  console.log(`\n${linea(cols)}\n${anchos.map(a => "─".repeat(a)).join("  ")}`);
  for (const f of filas) console.log(linea(f));

  if (detalle) {
    for (const r of reportes) {
      console.log(`\n■ ${r.caso} — ${r.archivo} (perfil: ${r.palabrasPerfil} palabras)`);
      for (const t of TIPOS) for (const d of r.v[t]) console.log(`  [${t}] ${d}`);
    }
  }
  console.log("");
}

main();

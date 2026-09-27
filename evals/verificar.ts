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
 *
 * Revisa:
 *   cifras+    cifras del CV adaptado que no están en el original (P2)
 *   cifras-    cifras del original que no aparecen en el CV adaptado (P3; revisar relevancia a mano)
 *   verbos>2   verbo inicial (verbo base, sin importar el tiempo) en más de dos bullets (R-31)
 *   prohib     bullet que empieza con verbo prohibido, tercera persona, infinitivo o frase nominal (R-33)
 *   frases     frases prohibidas en el perfil (R-24, R-25) y en todo el CV (R-39)
 *   orden      orden de secciones según el nivel del caso y encabezados no estándar (R-10, R-11, R-75)
 *   etiquetas  líneas de HABILIDADES sin etiqueta exacta y funciones en Habilidades técnicas (R-60, R-61)
 *   perfil     largo del perfil fuera de 50–100 palabras (R-21)
 *   ≈orig      bullet casi idéntico a una línea débil del original que conserva la debilidad (R-37)
 *              (verbo prohibido o frase prohibida; ese bullet también cuenta en prohib o frases)
 *   ≈info      bullets casi idénticos a una línea del original, débil o no (informativo, no suma al total)
 *
 * El nivel sale del campo "nivel" de evals/casos/<caso>.json.
 */

import * as fs from "fs";
import * as path from "path";
import { extraerPerfilProfesional } from "../app/lib/cv-postprocess";

// ─── normalización ────────────────────────────────────────────────────────────

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => sinTildes(s.toLowerCase());

const LINEA_CONTACTO = /@|\+\s?56|m[oó]vil|tel[eé]fono|linkedin\.com/i;

const NUMEROS_EN_PALABRAS: Record<string, string> = {
  uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7",
  ocho: "8", nueve: "9", diez: "10", once: "11", doce: "12", veinte: "20", cien: "100",
  primer: "1", primero: "1", segundo: "2", tercer: "3", tercero: "3", cuarto: "4",
  quinto: "5", sexto: "6", septimo: "7", octavo: "8", noveno: "9", decimo: "10",
};

function extraerCifras(texto: string): Set<string> {
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

function cifraPresente(cifra: string, texto: string, cifrasTexto: Set<string>): boolean {
  if (cifrasTexto.has(cifra)) return true;
  const n = norm(texto);
  return Object.entries(NUMEROS_EN_PALABRAS).some(
    ([palabra, valor]) => valor === cifra && new RegExp(`\\b${palabra}\\b`).test(n)
  );
}

// ─── estructura del CV ────────────────────────────────────────────────────────

const ENCABEZADOS = [
  "PERFIL PROFESIONAL", "EXPERIENCIA LABORAL", "EDUCACIÓN", "HABILIDADES", "IDIOMAS", "CERTIFICACIONES",
];
const ORDEN_MID_SENIOR = ENCABEZADOS;
const ORDEN_PRACTICANTE_JUNIOR = [
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

const TIPOS = ["cifras+", "cifras-", "verbos>2", "prohib", "frases", "orden", "etiquetas", "perfil", "≈orig"] as const;
const INFORMATIVOS = ["≈info"] as const;

const esDebil = (linea: string) =>
  verboProhibido(linea) !== null || FRASES_CV.some(([re]) => re.test(norm(linea)));

function verificar(archivo: string): Reporte {
  const resultado = JSON.parse(fs.readFileSync(archivo, "utf-8"));
  const caso: string = resultado.caso ?? path.basename(archivo).replace(/-\d{4}-\d{2}-\d{2}T.*$/, "");
  const casoJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals/casos", `${caso}.json`), "utf-8"));
  const original: string = casoJson.cv_texto;
  const nivel: Nivel | "?" = casoJson.nivel ?? "?";
  const cv: string = resultado.cv_adaptado ?? "";

  const v: Record<string, string[]> = Object.fromEntries([...TIPOS, ...INFORMATIVOS].map(t => [t, [] as string[]]));
  const secciones = seccionar(cv);
  const bullets = secciones.flatMap(s => s.lineas.filter(esBullet).map(textoBullet));

  // cifras
  const cifrasOrig = extraerCifras(original);
  const cifrasCv = extraerCifras(cv);
  for (const c of cifrasCv) if (!cifraPresente(c, original, cifrasOrig)) v["cifras+"].push(c);
  for (const c of cifrasOrig) if (!cifraPresente(c, cv, cifrasCv)) v["cifras-"].push(c);

  // verbos iniciales repetidos
  const porRaiz = new Map<string, string[]>();
  for (const b of bullets) {
    const primera = b.split(/\s+/)[0].replace(/[^\p{L}]/gu, "");
    if (!primera) continue;
    const raiz = raizVerbo(primera);
    porRaiz.set(raiz, [...(porRaiz.get(raiz) ?? []), primera]);
  }
  for (const usos of porRaiz.values()) if (usos.length > 2) v["verbos>2"].push(`${usos.join("/")} (×${usos.length})`);

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
    const esperado = nivel === "practicante" || nivel === "junior" ? ORDEN_PRACTICANTE_JUNIOR : ORDEN_MID_SENIOR;
    const presentes = titulos.filter(t => esperado.includes(t));
    const ordenEsperado = esperado.filter(t => presentes.includes(t));
    if (presentes.join("|") !== ordenEsperado.join("|")) {
      v["orden"].push(`${nivel}: ${presentes.join(" → ")} (esperado ${ordenEsperado.join(" → ")})`);
    }
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

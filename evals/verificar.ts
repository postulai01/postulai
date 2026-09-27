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
 *   npx tsx evals/verificar.ts --aplicar-postproceso            # aplica antes postprocesarCV (filtros de habilidades y
 *                                                               # disponibilidad, como producción) a resultados guardados
 *
 * Revisa:
 *   cifras+    cifras del CV adaptado que no están en el original (P2)
 *   cifras-    cifras del original que no aparecen en el CV adaptado (P3). Las que se revisaron a mano y no son
 *              relevantes para la oferta se declaran en "cifras_no_relevantes" del caso y no se cuentan.
 *   verbos     verbo inicial (verbo base, sin importar el tiempo) repetido dentro de un cargo o en más de
 *              3 bullets de todo el CV (R-31)
 *   prohib     bullet que empieza con verbo prohibido, tercera persona, infinitivo o frase nominal (R-33)
 *   frases     frases prohibidas en el perfil (R-24, R-25), en todo el CV (R-39) y en Habilidades blandas (R-62)
 *   orden      orden de secciones según el nivel del caso y encabezados no estándar (R-10, R-11, R-75)
 *   brechas    brecha de 3+ meses entre dos cargos sin entrada cronológica (R-41, R-42); entrada de búsqueda
 *              en una brecha abierta hasta hoy; perfil sin disponibilidad cuando no hay cargo actual y el
 *              candidato no es estudiante, o con disponibilidad siendo estudiante (R-44, R-23; no se verifica
 *              si la oferta fija fecha de inicio). Solo líneas de cargo con fechas MM/AAAA.
 *   etiquetas  líneas de HABILIDADES sin etiqueta exacta y funciones en Habilidades técnicas (R-60, R-61)
 *   perfil     largo del perfil fuera de 50–100 palabras (R-21)
 *   cargo      el perfil no nombra el cargo de la oferta (R-20). El cargo sale de titulo_postulacion del
 *              resultado o, si no está, del campo "cargo_oferta" del caso.
 *   educación  líneas bajo EDUCACIÓN que no son carrera e institución ni una excepción de R-51
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
  postprocesarCV,
} from "../app/lib/cv-postprocess";
import {
  norm, ENCABEZADOS, seccionar, esBullet, textoBullet, cargos, esCargoActual, fechasCargo, esEstudiante,
  raizVerbo, primeraPalabra, verboProhibido, verbosRepetidosEnCargo, FRASES_CV, FRASES_PERFIL,
  BLANDAS_PROHIBIDAS, FUNCION_EN_TECNICAS, cargoDesdeTitulo, perfilNombraCargo, lineasExtraEducacion,
} from "../app/lib/cv-verificacion";

const ORDEN_EXPERIENCIA_PRIMERO = ENCABEZADOS;
const ORDEN_EDUCACION_PRIMERO = [
  "PERFIL PROFESIONAL", "EDUCACIÓN", "EXPERIENCIA LABORAL", "HABILIDADES", "IDIOMAS", "CERTIFICACIONES",
];

const mesTexto = (abs: number) => { const y = Math.floor((abs - 1) / 12); const mm = abs - y * 12; return `${String(mm).padStart(2, "0")}/${y}`; };

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

const TIPOS = ["cifras+", "cifras-", "verbos", "prohib", "frases", "cargo", "orden", "educación", "brechas", "etiquetas", "perfil", "≈orig"] as const;
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
    ? postprocesarCV(resultado.cv_adaptado ?? "", original)
    : (resultado.cv_adaptado ?? "");
  const cargoOferta: string | null = cargoDesdeTitulo(resultado.titulo_postulacion) ?? casoJson.cargo_oferta ?? null;

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
  const porRaiz = new Map<string, string[]>();
  for (const b of bullets) {
    const primera = primeraPalabra(b);
    if (!primera) continue;
    const raiz = raizVerbo(primera);
    porRaiz.set(raiz, [...(porRaiz.get(raiz) ?? []), primera]);
  }
  for (const usos of porRaiz.values()) if (usos.length > 3) v["verbos"].push(`CV: ${usos.join("/")} (×${usos.length})`);
  for (const cargo of cargos(secciones)) {
    for (const r of verbosRepetidosEnCargo(cargo)) {
      v["verbos"].push(`cargo "${cargo.titulo.slice(0, 40)}": ${r.verbo} repetido ("${r.bullet.slice(0, 50)}")`);
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

  // habilidades blandas prohibidas (R-62)
  for (const l of cuerpo.split("\n").filter(x => /^\s*Habilidades blandas\s*:/i.test(x))) {
    for (const [re, nombre] of BLANDAS_PROHIBIDAS) if (re.test(norm(l))) v["frases"].push(`blandas · ${nombre}`);
  }

  // cargo de la oferta en el perfil (R-20)
  if (cargoOferta && perfil && !perfilNombraCargo(perfil, cargoOferta)) v["cargo"].push(`no nombra "${cargoOferta}"`);

  // líneas extra en EDUCACIÓN (R-51)
  for (const e of lineasExtraEducacion(secciones)) v["educación"].push(`"${e.texto.slice(0, 70)}"`);

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
  const hayActual = entradas.some(e => !esBusqueda(e.titulo) && esCargoActual(e.titulo));
  const estudiante = esEstudiante(secciones);
  if (estudiante && /disponib/i.test(perfil)) v["brechas"].push("estudiante con disponibilidad en el perfil (R-23)");
  if (!hayActual && reales.length > 0 && !estudiante) {
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

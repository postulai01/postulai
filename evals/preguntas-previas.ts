/**
 * Eval de las preguntas previas (PED-5) sobre los casos del set.
 *
 * Uso:
 *   npx tsx evals/preguntas-previas.ts [caso ...]              # sin API: respuestas del modelo guardadas (o solo plantillas)
 *   npx tsx evals/preguntas-previas.ts [caso ...] --estimar    # costo estimado de --ejecutar
 *   npx tsx evals/preguntas-previas.ts [caso ...] --ejecutar   # UNA llamada a Haiku por CV (resúmenes y definiciones)
 * Guarda las respuestas en evals/preguntas/<caso>.json (por texto del system + prompt: si cambia, se vuelve a pedir).
 *
 * Chequeos: ≤ 15 palabras, "¿…?", sin comillas, sin "agrégalo", definiciones sin tuteo. Simulación en SIMULADOS:
 * todo "si" (CV antes → después, inserción en código) y todo "no" (CV idéntico). 0 mentiras: cada palabra nueva de una línea cambiada está
 * en el CV o en una declaración.
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { informeFit } from "../app/lib/informe-fit";
import {
  aplicarRespuestas, armarPreguntas, cvConDeclaraciones, llamarModelo, mapeoConDeclaraciones, palabrasSignificativas,
  pedidoModelo, preguntaValida, promptPrevias, SYSTEM_PREVIAS, type AnalisisPrevio, type RespuestaModelo,
} from "../app/lib/preguntas-previas";
import { definicionValida } from "../app/lib/glosario";
import { informeDelCaso, loadEnv } from "./lib-casos";

const CASOS = [
  "andres_senior", "andres_asap_antofagasta", "andres_vallenar", "pedro_tricolor", "pedro_conectatalentos",
  "camila_junior", "roberto_brecha", "roberto_mercadolibre", "camila_telecom", "valentina_teamwork",
  "valentina_asistente_do", "valentina_cambio_rubro", "pedro_xepelin", "pedro_cencomalls", "roberto_bluelight",
];
const SIMULADOS = ["pedro_tricolor", "valentina_cambio_rubro", "andres_asap_antofagasta"];
const DIR = path.join(process.cwd(), "evals/preguntas");
// Haiku 4.5: $1 / $5 por MTok
const PRECIO_IN = 1, PRECIO_OUT = 5, CHARS_POR_TOKEN = 2.1;
const costo = (u: { input_tokens: number; output_tokens: number }) => (u.input_tokens * PRECIO_IN + u.output_tokens * PRECIO_OUT) / 1e6;

interface Guardado {
  prompt?: string; respuesta?: RespuestaModelo; costo?: number;
}

async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes("--ejecutar"), estimar = args.includes("--estimar");
  const pedidos = args.filter(a => !a.startsWith("--"));
  const casos = pedidos.length ? pedidos : CASOS;
  if (ejecutar) loadEnv();
  const client = ejecutar ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : undefined;
  fs.mkdirSync(DIR, { recursive: true });

  let gastado = 0, estimado = 0;
  const problemas: string[] = [];
  const filas: { caso: string; analisis: AnalisisPrevio }[] = [];

  for (const caso of casos) {
    const base = await informeDelCaso(caso);
    const { ctx, informe } = base;
    const cv: string = ctx.casoJson.cv_texto;
    const archivo = path.join(DIR, `${caso}.json`);
    const g: Guardado = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, "utf-8")) : {};

    // 1. Resúmenes y definiciones (una llamada por CV, solo si hace falta).
    const pedido = pedidoModelo(informe, ctx.keywordsJD, cv);
    // La caché se invalida si cambia el system o el prompt.
    const prompt = pedido ? `${SYSTEM_PREVIAS}\n---\n${promptPrevias(pedido.resumenes, pedido.terminos)}` : undefined;
    let respuesta: RespuestaModelo = g.prompt === prompt ? g.respuesta ?? {} : {};
    // Sin --ejecutar, de una caché de otro prompt se reutiliza solo lo que sigue valiendo: definiciones por término y
    // resúmenes cuyo par "id. línea" estaba en el prompt guardado.
    if (pedido && g.prompt !== prompt && !client && g.respuesta && g.prompt) {
      respuesta = {
        definiciones: g.respuesta.definiciones?.filter(d => pedido.terminos.includes(d.termino)),
        resumenes: g.respuesta.resumenes?.filter(r => pedido.resumenes.some(x => x.id === Number(r.id) && g.prompt!.includes(`\n${x.id}. ${x.linea}\n`))),
      };
      const falta = pedido.terminos.some(t => !respuesta.definiciones?.some(d => d.termino === t))
        || pedido.resumenes.some(x => !respuesta.resumenes?.some(r => Number(r.id) === x.id));
      if (!falta) Object.assign(g, { prompt }); // todo lo pedido estaba en la caché: queda vigente
    }
    if (pedido && g.prompt !== prompt) {
      estimado += (prompt!.length / CHARS_POR_TOKEN * PRECIO_IN + 150 * PRECIO_OUT) / 1e6;
      if (client) {
        const r = await llamarModelo(pedido, client);
        respuesta = r.respuesta;
        gastado += costo(r.usage);
        Object.assign(g, { prompt, respuesta, costo: costo(r.usage) });
      }
    }
    const analisis = armarPreguntas(informe, ctx.keywordsJD, cv, respuesta);
    filas.push({ caso, analisis });

    for (const p of analisis.preguntas) {
      if (!preguntaValida(p.texto)) problemas.push(`${caso}: pregunta inválida (${p.palabras} palabras): ${p.texto}`);
      if (p.definicion && !definicionValida(p.definicion.texto)) problemas.push(`${caso}: definición inválida: ${p.definicion.texto}`);
    }

    // 2. Simulación de respuestas.
    if (SIMULADOS.includes(caso)) {
      const todo = (r: "si" | "no") => Object.fromEntries(analisis.preguntas.map(p => [p.id, r]));
      const no = aplicarRespuestas(analisis, todo("no"));
      if (no.hechos.length > 0 || cvConDeclaraciones(cv, no.hechos) !== cv) problemas.push(`${caso}: con todo "no" el CV cambia`);

      const { hechos } = aplicarRespuestas(analisis, todo("si"));
      const mapeo = mapeoConDeclaraciones(base.resultado, hechos);
      // Inserción en código, sin modelo: viñetas nombradas con la keyword entre paréntesis; el resto a habilidades.
      const despues = cvConDeclaraciones(cv, hechos);
      const pares: { antes: string; despues: string }[] = [];
      const lineasAntes = cv.split("\n");
      for (const l of despues.split("\n").filter(l => !lineasAntes.includes(l))) {
        const etiqueta = l.split(":")[0];
        const original = lineasAntes.find(a => a.trim() && l.startsWith(a.replace(/\.?\s*$/, "")))
          ?? lineasAntes.find(a => a.includes(":") && a.split(":")[0] === etiqueta);
        pares.push({ antes: original ?? "(línea nueva)", despues: l });
      }

      // 0 mentiras: toda palabra nueva de una línea cambiada está en el CV original o en una declaración.
      // "Conocimientos" es la etiqueta de la línea nueva, no una afirmación.
      const respaldo = new Set([...palabrasSignificativas(cv), ...hechos.flatMap(h => palabrasSignificativas(h.keyword)), "conocimientos"]);
      const antes = cv.split("\n"), ahora = despues.split("\n");
      const cambiadas = ahora.filter(l => !antes.includes(l));
      for (const l of cambiadas) {
        const sin = palabrasSignificativas(l).filter(p => !respaldo.has(p));
        if (sin.length) problemas.push(`${caso}: palabras sin fuente en «${l.trim()}»: ${sin.join(", ")}`);
      }
      const informeSi = informeFit({
        cv, mapeo, keywordsJD: ctx.keywordsJD, nivelPosicion: ctx.nivelPosicion, cargo: base.cargo,
        etiquetas: base.etiquetas, rechazadas: base.rechazos,
      });
      console.log(`\n═══ ${caso}: simulación todo "sí" · fit ${informe.fit.clase} (${informe.fit.score}) → ${informeSi.fit.clase} (${informeSi.fit.score})`);
      for (const h of hechos) console.log(`  hecho: ${h.texto} → ${h.destino.tipo}`);
      for (const p of pares) console.log(`  antes:   ${p.antes.trim()}\n  después: ${p.despues.trim()}`);
      if (cambiadas.length === 0) console.log("  (sin cambios en el CV)");
      console.log(`  todo "no": CV idéntico ${no.hechos.length === 0 ? "✅" : "❌"}`);
      informeSi.cumples.filter(c => /declarado por ti/.test(c.requisito)).forEach(c => console.log(`  informe: ✓ ${c.requisito}`));
    }
    if (client || g.prompt === prompt) fs.writeFileSync(archivo, JSON.stringify(g, null, 2) + "\n");
  }

  if (estimar) { console.log(`\nCosto estimado de --ejecutar: ~$${estimado.toFixed(4)}\n`); return; }

  console.log(`\n${"caso".padEnd(24)} preguntas (palabras) · definición`);
  for (const { caso, analisis } of filas) {
    if (analisis.preguntas.length === 0) { console.log(`${caso.padEnd(24)} — (sin preguntas: el paso se salta)`); continue; }
    analisis.preguntas.forEach((p, i) => {
      const def = p.definicion ? ` · ${p.definicion.texto}${p.definicion.revisar ? " [revisar]" : ""}` : "";
      console.log(`${(i === 0 ? caso : "").padEnd(24)} ${p.texto} (${p.palabras}) [${p.tipo}, ${p.impacto}, → ${p.destino.tipo}]${def}`);
    });
  }
  console.log(`\nChequeos: ${problemas.length === 0 ? "✅ sin problemas" : "❌\n  " + problemas.join("\n  ")}`);
  if (ejecutar) console.log(`Costo real: $${gastado.toFixed(4)}`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

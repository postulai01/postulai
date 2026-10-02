/**
 * Eval del informe de fit (PED-33). Sin API: mapeo con propuestas semánticas guardadas (evals/semantico/) y
 * etiquetas del priorizador guardadas (evals/priorizar/, solo como contexto de preguntas).
 *
 * Uso: npx tsx evals/informe-fit.ts [caso ...]
 *
 * - Clase antes (scoreV2 con la clasificación de PED-30) vs ahora (calibración de informe-fit.ts), contra fit_esperado.
 *   Las reglas se fijaron antes de correr esto; el número se registra, no se optimiza.
 * - Chequeos automáticos: toda pregunta es pregunta (empieza con "¿" y su primera oración termina en "?"),
 *   y todo "cumples" tiene evidencia que existe en el CV.
 * - Parte 2: máximo 5 preguntas visibles; ni funciones de práctica ni habilidades blandas como pregunta; "relacionado"
 *   con su advertencia; limpieza de andres_datos_personales (nacimiento, estado civil, hijos).
 * - Imprime el informe completo de cada caso para revisión manual.
 */
import * as fs from "fs";
import * as path from "path";
import { informeFit, MAX_PREGUNTAS, type InformeFit } from "../app/lib/informe-fit";
import { scoreV2 } from "../app/lib/mapeo-semantico";
import { casosConOferta, informeDelCaso } from "./lib-casos";

const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();

// Citas «…» de la evidencia; cada una (sin el "…" final de recorte) debe existir en el CV.
function evidenciaEnCV(evidencia: string, cv: string): boolean {
  const citas = [...evidencia.matchAll(/«([^»]+)»/g)].map(m => colapsar(m[1].replace(/^…|…$/g, "")));
  return citas.length > 0 && citas.every(c => colapsar(cv).includes(c));
}

// Empieza con "¿" y la pregunta se cierra con "?" antes de cualquier otra oración (los puntos de "N.º" o "RR.HH." no cortan).
const esPregunta = (t: string) => /^¿[^¿?!]+\?(\s|$)/.test(t) && !/^¿[^?]*[.!]\s+[A-ZÁÉÍÓÚ]/.test(t);

async function main() {
  const pedidos = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : casosConOferta();
  const filas: { caso: string; fit: string; antes: string; informe: InformeFit; problemas: string[] }[] = [];

  for (const caso of casos) {
    const { ctx, resultado, informe } = await informeDelCaso(caso);
    const cv: string = ctx.casoJson.cv_texto;
    const todas = [...informe.preguntas, ...informe.otras_preguntas];
    const problemas = [
      ...todas.filter(p => !esPregunta(p.texto)).map(p => `pregunta redactada como afirmación: ${p.texto}`),
      ...todas.filter(p => p.tipo === "funcion" || p.tipo === "blanda").map(p => `función o habilidad blanda como pregunta: ${p.texto}`),
      ...todas.filter(p => /«…|…»/.test(p.texto)).map(p => `cita cortada dentro de una pregunta: ${p.texto}`),
      ...todas.filter(p => /demostrado/.test(p.texto)).map(p => `redacción antigua: ${p.texto}`),
      ...informe.preguntas.filter(p => p.tipo === "subtarea").map(p => `subtarea visible (debe ir plegada): ${p.requisito}`),
      ...(informe.preguntas.length > MAX_PREGUNTAS ? [`${informe.preguntas.length} preguntas visibles (máx. ${MAX_PREGUNTAS})`] : []),
      ...informe.relacionado.filter(r => !evidenciaEnCV(r.evidencia, cv) || !/nómbralo así; si no, no lo agregues/.test(r.texto)).map(r => `relacionado sin evidencia o sin advertencia: ${r.requisito}`),
      ...informe.cumples.filter(c => /\(en parte\)/.test(c.requisito)).map(c => `"en parte" en cumples: ${c.requisito}`),
      ...(caso === "andres_datos_personales"
        ? (["nacimiento", "estado_civil", "hijos"] as const).filter(t => !informe.limpieza.some(l => l.tema === t)).map(t => `limpieza no detecta ${t}`)
        : []),
      ...informe.cumples.filter(c => !c.evidencia || !evidenciaEnCV(c.evidencia, cv)).map(c => `cumple sin evidencia en el CV: ${c.requisito} ← ${c.evidencia}`),
    ];
    filas.push({ caso, fit: ctx.casoJson.fit_esperado ?? "?", antes: scoreV2(resultado, ctx.keywordsJD).clase, informe, problemas });
  }

  const ok = (clase: string, fit: string) => `${clase} ${clase === fit ? "✓" : "✗"}`;
  console.log(`\n${"caso".padEnd(25)} ${"fit esp.".padEnd(8)} ${"antes".padEnd(8)} ${"ahora".padEnd(8)} score  cumples  relac  bloq  preg vis/otras  entrev  aprende  alerta`);
  for (const f of filas) {
    const i = f.informe;
    console.log(`${f.caso.padEnd(25)} ${f.fit.padEnd(8)} ${ok(f.antes, f.fit).padEnd(8)} ${ok(i.fit.clase, f.fit).padEnd(8)} ${i.fit.score.toFixed(2)}  ${String(i.cumples.length).padStart(7)}  ${String(i.relacionado.length).padStart(5)}  ${String(i.bloqueantes.length).padStart(4)}  ${`${i.preguntas.length}/${i.otras_preguntas.length}`.padStart(13)}  ${String(i.para_la_entrevista.length).padStart(6)}  ${(i.aprenderas_en_el_cargo ? "sí" : "—").padStart(7)}  ${i.alerta.nivel ?? "—"}`);
  }
  const n = (k: "antes" | "ahora") => filas.filter(f => (k === "antes" ? f.antes : f.informe.fit.clase) === f.fit).length;
  console.log(`\nEn su clase: antes ${n("antes")}/${filas.length} · ahora ${n("ahora")}/${filas.length}`);

  const problemas = filas.flatMap(f => f.problemas.map(p => `${f.caso}: ${p}`));
  console.log(`\nChequeos: preguntas como pregunta y cumples con evidencia → ${problemas.length === 0 ? "✅ sin problemas" : "❌\n  " + problemas.join("\n  ")}`);

  for (const f of filas) {
    const i = f.informe;
    console.log(`\n${"═".repeat(90)}\n${f.caso} · fit ${i.fit.clase} (${i.fit.score.toFixed(2)}) · esperado ${f.fit}\n${i.fit.frase}`);
    console.log(`\n  Cumples (${i.cumples.length}):`);
    i.cumples.forEach(c => console.log(`    ✓ ${c.requisito}\n        ${c.evidencia}`));
    console.log(`\n  Relacionado (${i.relacionado.length}):`);
    i.relacionado.forEach(r => console.log(`    ~ ${r.texto}`));
    console.log(`\n  Brechas (${i.bloqueantes.length}):`);
    i.bloqueantes.forEach(b => console.log(`    • ${b.texto}`));
    console.log(`\n  Preguntas (${i.preguntas.length}):`);
    i.preguntas.forEach(p => console.log(`    ? [${p.tipo}] ${p.texto}`));
    console.log(`\n  Otras preguntas, plegadas (${i.otras_preguntas.length}):`);
    i.otras_preguntas.forEach(p => console.log(`    ? [${p.tipo}] ${p.texto}`));
    console.log(`\n  Aprenderás en el cargo: ${i.aprenderas_en_el_cargo ?? "—"}`);
    console.log(`\n  Para la entrevista (${i.para_la_entrevista.length}):`);
    i.para_la_entrevista.forEach(t => console.log(`    ◦ ${t}`));
    console.log(`\n  Consejo sobre brechas laborales (${i.consejo_brecha.length}):`);
    i.consejo_brecha.forEach(t => console.log(`    · ${t}`));
    console.log(`\n  Alerta de nivel: ${i.alerta.texto ?? "—"}`);
    console.log(`\n  Limpieza del CV (${i.limpieza.length}):`);
    i.limpieza.forEach(l => console.log(`    - ${l.texto}\n        línea: «${l.linea}»`));
  }

  const dir = path.join(process.cwd(), "evals/resultados");
  const archivo = path.join(dir, `informe-fit-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
  fs.writeFileSync(archivo, JSON.stringify(filas, null, 2));
  console.log(`\nGuardado en ${path.relative(process.cwd(), archivo)}\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

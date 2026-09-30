/**
 * Eval del priorizador (app/lib/priorizador.ts). Sin API, $0: usa las ofertas fijadas y las propuestas
 * semánticas guardadas (evals/semantico/).
 *
 * Uso:
 *   npx tsx evals/priorizar.ts [caso ...]   # sin casos: todos los que tienen oferta parseada
 *
 * andres_senior se compara con la referencia de PED-28 (primera viñeta de cada puesto). El resto se muestra
 * antes → después para revisión manual. El invariante se verifica dentro de priorizarCV (lanza error si falla).
 */

import { priorizarCV, type ResultadoPriorizacion } from "../app/lib/priorizador";
import { casosConOferta, mapeoDelCaso } from "./lib-casos";

// Referencia de PED-28: fragmento de la viñeta que debería quedar primera en cada puesto de andres_senior.
const REFERENCIA_ANDRES: [string, string][] = [
  ["Servicios de Consultoría", "negociaciones colectivas y relaciones laborales"],
  ["SERVIMAULE", "las relaciones sindicales y los comités de gestión de crisis"],
  ["CLINICA SANTA MARIA", "Encabecé los procesos de negociación colectiva"],
  ["BUILDTEK", "relaciones laborales a nivel nacional"],
  ["GRUPO COPESA", "Conduje con éxito múltiples procesos de negociación colectiva"],
  ["COEXPAN", "negociación colectiva con el sindicato de la compañía"],
  ["CIA MINERA MANTOS DE LA LUNA", "Monitoreé el control presupuestario y financiero de la gerencia"],
];

const corta = (s: string, n = 95) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function main() {
  const pedidos = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : casosConOferta();
  const resultados: { caso: string; r: ResultadoPriorizacion }[] = [];
  const invariantes: string[] = [];

  for (const caso of casos) {
    const { ctx, resultado, semantico } = await mapeoDelCaso(caso);
    const frasesConocidas = ctx.competencias.flatMap(c => [c.nombre, ...(c.variantes ?? [])]);
    let r: ResultadoPriorizacion;
    try {
      r = priorizarCV({ cv: ctx.casoJson.cv_texto, mapeo: resultado, keywordsJD: ctx.keywordsJD, frasesConocidas });
      invariantes.push(`${caso}: ✅`);
    } catch (err) {
      invariantes.push(`${caso}: ❌ ${(err as Error).message}`);
      continue;
    }
    resultados.push({ caso, r });
    console.log(`\n═══ ${caso}${semantico ? "" : " (sin capa semántica guardada)"} · ${r.movimientos.length} movimientos`);

    if (caso === "andres_senior") {
      let aciertos = 0;
      for (const [puesto, ref] of REFERENCIA_ANDRES) {
        const p = r.primeras.find(x => x.puesto.includes(puesto));
        const ok = !!p && p.despues.includes(ref);
        if (ok) aciertos++;
        console.log(`\n  ${ok ? "✅" : "❌"} ${puesto}\n     referencia: …${ref}…\n     priorizador (${p?.puntaje ?? "—"}): ${corta(p?.despues ?? "—")}`);
        if (!ok) {
          for (const m of r.movimientos.filter(m => m.bloque.includes(puesto) && m.tipo === "vineta").sort((a, b) => a.a - b.a)) {
            console.log(`       pos ${m.a} (${m.puntaje}): ${corta(m.texto, 70)} · ${m.keywords.map(k => `${k.keyword} ${k.puntaje}`).join(", ") || "—"}`);
          }
        }
      }
      console.log(`\n  Aciertos: ${aciertos}/${REFERENCIA_ANDRES.length}`);
    } else {
      for (const p of r.primeras) {
        const cambio = p.antes !== p.despues;
        console.log(`  ${corta(p.puesto, 60)}\n     ${cambio ? "antes:   " + corta(p.antes) + "\n     después: " : "sin cambio: "}${corta(p.despues)} (${p.puntaje})`);
      }
    }
    const items = r.movimientos.filter(m => m.tipo === "item");
    if (items.length > 0) {
      const listas = [...new Set(items.map(m => m.bloque))];
      console.log(`  Listas reordenadas: ${listas.map(l => corta(l, 40)).join(" · ")}`);
    }
    for (const s of r.separadores) console.log(`  Separador corregido (línea ${s.linea}): ${corta(s.antes, 80)} → ${corta(s.despues, 80)}`);
  }

  console.log("\nCandidatas a acortar (solo marcadas):");
  for (const { caso, r } of resultados) for (const c of r.candidatas) console.log(`  ${caso.padEnd(24)} [${corta(c.puesto, 28)}] ${corta(c.texto, 70)} · ${c.motivo}`);

  console.log("\nInvariante:");
  for (const i of invariantes) console.log(`  ${i}`);
  console.log("");
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

/**
 * Eval del perfil priorizado (modo por defecto de app/lib/perfil-adaptado.ts). Sin API, $0.
 *
 * Uso:
 *   npx tsx evals/perfil-priorizado.ts [caso ...]
 *
 * Por caso: perfil original → priorizado, qué oración subió y con qué keywords. El invariante (mismo multiconjunto
 * de oraciones) se verifica dentro de priorizarPerfil, que lanza error si falla.
 */

import { priorizarPerfil } from "../app/lib/perfil-adaptado";
import { casosConOferta, mapeoDelCaso } from "./lib-casos";

async function main() {
  const pedidos = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const casos = pedidos.length > 0 ? pedidos : casosConOferta();
  const invariantes: string[] = [];

  for (const caso of casos) {
    const { ctx, resultado } = await mapeoDelCaso(caso);
    try {
      const r = priorizarPerfil({ cv: ctx.casoJson.cv_texto, mapeo: resultado, keywordsJD: ctx.keywordsJD });
      invariantes.push(`${caso}: ✅`);
      console.log(`\n═══ ${caso} (${ctx.casoJson.fit_esperado ?? "?"}) · ${r.estado}`);
      if (r.estado === "sin_perfil") continue;
      const cambio = r.perfil !== r.original;
      console.log(`  ORIGINAL:    ${r.original}`);
      console.log(`  PRIORIZADO:  ${cambio ? r.perfil : "= (sin cambios de orden)"}`);
      for (const o of r.oraciones) {
        const mov = o.de === o.a ? "  " : o.a < o.de ? "↑ " : "↓ ";
        console.log(`  ${mov}${o.de}→${o.a} (${o.puntaje}) ${o.texto.slice(0, 90)}${o.texto.length > 90 ? "…" : ""}${o.keywords.length ? ` · ${o.keywords.map(k => k.keyword).join(", ")}` : ""}`);
      }
    } catch (err) {
      invariantes.push(`${caso}: ❌ ${(err as Error).message}`);
    }
  }
  console.log("\nInvariante:");
  for (const i of invariantes) console.log(`  ${i}`);
  console.log("");
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

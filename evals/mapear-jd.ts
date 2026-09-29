/**
 * Corre mapearCompetencias (app/lib/mapeo-semantico.ts) con salidas ya guardadas del extractor de
 * competencias (evals/competencias/) y del parser de ofertas (evals/ofertas/). Sin API.
 * Re-aplica fusionarCompetencias y consolidarJD a lo guardado, para que refleje el código actual.
 *
 * Uso:
 *   npx tsx evals/mapear-jd.ts <caso> [archivo-competencias.json] [archivo-oferta.json]
 *   Sin archivos, usa el más reciente de cada carpeta para el caso; si el caso no tiene competencias propias,
 *   usa las de otro caso con el mismo cv_texto.
 */

import { mapearCompetencias } from "../app/lib/mapeo-semantico";
import { cargarContexto } from "./lib-casos";

async function main() {
  const [caso, archivoComp, archivoOferta] = process.argv.slice(2);
  if (!caso) { console.error("❌  Indica un caso, por ejemplo: pedro_cencomalls"); process.exit(1); }
  const { competencias, keywordsJD, extras } = cargarContexto(caso, archivoComp, archivoOferta);
  const r = await mapearCompetencias(competencias, keywordsJD, extras);
  const jd = { keywords_requeridas: keywordsJD.requeridas, keywords_deseables: keywordsJD.deseables };

  console.log(`\n${caso}: ${competencias.length} competencias del CV · ${jd.keywords_requeridas.length} requeridas y ${jd.keywords_deseables.length} deseables en la oferta\n`);
  const fila = (k: string, t: string, cv: string, rel: string) => console.log(`${k.padEnd(48).slice(0, 48)} ${t.padEnd(10)} ${rel.padEnd(5)} ${cv}`);
  fila("keyword de la oferta", "tipo", "match en el CV", "rel.");
  for (const m of r.matches_directos) fila(m.keyword_jd, m.tipo, `directo ← ${m.competencia_cv}`, m.relevancia.toFixed(2));
  for (const m of r.matches_relacionados) fila(m.keyword_jd, m.tipo, `relacionado ← ${m.competencia_cv}`, m.relevancia.toFixed(2));
  for (const g of r.gap_keywords) fila(g.keyword, g.tipo, "— brecha", "");
  for (const q of r.requisitos ?? []) fila(q.descripcion, q.tipo, `requisito: ${q.estado} · ${q.detalle}`, "");
  console.log(`\nscore_adaptacion: ${r.score_adaptacion} (requeridas: directo 1, relacionado 0.5; requisitos: cumple 1, afín a revisar 0.5)\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

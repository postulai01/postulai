/**
 * Corre mapearCompetencias (app/lib/mapeo-semantico.ts) con salidas ya guardadas del extractor de
 * competencias (evals/competencias/) y del parser de ofertas (evals/ofertas/). Sin API.
 * Re-aplica fusionarCompetencias y consolidarJD a lo guardado, para que refleje el código actual.
 *
 * Uso:
 *   npx tsx evals/mapear-jd.ts <caso> [archivo-competencias.json] [archivo-oferta.json]
 *   Sin archivos, usa el más reciente de cada carpeta para el caso.
 */

import * as fs from "fs";
import * as path from "path";
import { fusionarCompetencias } from "../app/lib/competencia-extractor";
import { consolidarJD } from "../app/lib/jd-parser";
import { mapearCompetencias } from "../app/lib/mapeo-semantico";

const masReciente = (dir: string, caso: string) => {
  const archivos = fs.readdirSync(dir).filter(f => f.startsWith(`${caso}-`)).sort();
  if (archivos.length === 0) throw new Error(`no hay salidas guardadas de ${caso} en ${dir}`);
  return path.join(dir, archivos[archivos.length - 1]);
};

async function main() {
  const [caso, archivoComp, archivoOferta] = process.argv.slice(2);
  if (!caso) { console.error("❌  Indica un caso, por ejemplo: pedro_cencomalls"); process.exit(1); }
  const raiz = process.cwd();
  const casoJson = JSON.parse(fs.readFileSync(path.join(raiz, "evals/casos", `${caso}.json`), "utf-8"));
  const comp = JSON.parse(fs.readFileSync(archivoComp ?? masReciente(path.join(raiz, "evals/competencias"), caso), "utf-8"));
  const oferta = JSON.parse(fs.readFileSync(archivoOferta ?? masReciente(path.join(raiz, "evals/ofertas"), caso), "utf-8"));

  const { competencias } = fusionarCompetencias(comp.competencias);
  const jd = consolidarJD(casoJson.oferta_texto, { requeridas: oferta.keywords_requeridas, deseables: oferta.keywords_deseables });

  const r = await mapearCompetencias(
    competencias,
    { requeridas: jd.keywords_requeridas, deseables: jd.keywords_deseables },
    { herramientas: comp.herramientas, certificaciones: comp.certificaciones, idiomas: comp.idiomas, cvTexto: casoJson.cv_texto },
  );

  console.log(`\n${caso}: ${competencias.length} competencias del CV · ${jd.keywords_requeridas.length} requeridas y ${jd.keywords_deseables.length} deseables en la oferta\n`);
  const fila = (k: string, t: string, cv: string, rel: string) => console.log(`${k.padEnd(48).slice(0, 48)} ${t.padEnd(10)} ${rel.padEnd(5)} ${cv}`);
  fila("keyword de la oferta", "tipo", "match en el CV", "rel.");
  for (const m of r.matches_directos) fila(m.keyword_jd, m.tipo, `directo ← ${m.competencia_cv}`, m.relevancia.toFixed(2));
  for (const m of r.matches_relacionados) fila(m.keyword_jd, m.tipo, `relacionado ← ${m.competencia_cv}`, m.relevancia.toFixed(2));
  for (const g of r.gap_keywords) fila(g.keyword, g.tipo, "— brecha", "");
  console.log(`\nscore_adaptacion: ${r.score_adaptacion} (requeridas: directo cuenta 1, relacionado 0.5)\n`);
}

main().catch(err => { console.error("Error inesperado:", err); process.exit(1); });

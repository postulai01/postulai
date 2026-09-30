/**
 * Test sin API: bloquesCV (app/lib/reescritor-contextual.ts) detecta al menos un puesto en cada CV de
 * evals/casos/ que tiene sección de experiencia. Sale con código 1 si alguno falla.
 *
 * Uso: npx tsx evals/test-bloques.ts
 */
import * as fs from "fs";
import * as path from "path";
import { normalizarParaComparar } from "../app/lib/cv-postprocess";
import { esEncabezado } from "../app/lib/cv-verificacion";
import { RE_EXPERIENCIA } from "../app/lib/mapeo-semantico";
import { bloquesCV } from "../app/lib/reescritor-contextual";

const dir = path.join(process.cwd(), "evals/casos");
let fallos = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
  const cv: string = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")).cv_texto;
  const conExperiencia = cv.split("\n").some(l => esEncabezado(l) && RE_EXPERIENCIA.test(normalizarParaComparar(l)));
  if (!conExperiencia) { console.log(`–  ${f}: sin sección de experiencia`); continue; }
  const puestos = bloquesCV(cv).filter(b => b.tipo === "puesto");
  const ok = puestos.length >= 1;
  if (!ok) fallos++;
  console.log(`${ok ? "✅" : "❌"} ${f}: ${puestos.length} puesto(s)${puestos.length ? " · " + puestos.map(p => p.titulo.slice(0, 30)).join(" | ") : ""}`);
}
if (fallos > 0) { console.error(`\n${fallos} CV sin puestos detectados`); process.exit(1); }
console.log("\nOK");

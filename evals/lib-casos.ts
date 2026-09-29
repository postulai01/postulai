/**
 * Carga de casos para los evals de mapeo: caso, competencias guardadas y oferta parseada. Sin API.
 */
import * as fs from "fs";
import * as path from "path";
import { fusionarCompetencias, type Competencia } from "../app/lib/competencia-extractor";
import { consolidarJD } from "../app/lib/jd-parser";
import type { ExtrasCV, KeywordsJD } from "../app/lib/mapeo-semantico";

export function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

export const masReciente = (dir: string, caso: string) => {
  const archivos = fs.readdirSync(dir).filter(f => f.startsWith(`${caso}-`)).sort();
  if (archivos.length === 0) throw new Error(`no hay salidas guardadas de ${caso} en ${dir}`);
  return path.join(dir, archivos[archivos.length - 1]);
};

// Sin archivo propio en evals/competencias/, usa el de otro caso con el mismo cv_texto (misma persona). Sin API.
export function competenciasDelCaso(raiz: string, caso: string, cvTexto: string): string {
  const dir = path.join(raiz, "evals/competencias");
  if (fs.readdirSync(dir).some(f => f.startsWith(`${caso}-`))) return masReciente(dir, caso);
  const base = fs.readdirSync(path.join(raiz, "evals/casos"))
    .filter(f => f.endsWith(".json") && f !== `${caso}.json`)
    .map(f => f.slice(0, -5))
    .find(c => JSON.parse(fs.readFileSync(path.join(raiz, "evals/casos", `${c}.json`), "utf-8")).cv_texto === cvTexto
      && fs.readdirSync(dir).some(f => f.startsWith(`${c}-`)));
  if (!base) throw new Error(`no hay competencias guardadas de ${caso} ni de otro caso con el mismo CV`);
  const archivo = masReciente(dir, base);
  console.log(`ℹ️  ${caso} no tiene competencias propias: uso ${path.relative(raiz, archivo)} (mismo CV)`);
  return archivo;
}

export interface ContextoMapeo {
  caso: string;
  casoJson: Record<string, any>;
  competencias: Competencia[];
  keywordsJD: KeywordsJD;
  extras: ExtrasCV;
  archivoOferta: string;
}

// Re-aplica fusionarCompetencias y consolidarJD a lo guardado, para que refleje el código actual.
export function cargarContexto(caso: string, archivoComp?: string, archivoOferta?: string): ContextoMapeo {
  const raiz = process.cwd();
  const casoJson = JSON.parse(fs.readFileSync(path.join(raiz, "evals/casos", `${caso}.json`), "utf-8"));
  const comp = JSON.parse(fs.readFileSync(archivoComp ?? competenciasDelCaso(raiz, caso, casoJson.cv_texto), "utf-8"));
  const arch = archivoOferta ?? masReciente(path.join(raiz, "evals/ofertas"), caso);
  const oferta = JSON.parse(fs.readFileSync(arch, "utf-8"));
  const { competencias } = fusionarCompetencias(comp.competencias);
  const jd = consolidarJD(casoJson.oferta_texto, {
    requeridas: oferta.keywords_requeridas, deseables: oferta.keywords_deseables,
    experiencia: oferta.experiencia, carreras: oferta.carreras,
  });
  return {
    caso, casoJson, competencias, archivoOferta: arch,
    keywordsJD: { requeridas: jd.keywords_requeridas, deseables: jd.keywords_deseables, experiencia: jd.experiencia, carreras: jd.carreras },
    extras: { herramientas: comp.herramientas, certificaciones: comp.certificaciones, idiomas: comp.idiomas, cvTexto: casoJson.cv_texto },
  };
}

// Casos con oferta parseada guardada.
export function casosConOferta(): string[] {
  const ofertas = fs.readdirSync(path.join(process.cwd(), "evals/ofertas"));
  return fs.readdirSync(path.join(process.cwd(), "evals/casos")).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5))
    .filter(c => ofertas.some(o => o.startsWith(`${c}-`))).sort();
}

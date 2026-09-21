// @ts-check
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Read eval data
const andres = JSON.parse(readFileSync("evals/casos/andres_senior.json", "utf8"));
const camila = JSON.parse(readFileSync("evals/casos/camila_junior.json", "utf8"));

async function main() {
  const React = (await import("react")).default;
  const { pdf } = await import("@react-pdf/renderer");

  console.log("Loading templates...");
  const { default: Tradicional } = await import("../app/components/CVDocumentTradicional.tsx");
  const { default: Moderno }     = await import("../app/components/CVDocumentModerno.tsx");
  const { default: Ejecutivo }   = await import("../app/components/CVDocumentEjecutivo.tsx");

  const cases = [
    { name: "tradicional-andres",  Component: Tradicional, cv: andres.cv_texto },
    { name: "ejecutivo-andres",    Component: Ejecutivo,   cv: andres.cv_texto },
    { name: "moderno-camila",      Component: Moderno,     cv: camila.cv_texto },
  ];

  for (const { name, Component, cv } of cases) {
    console.log(`Generating ${name}.pdf ...`);
    const blob = await pdf(React.createElement(Component, { cvText: cv })).toBlob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    writeFileSync(`/tmp/${name}.pdf`, buffer);
    console.log(`  ✓ /tmp/${name}.pdf  (${Math.round(buffer.length / 1024)} KB)`);
  }

  console.log("\nAll PDFs generated.");
}

main().catch(err => { console.error(err); process.exit(1); });

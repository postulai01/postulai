import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

// Importar desde lib/ evita que pdf-parse intente abrir ./test/data/05-versions-space.pdf
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  buf: Buffer
) => Promise<{ text: string; numpages: number }>;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let texto = "";

    if (name.endsWith(".pdf")) {
      const data = await pdfParse(buffer);
      texto = data.text;
    } else if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      texto = result.value;
    } else {
      return NextResponse.json(
        { error: "Formato no soportado. Sube un PDF o archivo Word (.docx)." },
        { status: 400 }
      );
    }

    if (!texto.trim()) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del archivo. Asegúrate de que el archivo no esté protegido o vacío." },
        { status: 422 }
      );
    }

    return NextResponse.json({ texto });
  } catch (error) {
    console.error("[extract-text] error:", (error as Error)?.message);
    const message =
      error instanceof Error ? error.message : "Error al leer el archivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

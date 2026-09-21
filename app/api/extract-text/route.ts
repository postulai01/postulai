import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import mammoth from "mammoth";
import { checkRateLimit } from "@/lib/rate-limit";

// Importar desde lib/ evita que pdf-parse intente abrir ./test/data/05-versions-space.pdf
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  buf: Buffer
) => Promise<{ text: string; numpages: number }>;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Intenta en un minuto." }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo supera el límite de 5 MB." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    if (!checkMagicBytes(buffer, name)) {
      return NextResponse.json(
        { error: "El archivo no corresponde al formato declarado." },
        { status: 400 }
      );
    }

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

function checkMagicBytes(buffer: Buffer, name: string): boolean {
  if (buffer.length < 4) return false;
  if (name.endsWith(".pdf")) {
    // PDF magic: %PDF  →  25 50 44 46
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  if (name.endsWith(".docx")) {
    // DOCX is a ZIP: PK  →  50 4B 03 04
    return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  }
  return false;
}

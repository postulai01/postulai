import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "El campo 'url' es requerido." }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "La URL no es válida." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Solo se permiten URLs http o https." }, { status: 400 });
    }

    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `La página respondió con error ${res.status}.` },
          { status: 422 }
        );
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        return NextResponse.json(
          { error: "La URL no apunta a una página web." },
          { status: 422 }
        );
      }

      html = await res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      return NextResponse.json(
        { error: `No se pudo acceder a la página: ${msg}` },
        { status: 422 }
      );
    }

    const texto = extractText(html);

    if (texto.length < 50) {
      return NextResponse.json(
        { error: "No se pudo extraer contenido útil de esa página." },
        { status: 422 }
      );
    }

    return NextResponse.json({ texto });
  } catch (error) {
    console.error("Error en /api/fetch-url:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

function extractText(html: string): string {
  // Drop <head> entirely
  html = html.replace(/<head[\s\S]*?<\/head>/gi, "");

  // Remove non-content blocks with their children
  for (const tag of ["script", "style", "nav", "footer", "aside", "noscript", "iframe", "svg", "form"]) {
    html = html.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"), " ");
  }

  // Turn block-level closing tags into line breaks before stripping
  html = html.replace(/<\/(p|div|li|h[1-6]|section|article|tr|td|th|br)>/gi, "\n");

  // Strip all remaining tags
  html = html.replace(/<[^>]+>/g, " ");

  // Decode entities
  html = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]{2,6};/g, " ");

  // Normalise whitespace
  html = html
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Cap at 12 000 chars so Claude doesn't get overwhelmed
  if (html.length > 12000) {
    html = html.slice(0, 12000) + "\n[contenido truncado]";
  }

  return html;
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { lookup } from "dns/promises";
import { checkRateLimit } from "@/lib/rate-limit";

function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 127) return true;                        // 127.0.0.0/8  loopback
    if (a === 10) return true;                         // 10.0.0.0/8   private
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local / metadata
    if (a === 0) return true;                          // 0.0.0.0/8
  }
  if (ip === "::1") return true;           // IPv6 loopback
  if (/^f[cd]/i.test(ip)) return true;     // fc00::/7  IPv6 private
  return false;
}

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

    let resolvedIp: string;
    try {
      const result = await lookup(parsed.hostname);
      resolvedIp = result.address;
    } catch {
      return NextResponse.json({ error: "No se pudo resolver el hostname." }, { status: 400 });
    }

    if (isPrivateIp(resolvedIp)) {
      return NextResponse.json({ error: "La URL apunta a una dirección no permitida." }, { status: 400 });
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

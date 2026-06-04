import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];

function findChrome(): string | null {
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

function buildHtml(cvText: string): string {
  const lines = cvText.split("\n");

  const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
  const clean = (s: string) => s.replace(/%%%/g, "").replace(/[─━]+/g, "").trim();

  type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
  interface ParsedLine { role: Role; text: string }

  const parsed: ParsedLine[] = [];
  let seenName = false;
  let seenTitle = false;
  let seenContact = false;
  let seenFirstSection = false;

  for (const raw of lines) {
    if (isSep(raw)) continue;
    const t = clean(raw);
    if (t === "") {
      parsed.push({ role: "blank", text: "" });
      continue;
    }

    const isAllCaps =
      t.length > 1 && t.length < 60 &&
      t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);

    if (!seenName) {
      parsed.push({ role: "name", text: t });
      seenName = true;
      continue;
    }
    if (!seenTitle) {
      if (isAllCaps) {
        seenTitle = true;
        seenContact = true;
        seenFirstSection = true;
        parsed.push({ role: "section", text: t });
      } else {
        parsed.push({ role: "title", text: t });
        seenTitle = true;
      }
      continue;
    }
    if (!seenContact) {
      if (isAllCaps) {
        seenContact = true;
        seenFirstSection = true;
        parsed.push({ role: "section", text: t });
      } else {
        parsed.push({ role: "contact", text: t });
        seenContact = true;
      }
      continue;
    }
    if (!seenFirstSection) {
      if (isAllCaps) {
        seenFirstSection = true;
        parsed.push({ role: "section", text: t });
      } else {
        parsed.push({ role: "contact", text: t });
      }
      continue;
    }
    if (isAllCaps) {
      parsed.push({ role: "section", text: t });
      continue;
    }
    if (/^[•\-]\s/.test(t)) {
      parsed.push({ role: "bullet", text: t.replace(/^[•\-]\s*/, "") });
      continue;
    }
    parsed.push({ role: "body", text: t });
  }

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let bodyHtml = "";
  let afterHeader = false;

  for (let i = 0; i < parsed.length; i++) {
    const ln = parsed[i];
    switch (ln.role) {
      case "name":
        bodyHtml += `<div class="name">${escape(ln.text)}</div>`;
        afterHeader = false;
        break;
      case "title":
        bodyHtml += `<div class="title">${escape(ln.text)}</div>`;
        break;
      case "contact":
        bodyHtml += `<div class="contact">${escape(ln.text)}</div>`;
        break;
      case "section":
        if (!afterHeader) {
          bodyHtml += `<hr class="header-rule" />`;
          afterHeader = true;
        }
        bodyHtml += `<div class="section-title">${escape(ln.text)}</div><hr class="section-rule" />`;
        break;
      case "bullet":
        bodyHtml += `<div class="bullet"><span class="bullet-dot">•</span><span>${escape(ln.text)}</span></div>`;
        break;
      case "body":
        bodyHtml += `<div class="body">${escape(ln.text)}</div>`;
        break;
      case "blank":
        bodyHtml += `<div class="blank"></div>`;
        break;
    }
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #000;
    background: #fff;
    line-height: 1.45;
  }
  .name {
    text-align: center;
    font-size: 22pt;
    font-weight: bold;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 4pt;
  }
  .title {
    text-align: center;
    font-size: 11pt;
    color: #333;
    margin-bottom: 3pt;
  }
  .contact {
    text-align: center;
    font-size: 10pt;
    color: #333;
    margin-bottom: 2pt;
  }
  hr.header-rule {
    border: none;
    border-top: 1.5px solid #000;
    margin: 8pt 0 6pt;
  }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    color: #000;
    margin-top: 6pt;
    margin-bottom: 2pt;
  }
  hr.section-rule {
    border: none;
    border-top: 0.75px solid #888;
    margin-bottom: 5pt;
  }
  .body {
    font-size: 10pt;
    color: #000;
    margin-bottom: 2pt;
  }
  .bullet {
    display: flex;
    gap: 5pt;
    font-size: 10pt;
    color: #000;
    margin-bottom: 2pt;
    padding-left: 4pt;
  }
  .bullet-dot {
    flex-shrink: 0;
  }
  .blank {
    height: 4pt;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cv_adaptado } = body as { cv_adaptado: string };

    if (!cv_adaptado) {
      return NextResponse.json({ error: "cv_adaptado requerido" }, { status: 400 });
    }

    const chromePath = findChrome();
    if (!chromePath) {
      return NextResponse.json(
        { error: "No se encontró Chrome instalado en este servidor." },
        { status: 500 }
      );
    }

    const html = buildHtml(cv_adaptado);

    const browser = await puppeteer.launch({
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "18mm", bottom: "22mm", left: "18mm", right: "18mm" },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `
          <div style="width:100%;text-align:center;font-size:7pt;color:#aaa;font-family:Arial,sans-serif;padding-bottom:4mm;">
            Generado por Postulai · postulai.cl
          </div>`,
      });

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="cv-adaptado.pdf"',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("[generate-pdf] error:", (error as Error)?.message);
    const message = error instanceof Error ? error.message : "Error al generar el PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

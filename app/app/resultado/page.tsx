"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ResultData {
  cv_adaptado: string;
  carta_presentacion: string;
  sugerencias: string[];
  principales_cambios: string[];
  generadoEn: string;
}

function truncateWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text;
  return words.slice(0, max).join(" ") + "…";
}

const IconDownload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

function CardHeading({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white">{children}</h2>
      <div className="mt-2 w-8 h-0.5 bg-white/20 rounded-full" />
    </div>
  );
}

export default function ResultadoPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [copiedCarta, setCopiedCarta] = useState(false);
  const [copiedCv, setCopiedCv] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "word" | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("postulai_resultado");
    if (!raw) { router.replace("/app/adaptar"); return; }
    try { setData(JSON.parse(raw)); }
    catch { router.replace("/app/adaptar"); }
  }, [router]);

  async function copyCarta() {
    if (!data) return;
    await navigator.clipboard.writeText(data.carta_presentacion);
    setCopiedCarta(true);
    setTimeout(() => setCopiedCarta(false), 2000);
  }

  async function copyCv() {
    if (!data) return;
    await navigator.clipboard.writeText(data.cv_adaptado);
    setCopiedCv(true);
    setTimeout(() => setCopiedCv(false), 2000);
  }

  function handleDownloadPDF() {
    if (!data || downloading) return;
    setDownloading("pdf");

    const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
    const parsed: { role: Role; text: string }[] = [];
    let state: "name" | "title" | "contact" | "body" = "name";

    for (const raw of data.cv_adaptado.split("\n")) {
      if (isSep(raw)) continue;
      const t = raw.replace(/%%%/g, "").replace(/[─━]+/g, "").trim();
      if (t === "") { parsed.push({ role: "blank", text: "" }); continue; }
      const allCaps = t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);

      if (state === "name") {
        parsed.push({ role: "name", text: t }); state = "title";
      } else if (state === "title") {
        if (allCaps) { state = "body"; parsed.push({ role: "section", text: t }); }
        else { parsed.push({ role: "title", text: t }); state = "contact"; }
      } else if (state === "contact") {
        if (allCaps) { state = "body"; parsed.push({ role: "section", text: t }); }
        else { parsed.push({ role: "contact", text: t }); state = "body"; }
      } else {
        if (allCaps) parsed.push({ role: "section", text: t });
        else if (/^•/.test(t)) parsed.push({ role: "bullet", text: t.replace(/^•\s*/, "") });
        else parsed.push({ role: "body", text: t });
      }
    }

    let cvHtml = "";
    let ruleDone = false;
    for (const ln of parsed) {
      switch (ln.role) {
        case "name":
          cvHtml += `<p class="cv-name">${esc(ln.text)}</p>`; break;
        case "title":
          cvHtml += `<p class="cv-title">${esc(ln.text)}</p>`; break;
        case "contact":
          cvHtml += `<p class="cv-contact">${esc(ln.text)}</p>`;
          if (!ruleDone) { cvHtml += `<hr class="cv-rule">`; ruleDone = true; }
          break;
        case "section":
          if (!ruleDone) { cvHtml += `<hr class="cv-rule">`; ruleDone = true; }
          cvHtml += `<p class="cv-section">${esc(ln.text)}</p>`; break;
        case "bullet":
          cvHtml += `<p class="cv-bullet">• ${esc(ln.text)}</p>`; break;
        case "body":
          cvHtml += `<p class="cv-body">${esc(ln.text)}</p>`; break;
        case "blank":
          cvHtml += `<p class="cv-blank"> </p>`; break;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>CV — Postulai</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;background:#e8e8e8}
@page{margin:18mm;size:letter portrait}
@media screen{
  .bar{background:#111;color:#fff;text-align:center;padding:12px 20px;font-size:13px;font-family:Arial,sans-serif;position:sticky;top:0;z-index:9}
  .bar button{background:#fff;color:#111;border:none;cursor:pointer;padding:7px 18px;font-size:13px;font-weight:700;border-radius:6px;margin-left:12px}
  .bar button:hover{background:#eee}
  .cv{max-width:216mm;margin:24px auto 48px;background:#fff;padding:18mm;box-shadow:0 4px 24px rgba(0,0,0,.18)}
}
@media print{
  body{background:#fff}
  .bar{display:none!important}
  .cv{padding:0;max-width:none;margin:0;box-shadow:none}
}
.cv-name{font-size:20pt;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px}
.cv-title{font-size:11pt;text-align:center;color:#444;margin-bottom:3px}
.cv-contact{font-size:9pt;text-align:center;color:#444;margin-bottom:8px}
.cv-rule{border:none;border-top:1px solid #000;margin:8px 0 10px}
.cv-section{font-size:10pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #999;padding-bottom:2px;margin-top:10px;margin-bottom:4px}
.cv-body{font-size:10pt;line-height:1.4;margin:2px 0}
.cv-bullet{font-size:10pt;line-height:1.4;padding-left:12px;margin:2px 0}
.cv-blank{height:5px}
.cv-footer{font-size:7pt;text-align:center;color:#999;margin-top:24px}
</style>
</head>
<body>
<div class="bar">
  Guarda como PDF: <strong>Cmd+P</strong> (Mac) o <strong>Ctrl+P</strong> (Windows) → selecciona <strong>"Guardar como PDF"</strong>
  <button onclick="window.print()">Imprimir / Guardar PDF</button>
</div>
<div class="cv">
${cvHtml}
<p class="cv-footer">Generado por Postulai · postulai.cl</p>
</div>
<script>setTimeout(function(){window.print()},400)</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Permite ventanas emergentes para descargar el PDF."); setDownloading(null); return; }
    win.document.write(html);
    win.document.close();
    setDownloading(null);
  }

  async function handleDownloadWord() {
    if (!data || downloading) return;
    setDownloading("word");
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

      const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
      type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
      const parsed: { role: Role; text: string }[] = [];
      let state: "name" | "title" | "contact" | "body" = "name";

      for (const raw of data.cv_adaptado.split("\n")) {
        if (isSep(raw)) continue;
        const t = raw.replace(/%%%/g, "").replace(/[─━]+/g, "").trim();
        if (t === "") { parsed.push({ role: "blank", text: "" }); continue; }
        const allCaps = t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);

        if (state === "name") {
          parsed.push({ role: "name", text: t }); state = "title";
        } else if (state === "title") {
          if (allCaps) { state = "body"; parsed.push({ role: "section", text: t }); }
          else { parsed.push({ role: "title", text: t }); state = "contact"; }
        } else if (state === "contact") {
          if (allCaps) { state = "body"; parsed.push({ role: "section", text: t }); }
          else { parsed.push({ role: "contact", text: t }); state = "body"; }
        } else {
          if (allCaps) parsed.push({ role: "section", text: t });
          else if (/^•/.test(t)) parsed.push({ role: "bullet", text: t.replace(/^•\s*/, "") });
          else parsed.push({ role: "body", text: t });
        }
      }

      const children: InstanceType<typeof Paragraph>[] = [];
      let ruleDone = false;

      for (const { role, text } of parsed) {
        switch (role) {
          case "name":
            children.push(new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, font: "Arial", size: 40, bold: true })],
              spacing: { after: 120 },
            }));
            break;
          case "title":
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, font: "Arial", size: 22, color: "444444" })],
              spacing: { after: 60 },
            }));
            break;
          case "contact":
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, font: "Arial", size: 18, color: "444444" })],
              spacing: { after: 60 },
            }));
            if (!ruleDone) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              children.push(new Paragraph({ border: { bottom: { style: "single" as any, size: 6, color: "000000", space: 4 } }, spacing: { after: 160 }, children: [] }));
              ruleDone = true;
            }
            break;
          case "section":
            if (!ruleDone) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              children.push(new Paragraph({ border: { bottom: { style: "single" as any, size: 6, color: "000000", space: 4 } }, spacing: { after: 160 }, children: [] }));
              ruleDone = true;
            }
            children.push(new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text, font: "Arial", size: 20, bold: true })],
              spacing: { before: 240, after: 80 },
            }));
            break;
          case "bullet":
            children.push(new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text, font: "Arial", size: 20 })],
              spacing: { after: 40 },
            }));
            break;
          case "body":
            children.push(new Paragraph({
              children: [new TextRun({ text, font: "Arial", size: 20 })],
              spacing: { after: 60, line: 276 },
            }));
            break;
          default:
            children.push(new Paragraph({ children: [new TextRun({ text: " " })], spacing: { after: 0 } }));
        }
      }

      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Generado por Postulai · postulai.cl", font: "Arial", size: 14, color: "999999" })],
        spacing: { before: 480 },
      }));

      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cv-postulai.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const fecha = new Date(data.generadoEn).toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const cartaTruncada = truncateWords(data.carta_presentacion, 150);
  const cartaEsTruncada = cartaTruncada !== data.carta_presentacion;

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{
        backgroundColor: "#0A0A0A",
        backgroundImage:
          "radial-gradient(ellipse 90% 45% at 50% 0%, #141414 0%, #0A0A0A 70%), " +
          "repeating-linear-gradient(-45deg, transparent, transparent 40px, #ffffff04 40px, #ffffff04 41px)",
      }}
    >
      {/* Navbar */}
      <header className="w-full border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-black tracking-tight text-white hover:opacity-80 transition-opacity duration-150">
            Postulai
          </a>
          <button
            type="button"
            onClick={() => router.push("/app/adaptar")}
            className="text-sm font-medium text-white/60 hover:text-white transition-colors duration-150 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Adaptar otro
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-10">

          {/* ── Encabezado + botones ── */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Tu currículum adaptado</h1>
              <p className="text-sm text-[#D1D5DB]">Generado el {fecha}</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={!!downloading}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-bold rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading === "pdf"
                  ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  : <IconDownload />}
                Descargar PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadWord}
                disabled={!!downloading}
                className="flex items-center gap-2 px-5 py-2.5 bg-transparent text-white text-sm font-semibold border border-white/20 rounded-xl hover:border-white/40 hover:bg-white/5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading === "word"
                  ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  : <IconDownload />}
                Descargar Word
              </button>
            </div>
          </div>

          {/* ── Grid dos columnas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">

            {/* COLUMNA IZQUIERDA — CV */}
            <div className="bg-[#111] border border-[#222] rounded-2xl flex flex-col overflow-hidden">
              <div className="px-6 py-5 border-b border-[#222] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-bold text-white">CV Adaptado</span>
                  <span className="text-xs text-[#D1D5DB] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">ATS 2026</span>
                </div>
                <button
                  type="button"
                  onClick={copyCv}
                  className="flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors duration-150 px-3 py-1.5 border border-white/20 rounded-lg hover:border-white/40"
                >
                  {copiedCv ? <><IconCheck />Copiado</> : <><IconCopy />Copiar</>}
                </button>
              </div>
              <div className="px-7 py-6 overflow-y-auto max-h-[580px] lg:max-h-[660px]">
                <pre className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap font-sans">{data.cv_adaptado}</pre>
              </div>
            </div>

            {/* COLUMNA DERECHA — Cards */}
            <div className="flex flex-col gap-5">

              {/* Card — Qué cambió */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-7 flex flex-col gap-5">
                <CardHeading>Qué cambió</CardHeading>
                <div className="flex flex-wrap gap-2">
                  {data.principales_cambios.map((cambio, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#1a1a1a] border border-[#333] text-white"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      {cambio}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card — Carta de presentación */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-7 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-3">
                  <CardHeading>Carta de presentación</CardHeading>
                  <button
                    type="button"
                    onClick={copyCarta}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors duration-150 px-3.5 py-2 border border-white/20 rounded-lg hover:border-white/40 shrink-0 mt-0.5"
                  >
                    {copiedCarta ? <><IconCheck />Copiado</> : <><IconCopy />Copiar</>}
                  </button>
                </div>
                <p className="text-sm text-white/90 leading-relaxed">
                  {cartaTruncada}
                  {cartaEsTruncada && <span className="text-white/40"> …ver todo al copiar</span>}
                </p>
              </div>

            </div>
          </div>

          {/* ── Sugerencias — ancho completo ── */}
          <div className="flex flex-col gap-5">
            <CardHeading>Sugerencias</CardHeading>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {data.sugerencias.map((s, i) => (
                <div key={i} className="bg-[#111] border border-[#222] rounded-2xl px-6 py-6 relative overflow-hidden min-h-[130px]">
                  <span
                    aria-hidden
                    className="absolute -bottom-4 -right-2 text-[6rem] font-black leading-none select-none pointer-events-none"
                    style={{ color: "rgba(255,255,255,0.06)" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm text-white/90 leading-relaxed relative z-10">{s}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

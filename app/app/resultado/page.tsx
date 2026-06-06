"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

interface ResultData {
  cv_adaptado: string;
  carta_presentacion: string;
  sugerencias: string[];
  principales_cambios: string[];
  generadoEn: string;
  titulo_postulacion?: string;
  modo?: string;
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

const ALLOWED_EMAIL = "pedro.ignacio.heresi@gmail.com";

export default function ResultadoPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [copiedCarta, setCopiedCarta] = useState(false);
  const [copiedCv, setCopiedCv] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "word" | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      if (session.user.email !== ALLOWED_EMAIL) { router.replace("/"); }
    });
  }, [router]);

  useEffect(() => {
    const raw = sessionStorage.getItem("postulai_resultado");
    if (!raw) { router.replace("/app/adaptar"); return; }
    try { setData(JSON.parse(raw)); }
    catch { router.replace("/app/adaptar"); }
  }, [router]);

  useEffect(() => {
    if (!data || savedRef.current) return;
    savedRef.current = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const match = data.titulo_postulacion?.match(/CV para (.+?) · (.+)/);
      await supabase.from("postulaciones").insert({
        user_id: session.user.id,
        tipo: data.modo ?? "adaptar",
        empresa: match?.[1] ?? null,
        cargo: match?.[2] ?? null,
        titulo_postulacion: data.titulo_postulacion ?? null,
        cv_adaptado: data.cv_adaptado,
        carta_presentacion: data.carta_presentacion,
        principales_cambios: data.principales_cambios ?? null,
        sugerencias: data.sugerencias ?? null,
      });
    });
  }, [data]);

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

  async function handleDownloadPDF() {
    if (!data || downloading) return;
    setDownloading("pdf");
    try {
      const [{ pdf }, { default: CVDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/app/components/CVDocument"),
      ]);
      const blob = await pdf(<CVDocument cvText={data.cv_adaptado} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cv-postulai.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadWord() {
    if (!data || downloading) return;
    setDownloading("word");
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = await import("docx");

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

      const headerRule = () => new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 4 } },
        spacing: { after: 120 },
        children: [],
      });

      for (const { role, text } of parsed) {
        switch (role) {
          case "name":
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: text.toUpperCase(), font: "Calibri", size: 32, bold: true, color: "000000" })],
              spacing: { after: 60 },
            }));
            break;
          case "title":
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, font: "Calibri", size: 22, color: "555555" })],
              spacing: { after: 40 },
            }));
            break;
          case "contact":
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, font: "Calibri", size: 20, color: "777777" })],
              spacing: { after: 60 },
            }));
            if (!ruleDone) { children.push(headerRule()); ruleDone = true; }
            break;
          case "section":
            if (!ruleDone) { children.push(headerRule()); ruleDone = true; }
            children.push(new Paragraph({
              children: [new TextRun({ text: text.toUpperCase(), font: "Calibri", size: 22, bold: true, color: "000000" })],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA", space: 4 } },
              spacing: { before: 200, after: 80 },
            }));
            break;
          case "bullet":
            children.push(new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text, font: "Calibri", size: 22, color: "000000" })],
              spacing: { after: 40 },
            }));
            break;
          case "body":
            children.push(new Paragraph({
              children: [new TextRun({ text, font: "Calibri", size: 22, color: "000000" })],
              spacing: { after: 60, line: 276 },
            }));
            break;
          default:
            children.push(new Paragraph({
              children: [new TextRun({ text: "", font: "Calibri", size: 22 })],
              spacing: { after: 0 },
            }));
        }
      }

      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
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
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">

        {/* Figuras decorativas */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full border border-[#1e1e1e]" />
          <div className="absolute top-[55%] -right-16 w-44 h-44 rounded-full border border-[#1e1e1e]" />
          <div className="absolute bottom-20 right-20 w-28 h-28 border border-[#1e1e1e] rotate-45" />
        </div>

      <main className="flex-1 px-6 sm:px-10 py-10 sm:py-14 relative">
        <div className="w-full max-w-[900px] mx-auto flex flex-col gap-10">

          {/* ── Encabezado + botones ── */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[28px] sm:text-[34px] font-bold text-white tracking-tight">Tu currículum adaptado</h1>
              <p className="text-sm text-[#aaa]">Generado el {fecha}</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => router.push("/app/adaptar")}
                className="text-sm font-medium text-white/50 hover:text-white transition-colors duration-150 flex items-center gap-1.5 w-fit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Adaptar otro
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={!!downloading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-bold rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
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
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-transparent text-white text-sm font-semibold border border-white/20 rounded-xl hover:border-white/40 hover:bg-white/5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {downloading === "word"
                  ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  : <IconDownload />}
                Descargar Word
              </button>
            </div>
          </div>

          {/* ── Grid dos columnas ── */}
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6 items-start">

            {/* COLUMNA IZQUIERDA — CV */}
            <div className="bg-[#111] border border-[#222] rounded-2xl flex flex-col overflow-hidden">
              <div className="px-6 py-5 border-b border-[#222] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-bold text-white">CV Adaptado</span>
                  <span className="text-xs text-[#aaa] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">ATS 2026</span>
                </div>
                <button
                  type="button"
                  onClick={copyCv}
                  className="flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors duration-150 px-3 py-1.5 border border-white/20 rounded-lg hover:border-white/40"
                >
                  {copiedCv ? <><IconCheck />Copiado</> : <><IconCopy />Copiar</>}
                </button>
              </div>
              <div className="px-7 py-6 overflow-y-auto max-h-[580px] md:max-h-[660px]">
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
    </div>
  );
}

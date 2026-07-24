"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";
import PdfThumbnail from "@/app/components/PdfThumbnail";

interface ResultData {
  cv_adaptado: string;
  carta_presentacion: string;
  sugerencias: string[];
  principales_cambios: string[];
  generadoEn: string;
  titulo_postulacion?: string;
  modo?: string;
  keywords_totales?: number;
  keywords_encontradas?: number;
  formato?: string;
}

const CIRCLE_R = 44;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R;
const ATS_CHECKS = ["Formato de columna única", "Sin tablas ni gráficos", "Máximo 2 páginas"];

// ── Hero ───────────────────────────────────────────────────────────────
function HeroBlock({ data }: { data: ResultData }) {
  const hasKeywords = (data.keywords_totales ?? 0) > 0;
  const found = data.keywords_encontradas ?? 0;
  const total = data.keywords_totales ?? 0;
  const dashOffset = CIRCLE_C * (1 - (hasKeywords ? found / total : 0));
  const tituloMatch = data.titulo_postulacion?.match(/CV para (.+?) · (.+)/);
  const empresa = tituloMatch?.[1];
  const cargo = tituloMatch?.[2];

  return (
    <div className="relative bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
      <div aria-hidden className="absolute -top-14 -left-14 w-52 h-52 rounded-full"
        style={{ border: "0.5px solid rgba(255,255,255,0.07)" }} />
      <div aria-hidden className="absolute -bottom-20 left-32 w-72 h-72 rounded-full"
        style={{ border: "0.5px solid rgba(255,255,255,0.05)" }} />

      <div className="relative z-10 px-8 py-7 flex flex-col sm:flex-row gap-8 items-start sm:items-center">
        {hasKeywords ? (
          <div className="shrink-0">
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={CIRCLE_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
              <circle cx="50" cy="50" r={CIRCLE_R} fill="none" stroke="#22c55e" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={CIRCLE_C} strokeDashoffset={dashOffset} transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 0.8s ease" }} />
              <text x="50" y="45" textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontFamily="inherit">{found}</text>
              <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="10" fontFamily="inherit">de {total}</text>
            </svg>
          </div>
        ) : (
          <div className="shrink-0 w-[120px] h-[120px] rounded-full border-2 border-[#22c55e]/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#22c55e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        <div className="flex-1 flex flex-col gap-4">
          {hasKeywords ? (
            <>
              <div>
                <h2 className="text-[28px] sm:text-[34px] leading-tight text-white" style={{ fontWeight: 900 }}>
                  Tu CV cubre{" "}
                  <span className="text-[#22c55e]">{found} de {total}</span>{" "}
                  palabras clave
                </h2>
                <p className="mt-1.5 text-sm text-white/50">
                  {cargo && empresa ? `Coincidencias con la oferta de ${cargo} en ${empresa}`
                    : cargo ? `Coincidencias con la oferta de ${cargo}`
                    : "Coincidencias detectadas en la oferta de trabajo"}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {ATS_CHECKS.map(c => (
                  <span key={c} className="flex items-center gap-1.5 text-xs text-white/55">
                    <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {c}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-[28px] sm:text-[34px] leading-tight text-white" style={{ fontWeight: 900 }}>
                  {data.modo === "adaptar" || (cargo && empresa)
                    ? <>CV adaptado a la <span className="text-[#22c55e]">oferta</span></>
                    : <>CV optimizado para <span className="text-[#22c55e]">ATS 2026</span></>
                  }
                </h2>
                <p className="mt-1.5 text-sm text-white/50">
                  {cargo && empresa ? `Adaptado para ${cargo} en ${empresa}`
                    : cargo ? `Adaptado para ${cargo}`
                    : "Generado con las mejores prácticas para sistemas de seguimiento de candidatos"}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {ATS_CHECKS.map(c => (
                  <span key={c} className="flex items-center gap-1.5 text-xs text-white/55">
                    <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Document thumbnail skeleton ────────────────────────────────────────
function DocumentSkeleton({ type }: { type: "cv" | "carta" }) {
  if (type === "cv") {
    return (
      <div className="w-full h-full bg-white" style={{ padding: "10% 8%" }}>
        <div className="flex justify-center" style={{ marginBottom: "4%" }}>
          <div style={{ width: "52%", height: 3, background: "#d1d5db", borderRadius: 2 }} />
        </div>
        <div className="flex justify-center" style={{ marginBottom: "2%" }}>
          <div style={{ width: "40%", height: 2, background: "#e5e7eb", borderRadius: 2 }} />
        </div>
        <div className="flex justify-center" style={{ marginBottom: "5%" }}>
          <div style={{ width: "48%", height: 1.5, background: "#e5e7eb", borderRadius: 2 }} />
        </div>
        <div style={{ height: 1, background: "#d1d5db", marginBottom: "5%" }} />

        <div style={{ width: "32%", height: 2, background: "#d1d5db", borderRadius: 2, marginBottom: "3%" }} />
        {[76, 62, 70].map((w, i) => (
          <div key={i} className="flex items-center" style={{ gap: "2%", paddingLeft: "4%", marginBottom: "2%" }}>
            <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />
            <div style={{ width: `${w}%`, height: 1.5, background: "#e5e7eb", borderRadius: 2 }} />
          </div>
        ))}

        <div style={{ height: 1, background: "#e5e7eb", margin: "4% 0" }} />

        <div style={{ width: "28%", height: 2, background: "#d1d5db", borderRadius: 2, marginBottom: "3%" }} />
        {[80, 66, 73, 58].map((w, i) => (
          <div key={i} className="flex items-center" style={{ gap: "2%", paddingLeft: "4%", marginBottom: "2%" }}>
            <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />
            <div style={{ width: `${w}%`, height: 1.5, background: "#e5e7eb", borderRadius: 2 }} />
          </div>
        ))}

        <div style={{ height: 1, background: "#e5e7eb", margin: "4% 0" }} />

        <div style={{ width: "22%", height: 2, background: "#d1d5db", borderRadius: 2, marginBottom: "3%" }} />
        {[58, 48, 53].map((w, i) => (
          <div key={i} className="flex items-center" style={{ gap: "2%", paddingLeft: "4%", marginBottom: "2%" }}>
            <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />
            <div style={{ width: `${w}%`, height: 1.5, background: "#e5e7eb", borderRadius: 2 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white" style={{ padding: "10% 8%" }}>
      <div className="flex justify-end" style={{ marginBottom: "6%" }}>
        <div style={{ width: "32%", height: 1.5, background: "#e5e7eb", borderRadius: 2 }} />
      </div>
      {[36, 26].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: 1.5, background: "#e5e7eb", borderRadius: 2, marginBottom: "2%" }} />
      ))}
      <div style={{ marginBottom: "5%" }} />
      <div style={{ width: "44%", height: 1.5, background: "#e5e7eb", borderRadius: 2, marginBottom: "4%" }} />
      {[94, 86, 91, 63].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: 1.5, background: "#e5e7eb", borderRadius: 2, marginBottom: "2%" }} />
      ))}
      <div style={{ marginBottom: "4%" }} />
      {[88, 83, 92, 76, 52].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: 1.5, background: "#e5e7eb", borderRadius: 2, marginBottom: "2%" }} />
      ))}
      <div style={{ marginBottom: "4%" }} />
      {[86, 80, 58].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: 1.5, background: "#e5e7eb", borderRadius: 2, marginBottom: "2%" }} />
      ))}
      <div style={{ marginBottom: "8%" }} />
      <div style={{ width: "32%", height: 1.5, background: "#e5e7eb", borderRadius: 2, marginBottom: "2%" }} />
      <div style={{ width: "24%", height: 1.5, background: "#e5e7eb", borderRadius: 2 }} />
    </div>
  );
}

// ── Icon ───────────────────────────────────────────────────────────────
const IconDownload = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

// ── Page ───────────────────────────────────────────────────────────────
export default function ResultadoPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [downloading, setDownloading] = useState<"cv-pdf" | "cv-word" | "carta-pdf" | "carta-word" | null>(null);
  const [cambiosExpanded, setCambiosExpanded] = useState(false);
  const [formato, setFormato] = useState<string>("minimalista");
  const [postulacionId, setPostulacionId] = useState<string | null>(null);
  const savedRef = useRef(false);

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
      const { data: inserted } = await supabase.from("postulaciones").insert({
        user_id: session.user.id,
        tipo: data.modo ?? "adaptar",
        empresa: match?.[1] ?? null,
        cargo: match?.[2] ?? null,
        titulo_postulacion: data.titulo_postulacion ?? null,
        cv_adaptado: data.cv_adaptado,
        carta_presentacion: data.carta_presentacion,
        principales_cambios: data.principales_cambios ?? null,
        sugerencias: data.sugerencias ?? null,
        keywords_totales: data.keywords_totales ?? null,
        keywords_encontradas: data.keywords_encontradas ?? null,
        formato: formato,
      }).select("id").single();
      if (inserted) setPostulacionId(inserted.id);
    });
  }, [data]);

  async function handleDownloadCvPDF() {
    if (!data || downloading) return;
    setDownloading("cv-pdf");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && postulacionId) {
        await supabase
          .from("postulaciones")
          .update({ formato: formato })
          .eq("id", postulacionId);
      }
      const { generateCVPDF } = await import("@/app/components/cv-templates/generatePDF");
      const blob = await generateCVPDF(data.cv_adaptado, formato);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `cv-postulai-${formato}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generando PDF:", error);
    } finally { setDownloading(null); }
  }

  async function handleDownloadCvWord() {
    if (!data || downloading) return;
    setDownloading("cv-word");
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = await import("docx");
      type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
      const parsed: { role: Role; text: string }[] = [];
      let state: "name" | "title" | "contact" | "body" = "name";
      const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
      for (const raw of data.cv_adaptado.split("\n")) {
        if (isSep(raw)) continue;
        const t = raw.replace(/%%%/g, "").replace(/[─━]+/g, "").trim();
        if (t === "") { parsed.push({ role: "blank", text: "" }); continue; }
        const allCaps = t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);
        if (state === "name") { parsed.push({ role: "name", text: t }); state = "title"; }
        else if (state === "title") {
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
      const headerRule = () => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 4 } }, spacing: { after: 120 }, children: [] });
      for (const { role, text } of parsed) {
        switch (role) {
          case "name": children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text.toUpperCase(), font: "Calibri", size: 32, bold: true, color: "000000" })], spacing: { after: 60 } })); break;
          case "title": children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, font: "Calibri", size: 22, color: "555555" })], spacing: { after: 40 } })); break;
          case "contact":
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, font: "Calibri", size: 20, color: "777777" })], spacing: { after: 60 } }));
            if (!ruleDone) { children.push(headerRule()); ruleDone = true; } break;
          case "section":
            if (!ruleDone) { children.push(headerRule()); ruleDone = true; }
            children.push(new Paragraph({ children: [new TextRun({ text: text.toUpperCase(), font: "Calibri", size: 22, bold: true, color: "000000" })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA", space: 4 } }, spacing: { before: 200, after: 80 } })); break;
          case "bullet": children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text, font: "Calibri", size: 22, color: "000000" })], spacing: { after: 40 } })); break;
          case "body": children.push(new Paragraph({ children: [new TextRun({ text, font: "Calibri", size: 22, color: "000000" })], spacing: { after: 60, line: 276 } })); break;
          default: children.push(new Paragraph({ children: [new TextRun({ text: "", font: "Calibri", size: 22 })], spacing: { after: 0 } }));
        }
      }
      const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "cv-postulai.docx";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } finally { setDownloading(null); }
  }

  async function handleDownloadCartaPDF() {
    if (!data || downloading) return;
    setDownloading("carta-pdf");
    try {
      const jspdf = await import("jspdf");
      const doc = new jspdf.jsPDF({ unit: "pt", format: "a4" });
      const margin = 60;
      const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(33, 33, 33);
      const lines = doc.splitTextToSize(data.carta_presentacion, pageWidth);
      doc.text(lines, margin, margin + 20);
      doc.save("carta-postulai.pdf");
    } finally { setDownloading(null); }
  }

  async function handleDownloadCartaWord() {
    if (!data || downloading) return;
    setDownloading("carta-word");
    try {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const children = data.carta_presentacion.split("\n").map(line =>
        new Paragraph({
          children: [new TextRun({ text: line, font: "Calibri", size: 22, color: "111111" })],
          spacing: { after: line.trim() === "" ? 0 : 160, line: 276 },
        })
      );
      const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "carta-postulai.docx";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } finally { setDownloading(null); }
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
  const cambios = data.principales_cambios ?? [];
  const cartaWordCount = data.carta_presentacion.trim().split(/\s+/).filter(Boolean).length;
  const cvText = data.cv_adaptado;
  const cartaText = data.carta_presentacion;

  async function generateCvBlob() {
    const [{ pdf }, { getCVDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/app/components/CVDocumentSelector"),
    ]);
    return pdf(getCVDocument(formato, cvText)).toBlob();
  }

  async function generateCartaBlob() {
    const jspdf = await import("jspdf");
    const doc = new jspdf.jsPDF({ unit: "pt", format: "a4" });
    const margin = 60;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(33, 33, 33);
    const lines = doc.splitTextToSize(cartaText, pageWidth);
    doc.text(lines, margin, margin + 20);
    return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">

        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full border border-[#1e1e1e]" />
          <div className="absolute top-[55%] -right-16 w-44 h-44 rounded-full border border-[#1e1e1e]" />
          <div className="absolute bottom-20 right-20 w-28 h-28 rounded-full border border-[#1e1e1e]" />
        </div>

        <main className="flex-1 px-6 sm:px-10 py-10 sm:py-14 relative">
          <div className="w-full max-w-[960px] mx-auto flex flex-col gap-8">

            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-white/35 uppercase tracking-widest font-semibold">Resultado</p>
                <p className="text-sm text-white/45">{fecha}</p>
              </div>
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
            </div>

            {/* Hero */}
            <HeroBlock data={data} />

            {/* Template selector */}
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold text-white/35 uppercase tracking-widest">Formato del PDF</p>
              <div className="flex flex-wrap gap-2">
                {(["minimalista", "clasico", "moderno", "profesional", "simple"] as const).map(f => {
                  const label: Record<string, string> = {
                    minimalista: "Minimalista", clasico: "Clásico", moderno: "Moderno",
                    profesional: "Profesional", simple: "Simple",
                  };
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormato(f)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 ${
                        formato === f
                          ? "bg-white text-black"
                          : "bg-transparent text-white/50 border border-white/15 hover:border-white/35 hover:text-white/80"
                      }`}
                    >
                      {label[f]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Document cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* CV card */}
              <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden flex flex-col">
                <div className="py-7 px-5 bg-[#111] flex justify-center border-b border-[#1e1e1e]">
                  <div className="shadow-2xl rounded-sm overflow-hidden" style={{ width: 148, aspectRatio: "210/297" }}>
                    <PdfThumbnail key={formato} generate={generateCvBlob} fallback={<DocumentSkeleton type="cv" />} />
                  </div>
                </div>
                <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">CV Adaptado</p>
                    <p className="text-xs text-white/40 mt-0.5">Optimizado ATS 2026</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadCvPDF}
                      disabled={!!downloading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloading === "cv-pdf"
                        ? <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        : <IconDownload />}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCvWord}
                      disabled={!!downloading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-transparent text-white text-xs font-semibold border border-white/20 rounded-lg hover:border-white/40 hover:bg-white/5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloading === "cv-word"
                        ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        : <IconDownload />}
                      Word
                    </button>
                  </div>
                </div>
              </div>

              {/* Carta card */}
              <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden flex flex-col">
                <div className="py-7 px-5 bg-[#111] flex justify-center border-b border-[#1e1e1e]">
                  <div className="shadow-2xl rounded-sm overflow-hidden" style={{ width: 148, aspectRatio: "210/297" }}>
                    <PdfThumbnail generate={generateCartaBlob} fallback={<DocumentSkeleton type="carta" />} />
                  </div>
                </div>
                <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Carta de presentación</p>
                    <p className="text-xs text-white/40 mt-0.5">~{cartaWordCount} palabras</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadCartaPDF}
                      disabled={!!downloading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloading === "carta-pdf"
                        ? <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        : <IconDownload />}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCartaWord}
                      disabled={!!downloading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-transparent text-white text-xs font-semibold border border-white/20 rounded-lg hover:border-white/40 hover:bg-white/5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloading === "carta-word"
                        ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        : <IconDownload />}
                      Word
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Qué cambió */}
            {cambios.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-white/35 uppercase tracking-widest">Qué cambió</p>
                <div className="flex flex-col">
                  {(cambiosExpanded ? cambios : cambios.slice(0, 3)).map((cambio, i) => (
                    <div key={i} className="flex items-start gap-3 py-3 border-b border-white/[0.06] last:border-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0 mt-[6px]" />
                      <span className="text-sm text-white/75 leading-snug">{cambio}</span>
                    </div>
                  ))}
                </div>
                {cambios.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setCambiosExpanded(e => !e)}
                    className="text-xs text-white/35 hover:text-white/60 transition-colors duration-150 text-left flex items-center gap-1"
                  >
                    {cambiosExpanded ? "Ver menos ↑" : `Ver ${cambios.length - 3} más ↓`}
                  </button>
                )}
              </div>
            )}

            {/* Sugerencias */}
            {data.sugerencias.length > 0 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-bold text-white/35 uppercase tracking-widest">Sugerencias</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {data.sugerencias.map((s, i) => (
                    <div key={i} className="relative rounded-2xl px-5 pt-10 pb-6 bg-[#111] border border-[#222]">
                      <span className="absolute top-4 left-4 w-6 h-6 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center text-[10px] font-bold text-[#22c55e] leading-none">
                        {i + 1}
                      </span>
                      <p className="text-sm text-white/75 leading-relaxed">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

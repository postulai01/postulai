"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

interface Postulacion {
  id: string;
  user_id: string;
  tipo: string;
  cargo: string | null;
  empresa: string | null;
  titulo_postulacion: string | null;
  fecha: string;
  cv_adaptado: string;
  carta_presentacion: string;
  principales_cambios: string[] | null;
  sugerencias: string[] | null;
  created_at: string;
  keywords_totales: number | null;
  keywords_encontradas: number | null;
}

// ── Icons ──────────────────────────────────────────────────────────────
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

// ── CV parsing ─────────────────────────────────────────────────────────
type CvRole = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
interface ParsedLine { role: CvRole; text: string; }

function parseCvText(cvText: string): ParsedLine[] {
  const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
  const parsed: ParsedLine[] = [];
  let state: "name" | "title" | "contact" | "body" = "name";
  for (const raw of cvText.split("\n")) {
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
  return parsed;
}

function CVPreviewElements({ text }: { text: string }) {
  const lines = parseCvText(text);
  let ruleDone = false;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { role, text: t } = lines[i];
    switch (role) {
      case "name":
        elements.push(
          <p key={i} style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
            className="text-center font-bold uppercase tracking-widest text-[14px] text-white mb-1.5 leading-tight">{t}</p>
        ); break;
      case "title":
        elements.push(
          <p key={i} style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
            className="text-center text-[11px] text-white/55 mb-0.5 leading-snug">{t}</p>
        ); break;
      case "contact":
        elements.push(
          <p key={i} style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
            className="text-center text-[10px] text-white/45 mb-2.5 leading-snug">{t}</p>
        );
        if (!ruleDone) {
          elements.push(<hr key={`rule-${i}`} className="border-white/25 mb-3 mt-0.5" />);
          ruleDone = true;
        }
        break;
      case "section":
        if (!ruleDone) {
          elements.push(<hr key={`rule-${i}`} className="border-white/25 mb-3 mt-0.5" />);
          ruleDone = true;
        }
        elements.push(
          <p key={i} style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
            className="text-[9.5px] font-bold uppercase tracking-wider text-white/65 border-b border-white/12 pb-1 mt-4 mb-2 leading-none">{t}</p>
        ); break;
      case "bullet":
        elements.push(
          <div key={i} className="flex gap-2 mb-0.5 pl-2.5">
            <span style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
              className="text-white/60 text-[10px] shrink-0 mt-[1px] leading-relaxed">•</span>
            <span style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
              className="text-[10px] text-white/80 leading-relaxed">{t}</span>
          </div>
        ); break;
      case "body":
        elements.push(
          <p key={i} style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
            className="text-[10px] text-white/80 leading-relaxed mb-0.5">{t}</p>
        ); break;
      case "blank":
        elements.push(<div key={i} className="h-2" />);
        break;
    }
  }
  return <>{elements}</>;
}

// ── Hero ───────────────────────────────────────────────────────────────
const ATS_CHECKS = ["Formato de columna única", "Sin tablas ni gráficos", "Máximo 2 páginas"];
const CIRCLE_R = 44;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R;

function HeroBlock({ post }: { post: Postulacion }) {
  const tituloMatch = post.titulo_postulacion?.match(/CV para (.+?) · (.+)/);
  const empresa = tituloMatch?.[1];
  const cargo = tituloMatch?.[2];

  const hasKeywords = (post.keywords_totales ?? 0) > 0;
  const found = post.keywords_encontradas ?? 0;
  const total = post.keywords_totales ?? 0;
  const dashOffset = CIRCLE_C * (1 - (hasKeywords ? found / total : 0));

  return (
    <div className="relative bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
      <div aria-hidden className="absolute -top-14 -left-14 w-52 h-52 rounded-full"
        style={{ border: "0.5px solid rgba(255,255,255,0.07)" }} />
      <div aria-hidden className="absolute -bottom-20 left-32 w-72 h-72 rounded-full"
        style={{ border: "0.5px solid rgba(255,255,255,0.05)" }} />

      <div className="relative z-10 px-8 py-7 flex flex-col sm:flex-row gap-8 items-start sm:items-center">
        {/* Indicador visual */}
        {hasKeywords ? (
          <div className="shrink-0">
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={CIRCLE_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
              <circle
                cx="50" cy="50" r={CIRCLE_R}
                fill="none" stroke="#22c55e" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={CIRCLE_C} strokeDashoffset={dashOffset}
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
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
          <div>
            {hasKeywords ? (
              <>
                <h2 className="text-[28px] sm:text-[34px] leading-tight text-white" style={{ fontWeight: 900 }}>
                  Tu CV cubre{" "}
                  <span className="text-[#22c55e]">{found} de {total}</span>{" "}
                  palabras clave
                </h2>
                <p className="mt-1.5 text-sm text-white/50">
                  {cargo && empresa
                    ? `Coincidencias con la oferta de ${cargo} en ${empresa}`
                    : cargo
                    ? `Coincidencias con la oferta de ${cargo}`
                    : "Coincidencias detectadas en la oferta de trabajo"}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-[28px] sm:text-[34px] leading-tight text-white" style={{ fontWeight: 900 }}>
                  {post.tipo === "adaptar" || (cargo && empresa)
                    ? <>CV adaptado a la <span className="text-[#22c55e]">oferta</span></>
                    : <>CV optimizado para <span className="text-[#22c55e]">ATS 2026</span></>
                  }
                </h2>
                <p className="mt-1.5 text-sm text-white/50">
                  {cargo && empresa
                    ? `${post.tipo === "adaptar" ? "Adaptado" : "Creado"} para ${cargo} en ${empresa}`
                    : cargo
                    ? `${post.tipo === "adaptar" ? "Adaptado" : "Creado"} para ${cargo}`
                    : "Generado con las mejores prácticas para sistemas ATS"}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {ATS_CHECKS.map(check => (
              <span key={check} className="flex items-center gap-1.5 text-xs text-white/55">
                <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {check}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────
export default function HistorialIdPage() {
  const { id } = useParams<{ id: string }>();

  const [post, setPost] = useState<Postulacion | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"cv" | "carta">("cv");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "word" | null>(null);
  const [cambiosExpanded, setCambiosExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  function switchTab(tab: "cv" | "carta") {
    setActiveTab(tab);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  async function copyActive() {
    if (!post) return;
    await navigator.clipboard.writeText(
      activeTab === "cv" ? post.cv_adaptado : post.carta_presentacion
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setNotFound(true); return; }
      const { data, error } = await supabase
        .from("postulaciones")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data || data.user_id !== session.user.id) { setNotFound(true); return; }
      setPost(data as Postulacion);
    });
  }, [id]);

  async function handleDownloadPDF() {
    if (!post || downloading) return;
    setDownloading("pdf");
    try {
      const [{ pdf }, { default: CVDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/app/components/CVDocument"),
      ]);
      const blob = await pdf(<CVDocument cvText={post.cv_adaptado} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "cv-postulai.pdf";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } finally { setDownloading(null); }
  }

  async function handleDownloadWord() {
    if (!post || downloading) return;
    setDownloading("word");
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = await import("docx");
      const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
      type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
      const parsed: { role: Role; text: string }[] = [];
      let state: "name" | "title" | "contact" | "body" = "name";

      for (const raw of post.cv_adaptado.split("\n")) {
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
      const headerRule = () => new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 4 } },
        spacing: { after: 120 }, children: [],
      });

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

  if (notFound) {
    return (
      <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-white/40">Postulación no encontrada.</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="h-screen overflow-hidden bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const fecha = new Date(post.created_at).toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });

  const cambios = post.principales_cambios ?? [];
  const sugerencias = post.sugerencias ?? [];

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">

        {/* Figuras decorativas */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full border border-[#1e1e1e]" />
          <div className="absolute top-[55%] -right-16 w-44 h-44 rounded-full border border-[#1e1e1e]" />
          <div className="absolute bottom-20 right-20 w-28 h-28 rounded-full border border-[#1e1e1e]" />
        </div>

        <main className="flex-1 px-6 sm:px-10 py-10 sm:py-14 relative">
          <div className="w-full max-w-[960px] mx-auto flex flex-col gap-8">

            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-white/35 uppercase tracking-widest font-semibold">
                  {post.tipo === "adaptar" ? "CV Adaptado" : "CV Creado"}
                </p>
                <p className="text-sm text-white/45">{fecha}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
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

            {/* Hero */}
            <HeroBlock post={post} />

            {/* Grid asimétrico */}
            <div className="grid grid-cols-1 md:grid-cols-[5fr_3fr] gap-6 items-start">

              {/* Card CV / Carta con tabs */}
              <div className="bg-[#111] border border-[#222] rounded-2xl flex flex-col overflow-hidden">
                <div className="px-4 border-b border-[#222] flex items-center justify-between gap-2">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => switchTab("cv")}
                      className={`relative px-3 py-4 text-sm font-semibold transition-colors duration-150 flex items-center gap-2 ${
                        activeTab === "cv" ? "text-white" : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      CV Adaptado
                      {activeTab === "cv" && (
                        <>
                          <span className="text-xs text-[#aaa] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md font-normal">ATS 2026</span>
                          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-white rounded-t-full" />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTab("carta")}
                      className={`relative px-3 py-4 text-sm font-semibold transition-colors duration-150 ${
                        activeTab === "carta" ? "text-white" : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      Carta de presentación
                      {activeTab === "carta" && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-white rounded-t-full" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={copyActive}
                    className="flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors duration-150 px-3 py-1.5 border border-white/20 rounded-lg hover:border-white/40 shrink-0"
                  >
                    {copied ? <><IconCheck />Copiado</> : <><IconCopy />Copiar</>}
                  </button>
                </div>
                <div className="relative flex-1 min-h-0">
                  <div className="absolute top-0 inset-x-0 h-7 bg-gradient-to-b from-[#111] to-transparent pointer-events-none z-10" />
                  <div ref={scrollRef} className="overflow-y-auto max-h-[580px] md:max-h-[660px] px-7 py-5">
                    {activeTab === "cv"
                      ? <CVPreviewElements text={post.cv_adaptado} />
                      : <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{post.carta_presentacion}</p>
                    }
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#111] to-transparent pointer-events-none z-10" />
                </div>
              </div>

              {/* Qué cambió — lista liviana */}
              {cambios.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs font-bold text-white/35 uppercase tracking-widest px-1 mb-1">Qué cambió</p>
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
                      className="text-xs text-white/35 hover:text-white/60 transition-colors duration-150 text-left px-1 pt-1 flex items-center gap-1"
                    >
                      {cambiosExpanded ? "Ver menos ↑" : `Ver ${cambios.length - 3} más ↓`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sugerencias */}
            {sugerencias.length > 0 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-bold text-white/35 uppercase tracking-widest">Sugerencias</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {sugerencias.map((s, i) => (
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

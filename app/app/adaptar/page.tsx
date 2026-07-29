"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";
import UsosAgotadosModal from "@/app/components/UsosAgotadosModal";

const textareaClass =
  "w-full bg-[#0d0d0d] border border-[#232323] rounded-xl px-4 py-3.5 text-base text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/25 transition-colors duration-150 leading-relaxed";


type CvStatus = "idle" | "loading" | "success" | "error";

export default function AdaptarPage() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [cvText, setCvText] = useState("");
  const [cvStatus, setCvStatus] = useState<CvStatus>("idle");
  const [isDragOver, setIsDragOver] = useState(false);

  const [ofertaText, setOfertaText] = useState("");

  const [instrucciones, setInstrucciones] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function processFile(file: File) {
    setFileName(file.name);
    setCvStatus("loading");
    setCvText("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al leer el archivo");
      setCvText(data.texto);
      setCvStatus("success");
    } catch {
      setCvStatus("error");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/process-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "adaptar",
          cv: cvText,
          oferta: ofertaText,
          instrucciones: instrucciones || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 403 && data.error === "sin_usos") {
        setShowModal(true);
        setLoading(false);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error || "Error desconocido");

      sessionStorage.setItem(
        "postulai_resultado",
        JSON.stringify({ ...data, generadoEn: new Date().toISOString(), modo: "adaptar" })
      );
      router.push("/app/resultado");
    } catch {
      setError("Algo salió mal, intenta de nuevo");
      setLoading(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <main className="flex-1 px-6 md:px-12 py-10 md:py-14">
          <div className="w-full max-w-[760px] mx-auto flex flex-col gap-7">

            {/* Heading */}
            <div className="flex flex-col gap-2">
              <h1
                className="font-bold text-white tracking-tight"
                style={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1 }}
              >
                Tu CV, a medida de cada oferta
              </h1>
              <p className="text-base" style={{ color: "rgba(255,255,255,.45)" }}>
                Sube tu currículum, pega la oferta y Postulai hace el resto.
              </p>
            </div>

            {/* Card 1 — Tu currículum */}
            <div
              className="flex flex-col gap-4 rounded-2xl p-6 md:p-7"
              style={{ background: "#141414", border: "1px solid #1e1e1e" }}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: "1px solid #2a2a2a" }}
                >
                  <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,.35)" }}>1</span>
                </span>
                <div>
                  <p className="text-sm font-bold text-white">Tu currículum</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.45)" }}>
                    Sube tu archivo en PDF o Word (.docx).
                  </p>
                </div>
              </div>

              {cvStatus === "success" ? (
                <div
                  className="rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                  style={{ background: "#0d0d0d", border: "1px solid #232323" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{fileName}</p>
                      <p className="text-xs text-green-400 mt-0.5">CV cargado correctamente</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCvStatus("idle"); setFileName(null); setCvText(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs hover:text-white/70 transition-colors duration-150 shrink-0"
                    style={{ color: "rgba(255,255,255,.35)" }}
                  >
                    Cambiar
                  </button>
                </div>
              ) : cvStatus === "loading" ? (
                <div
                  className="rounded-xl px-5 py-4 flex items-center gap-3"
                  style={{ background: "#0d0d0d", border: "1px solid #232323" }}
                >
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                  <span className="text-sm" style={{ color: "rgba(255,255,255,.45)" }}>
                    Leyendo {fileName}...
                  </span>
                </div>
              ) : cvStatus === "error" ? (
                <div className="rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <p className="text-sm text-red-400">No se pudo leer el archivo. Intenta con otro.</p>
                  <button
                    type="button"
                    onClick={() => { setCvStatus("idle"); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs hover:text-white/70 transition-colors duration-150 shrink-0"
                    style={{ color: "rgba(255,255,255,.35)" }}
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-5 text-center cursor-pointer transition-all duration-200"
                  style={{
                    borderColor: isDragOver ? "#22c55e" : "#2a2a2a",
                    background: isDragOver ? "rgba(34,197,94,0.04)" : "transparent",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <svg
                    className="w-9 h-9 transition-colors duration-200"
                    style={{ color: isDragOver ? "#22c55e" : "rgba(255,255,255,.2)" }}
                    fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div className="flex flex-col gap-1.5">
                    <p
                      className="text-base font-bold transition-colors duration-200"
                      style={{ color: isDragOver ? "#22c55e" : "#fff" }}
                    >
                      {isDragOver ? "Suelta para subir" : "Tu currículum"}
                    </p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,.45)" }}>
                      PDF o Word — arrastra aquí o haz click para buscar.
                    </p>
                  </div>
                  {!isDragOver && (
                    <button
                      type="button"
                      className="px-5 py-2 border rounded-lg text-sm font-medium text-white hover:border-white/40 transition-colors duration-150"
                      style={{ borderColor: "rgba(255,255,255,.18)" }}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      Subir CV
                    </button>
                  )}
                </div>
              )}

              <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Card 2 — Oferta de trabajo */}
            <div
              className="flex flex-col gap-4 rounded-2xl p-6 md:p-7"
              style={{ background: "#141414", border: "1px solid #1e1e1e" }}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: "1px solid #2a2a2a" }}
                >
                  <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,.35)" }}>2</span>
                </span>
                <div>
                  <p className="text-sm font-bold text-white">Oferta de trabajo</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.45)" }}>
                    Pega el texto o el link de la oferta.
                  </p>
                </div>
              </div>

              <textarea
                rows={7}
                placeholder="Pega aquí el texto completo de la oferta de trabajo..."
                value={ofertaText}
                onChange={(e) => setOfertaText(e.target.value)}
                className={textareaClass}
              />
            </div>

            {/* Card 3 — Instrucciones adicionales */}
            <div
              className="flex flex-col gap-4 rounded-2xl p-6 md:p-7"
              style={{ background: "#141414", border: "1px solid #1e1e1e" }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: "1px solid #2a2a2a" }}
                >
                  <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,.35)" }}>3</span>
                </span>
                <span className="text-sm font-bold text-white">Instrucciones adicionales</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-md"
                  style={{
                    color: "rgba(255,255,255,.35)",
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  Opcional
                </span>
              </div>
              <textarea
                rows={3}
                placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                className={textareaClass}
              />
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || cvStatus !== "success" || !ofertaText.trim()}
              className="w-full py-4 bg-white text-black font-bold rounded-xl text-base tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Procesando..." : "Adaptar mi currículum →"}
            </button>

            {loading && (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-sm" style={{ color: "rgba(255,255,255,.45)" }}>
                  Postulai está adaptando tu currículum...
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-400"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}>
                {error}
              </div>
            )}

          </div>
        </main>
      </div>

      <UsosAgotadosModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

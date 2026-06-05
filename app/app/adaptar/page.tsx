"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { saveHistorialEntry } from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors duration-150";

type CvStatus = "idle" | "loading" | "success" | "error";

const ALLOWED_EMAIL = "pedro.ignacio.heresi@gmail.com";

export default function AdaptarPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      if (session.user.email !== ALLOWED_EMAIL) { router.replace("/"); }
    });
  }, [router]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [cvText, setCvText] = useState("");
  const [cvStatus, setCvStatus] = useState<CvStatus>("idle");

  const [ofertaMode, setOfertaMode] = useState<"texto" | "link">("texto");
  const [ofertaText, setOfertaText] = useState("");

  const [instrucciones, setInstrucciones] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setCvStatus("loading");
    setCvText("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al leer el archivo");

      setCvText(data.texto);
      setCvStatus("success");
    } catch {
      setCvStatus("error");
    }
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      let oferta = ofertaText;

      if (ofertaMode === "link") {
        const fetchRes = await fetch("/api/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: ofertaText }),
        });
        const fetchData = await fetchRes.json();
        if (!fetchRes.ok || fetchData.error) {
          setError("No pudimos leer esa página. Intenta pegar el texto directamente.");
          setLoading(false);
          return;
        }
        oferta = fetchData.texto;
      }

      const res = await fetch("/api/process-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "adaptar",
          cv: cvText,
          oferta,
          instrucciones: instrucciones || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error desconocido");

      sessionStorage.setItem(
        "postulai_resultado",
        JSON.stringify({ ...data, generadoEn: new Date().toISOString(), modo: "adaptar" })
      );
      const titulo = data.titulo_postulacion ??
        oferta.split("\n").find((l) => l.trim().length > 3)?.trim().slice(0, 60) ??
        "Oferta de trabajo";
      saveHistorialEntry({ titulo, fecha: new Date().toISOString(), tipo: "adaptado" });
      router.push("/app/resultado");
    } catch {
      setError("Algo salió mal, intenta de nuevo");
      setLoading(false);
    }
  }

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

      <main
        className="flex-1 flex flex-col px-6 sm:px-10 py-10 sm:py-16 relative"
      >
        <div className="w-full max-w-[900px] mx-auto flex flex-col gap-8">

          {/* Encabezado */}
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] sm:text-[34px] font-bold text-white tracking-tight">Tu CV, a medida de cada oferta</h1>
            <p className="text-[#aaa] text-base">Sube tu currículum, pega la oferta y Postulai hace el resto.</p>
          </div>

          {/* Subir CV */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-white">Tu currículum</p>
              <p className="text-xs text-[#aaa] mt-0.5">Sube tu archivo en PDF o Word (.docx).</p>
            </div>

            {cvStatus === "success" ? (
              <div className="border border-[#222] bg-[#111] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
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
                  className="text-xs text-white/40 hover:text-white/70 transition-colors duration-150 shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : cvStatus === "loading" ? (
              <div className="border border-[#222] bg-[#111] rounded-xl px-5 py-4 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                <span className="text-sm text-[#aaa]">Leyendo {fileName}...</span>
              </div>
            ) : cvStatus === "error" ? (
              <div className="border border-red-500/30 bg-red-500/10 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-red-400">No se pudo leer el archivo. Intenta con otro.</p>
                <button
                  type="button"
                  onClick={() => { setCvStatus("idle"); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors duration-150 shrink-0"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-[#222] bg-[#111] rounded-xl p-10 flex flex-col items-center justify-center gap-5 text-center cursor-pointer hover:border-white/20 transition-colors duration-200"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-9 h-9 text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="flex flex-col gap-1.5">
                  <p className="text-base font-bold text-white">Tu currículum</p>
                  <p className="text-sm text-[#aaa]">PDF o Word — arrastra aquí o haz click para buscar.</p>
                </div>
                <button
                  type="button"
                  className="px-5 py-2 border border-white/20 rounded-lg text-sm font-medium text-white hover:border-white/40 transition-colors duration-150"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  Subir CV
                </button>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Oferta de trabajo */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-white">Oferta de trabajo</p>
              <p className="text-xs text-[#aaa] mt-0.5">Pega el texto o el link de la oferta.</p>
            </div>
            <div className="flex gap-1 bg-[#111] border border-[#222] rounded-lg p-1 w-fit">
              {(["texto", "link"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setOfertaMode(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ${
                    ofertaMode === tab ? "bg-white text-black" : "text-white/50 hover:text-white"
                  }`}
                >
                  {tab === "texto" ? "Pegar texto" : "Pegar link"}
                </button>
              ))}
            </div>
            {ofertaMode === "texto" ? (
              <textarea
                rows={7}
                placeholder="Pega aquí el texto completo de la oferta de trabajo..."
                value={ofertaText}
                onChange={(e) => setOfertaText(e.target.value)}
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors duration-150 leading-relaxed"
              />
            ) : (
              <input
                type="url"
                placeholder="https://..."
                value={ofertaText}
                onChange={(e) => setOfertaText(e.target.value)}
                className={inputClass}
              />
            )}
          </div>

          {/* Instrucciones adicionales */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Instrucciones adicionales</span>
              <span className="text-xs text-[#aaa] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">Opcional</span>
            </div>
            <textarea
              rows={3}
              placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors duration-150 leading-relaxed"
            />
          </div>

          {/* Botón principal */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || cvStatus !== "success" || !ofertaText.trim()}
            className="w-full py-4 bg-white text-black font-bold rounded-xl text-base tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Procesando..." : "Adaptar mi currículum →"}
          </button>

          {loading && (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-[#aaa]">Postulai está adaptando tu currículum...</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

        </div>
      </main>

      </div>
    </div>
  );
}

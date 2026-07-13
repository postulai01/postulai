"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveHistorialEntry } from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full bg-[#111] border border-[#232323] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors duration-150";

type CvStatus = "idle" | "loading" | "success" | "error";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AdaptarPage() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [cvText, setCvText] = useState("");
  const [cvStatus, setCvStatus] = useState<CvStatus>("idle");

  const [ofertaMode, setOfertaMode] = useState<"texto" | "link">("texto");
  const [ofertaText, setOfertaText] = useState("");

  const [instrucciones, setInstrucciones] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account chip state
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setUserName(session.user.user_metadata?.full_name ?? session.user.email ?? null);
      setUserEmail(session.user.email ?? null);
    });
  }, []);

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
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Header */}
      <header
        className="relative z-50 shrink-0 flex items-center justify-between px-5 md:px-10"
        style={{ height: 64, borderBottom: "1px solid #1a1a1a" }}
      >
        <a
          href="/app"
          className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity duration-150"
          style={{ color: "rgba(255,255,255,.7)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Inicio
        </a>

        <div className="relative">
          {userName ? (
            <>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-opacity duration-150 hover:opacity-90"
                style={{ background: "#141414", border: "1px solid #2a2a2a" }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "#232323" }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
                    {getInitials(userName)}
                  </span>
                </div>
                <span className="hidden sm:block text-xs font-medium text-white">
                  {userName.split(" ")[0]}
                </span>
                <svg
                  className={`w-3 h-3 shrink-0 transition-transform duration-150 ${accountOpen ? "rotate-180" : ""}`}
                  style={{ color: "rgba(255,255,255,.3)" }}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>

              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
                  <div
                    className="absolute top-full right-0 mt-2 w-56 rounded-xl overflow-hidden shadow-2xl z-20"
                    style={{ background: "#161616", border: "1px solid #2a2a2a" }}
                  >
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid #2a2a2a" }}>
                      <p className="text-xs font-semibold text-white truncate">{userName}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>{userEmail}</p>
                    </div>
                    <div className="py-1.5">
                      <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.55)" }}>Mi plan</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ color: "rgba(255,255,255,.3)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
                        >
                          Prueba gratuita · 7 días
                        </span>
                      </div>
                      <a href="/terminos" className="block px-4 py-2 text-xs hover:bg-white/5 transition-colors duration-150" style={{ color: "rgba(255,255,255,.55)" }}>
                        Términos y condiciones
                      </a>
                      <a href="/privacidad" className="block px-4 py-2 text-xs hover:bg-white/5 transition-colors duration-150" style={{ color: "rgba(255,255,255,.55)" }}>
                        Política de privacidad
                      </a>
                      <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.55)" }}>Ayuda</span>
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,.3)" }}>contacto@postulai.cl</span>
                      </div>
                      <div style={{ borderTop: "1px solid #2a2a2a", margin: "6px 0 4px" }} />
                      <button
                        type="button"
                        onClick={async () => {
                          setAccountOpen(false);
                          await supabase.auth.signOut();
                          router.push("/login");
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors duration-150"
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <a href="/login" className="text-xs font-medium hover:opacity-80 transition-opacity duration-150" style={{ color: "rgba(255,255,255,.5)" }}>
              Iniciar sesión
            </a>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-5 py-10 md:px-10 md:py-16">
        <div className="w-full max-w-[740px] mx-auto flex flex-col gap-8">

          {/* Heading */}
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] sm:text-[34px] font-bold text-white tracking-tight">Tu CV, a medida de cada oferta</h1>
            <p className="text-base" style={{ color: "rgba(255,255,255,.5)" }}>Sube tu currículum, pega la oferta y Postulai hace el resto.</p>
          </div>

          {/* Subir CV */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-white">Tu currículum</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>Sube tu archivo en PDF o Word (.docx).</p>
            </div>

            {cvStatus === "success" ? (
              <div className="border bg-[#111] rounded-xl px-5 py-4 flex items-center justify-between gap-4" style={{ borderColor: "#232323" }}>
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
                  className="text-xs hover:text-white/70 transition-colors duration-150 shrink-0"
                  style={{ color: "rgba(255,255,255,.4)" }}
                >
                  Cambiar
                </button>
              </div>
            ) : cvStatus === "loading" ? (
              <div className="border bg-[#111] rounded-xl px-5 py-4 flex items-center gap-3" style={{ borderColor: "#232323" }}>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>Leyendo {fileName}...</span>
              </div>
            ) : cvStatus === "error" ? (
              <div className="border border-red-500/30 bg-red-500/10 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-red-400">No se pudo leer el archivo. Intenta con otro.</p>
                <button
                  type="button"
                  onClick={() => { setCvStatus("idle"); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-xs hover:text-white/70 transition-colors duration-150 shrink-0"
                  style={{ color: "rgba(255,255,255,.4)" }}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed bg-[#111] rounded-xl p-10 flex flex-col items-center justify-center gap-5 text-center cursor-pointer hover:border-white/20 transition-colors duration-200"
                style={{ borderColor: "#232323" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-9 h-9" style={{ color: "rgba(255,255,255,.2)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="flex flex-col gap-1.5">
                  <p className="text-base font-bold text-white">Tu currículum</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>PDF o Word — arrastra aquí o haz click para buscar.</p>
                </div>
                <button
                  type="button"
                  className="px-5 py-2 border rounded-lg text-sm font-medium text-white hover:border-white/40 transition-colors duration-150"
                  style={{ borderColor: "rgba(255,255,255,.2)" }}
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
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>Pega el texto o el link de la oferta.</p>
            </div>
            <div className="flex gap-1 bg-[#111] rounded-lg p-1 w-fit" style={{ border: "1px solid #232323" }}>
              {(["texto", "link"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setOfertaMode(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ${
                    ofertaMode === tab ? "bg-white text-black" : "hover:text-white"
                  }`}
                  style={ofertaMode !== tab ? { color: "rgba(255,255,255,.5)" } : {}}
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
                className="w-full bg-[#111] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/25 transition-colors duration-150 leading-relaxed"
                style={{ border: "1px solid #232323" }}
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
              <span
                className="text-xs px-2 py-0.5 rounded-md"
                style={{ color: "rgba(255,255,255,.4)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
              >
                Opcional
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              className="w-full bg-[#111] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/25 transition-colors duration-150 leading-relaxed"
              style={{ border: "1px solid #232323" }}
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
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>Postulai está adaptando tu currículum...</span>
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
  );
}

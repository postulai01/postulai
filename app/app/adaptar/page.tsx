"use client";

import { useRef, useState } from "react";

const inputClass =
  "w-full bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors duration-150";

export default function AdaptarPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [ofertaMode, setOfertaMode] = useState<"texto" | "link">("texto");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Navbar */}
      <header className="w-full border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-black tracking-tight text-white hover:opacity-80 transition-opacity duration-150">
            Postul<span className="text-[#9CA3AF]">ai</span>
          </a>
          <button className="text-sm font-medium text-white/60 hover:text-white transition-colors duration-150">
            Mi cuenta
          </button>
        </div>
      </header>

      <main
        className="flex-1 flex flex-col items-center px-6 py-14"
        style={{
          backgroundImage: "linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="w-full max-w-[700px] flex flex-col gap-8">

          {/* Encabezado */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Tu CV, a medida de cada oferta</h1>
            <p className="text-[#A0A0A0] text-base">Sube tu currículum, pega la oferta y Postulai hace el resto.</p>
          </div>

          {/* Subir CV */}
          <div
            className="border-2 border-dashed border-[#222] bg-[#111] rounded-xl p-10 flex flex-col items-center justify-center gap-5 text-center cursor-pointer hover:border-white/20 transition-colors duration-200"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-9 h-9 text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-bold text-white">{fileName ?? "Tu currículum"}</p>
              <p className="text-sm text-[#A0A0A0]">{fileName ? "Click para cambiar" : "Sube tu archivo en PDF o Word."}</p>
            </div>
            <button
              type="button"
              className="px-5 py-2 border border-white/20 rounded-lg text-sm font-medium text-white hover:border-white/40 transition-colors duration-150"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              Subir CV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Oferta de trabajo */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-white">Oferta de trabajo</p>
              <p className="text-xs text-[#A0A0A0] mt-0.5">Pega el texto o el link de la oferta.</p>
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
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors duration-150 leading-relaxed"
              />
            ) : (
              <input type="url" placeholder="https://..." className={inputClass.replace("bg-[#0A0A0A]", "bg-[#111]")} />
            )}
          </div>

          {/* Instrucciones adicionales */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Instrucciones adicionales</span>
              <span className="text-xs text-[#A0A0A0] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">Opcional</span>
            </div>
            <textarea
              rows={3}
              placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors duration-150 leading-relaxed"
            />
          </div>

          {/* Botón */}
          <button
            type="button"
            className="w-full py-4 bg-white text-black font-bold rounded-xl text-base tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
          >
            Adaptar mi currículum →
          </button>

        </div>
      </main>

    </div>
  );
}

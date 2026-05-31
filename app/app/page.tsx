"use client";

import { useRef, useState } from "react";

export default function AppPage() {
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
          <a href="/" className="text-xl font-black tracking-tight text-white hover:opacity-80 transition-opacity duration-150">Postulai</a>
          <button className="text-sm font-medium text-white/60 hover:text-white transition-colors duration-150">
            Mi cuenta
          </button>
        </div>
      </header>

      {/* Banner vista previa */}
      <div className="w-full bg-white border-b border-gray-200 px-6 py-3 text-center text-sm text-black">
        Estás viendo una vista previa. El producto completo estará disponible pronto —{" "}
        <a href="/" className="underline underline-offset-2 hover:text-gray-600 transition-colors duration-150">
          inscríbete en la lista de espera
        </a>{" "}
        para ser el primero.
      </div>

      <main className="flex-1 flex flex-col items-center px-6 py-14">
        <div className="w-full max-w-[800px] flex flex-col gap-6">

          {/* Título */}
          <div className="flex flex-col gap-2 mb-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Adapta tu CV</h1>
            <p className="text-[#A0A0A0] text-sm">Sube tu currículum y la oferta de trabajo. Postulai hace el resto.</p>
          </div>

          {/* Dos cajas superiores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Caja izquierda: Tu CV */}
            <div className="border-2 border-dashed border-[#2A2A2A] bg-[#141414] rounded-2xl p-10 flex flex-col items-center justify-center gap-5 text-center min-h-[260px]">
              <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <div className="flex flex-col gap-2">
                <p className="text-xl font-bold text-white">
                  {fileName ? fileName : "Tu currículum"}
                </p>
                <p className="text-base text-[#A0A0A0]">
                  {fileName ? "Click para cambiar" : "Sube tu archivo en PDF o Word."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 px-5 py-2 border border-white/20 rounded-lg text-base font-medium text-white hover:border-white/40 transition-colors duration-150"
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

            {/* Caja derecha: La oferta de trabajo */}
            <div className="border-2 border-dashed border-[#2A2A2A] bg-[#141414] rounded-2xl p-6 flex flex-col gap-4 min-h-[260px]">
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-bold text-white">Oferta de trabajo</p>
                <p className="text-sm text-[#A0A0A0]">Pega el texto o el link de la oferta.</p>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 bg-[#0A0A0A] rounded-lg p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setOfertaMode("texto")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                    ofertaMode === "texto"
                      ? "bg-white text-black"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  Pegar texto
                </button>
                <button
                  type="button"
                  onClick={() => setOfertaMode("link")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                    ofertaMode === "link"
                      ? "bg-white text-black"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  Pegar link
                </button>
              </div>

              {/* Contenido según modo */}
              {ofertaMode === "texto" ? (
                <textarea
                  rows={7}
                  placeholder="Pega aquí el texto completo de la oferta de trabajo..."
                  className="flex-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors duration-150 leading-relaxed"
                />
              ) : (
                <div className="flex-1 flex flex-col justify-center">
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors duration-150"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Campo inferior */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Instrucciones adicionales</span>
              <span className="text-xs text-[#A0A0A0] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">Opcional</span>
            </div>
            <textarea
              rows={4}
              placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded-2xl px-5 py-4 text-white placeholder-white/20 text-base leading-relaxed resize-none focus:outline-none focus:border-white/20 transition-colors duration-150"
            />
          </div>

          {/* Botón final */}
          <button
            type="button"
            className="w-full py-4 bg-white text-black font-bold rounded-xl text-lg tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
          >
            Adaptar mi CV
          </button>

        </div>
      </main>

    </div>
  );
}

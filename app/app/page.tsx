"use client";

import { useRef, useState } from "react";

export default function AppPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Navbar */}
      <header className="w-full border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-white">Postulai</span>
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
                  {fileName ? fileName : "Tu CV"}
                </p>
                <p className="text-base text-[#A0A0A0]">
                  {fileName ? "Click para cambiar" : "Pega el texto o sube el archivo"}
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
            <div className="border-2 border-dashed border-[#2A2A2A] bg-[#141414] rounded-2xl p-10 flex flex-col items-center justify-center gap-5 text-center min-h-[260px]">
              <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <div className="flex flex-col gap-2">
                <p className="text-xl font-bold text-white">La oferta de trabajo</p>
                <p className="text-base text-[#A0A0A0]">Pega el texto o el link de la oferta</p>
              </div>
              <input
                type="url"
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors duration-150"
              />
              <button
                type="button"
                className="px-5 py-2 border border-white/20 rounded-lg text-base font-medium text-white hover:border-white/40 transition-colors duration-150"
              >
                Pegar oferta
              </button>
            </div>

          </div>

          {/* Campo inferior */}
          <textarea
            rows={4}
            placeholder="¿Algo que quieras agregar o cambiar? Cuéntanos aquí..."
            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-2xl px-5 py-4 text-white placeholder-white/20 text-base leading-relaxed resize-none focus:outline-none focus:border-white/20 transition-colors duration-150"
          />

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

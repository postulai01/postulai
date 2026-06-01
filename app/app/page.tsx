"use client";

import { useState } from "react";

export default function AppPage() {
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col">

      {/* Banner vista previa */}
      {bannerVisible && (
        <div className="relative w-full bg-white border-b border-gray-200 px-6 py-3 text-center text-sm text-black shrink-0">
          Estás viendo una vista previa. El producto completo estará disponible pronto —{" "}
          <a href="/" className="underline underline-offset-2 hover:text-gray-600 transition-colors duration-150">
            inscríbete en la lista de espera
          </a>{" "}
          para ser el primero.
          <button
            onClick={() => setBannerVisible(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors duration-150 p-1"
            aria-label="Cerrar banner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Layout principal */}
      <div className="flex flex-1 min-h-0">

        {/* Barra lateral */}
        <aside className="w-[280px] shrink-0 bg-[#0D0D0D] border-r border-[#1a1a1a] flex flex-col">

          {/* Logo */}
          <div className="px-6 py-5 border-b border-[#1a1a1a]">
            <a href="/" className="text-xl font-black tracking-tight text-white hover:opacity-70 transition-opacity duration-150">
              Postul<span className="text-[#9CA3AF]">ai</span>
            </a>
          </div>

          {/* Postulaciones */}
          <div className="flex-1 flex flex-col gap-4 px-6 py-5 overflow-y-auto">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">
              Últimas postulaciones
            </p>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-white/20 text-center leading-relaxed">
                Aún no tienes postulaciones.
              </p>
            </div>
          </div>

          {/* Mi cuenta */}
          <div className="px-6 py-4 border-t border-[#1a1a1a]">
            <p className="text-sm text-white/30 hover:text-white/60 transition-colors duration-150 cursor-pointer">
              Mi cuenta
            </p>
          </div>

        </aside>

        {/* Contenido principal */}
        <main
          className="flex-1 flex flex-col items-center justify-center px-10 overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(circle, #161616 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        >
          <div className="w-full max-w-[680px] flex flex-col gap-8">

            {/* Encabezado */}
            <div className="flex flex-col gap-3">
              <h1 className="text-4xl font-black text-white tracking-tight leading-tight" style={{ fontWeight: 900 }}>
                Tu próxima entrevista empieza aquí.
              </h1>
              <p className="text-[#A0A0A0] text-base leading-relaxed mb-2">
                Tú nos das la información. Nosotros te conseguimos la entrevista.
              </p>
            </div>

            {/* Tarjetas */}
            <div className="flex flex-col gap-3">

              <a
                href="/app/crear"
                className="group flex items-center gap-5 bg-[#111] border border-[#1e1e1e] rounded-xl p-7 hover:border-white/15 transition-colors duration-200"
              >
                <div className="w-11 h-11 bg-[#1a1a1a] rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-lg font-bold text-white leading-snug">Cuéntanos tu historia, nosotros el CV</p>
                  <p className="text-[14px] text-[#A0A0A0] leading-relaxed">Completa tu perfil en minutos y creamos tu currículum profesional desde cero.</p>
                </div>
                <span className="text-white/20 group-hover:text-white/60 transition-colors duration-150 shrink-0 text-base">→</span>
              </a>

              <a
                href="/app/adaptar"
                className="group flex items-center gap-5 bg-[#111] border border-[#1e1e1e] rounded-xl p-7 hover:border-white/15 transition-colors duration-200"
              >
                <div className="w-11 h-11 bg-[#1a1a1a] rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-lg font-bold text-white leading-snug">Tu CV, a medida de cada oferta</p>
                  <p className="text-[14px] text-[#A0A0A0] leading-relaxed">Sube tu currículum y pega la oferta. Postulai lo adapta para que llegues primero.</p>
                </div>
                <span className="text-white/20 group-hover:text-white/60 transition-colors duration-150 shrink-0 text-base">→</span>
              </a>

            </div>
          </div>
        </main>

      </div>
    </div>
  );
}

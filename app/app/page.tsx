"use client";

import { useState } from "react";
import Sidebar from "@/app/components/Sidebar";

export default function AppPage() {
  const [modalVisible, setModalVisible] = useState<boolean | null>(false);

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col">

      {modalVisible === true && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[400px] mx-6 bg-[#0A0A0A] border border-[#222] rounded-2xl p-8 flex flex-col gap-7">
            <div className="flex justify-center">
              <a href="/" className="text-2xl font-medium text-white hover:opacity-70 transition-opacity duration-150">
                Postulai
              </a>
            </div>
            <div className="flex flex-col gap-1 text-center">
              <h2 className="text-xl font-bold tracking-tight">Bienvenido</h2>
              <p className="text-sm text-[#aaa]">Inicia sesión o crea tu cuenta para continuar</p>
            </div>
            <div className="flex flex-col gap-3">
              <a href="/registro" className="w-full py-3 bg-white text-black font-bold text-sm rounded-xl text-center hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150">
                Crear cuenta
              </a>
              <a href="/login" className="w-full py-3 border border-white/25 text-white font-semibold text-sm rounded-xl text-center hover:border-white/50 hover:bg-white/5 transition-colors duration-150">
                Iniciar sesión
              </a>
            </div>
            <div className="flex justify-center">
              <button type="button" onClick={() => setModalVisible(false)} className="text-xs text-[#555] hover:text-[#888] transition-colors duration-150">
                Continuar sin cuenta →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <Sidebar />

        {/* Contenido principal */}
        <main className="flex-1 flex flex-col items-center justify-center px-8 sm:px-14 overflow-hidden relative">

          {/* Figuras decorativas */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full border border-[#1e1e1e]" />
            <div className="absolute top-[50%] -right-20 w-52 h-52 rounded-full border border-[#1e1e1e]" />
            <div className="absolute -bottom-10 right-28 w-36 h-36 border border-[#1e1e1e] rotate-45" />
          </div>

          {/* Contenido */}
          <div className="w-full max-w-[640px] flex flex-col gap-10 relative">

            {/* Encabezado */}
            <div className="flex flex-col gap-3">
              <h1 className="text-[30px] sm:text-[38px] font-bold text-white tracking-tight leading-tight">
                Tu próxima entrevista<br className="hidden sm:block" /> empieza aquí.
              </h1>
              <p className="text-[#888] text-[15px] leading-relaxed">
                Tú nos das la información. Nosotros te conseguimos la entrevista.
              </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <a
                href="/app/crear"
                className="group relative bg-[#141414] border border-[#222] rounded-xl p-6 flex items-start gap-5 hover:border-[#2a2a2a] hover:bg-[#161616] transition-colors duration-200 overflow-hidden"
              >
                {/* Triángulo decorativo */}
                <div
                  className="absolute top-0 right-0 pointer-events-none"
                  style={{ width: 0, height: 0, borderTop: "40px solid #1e1e1e", borderLeft: "40px solid transparent" }}
                />
                {/* Ícono */}
                <div className="w-10 h-10 bg-[#1e1e1e] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                </div>
                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-[16px] leading-snug">Cuéntanos tu historia, nosotros el CV</p>
                  <p className="text-[#aaa] text-[13px] mt-1.5 leading-relaxed">Completa tu perfil en minutos y creamos tu currículum profesional desde cero.</p>
                  <p className="text-[#ccc] text-[11px] mt-4 font-semibold tracking-[0.08em]">EMPEZAR →</p>
                </div>
              </a>

              <a
                href="/app/adaptar"
                className="group relative bg-[#141414] border border-[#222] rounded-xl p-6 flex items-start gap-5 hover:border-[#2a2a2a] hover:bg-[#161616] transition-colors duration-200 overflow-hidden"
              >
                {/* Triángulo decorativo */}
                <div
                  className="absolute top-0 right-0 pointer-events-none"
                  style={{ width: 0, height: 0, borderTop: "40px solid #1e1e1e", borderLeft: "40px solid transparent" }}
                />
                {/* Ícono */}
                <div className="w-10 h-10 bg-[#1e1e1e] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-[16px] leading-snug">Tu CV, a medida de cada oferta</p>
                  <p className="text-[#aaa] text-[13px] mt-1.5 leading-relaxed">Sube tu currículum y pega la oferta. Postulai lo adapta para que llegues primero.</p>
                  <p className="text-[#ccc] text-[11px] mt-4 font-semibold tracking-[0.08em]">EMPEZAR →</p>
                </div>
              </a>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

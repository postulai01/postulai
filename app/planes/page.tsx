"use client";

import { useState } from "react";

const checkIcon = (
  <svg className="w-4 h-4 text-white/60 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const proFeatures = [
  "Adaptaciones ilimitadas de currículum",
  "Creación de currículum desde cero",
  "Carta de presentación incluida",
  "Formatos compatibles con ATS",
  "Descarga en PDF y Word",
];

const anualFeatures = [
  ...proFeatures,
  "Equivale a más de 5 meses gratis",
];

const faqs = [
  {
    q: "¿Cómo funcionan los usos gratis?",
    a: "Al crear tu cuenta accedes a 5 usos gratis para adaptar tu CV y generar cartas de presentación, sin necesidad de tarjeta de crédito. Cuando los uses, puedes elegir el plan que más te acomode.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, puedes cancelar tu suscripción en cualquier momento desde tu cuenta sin costo adicional.",
  },
  {
    q: "¿En qué formatos recibo mi currículum?",
    a: "Postulai entrega tu currículum adaptado en PDF y Word, listos para enviar directamente al reclutador.",
  },
  {
    q: "¿Funciona para cualquier tipo de trabajo?",
    a: "Sí, Postulai está diseñado para adaptarse a cualquier oferta laboral en Chile, desde cargos técnicos hasta posiciones ejecutivas.",
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#222] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-semibold text-white">{q}</span>
        <svg
          className={`w-4 h-4 text-white/40 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <p className="text-sm text-[#A0A0A0] leading-relaxed pb-5">{a}</p>
      )}
    </div>
  );
}

export default function PlanesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Navbar */}
      <header className="w-full border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-black tracking-tight text-white hover:opacity-80 transition-opacity duration-150">
            Postulai
          </a>
          <a href="/login" className="text-sm font-medium text-white/60 hover:text-white transition-colors duration-150">
            Iniciar sesión
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col">

        {/* Encabezado */}
        <section className="px-6 pt-20 pb-16 flex flex-col items-center text-center gap-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/30">Planes</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight max-w-lg">
            Simple y sin sorpresas
          </h1>
          <p className="text-[#A0A0A0] text-base sm:text-lg max-w-sm">
            Empieza con 5 usos gratis. Sin tarjeta de crédito.
          </p>
        </section>

        {/* Tarjetas */}
        <section className="px-6 pb-20 flex justify-center">
          <div className="w-full max-w-[800px] grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Plan Pro */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-bold tracking-[0.2em] text-white bg-white/10 border border-white/15 px-2.5 py-1 rounded-md w-fit">
                  MÁS POPULAR
                </span>
                <div>
                  <p className="text-lg font-black tracking-tight">Pro</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-4xl font-black tracking-tight">$8.990</span>
                    <span className="text-sm text-[#A0A0A0] font-medium">/mes</span>
                  </div>
                </div>
                <p className="text-sm text-[#A0A0A0]">Para quienes buscan trabajo activamente.</p>
              </div>

              <ul className="flex flex-col gap-3">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/80">
                    {checkIcon}
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2 mt-auto pt-2">
                <a
                  href="/registro"
                  className="w-full py-3 bg-white text-black font-bold text-sm rounded-xl text-center hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
                >
                  Empezar gratis
                </a>
                <p className="text-xs text-[#555] text-center">Sin tarjeta de crédito</p>
              </div>
            </div>

            {/* Plan Anual */}
            <div className="bg-[#111] border border-[#333] rounded-2xl p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-bold tracking-[0.2em] text-white/60 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md w-fit">
                  AHORRA 44%
                </span>
                <div>
                  <p className="text-lg font-black tracking-tight">Anual</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-4xl font-black tracking-tight">$60.000</span>
                    <span className="text-sm text-[#A0A0A0] font-medium">al año</span>
                  </div>
                  <p className="text-xs text-[#555] mt-1">Equivale a $5.000/mes · pago único</p>
                </div>
                <p className="text-sm text-[#A0A0A0]">Para quienes quieren el mejor precio.</p>
              </div>

              <ul className="flex flex-col gap-3">
                {anualFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/80">
                    {checkIcon}
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2 mt-auto pt-2">
                <a
                  href="/registro"
                  className="w-full py-3 border border-white/30 text-white font-bold text-sm rounded-xl text-center hover:border-white/60 hover:bg-white/5 transition-colors duration-150"
                >
                  Empezar gratis
                </a>
                <p className="text-xs text-[#555] text-center">Sin tarjeta de crédito</p>
              </div>
            </div>

          </div>
        </section>

        {/* FAQ */}
        <section className="bg-[#111] border-t border-[#1a1a1a] px-6 py-20">
          <div className="max-w-[640px] mx-auto flex flex-col gap-2">
            <h2 className="text-xl font-black tracking-tight mb-6">Preguntas frecuentes</h2>
            {faqs.map((faq) => (
              <Faq key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-[#0A0A0A] border-t border-white/10 py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-3">
          <span className="text-sm text-white/30">
            Postulai · Hecho en Chile 🇨🇱 ·{" "}
            <a href="mailto:contacto@postulai.cl" className="hover:text-white/60 transition-colors duration-150">
              contacto@postulai.cl
            </a>
          </span>
          <div className="flex items-center gap-5">
            <a href="/terminos" className="text-xs text-white/20 hover:text-white/50 transition-colors duration-150">Términos y condiciones</a>
            <a href="/privacidad" className="text-xs text-white/20 hover:text-white/50 transition-colors duration-150">Privacidad</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

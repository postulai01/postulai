"use client";

import { useEffect, useState } from "react";
import WaitlistForm from "./components/WaitlistForm";

const benefits = [
  {
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: "Adaptado con precisión a cada oferta",
    description:
      "No importa si tienes poca experiencia o mucha. Postulai identifica lo que pide la oferta y reorganiza tu currículum para que el reclutador vea lo que necesita ver.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: "Una carta de presentación que suena a ti",
    description:
      "Sin frases genéricas ni copiar y pegar de internet. Postulai genera una carta adaptada al mercado laboral chileno, directa y profesional.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Más entrevistas, menos esfuerzo",
    description:
      "Deja de invertir horas en cada postulación. Postulai optimiza tu perfil en segundos para que puedas enfocarte en lo que importa: preparar la entrevista.",
  },
];

export default function Home() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Navbar — negro */}
      <header className="w-full border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="text-xl font-black tracking-tight text-white hover:opacity-80 transition-opacity duration-150">
            Postulai
          </a>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-white/60">
            <a href="#como-funciona" className="hover:text-white transition-colors duration-150">¿Cómo funciona?</a>
            <a href="#beneficios" className="hover:text-white transition-colors duration-150">¿Por qué Postulai?</a>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden text-white/70 hover:text-white transition-colors duration-150 p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t border-white/10 bg-[#0A0A0A] px-6 py-5 flex flex-col gap-5">
            <a href="#como-funciona" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-150">¿Cómo funciona?</a>
            <a href="#beneficios" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-150">¿Por qué Postulai?</a>
          </div>
        )}
      </header>

      <main className="flex-1">

        {/* Hero — NEGRO */}
        <section className="bg-[#0A0A0A] px-6 py-20">
          <div className="max-w-6xl mx-auto flex flex-col gap-10">
            <div className="inline-flex items-center border border-black bg-white text-black text-[10px] font-semibold uppercase tracking-[0.2em] px-4 py-1.5 w-fit">
              Acceso anticipado disponible
            </div>

            <h1 className="text-white leading-none tracking-tight max-w-4xl" style={{ fontSize: 'clamp(3rem, 8vw, 7rem)', fontWeight: 900 }}>
              Tu currículum, listo para cada trabajo que quieras.
            </h1>

            <p className="text-lg sm:text-xl text-[#A0A0A0] max-w-2xl leading-relaxed">
              Sube tu currículum y la oferta de trabajo que te interesa. Postulai lo adapta y lo
              deja listo para enviar en menos de 30 segundos.
            </p>

            <WaitlistForm variant="dark" />

            <p className="text-sm text-white/30">
              Sin spam. Solo te avisamos cuando esté lista.
            </p>
          </div>
        </section>

        {/* ATS — BLANCO */}
        <section id="como-funciona" className="bg-white px-6 py-20 scroll-mt-[72px]">
          <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Dato que pocos conocen
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-black leading-tight">
              El 75% de los currículums nunca llegan a un reclutador
            </h2>
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
              Las empresas grandes filtran candidatos automáticamente antes de que un humano vea tu CV. Postulai crea y adapta tu currículum con la estructura correcta, las palabras clave exactas de la oferta, y el formato que exigen los sistemas de selección más usados en Chile. Tu currículum llega donde otros no llegan.
            </p>
          </div>
        </section>

        {/* Benefits + Tagline — NEGRO */}
        <section id="beneficios" className="bg-[#0A0A0A] px-6 py-20 scroll-mt-[72px]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-4">
              ¿Por qué Postulai?
            </h2>
            <p className="text-[#A0A0A0] text-center mb-12 max-w-xl mx-auto">
              Cada postulación exige tiempo, energía y precisión. Postulai se encarga de eso por ti.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="flex flex-col gap-4 bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-white/8 transition-colors duration-200"
                >
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    {b.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">{b.title}</h3>
                  <p className="text-[#A0A0A0] text-sm leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-20 text-center">
              <p className="text-white font-black leading-none tracking-tight" style={{ fontSize: 'clamp(3rem, 10vw, 8rem)' }}>
                Postulai y listo.
              </p>
            </div>
          </div>
        </section>

        {/* Second CTA — BLANCO */}
        <section id="unirse" className="bg-white px-6 py-20 border-t border-slate-100 scroll-mt-[72px]">
          <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-black max-w-2xl leading-tight mb-4">
              ¿Listo para postular mejor?
            </h2>
            <p className="text-slate-500 max-w-md text-lg mb-12">
              Los primeros en entrar tendrán acceso anticipado. No te quedes fuera.
            </p>
            <WaitlistForm variant="light" centered />
          </div>
        </section>

      </main>

      {/* Footer — NEGRO */}
      <footer className="bg-[#0A0A0A] border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-white/50">
          <span className="text-lg font-bold text-white tracking-tight">Postulai</span>
          <span className="text-base">Hecho en Chile 🇨🇱</span>
          <div className="flex items-center gap-4">
            <a href="mailto:contacto@postulai.cl" className="text-base hover:text-white transition-colors duration-150">
              contacto@postulai.cl
            </a>
            <a
              href="https://instagram.com/postulai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-base hover:text-white transition-colors duration-150"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              @postulai
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

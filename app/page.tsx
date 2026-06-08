"use client";

import { Space_Grotesk } from "next/font/google";
import { useEffect, useState } from "react";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

type FormStatus = "idle" | "loading" | "success" | "error";

function WaitlistForm({ centered = false, theme = "dark" }: { centered?: boolean; theme?: "dark" | "light" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const dark = theme === "dark";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Ocurrió un error. Intenta de nuevo.");
        setStatus("error");
        return;
      }
      setStatus("success");
      setEmail("");
    } catch {
      setErrorMsg("Ocurrió un error. Intenta de nuevo.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p style={{ fontSize: 14, color: dark ? "#888888" : "#666666", textAlign: centered ? "center" : "left" }}>
        ¡Te avisamos cuando esté listo. Gracias por tu interés!
      </p>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 480, margin: centered ? "0 auto" : undefined }}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          disabled={status === "loading"}
          className="flex-1"
          style={{
            padding: "13px 16px",
            background: dark ? "#141414" : "#F5F5F5",
            border: dark ? "0.5px solid #333" : "0.5px solid #DDDDDD",
            borderRadius: 10,
            color: dark ? "white" : "#0A0A0A",
            fontSize: 15,
            fontFamily: "inherit",
            outline: "none",
            opacity: status === "loading" ? 0.6 : 1,
          }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-submit"
          style={{
            padding: "13px 24px",
            background: dark ? "white" : "#0A0A0A",
            color: dark ? "#0A0A0A" : "white",
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            fontSize: 15,
            fontFamily: "inherit",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            opacity: status === "loading" ? 0.6 : 1,
            transition: "transform 150ms ease",
          }}
        >
          {status === "loading" ? "Guardando…" : "Lista de espera →"}
        </button>
      </form>
      {status === "error" && (
        <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{errorMsg}</p>
      )}
    </div>
  );
}

const benefits = [
  { title: "Adaptado con precisión a cada oferta", desc: "No importa si tienes poca experiencia o mucha. Postulai identifica lo que pide la oferta y reorganiza tu currículum para que el reclutador vea lo que necesita ver." },
  { title: "Una carta de presentación que suena a ti", desc: "Sin frases genéricas ni copiar y pegar de internet. Postulai genera una carta adaptada al mercado laboral chileno, directa y profesional." },
  { title: "Más entrevistas, menos esfuerzo", desc: "Deja de invertir horas en cada postulación. Postulai optimiza tu perfil en segundos para que puedas enfocarte en lo que importa: preparar la entrevista." },
  { title: "Encuentra dónde quieres trabajar", desc: "Dinos qué empresa o tipo de trabajo te interesa. Postulai detecta las oportunidades disponibles en el mercado laboral chileno y adapta tu perfil para que llegues primero." },
];

function MartinaCv({ borderLeft = false }: { borderLeft?: boolean }) {
  return (
    <div style={{
      background: "#FFFFFF",
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
      borderRadius: 10,
      padding: "1.75rem",
      borderLeft: borderLeft ? "3px solid #0A0A0A" : "3px solid transparent",
      boxSizing: "border-box",
    }}>
      <p style={{ fontWeight: 700, fontSize: "1rem", color: "#0A0A0A", margin: 0 }}>Martina González</p>
      <p style={{ fontWeight: 400, fontSize: "0.78rem", color: "#888", margin: "3px 0 12px" }}>Analista de Marketing</p>
      <div style={{ height: "0.5px", background: "#EEEEEE", marginBottom: 14 }} />
      <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", color: "#BBB", margin: "0 0 8px", textTransform: "uppercase" }}>Experiencia</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {[
          [{ w: "55%", dark: true }, { w: "85%", dark: false }, { w: "70%", dark: false }],
          [{ w: "45%", dark: true }, { w: "90%", dark: false }, { w: "60%", dark: false }],
          [{ w: "50%", dark: true }, { w: "75%", dark: false }],
        ].map((job, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {job.map((bar, j) => (
              <div key={j} style={{ height: 7, borderRadius: 3, background: bar.dark ? "#DDDDDD" : "#EEEEEE", width: bar.w }} />
            ))}
          </div>
        ))}
      </div>
      <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", color: "#BBB", margin: "0 0 8px", textTransform: "uppercase" }}>Educación</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {[{ w: "60%", dark: true }, { w: "80%", dark: false }].map((bar, i) => (
          <div key={i} style={{ height: 7, borderRadius: 3, background: bar.dark ? "#DDDDDD" : "#EEEEEE", width: bar.w }} />
        ))}
      </div>
    </div>
  );
}

function StoryAnimation() {
  const DURATIONS = [1400, 1100, 1400, 1100, 1400, 1100, 1500, 1000, 1000, 1000, 2000];
  const N = DURATIONS.length;

  const [tick, setTick] = useState(0);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
  }, []);

  useEffect(() => {
    if (prefersReduced) return;
    const tr = tick % N;
    const t = setTimeout(() => setTick(prev => prev + 1), DURATIONS[tr]);
    return () => clearTimeout(t);
  }, [tick, prefersReduced]);

  const tr = tick % N;
  const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

  const showOriginal = tr <= 5;
  const showProcessing = tr === 6;
  const showOptimized = tr >= 7;
  const isShaking = tr === 1 || tr === 3 || tr === 5;
  const showProblemText = tr === 5;

  let chipText = "";
  let chipIsRejected = false;
  if (tr === 0)      { chipText = "→ Enviado a Falabella"; }
  else if (tr === 1) { chipText = "✕ Rechazado"; chipIsRejected = true; }
  else if (tr === 2) { chipText = "→ Enviado a Ripley"; }
  else if (tr === 3) { chipText = "✕ Rechazado"; chipIsRejected = true; }
  else if (tr === 4) { chipText = "→ Enviado a Banco Santander"; }
  else if (tr === 5) { chipText = "✕ Rechazado"; chipIsRejected = true; }

  if (prefersReduced) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", maxWidth: 480, width: "100%" }}>
          <MartinaCv borderLeft />
          <div style={{ position: "absolute", top: -14, right: 0, background: "#0A0A0A", color: "white", padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>
            ✓ Optimizado por Postulai
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "→ Enviado a Banco Santander", green: false },
            { label: "✓ Entrevista agendada", green: true },
          ].map(({ label, green }) => (
            <div key={label} style={{ padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: green ? "#F0FAF0" : "#F5F5F5", color: green ? "#2D7D2D" : "#444", border: green ? "0.5px solid #C3E6C3" : "0.5px solid #DDD" }}>{label}</div>
          ))}
        </div>
        <p style={{ fontSize: "0.9rem", color: "#0A0A0A", fontWeight: 700 }}>Postulai y listo. 🇨🇱</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 420, maxWidth: 480, margin: "0 auto" }}>

      {/* Original CV — phases 1–3 */}
      <div style={{
        position: "absolute", top: 20, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        opacity: showOriginal ? 1 : 0,
        transform: showOriginal ? "translateY(0)" : "translateY(-16px)",
        transition: `opacity 400ms ${ease}, transform 400ms ${ease}`,
        pointerEvents: "none",
      }}>
        <div style={{ position: "relative", width: "100%" }}>
          <div style={{ animation: isShaking ? "story-shake 0.45s ease-in-out" : "none" }}>
            <MartinaCv />
          </div>
          {chipText && (
            <div
              key={`chip-${tr}`}
              style={{
                position: "absolute", top: -14, right: 0,
                padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600,
                background: chipIsRejected ? "#FFF0F0" : "#F0F0F0",
                color: chipIsRejected ? "#CC3333" : "#444",
                border: chipIsRejected ? "0.5px solid #FFCDD2" : "0.5px solid #DDD",
                animation: `fadeChipIn 300ms ${ease}`,
                whiteSpace: "nowrap",
              }}
            >{chipText}</div>
          )}
        </div>
        {showProblemText && (
          <p style={{ fontSize: "0.85rem", color: "#CC3333", fontWeight: 600, textAlign: "center", animation: `fadeChipIn 300ms ${ease}`, margin: 0 }}>
            El problema no eres tú. Es el formato.
          </p>
        )}
      </div>

      {/* Processing — phase 4 */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
        opacity: showProcessing ? 1 : 0,
        transition: `opacity 400ms ${ease}`,
        pointerEvents: "none",
      }}>
        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0A0A0A", letterSpacing: "-0.01em" }}>Postulai</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%", background: "#0A0A0A",
              animation: showProcessing ? `dotBounce 1.2s ${i * 160}ms ease-in-out infinite` : "none",
            }} />
          ))}
        </div>
        <p style={{ fontSize: "0.88rem", color: "#666", fontWeight: 400, margin: 0 }}>Optimizando tu CV…</p>
      </div>

      {/* Optimized CV — phases 5–6 */}
      <div style={{
        position: "absolute", top: 20, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        opacity: showOptimized ? 1 : 0,
        transform: showOptimized ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 500ms ${ease}, transform 500ms ${ease}`,
        pointerEvents: "none",
      }}>
        <div style={{ position: "relative", width: "100%" }}>
          <MartinaCv borderLeft />
          <div style={{ position: "absolute", top: -14, right: 0, background: "#0A0A0A", color: "white", padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>
            ✓ Optimizado por Postulai
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "flex-start" }}>
          <div style={{
            opacity: tr >= 8 ? 1 : 0,
            transform: tr >= 8 ? "translateY(0)" : "translateY(8px)",
            transition: `opacity 300ms ${ease}, transform 300ms ${ease}`,
            padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600,
            background: "#F0F0F0", color: "#444", border: "0.5px solid #DDD",
          }}>→ Enviado a Banco Santander</div>
          <div style={{
            opacity: tr >= 9 ? 1 : 0,
            transform: tr >= 9 ? "translateY(0)" : "translateY(8px)",
            transition: `opacity 300ms ${ease}, transform 300ms ${ease}`,
            padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600,
            background: "#F0FAF0", color: "#2D7D2D", border: "0.5px solid #C3E6C3",
          }}>✓ Entrevista agendada</div>
        </div>
        <p style={{
          fontSize: "0.9rem", color: "#0A0A0A", fontWeight: 700, textAlign: "center", margin: 0,
          opacity: tr >= 10 ? 1 : 0,
          transition: `opacity 400ms 100ms ${ease}`,
        }}>Postulai y listo. 🇨🇱</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={spaceGrotesk.className}
      style={{ minHeight: "100vh", background: "#0A0A0A", color: "white", display: "flex", flexDirection: "column" }}
    >
      <style>{`
        * { font-family: 'Space Grotesk', sans-serif !important; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          opacity: 0;
          animation: fadeUp 600ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        @keyframes shake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-5px); }
          30%  { transform: translateX(5px); }
          45%  { transform: translateX(-4px); }
          60%  { transform: translateX(4px); }
          75%  { transform: translateX(-2px); }
          90%  { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.3); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1; }
        }
        @keyframes story-shake {
          0%   { transform: translateX(0); }
          25%  { transform: translateX(-4px); }
          75%  { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        @keyframes fadeChipIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fade-up { animation-duration: 0.01ms !important; }
          .btn-submit { transition-duration: 0.01ms !important; }
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-submit:hover { transform: translateY(-2px); }
          .nav-link:hover { color: rgba(255,255,255,0.85) !important; }
          .benefit-card:hover { border-top-color: #0A0A0A !important; }
        }
        .nav-link { transition: color 150ms ease; }

        /* Stats band — white bg */
        .stat-item:not(:last-child) { border-bottom: 0.5px solid #E5E5E5; }
        @media (min-width: 640px) {
          .stat-item:not(:last-child) { border-bottom: none; border-right: 0.5px solid #E5E5E5; }
        }

        /* Benefit cards — white bg */
        .benefit-card {
          border-top: 2px solid transparent;
          transition: border-top-color 200ms ease;
        }
        .benefit-card:not(:last-child) { border-bottom: 0.5px solid #E5E5E5; }
        @media (min-width: 640px) {
          .benefit-card:not(:last-child) { border-bottom: none; }
          .benefit-card:nth-child(odd)  { border-right: 0.5px solid #E5E5E5; }
          .benefit-card:nth-child(-n+2) { border-bottom: 0.5px solid #E5E5E5; }
        }
        @media (min-width: 1024px) {
          .benefit-card:nth-child(-n+2) { border-bottom: none; }
          .benefit-card:nth-child(odd)  { border-right: none; }
          .benefit-card:not(:last-child) { border-right: 0.5px solid #E5E5E5; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "0.5px solid #1e1e1e" }}>
        <div className="flex items-center justify-between" style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px", height: 64 }}>
          <a href="#" className="nav-link" style={{ fontWeight: 700, fontSize: 18, color: "white", textDecoration: "none" }}>
            Postulai
          </a>

          <nav className="hidden sm:flex items-center gap-7">
            <a href="#como-funciona" className="nav-link" style={{ fontWeight: 500, color: "#888888", fontSize: 14, textDecoration: "none" }}>¿Cómo funciona?</a>
            <a href="#beneficios"    className="nav-link" style={{ fontWeight: 500, color: "#888888", fontSize: 14, textDecoration: "none" }}>¿Por qué Postulai?</a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block" style={{ border: "0.5px solid #222", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#555555", fontWeight: 500, letterSpacing: "0.02em" }}>
              Acceso anticipado
            </span>
            <button
              className="sm:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menú"
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 4, lineHeight: 0 }}
            >
              {menuOpen
                ? <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="sm:hidden flex flex-col gap-6" style={{ borderTop: "0.5px solid #1e1e1e", background: "#0A0A0A", padding: "24px" }}>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)} style={{ fontWeight: 500, color: "#888888", fontSize: 15, textDecoration: "none" }}>¿Cómo funciona?</a>
            <a href="#beneficios"    onClick={() => setMenuOpen(false)} style={{ fontWeight: 500, color: "#888888", fontSize: 15, textDecoration: "none" }}>¿Por qué Postulai?</a>
          </div>
        )}
      </header>

      <main className="flex-1">

        {/* ── HERO — negro ── */}
        <section style={{ position: "relative", overflow: "hidden", padding: "96px 24px 80px", background: "#0A0A0A" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: -160, right: -160, width: 560, height: 560, border: "0.5px solid #1e1e1e", borderRadius: "50%" }} />
            <div style={{ position: "absolute", bottom: -100, left: -100, width: 380, height: 380, border: "0.5px solid #1e1e1e", borderRadius: "50%" }} />
            <div style={{ position: "absolute", top: "30%", right: "12%", width: 72, height: 72, border: "0.5px solid #1e1e1e" }} />
            <div style={{ position: "absolute", top: "15%", left: "8%",  width: 36, height: 36, border: "0.5px solid #1e1e1e", borderRadius: "50%" }} />
            <div style={{ position: "absolute", bottom: "20%", right: "28%", width: 24, height: 24, border: "0.5px solid #1e1e1e" }} />
          </div>

          <div className="flex flex-col items-center text-center" style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", gap: 28 }}>
            <h1
              className="fade-up"
              style={{ fontWeight: 700, fontSize: "clamp(2.4rem, 6.5vw, 5.5rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: "#FFFFFF", animationDelay: "0ms" }}
            >
              Tu currículum, listo para cada trabajo que quieras.
            </h1>

            <p
              className="fade-up"
              style={{ color: "#AAAAAA", fontSize: "clamp(1rem, 2vw, 1.15rem)", lineHeight: 1.75, maxWidth: 500, fontWeight: 400, animationDelay: "150ms" }}
            >
              Sube tu CV y la oferta que te interesa. Postulai lo adapta y lo deja listo para enviar en menos de 30 segundos.
            </p>

            <div className="fade-up w-full" style={{ animationDelay: "300ms" }}>
              <WaitlistForm centered theme="dark" />
            </div>

            <p className="fade-up" style={{ fontSize: 13, color: "#888888", fontWeight: 400, animationDelay: "450ms" }}>
              Sin spam. Solo te avisamos cuando esté lista.
            </p>
          </div>
        </section>

        {/* ── HISTORIA POSTULAI — gris claro ── */}
        <section style={{ background: "#F5F5F5", padding: "88px 24px", borderTop: "0.5px solid #E5E5E5" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontWeight: 900, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", color: "#0A0A0A", marginBottom: 12, lineHeight: 1.2 }}>
                Lo que pasa sin Postulai.
              </h2>
              <p style={{ color: "#666", fontWeight: 400, fontSize: 15 }}>
                El mismo CV. Empresa tras empresa. Siempre rechazado.
              </p>
            </div>
            <StoryAnimation />
          </div>
        </section>

        {/* ── STATS BAND — blanco ── */}
        <div style={{ background: "#FFFFFF", borderTop: "0.5px solid #E5E5E5", borderBottom: "0.5px solid #E5E5E5" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ maxWidth: 1152, margin: "0 auto", position: "relative" }}>
            {[
              { value: "75%",      label: "de los CVs nunca llegan a un reclutador" },
              { value: "Segundos", label: "para adaptar tu CV a cada oferta" },
              { value: "Chile",    label: "ortografía, tono y formato del mercado laboral chileno" },
            ].map((s) => (
              <div key={s.value} className="stat-item text-center" style={{ padding: "40px 32px" }}>
                <p style={{ fontWeight: 700, fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "#0A0A0A", marginBottom: 10 }}>{s.value}</p>
                <p style={{ fontSize: 13, color: "#666666", lineHeight: 1.6, fontWeight: 500 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ATS — negro ── */}
        <section style={{ padding: "88px 24px", background: "#0A0A0A" }}>
          <div className="flex flex-col text-center" style={{ maxWidth: 620, margin: "0 auto", gap: 24 }}>
            <h2 style={{ fontWeight: 700, fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", lineHeight: 1.2, color: "#FFFFFF" }}>
              El 75% de los currículums nunca llegan a un reclutador
            </h2>
            <p style={{ color: "#AAAAAA", fontSize: 16, lineHeight: 1.9, fontWeight: 400 }}>
              Las empresas grandes filtran candidatos automáticamente antes de que un humano vea tu CV. Postulai crea y adapta tu currículum con la estructura correcta, las palabras clave exactas de la oferta, y el formato que exigen los sistemas de selección más usados en Chile. Tu currículum llega donde otros no llegan.
            </p>
          </div>
        </section>

        {/* ── POSTULAI Y LISTO — blanco ── */}
        <section id="como-funciona" style={{ padding: "8rem 24px", background: "#FFFFFF", borderTop: "0.5px solid #E5E5E5", scrollMarginTop: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontWeight: 900, fontSize: "clamp(3rem, 8vw, 6rem)", letterSpacing: "-1.5px", color: "#0A0A0A", textAlign: "center", lineHeight: 1.1, margin: 0 }}>
            Postulai y listo. 🇨🇱
          </p>
        </section>

        {/* ── BENEFICIOS — blanco ── */}
        <section id="beneficios" style={{ padding: "88px 24px", background: "#FFFFFF", borderTop: "0.5px solid #E5E5E5", scrollMarginTop: 80 }}>
          <div style={{ maxWidth: 1152, margin: "0 auto", position: "relative" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, border: "0.5px solid #E0E0E0", borderRadius: "50%" }} />
              <div style={{ position: "absolute", bottom: 20, left: -30, width: 60, height: 60, border: "0.5px solid #E0E0E0" }} />
            </div>

            <h2 className="text-center" style={{ fontWeight: 700, fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", marginBottom: 12, color: "#0A0A0A" }}>
              ¿Por qué Postulai?
            </h2>
            <p className="text-center" style={{ color: "#444444", maxWidth: 480, margin: "0 auto 48px", fontSize: 15, fontWeight: 400 }}>
              Cada postulación exige tiempo, energía y precisión. Postulai se encarga de eso por ti.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ border: "0.5px solid #E5E5E5", borderRadius: 2, overflow: "hidden", position: "relative", zIndex: 1 }}>
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="benefit-card flex flex-col gap-4"
                  style={{ padding: "36px 32px", background: "#F5F5F5" }}
                >
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: "#0A0A0A", lineHeight: 1.4 }}>{b.title}</h3>
                  <p style={{ color: "#555555", fontSize: 14, lineHeight: 1.85, fontWeight: 400 }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SEGUNDO CTA — blanco ── */}
        <section style={{ padding: "88px 24px", background: "#FFFFFF", borderTop: "0.5px solid #E5E5E5" }}>
          <div className="flex flex-col items-center text-center" style={{ maxWidth: 480, margin: "0 auto", gap: 20 }}>
            <h2 style={{ fontWeight: 700, fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", lineHeight: 1.2, color: "#0A0A0A" }}>
              ¿Listo para postular mejor?
            </h2>
            <p style={{ color: "#444444", fontSize: 15, fontWeight: 400, maxWidth: 340, marginBottom: 4 }}>
              Los primeros en entrar tendrán acceso anticipado. No te quedes fuera.
            </p>
            <WaitlistForm centered theme="light" />
          </div>
        </section>

      </main>

      {/* ── FOOTER — negro ── */}
      <footer style={{ borderTop: "0.5px solid #1e1e1e", background: "#0A0A0A", padding: "32px 24px" }}>
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4" style={{ maxWidth: 1152, margin: "0 auto" }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "white" }}>Postulai</span>

          <div className="flex items-center gap-5" style={{ fontSize: 14 }}>
            <a href="mailto:contacto@postulai.cl" className="nav-link" style={{ color: "#888888", textDecoration: "none" }}>
              contacto@postulai.cl
            </a>
            <a
              href="https://instagram.com/postulai"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link flex items-center gap-1.5"
              style={{ color: "#888888", textDecoration: "none" }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              @postulai
            </a>
          </div>

          <span style={{ color: "#888888", fontSize: 14 }}>Hecho en Chile 🇨🇱</span>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "idle" | "loading" | "sent" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });

    if (error) {
      setErrorMsg("No pudimos enviar el correo. Intenta de nuevo.");
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] flex flex-col gap-8">

        <div className="flex justify-center">
          <a href="/" className="text-2xl font-black tracking-tight text-white hover:opacity-70 transition-opacity duration-150">
            Postulai
          </a>
        </div>

        {status === "sent" ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-black tracking-tight">Revisa tu correo</h1>
              <p className="text-sm text-[#A0A0A0] leading-relaxed">
                Te enviamos un enlace a <span className="text-white font-medium">{email}</span> para restablecer tu contraseña.
              </p>
            </div>
            <a href="/login" className="text-sm text-[#A0A0A0] hover:text-white transition-colors duration-150">
              Volver al inicio de sesión
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 text-center">
              <h1 className="text-2xl font-black tracking-tight">¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-[#A0A0A0]">
                Ingresa tu correo y te enviamos un enlace para restablecerla.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/70">Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors duration-150"
                />
              </div>

              {status === "error" && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={status === "loading" || !email}
                className="w-full py-3.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "Enviando..." : "Enviar enlace"}
              </button>
            </div>

            <p className="text-center text-sm text-[#A0A0A0]">
              <a href="/login" className="text-white font-semibold hover:opacity-70 transition-opacity duration-150">
                Volver al inicio de sesión
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

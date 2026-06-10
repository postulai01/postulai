"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("No pudimos actualizar la contraseña. El enlace puede haber expirado.");
      setLoading(false);
      return;
    }
    router.replace("/app");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] flex flex-col gap-8">

        <div className="flex justify-center">
          <a href="/" className="text-2xl font-black tracking-tight text-white hover:opacity-70 transition-opacity duration-150">
            Postulai
          </a>
        </div>

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-black tracking-tight">Nueva contraseña</h1>
          <p className="text-sm text-[#A0A0A0]">Elige una contraseña nueva para tu cuenta.</p>
        </div>

        <div className="flex flex-col gap-5">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/70">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors duration-150"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors duration-150"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/70">Confirmar contraseña</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors duration-150"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            disabled={loading || !password || !confirm}
            className="w-full py-3.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </div>

      </div>
    </div>
  );
}

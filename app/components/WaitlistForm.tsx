"use client";

import { useState } from "react";

interface Props {
  variant?: "dark" | "light";
  centered?: boolean;
}

export default function WaitlistForm({ variant = "light", centered = false }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
      <div className={`flex items-center gap-3 rounded-xl px-6 py-4 font-medium text-base border ${
        variant === "dark"
          ? "bg-white/10 border-white/20 text-white"
          : "bg-gray-50 border-slate-200 text-black"
      }`}>
        <svg className={`w-5 h-5 shrink-0 ${variant === "dark" ? "text-white" : "text-black"}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        ¡Te avisamos cuando esté listo. Gracias por tu interés!
      </div>
    );
  }

  return (
    <div className={`w-full max-w-md ${centered ? "mx-auto" : ""}`}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className={`flex-1 px-4 py-3 rounded-xl border text-base shadow-sm focus:outline-none focus:ring-2 focus:border-transparent ${
            variant === "dark"
              ? "bg-white/10 border-white/20 text-white placeholder-white/40 focus:ring-white"
              : "bg-white border-slate-200 text-black placeholder-slate-400 focus:ring-black"
          }`}
          disabled={status === "loading"}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={`px-6 py-3 font-semibold rounded-xl transition-colors duration-150 text-base shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
            variant === "dark"
              ? "bg-white text-black hover:bg-gray-100 active:bg-gray-200"
              : "bg-black text-white hover:bg-slate-800 active:bg-slate-700"
          }`}
        >
          {status === "loading" ? "Guardando…" : "Lista de espera"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-red-400 text-sm mt-2">{errorMsg}</p>
      )}
    </div>
  );
}

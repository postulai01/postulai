"use client";

import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UsosAgotadosModal({ open, onClose }: Props) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[420px] rounded-2xl flex flex-col gap-6 p-7"
        style={{ background: "#141414", border: "1px solid #1e1e1e" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 transition-colors duration-150"
          style={{ color: "rgba(255,255,255,.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.6)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.3)")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}
        >
          <svg className="w-5 h-5" style={{ color: "#22c55e" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h2
            style={{
              fontFamily: "var(--font-space-grotesk, inherit)",
              fontWeight: 800,
              fontSize: 20,
              color: "#fff",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            Usaste tus 5 adaptaciones gratis
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.45)", lineHeight: 1.55 }}>
            Sigue postulando sin límites con Postulai Pro — adaptaciones y cartas ilimitadas.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/planes")}
            className="w-full py-3 rounded-xl text-sm font-bold transition-colors duration-150"
            style={{ background: "#22c55e", color: "#000" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#16a34a")}
            onMouseLeave={e => (e.currentTarget.style.background = "#22c55e")}
          >
            Ver planes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium transition-colors duration-150"
            style={{ color: "rgba(255,255,255,.3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.55)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.3)")}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

function firstName(rawName: string): string {
  if (rawName.includes("@")) return rawName.split("@")[0];
  return rawName.trim().split(/\s+/)[0];
}

export default function AppPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setUserName(session.user.user_metadata?.full_name ?? session.user.email ?? null);
    });
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar />

      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-14">
          <div className="w-full max-w-[700px] flex flex-col gap-10">

            {/* Marca + saludo */}
            <div className="flex flex-col gap-2">
              <p
                style={{
                  fontFamily: "var(--font-space-grotesk, inherit)",
                  fontWeight: 900,
                  fontSize: 22,
                  letterSpacing: "-0.02em",
                  color: "rgba(255,255,255,.35)",
                  lineHeight: 1,
                }}
              >
                Postulai
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-space-grotesk, inherit)",
                  fontWeight: 900,
                  fontSize: "clamp(32px, 5vw, 48px)",
                  letterSpacing: "-0.025em",
                  color: "#fff",
                  lineHeight: 1.05,
                }}
              >
                {userName ? `Hola, ${firstName(userName)}` : "Hola"}
              </h1>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,.4)", marginTop: 2 }}>
                ¿Qué quieres hacer hoy?
              </p>
            </div>

            {/* Cards de acción */}
            <div className="flex flex-col gap-3">

              {/* Banner principal — Adaptar */}
              <button
                type="button"
                onClick={() => router.push("/app/adaptar")}
                className="group w-full text-left rounded-2xl px-8 py-9 transition-all duration-300"
                style={{
                  background: "#141414",
                  border: "1px solid #242424",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#d8d8d5";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#141414";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                <p
                  className="group-hover:text-[#1a1a1a] transition-colors duration-300"
                  style={{
                    fontFamily: "var(--font-space-grotesk, inherit)",
                    fontWeight: 800,
                    fontSize: 28,
                    color: "#fff",
                    lineHeight: 1.15,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Adaptar tu CV
                </p>
                <p
                  className="group-hover:text-[rgba(26,26,26,0.6)] transition-colors duration-300"
                  style={{ fontSize: 15, color: "rgba(255,255,255,.5)", marginTop: 6 }}
                >
                  Ajusta tu currículum a cada oferta
                </p>
              </button>

              {/* Fila secundaria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Crear un CV */}
                <button
                  type="button"
                  onClick={() => router.push("/app/crear")}
                  className="group text-left rounded-2xl px-6 py-6 transition-all duration-300"
                  style={{
                    background: "#141414",
                    border: "1px solid #242424",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#d8d8d5";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#141414";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  <p
                    className="group-hover:text-[#1a1a1a] transition-colors duration-300"
                    style={{
                      fontFamily: "var(--font-space-grotesk, inherit)",
                      fontWeight: 700,
                      fontSize: 18,
                      color: "#fff",
                      lineHeight: 1.2,
                    }}
                  >
                    Crear un CV
                  </p>
                  <p
                    className="group-hover:text-[rgba(26,26,26,0.6)] transition-colors duration-300"
                    style={{ fontSize: 13.5, color: "rgba(255,255,255,.45)", marginTop: 5 }}
                  >
                    Construye tu perfil profesional desde cero
                  </p>
                </button>

                {/* Encuentra tu trabajo ideal — deshabilitado */}
                <div
                  className="text-left rounded-2xl px-6 py-6"
                  style={{
                    background: "#141414",
                    border: "1px solid #242424",
                    opacity: 0.38,
                    cursor: "default",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-space-grotesk, inherit)",
                      fontWeight: 700,
                      fontSize: 18,
                      color: "#fff",
                      lineHeight: 1.2,
                    }}
                  >
                    Encuentra tu trabajo ideal
                  </p>
                  <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.45)", marginTop: 5 }}>
                    Descubre ofertas que se ajustan a tu perfil
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,.4)",
                      marginTop: 14,
                      textTransform: "uppercase",
                    }}
                  >
                    Próximamente
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

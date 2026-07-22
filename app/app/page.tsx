"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PostulacionRow = {
  id: string;
  tipo: string;
  cargo: string | null;
  empresa: string | null;
  titulo_postulacion: string | null;
  created_at: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function rowCargo(row: PostulacionRow): string {
  if (row.cargo?.trim()) return row.cargo.trim();
  const title = row.titulo_postulacion?.trim();
  if (title) return title.length > 42 ? title.slice(0, 42) + "…" : title;
  return row.tipo === "adaptar" ? "CV Adaptado" : "CV Creado";
}

function empresaInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function rowFecha(created_at: string): string {
  const d = new Date(created_at);
  const now = new Date();
  if (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
    return "hoy";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export default function AppPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [postulaciones, setPostulaciones] = useState<PostulacionRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setPostulaciones([]);
        return;
      }
      setUserName(session.user.user_metadata?.full_name ?? session.user.email ?? null);
      setUserEmail(session.user.email ?? null);
      const { data } = await supabase
        .from("postulaciones")
        .select("id, tipo, cargo, empresa, titulo_postulacion, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setPostulaciones(data ?? []);
    });
  }, []);

  const displayed = showAll
    ? (postulaciones ?? [])
    : (postulaciones ?? []).slice(0, 3);

  return (
    <div
      className="bg-[#0A0A0A] text-white relative flex flex-col"
      style={{ minHeight: "100vh" }}
    >
      <style>{`
        .tool-card {
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          transition: background 350ms cubic-bezier(0.23,1,0.32,1),
                      transform 350ms cubic-bezier(0.23,1,0.32,1);
        }
        @media (hover: hover) and (pointer: fine) {
          .tool-card.interactive:hover {
            background: #d8d8d5;
            transform: translateY(-4px) scale(1.015);
          }
          .tool-card.interactive:hover .card-title { color: #1a1a1a; }
          .tool-card.interactive:hover .card-sub { color: rgba(26,26,26,0.65); }
        }
      `}</style>

      {/* Background watermark */}
      <svg
        aria-hidden
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 1000,
          height: 1000,
          pointerEvents: "none",
          zIndex: 0,
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 65% at 50% 35%, black 30%, transparent 85%)",
          maskImage:
            "radial-gradient(ellipse 70% 65% at 50% 35%, black 30%, transparent 85%)",
        }}
        viewBox="0 0 800 800"
        fill="none"
      >
        <path
          d="M170 430 L330 600 L640 220"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={46}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Header */}
      <header
        className="relative z-50 shrink-0 flex items-center justify-between px-5 md:px-10"
        style={{ height: 64, borderBottom: "1px solid #1a1a1a" }}
      >
        <a
          href="/"
          style={{
            fontFamily: "var(--font-space-grotesk, inherit)",
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: "-0.02em",
          }}
          className="text-white hover:opacity-70 transition-opacity duration-150"
        >
          Postulai
        </a>

        <div className="relative z-10">
          {userName ? (
            <>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-opacity duration-150 hover:opacity-90"
                style={{ background: "#141414", border: "1px solid #2a2a2a" }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "#232323" }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
                    {getInitials(userName)}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium text-white leading-none">
                    {userName.split(" ")[0]}
                  </p>
                  <p className="text-[10px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,.4)" }}>
                    7 días de prueba
                  </p>
                </div>
                <svg
                  className={`w-3 h-3 shrink-0 transition-transform duration-150 ${accountOpen ? "rotate-180" : ""}`}
                  style={{ color: "rgba(255,255,255,.3)" }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>

              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
                  <div
                    className="absolute top-full right-0 mt-2 w-56 rounded-xl overflow-hidden shadow-2xl z-20"
                    style={{ background: "#161616", border: "1px solid #2a2a2a" }}
                  >
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid #2a2a2a" }}>
                      <p className="text-xs font-semibold text-white truncate">{userName}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>
                        {userEmail}
                      </p>
                    </div>
                    <div className="py-1.5">
                      <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.55)" }}>Mi plan</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            color: "rgba(255,255,255,.3)",
                            background: "rgba(255,255,255,.05)",
                            border: "1px solid rgba(255,255,255,.1)",
                          }}
                        >
                          Prueba gratuita · 7 días
                        </span>
                      </div>
                      <a
                        href="/terminos"
                        className="block px-4 py-2 text-xs hover:bg-white/5 transition-colors duration-150"
                        style={{ color: "rgba(255,255,255,.55)" }}
                      >
                        Términos y condiciones
                      </a>
                      <a
                        href="/privacidad"
                        className="block px-4 py-2 text-xs hover:bg-white/5 transition-colors duration-150"
                        style={{ color: "rgba(255,255,255,.55)" }}
                      >
                        Política de privacidad
                      </a>
                      <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.55)" }}>Ayuda</span>
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,.3)" }}>
                          contacto@postulai.cl
                        </span>
                      </div>
                      <div style={{ borderTop: "1px solid #2a2a2a", margin: "6px 0 4px" }} />
                      <button
                        type="button"
                        onClick={async () => {
                          setAccountOpen(false);
                          await supabase.auth.signOut();
                          router.push("/login");
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors duration-150"
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              <a
                href="/login"
                className="py-1.5 px-4 text-xs font-medium rounded-full hover:opacity-80 transition-opacity duration-150"
                style={{ color: "rgba(255,255,255,.55)", border: "1px solid #2a2a2a" }}
              >
                Iniciar sesión
              </a>
              <a
                href="/registro"
                className="py-1.5 px-4 text-xs font-semibold text-black bg-white rounded-full hover:bg-gray-100 transition-colors duration-150"
              >
                Crear cuenta
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0 px-5 py-5 md:px-10 md:py-6 justify-center">
        {/* Tool cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Card 1: Adaptar */}
          <button
            type="button"
            onClick={() => router.push("/app/adaptar")}
            className="tool-card interactive flex flex-col items-center justify-center text-center px-6 py-9 w-full"
          >
            <p
              className="card-title transition-colors duration-[350ms]"
              style={{
                fontSize: 23,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "var(--font-space-grotesk, inherit)",
                lineHeight: 1.2,
              }}
            >
              Adaptar tu CV
            </p>
            <p
              className="card-sub mt-2.5 transition-colors duration-[350ms]"
              style={{ fontSize: 14, color: "rgba(255,255,255,.65)", lineHeight: 1.5 }}
            >
              Ajusta tu currículum a cada oferta
            </p>
          </button>

          {/* Card 2: Crear */}
          <button
            type="button"
            onClick={() => router.push("/app/crear")}
            className="tool-card interactive flex flex-col items-center justify-center text-center px-6 py-9 w-full"
          >
            <p
              className="card-title transition-colors duration-[350ms]"
              style={{
                fontSize: 23,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "var(--font-space-grotesk, inherit)",
                lineHeight: 1.2,
              }}
            >
              Crear un CV
            </p>
            <p
              className="card-sub mt-2.5 transition-colors duration-[350ms]"
              style={{ fontSize: 14, color: "rgba(255,255,255,.65)", lineHeight: 1.5 }}
            >
              Construye tu perfil profesional desde cero
            </p>
          </button>

          {/* Card 3: Buscar trabajo — disabled */}
          <div
            className="tool-card flex flex-col items-center justify-center text-center px-6 py-9"
            style={{ cursor: "default" }}
          >
            <p
              style={{
                fontSize: 23,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "var(--font-space-grotesk, inherit)",
                lineHeight: 1.2,
              }}
            >
              Encuentra tu trabajo ideal
            </p>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,.65)",
                lineHeight: 1.5,
                marginTop: 10,
              }}
            >
              Descubre ofertas que se ajustan a tu perfil
            </p>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,.3)",
                marginTop: 14,
                textTransform: "uppercase",
              }}
            >
              Próximamente
            </p>
          </div>
        </div>

        {/* Postulations section */}
        <div
          className="shrink-0 mt-4 pt-4 pb-12"
          style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-2.5">
              <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                Tus postulaciones
              </span>
              {postulaciones && postulaciones.length > 0 && (
                <span style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)" }}>
                  {postulaciones.length} en total
                </span>
              )}
            </div>
            {showAll ? (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="text-xs hover:opacity-80 transition-opacity duration-150"
                style={{ color: "rgba(255,255,255,.4)" }}
              >
                ← Volver
              </button>
            ) : postulaciones && postulaciones.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs hover:opacity-80 transition-opacity duration-150"
                style={{ color: "rgba(255,255,255,.4)" }}
              >
                Ver todas →
              </button>
            ) : null}
          </div>

          {postulaciones === null ? (
            <div className="flex items-center gap-2 py-2">
              <div
                className="w-3 h-3 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(255,255,255,.1)", borderTopColor: "rgba(255,255,255,.3)" }}
              />
              <span className="text-xs" style={{ color: "rgba(255,255,255,.3)" }}>
                Cargando...
              </span>
            </div>
          ) : displayed.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.5)", paddingTop: 8, paddingBottom: 8 }}>
              Aún no tienes postulaciones. Comienza adaptando o creando tu CV.
            </p>
          ) : (
            <div>
              {displayed.map((row) => (
                <a
                  key={row.id}
                  href={`/app/historial/${row.id}`}
                  className="flex items-center gap-3 hover:opacity-75 transition-opacity duration-150"
                  style={{ borderBottom: "1px solid rgba(255,255,255,.04)", paddingTop: 17, paddingBottom: 17 }}
                >
                  <div
                    className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                      {empresaInitials(row.empresa ?? row.titulo_postulacion ?? (row.tipo === "adaptar" ? "CV" : "CV"))}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: 16, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>
                      {rowCargo(row)}
                    </p>
                    {row.empresa && (
                      <p className="truncate mt-0.5" style={{ fontSize: 13.5, color: "rgba(255,255,255,.75)", lineHeight: 1.3 }}>
                        {row.empresa}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 ml-2" style={{ fontSize: 13.5, color: "rgba(255,255,255,.75)" }}>
                    {rowFecha(row.created_at)}
                  </span>
                </a>
              ))}
            </div>
          )}

          {!showAll && postulaciones && postulaciones.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-4 text-xs px-4 py-2 rounded-lg hover:opacity-80 transition-opacity duration-150"
              style={{ color: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.1)" }}
            >
              Ver todas ({postulaciones.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type HistorialEntry = {
  titulo: string;
  fecha: string;
  tipo: "adaptado" | "creado";
};

type PostulacionRow = {
  id: string;
  tipo: string;
  cargo: string | null;
  empresa: string | null;
  titulo_postulacion: string | null;
  created_at: string;
  anclado: boolean;
};

export function saveHistorialEntry(_entry: HistorialEntry) {}

function truncateWords(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let cut = text.slice(0, maxChars);
  if (text[maxChars] !== " ") {
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  }
  return cut.replace(/[\s·\-–—,;:.]+$/, "") + "…";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const IconMenu = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const IconX = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const IconPin = ({ filled }: { filled: boolean }) => (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 17v5" stroke="currentColor" strokeWidth={2} />
    <path
      d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78-.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1v3.76z"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={2}
    />
  </svg>
);

export default function Sidebar() {
  const [dbHistorial, setDbHistorial] = useState<PostulacionRow[] | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsOpen(false);
    setIsAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setDbHistorial([]);
        return;
      }
      setUserName(session.user.user_metadata?.full_name ?? session.user.email ?? null);
      setUserEmail(session.user.email ?? null);
      const { data } = await supabase
        .from("postulaciones")
        .select("id, tipo, cargo, empresa, titulo_postulacion, created_at, anclado")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setDbHistorial(data ?? []);
    });
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta postulación del historial?")) return;
    const { error } = await supabase.from("postulaciones").delete().eq("id", id);
    if (error) return;
    setDbHistorial((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    if (pathname === `/app/historial/${id}`) router.push("/app");
  }

  async function handlePin(id: string, currentlyPinned: boolean) {
    const newValue = !currentlyPinned;
    const { error } = await supabase
      .from("postulaciones")
      .update({ anclado: newValue })
      .eq("id", id);
    if (error) return;
    setDbHistorial((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, anclado: newValue } : r)) : prev
    );
  }

  const pinnedItems = dbHistorial?.filter((r) => r.anclado) ?? [];
  const recentItems = dbHistorial?.filter((r) => !r.anclado) ?? [];

  function renderRow(row: PostulacionRow) {
    const isActive = pathname === `/app/historial/${row.id}`;
    const rawTitle =
      row.titulo_postulacion?.trim() ||
      (row.tipo === "adaptar" ? "CV Adaptado" : "CV Creado");
    const displayTitle = truncateWords(rawTitle, 30);

    return (
      <div key={row.id} className="group relative flex items-stretch">
        <div
          className={`w-[2px] shrink-0 my-[4px] rounded-r-full transition-colors duration-150 ${
            isActive ? "bg-white" : "bg-transparent"
          }`}
        />
        <a
          href={`/app/historial/${row.id}`}
          className={`flex-1 flex items-center pl-3 pr-14 py-2.5 transition-colors duration-150 ${
            isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
          }`}
        >
          <p
            title={rawTitle}
            className={`text-[13px] leading-snug transition-colors duration-150 ${
              isActive ? "text-white font-medium" : "text-[#888]"
            }`}
          >
            {displayTitle}
          </p>
        </a>
        <button
          type="button"
          onClick={() => handlePin(row.id, row.anclado)}
          className={`absolute top-1/2 -translate-y-1/2 right-8 w-5 h-5 flex items-center justify-center transition-opacity duration-150 ${
            row.anclado
              ? "opacity-100 text-white"
              : "opacity-0 group-hover:opacity-100 text-[#444] hover:text-white"
          }`}
          aria-label={row.anclado ? "Desanclar" : "Anclar"}
        >
          <IconPin filled={row.anclado} />
        </button>
        <button
          type="button"
          onClick={() => handleDelete(row.id)}
          className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[#444] hover:text-red-400 w-5 h-5 flex items-center justify-center"
          aria-label="Eliminar postulación"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  const newPostButton = (
    <a
      href="/app"
      className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
    >
      <IconPlus />
      Nueva postulación
    </a>
  );

  const sectionLabel = (label: string, addTopPadding: boolean) => (
    <p
      className={`text-[10px] font-semibold tracking-[0.15em] text-[#444] uppercase px-4 pb-1.5 ${
        addTopPadding ? "pt-4" : "pt-1"
      }`}
    >
      {label}
    </p>
  );

  const historialSection = (
    <div className="flex-1 flex flex-col overflow-y-auto min-h-0 pt-4 pb-2">
      {dbHistorial === null ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
        </div>
      ) : userName === null ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-xs text-[#444] text-center leading-relaxed">
            Inicia sesión para ver tu historial.
          </p>
        </div>
      ) : dbHistorial.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[#444] text-center leading-relaxed px-4">
            Aún no tienes postulaciones.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {pinnedItems.length > 0 && (
            <>
              {sectionLabel("Anclado", false)}
              {pinnedItems.map(renderRow)}
            </>
          )}
          {recentItems.length > 0 && (
            <>
              {sectionLabel("Recientes", pinnedItems.length > 0)}
              {recentItems.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  );

  const footerSection = (
    <div className="relative px-3 py-3 border-t border-[#1e1e1e] shrink-0">
      {isAccountOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsAccountOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl z-20">
            <div className="px-4 py-3 border-b border-[#2a2a2a]">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[11px] text-[#555] truncate mt-0.5">{userEmail}</p>
            </div>
            <div className="py-1.5 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs text-[#888]">Mi plan</span>
                <span className="text-[10px] text-[#555] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  Plan gratuito · 5 usos
                </span>
              </div>
              <a href="/terminos" className="px-4 py-2 text-xs text-[#888] hover:text-white hover:bg-white/5 transition-colors duration-150">
                Términos y condiciones
              </a>
              <a href="/privacidad" className="px-4 py-2 text-xs text-[#888] hover:text-white hover:bg-white/5 transition-colors duration-150">
                Política de privacidad
              </a>
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs text-[#888]">Ayuda</span>
                <span className="text-[11px] text-[#555]">contacto@postulai.cl</span>
              </div>
              <div className="border-t border-[#2a2a2a] mt-1.5 mb-1" />
              <button
                type="button"
                onClick={async () => {
                  setIsAccountOpen(false);
                  await supabase.auth.signOut();
                  sessionStorage.removeItem("postulai_historial");
                  setUserName(null);
                  setUserEmail(null);
                  setDbHistorial([]);
                }}
                className="text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors duration-150"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

      {userName ? (
        <button
          type="button"
          onClick={() => setIsAccountOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors duration-150"
        >
          <div className="w-7 h-7 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-[#888]">{getInitials(userName)}</span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-medium text-white truncate leading-snug">{userName}</p>
            <p className="text-[10px] text-[#555] leading-snug">Plan gratuito · 5 usos</p>
          </div>
          <svg
            className={`w-3 h-3 text-[#444] shrink-0 transition-transform duration-150 ${isAccountOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      ) : (
        <div className="flex gap-2">
          <a
            href="/login"
            className="flex-1 py-2 text-center text-xs font-medium text-[#888] border border-[#2a2a2a] rounded-lg hover:border-[#444] hover:text-white transition-colors duration-150"
          >
            Iniciar sesión
          </a>
          <a
            href="/registro"
            className="flex-1 py-2 text-center text-xs font-semibold text-black bg-white rounded-lg hover:bg-gray-100 transition-colors duration-150"
          >
            Crear cuenta
          </a>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-[270px] shrink-0 bg-[#111] border-r border-[#1e1e1e]">
        <div className="px-4 pt-5 pb-4 border-b border-[#1e1e1e] shrink-0 flex flex-col gap-3">
          <a href="/" className="text-[18px] font-black text-white hover:opacity-70 transition-opacity duration-150 leading-none">
            Postulai
          </a>
          {newPostButton}
        </div>
        {historialSection}
        {footerSection}
      </aside>

      {/* ── Mobile header bar ── */}
      <header className="md:hidden shrink-0 h-14 bg-[#111] border-b border-[#1e1e1e] flex items-center justify-between px-5 z-30">
        <a href="/" className="text-[18px] font-black text-white leading-none">
          Postulai
        </a>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-[#888] hover:text-white transition-colors duration-150 p-1 -mr-1"
          aria-label="Abrir menú"
        >
          <IconMenu />
        </button>
      </header>

      {/* ── Mobile overlay ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => { setIsOpen(false); setIsAccountOpen(false); }}
      />

      {/* ── Mobile drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[270px] bg-[#111] border-r border-[#1e1e1e] flex flex-col transition-transform duration-250 md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 pt-5 pb-4 border-b border-[#1e1e1e] shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <a href="/" className="text-[18px] font-black text-white leading-none">
              Postulai
            </a>
            <button
              type="button"
              onClick={() => { setIsOpen(false); setIsAccountOpen(false); }}
              className="text-[#555] hover:text-white transition-colors duration-150 p-1 -mr-1"
              aria-label="Cerrar menú"
            >
              <IconX />
            </button>
          </div>
          {newPostButton}
        </div>
        {historialSection}
        {footerSection}
      </aside>
    </>
  );
}

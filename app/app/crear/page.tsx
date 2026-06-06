"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { saveHistorialEntry } from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors duration-150";

const textareaClass =
  "w-full bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors duration-150 leading-relaxed";

function YesNo({
  value,
  onChange,
}: {
  value: "si" | "no" | null;
  onChange: (v: "si" | "no") => void;
}) {
  return (
    <div className="flex gap-2">
      {(["si", "no"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
            value === opt
              ? "bg-white text-black"
              : "border border-white/20 text-white/50 hover:border-white/40 hover:text-white"
          }`}
        >
          {opt === "si" ? "Sí" : "No"}
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <hr className="border-[#222]" />;
}

type Trabajo = {
  id: number;
  empresa: string;
  cargo: string;
  periodo: string;
  descripcion: string;
};

const ALLOWED_EMAIL = "pedro.ignacio.heresi@gmail.com";

export default function CrearPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      if (session.user.email !== ALLOWED_EMAIL) { router.replace("/"); }
    });
  }, [router]);

  // Personal
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");

  // Educación escolar
  const [colegio, setColegio] = useState("");
  const [añoEgreso, setAñoEgreso] = useState("");
  const [logroColegio, setLogroColegio] = useState("");

  // Educación superior
  const [estudioSuperior, setEstudioSuperior] = useState<"si" | "no" | null>(null);
  const [universidad, setUniversidad] = useState("");
  const [carrera, setCarrera] = useState("");
  const [estadoEstudio, setEstadoEstudio] = useState("");

  // Experiencia
  const [experiencia, setExperiencia] = useState<"si" | "no" | null>(null);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([
    { id: 0, empresa: "", cargo: "", periodo: "", descripcion: "" },
  ]);
  const [nextId, setNextId] = useState(1);

  // Idiomas y habilidades
  const [idioma, setIdioma] = useState<"si" | "no" | null>(null);
  const [idiomaText, setIdiomaText] = useState("");
  const [nivelIdioma, setNivelIdioma] = useState<"basico" | "intermedio" | "avanzado" | null>(null);
  const [habilidades, setHabilidades] = useState("");

  // Oferta e instrucciones
  const [oferta, setOferta] = useState("");
  const [instrucciones, setInstrucciones] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addTrabajo() {
    setTrabajos((t) => [...t, { id: nextId, empresa: "", cargo: "", periodo: "", descripcion: "" }]);
    setNextId((n) => n + 1);
  }

  function removeTrabajo(id: number) {
    setTrabajos((t) => t.filter((tj) => tj.id !== id));
  }

  function updateTrabajo(id: number, field: keyof Omit<Trabajo, "id">, value: string) {
    setTrabajos((t) => t.map((tj) => (tj.id === id ? { ...tj, [field]: value } : tj)));
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const datos_personales = {
        nombre,
        email,
        telefono,
        ciudad,
        educacion_escolar: {
          colegio,
          anio_egreso: añoEgreso,
          ...(logroColegio ? { logro: logroColegio } : {}),
        },
        educacion_superior:
          estudioSuperior === "si"
            ? { institucion: universidad, carrera, estado: estadoEstudio }
            : "No tiene estudios superiores",
        experiencia_laboral:
          experiencia === "si"
            ? trabajos.map(({ empresa, cargo, periodo, descripcion }) => ({
                empresa,
                cargo,
                periodo,
                descripcion,
              }))
            : "Sin experiencia laboral",
        idiomas:
          idioma === "si" && idiomaText
            ? [{ idioma: idiomaText, nivel: nivelIdioma ?? "no especificado" }]
            : [],
        habilidades,
      };

      const res = await fetch("/api/process-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "crear",
          datos_personales,
          oferta,
          instrucciones: instrucciones || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error desconocido");

      sessionStorage.setItem(
        "postulai_resultado",
        JSON.stringify({ ...data, generadoEn: new Date().toISOString(), modo: "crear" })
      );
      const titulo = data.titulo_postulacion ??
        oferta.split("\n").find((l) => l.trim().length > 3)?.trim().slice(0, 60) ??
        "Oferta de trabajo";
      saveHistorialEntry({ titulo, fecha: new Date().toISOString(), tipo: "creado" });
      router.push("/app/resultado");
    } catch {
      setError("Algo salió mal, intenta de nuevo");
      setLoading(false);
    }
  }

  const canSubmit = !loading && nombre.trim() !== "";

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">

        {/* Figuras decorativas */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full border border-[#1e1e1e]" />
          <div className="absolute top-[55%] -right-16 w-44 h-44 rounded-full border border-[#1e1e1e]" />
          <div className="absolute bottom-20 right-20 w-28 h-28 border border-[#1e1e1e] rotate-45" />
        </div>

      <main
        className="flex-1 flex flex-col px-4 md:px-10 py-10 md:py-16 relative"
      >
        <div className="w-full max-w-[900px] mx-auto flex flex-col gap-8">

          {/* Encabezado */}
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] sm:text-[34px] font-bold text-white tracking-tight">Tu currículum profesional, en minutos</h1>
            <p className="text-[#aaa] text-base">Completa tu perfil y nosotros construimos tu CV adaptado a la oferta que quieres.</p>
          </div>

          {/* Sección 1 — Información personal */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Información personal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Nombre completo *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Ciudad de residencia"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <Divider />

          {/* Sección 2 — Educación escolar */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Educación escolar</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nombre del colegio o institución"
                value={colegio}
                onChange={(e) => setColegio(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Año de egreso"
                value={añoEgreso}
                onChange={(e) => setAñoEgreso(e.target.value)}
                className={inputClass}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#aaa]">Opcional</label>
                <input
                  type="text"
                  placeholder="¿Algún logro o distinción que quieras destacar?"
                  value={logroColegio}
                  onChange={(e) => setLogroColegio(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <Divider />

          {/* Sección 3 — Educación superior */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Educación superior</p>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#aaa]">¿Realizaste o estás realizando estudios superiores?</p>
              <YesNo value={estudioSuperior} onChange={setEstudioSuperior} />
              {estudioSuperior === "si" && (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Universidad, instituto o centro de formación técnica"
                    value={universidad}
                    onChange={(e) => setUniversidad(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Carrera o programa de estudios"
                    value={carrera}
                    onChange={(e) => setCarrera(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    value={estadoEstudio}
                    onChange={(e) => setEstadoEstudio(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-colors duration-150 cursor-pointer"
                  >
                    <option value="" disabled>Estado actual</option>
                    <option value="titulado">Titulado</option>
                    <option value="egresado">Egresado</option>
                    <option value="en-curso">En curso</option>
                    <option value="no-finalizado">No finalizado</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <Divider />

          {/* Sección 4 — Experiencia profesional */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Experiencia profesional</p>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#aaa]">¿Cuentas con experiencia laboral?</p>
              <YesNo value={experiencia} onChange={setExperiencia} />
              {experiencia === "si" && (
                <div className="flex flex-col gap-6">
                  {trabajos.map((tj, idx) => (
                    <div key={tj.id} className="flex flex-col gap-3 border border-[#222] rounded-xl p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">
                          Trabajo {idx + 1}
                        </p>
                        {trabajos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTrabajo(tj.id)}
                            className="text-xs text-white/25 hover:text-red-400 transition-colors duration-150"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Empresa"
                          value={tj.empresa}
                          onChange={(e) => updateTrabajo(tj.id, "empresa", e.target.value)}
                          className={inputClass}
                        />
                        <input
                          type="text"
                          placeholder="Cargo"
                          value={tj.cargo}
                          onChange={(e) => updateTrabajo(tj.id, "cargo", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Período (ej. 2022 – 2024)"
                        value={tj.periodo}
                        onChange={(e) => updateTrabajo(tj.id, "periodo", e.target.value)}
                        className={inputClass}
                      />
                      <textarea
                        rows={3}
                        placeholder="Descripción breve del rol. ¿Qué hacías? ¿Qué lograste?"
                        value={tj.descripcion}
                        onChange={(e) => updateTrabajo(tj.id, "descripcion", e.target.value)}
                        className={textareaClass}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTrabajo}
                    className="text-sm font-medium text-white/40 hover:text-white transition-colors duration-150 w-fit"
                  >
                    + Agregar otro trabajo
                  </button>
                </div>
              )}
            </div>
          </div>

          <Divider />

          {/* Sección 5 — Competencias */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Competencias</p>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#aaa]">¿Manejas algún idioma además del español?</p>
              <YesNo value={idioma} onChange={setIdioma} />
              {idioma === "si" && (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Idioma (ej. Inglés, Portugués)"
                    value={idiomaText}
                    onChange={(e) => setIdiomaText(e.target.value)}
                    className={inputClass}
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-[#aaa]">Nivel</p>
                    <div className="flex gap-2">
                      {(["basico", "intermedio", "avanzado"] as const).map((nivel) => (
                        <button
                          key={nivel}
                          type="button"
                          onClick={() => setNivelIdioma(nivel)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                            nivelIdioma === nivel
                              ? "bg-white text-black"
                              : "border border-white/20 text-white/50 hover:border-white/40 hover:text-white"
                          }`}
                        >
                          {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-white">Habilidades destacadas</label>
                <textarea
                  rows={3}
                  placeholder="Menciona hasta 5. Por ejemplo: liderazgo de equipos, Excel avanzado, atención al cliente."
                  value={habilidades}
                  onChange={(e) => setHabilidades(e.target.value)}
                  className={textareaClass}
                />
              </div>
            </div>
          </div>

          <Divider />

          {/* Sección 6 — Oferta de trabajo */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-white">Oferta de trabajo</p>
                <span className="text-xs text-[#aaa] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">Opcional</span>
              </div>
              <p className="text-xs text-[#aaa] mt-0.5">Si pegas una oferta, el CV se adapta a ella. Sin oferta, creamos un CV profesional general.</p>
            </div>
            <textarea
              rows={7}
              placeholder="Pega aquí el texto completo de la oferta de trabajo..."
              value={oferta}
              onChange={(e) => setOferta(e.target.value)}
              className={textareaClass}
            />
          </div>

          <Divider />

          {/* Instrucciones adicionales */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Instrucciones adicionales</span>
              <span className="text-xs text-[#aaa] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">Opcional</span>
            </div>
            <textarea
              rows={3}
              placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              className={textareaClass}
            />
          </div>

          {/* Botón */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-4 bg-white text-black font-bold rounded-xl text-base tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Procesando..." : "Crear mi currículum →"}
          </button>

          {loading && (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-[#aaa]">Postulai está creando tu currículum...</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

        </div>
      </main>

      </div>
    </div>
  );
}

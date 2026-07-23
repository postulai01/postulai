"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { saveHistorialEntry } from "@/app/components/Sidebar";

const inputClass =
  "w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3.5 text-base text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors duration-150";

const textareaClass =
  "w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3.5 text-base text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors duration-150 leading-relaxed";

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

type Trabajo = {
  id: number;
  empresa: string;
  cargo: string;
  periodo: string;
  descripcion: string;
};

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "Información personal",
  "Educación escolar",
  "Educación superior",
  "Experiencia profesional",
  "Competencias",
  "Oferta e instrucciones",
];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-white/35">
        Paso {step} de {TOTAL_STEPS}
      </p>
      <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function CrearPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);

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

  // UI
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

  function validateCurrentStep(): string | null {
    switch (step) {
      case 1:
        if (!nombre.trim()) return "El nombre completo es obligatorio.";
        return null;
      case 2:
        return null;
      case 3:
        if (estudioSuperior === null) return "Indica si realizaste o estás realizando estudios superiores.";
        if (estudioSuperior === "si") {
          if (!universidad.trim()) return "Ingresa el nombre de la institución.";
          if (!carrera.trim()) return "Ingresa la carrera o programa de estudios.";
          if (!estadoEstudio) return "Selecciona el estado actual de tus estudios.";
        }
        return null;
      case 4:
        if (experiencia === null) return "Indica si cuentas con experiencia laboral.";
        if (experiencia === "si") {
          const first = trabajos[0];
          if (!first.empresa.trim() || !first.cargo.trim())
            return "Completa al menos la empresa y el cargo del primer trabajo.";
        }
        return null;
      case 5:
        if (idioma === null) return "Indica si manejas algún idioma además del español.";
        if (idioma === "si") {
          if (!idiomaText.trim()) return "Ingresa el nombre del idioma.";
          if (!nivelIdioma) return "Selecciona el nivel del idioma.";
        }
        return null;
      case 6:
        return null;
      default:
        return null;
    }
  }

  function handleNext() {
    const err = validateCurrentStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0 });
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0 });
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
      const titulo =
        data.titulo_postulacion ??
        oferta.split("\n").find((l) => l.trim().length > 3)?.trim().slice(0, 60) ??
        "CV profesional";
      saveHistorialEntry({ titulo, fecha: new Date().toISOString(), tipo: "creado" });
      router.push("/app/resultado");
    } catch {
      setError("Algo salió mal, intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">
        <main className="flex-1 flex flex-col px-6 md:px-12 py-10 md:py-16">
          <div className="w-full max-w-[780px] mx-auto flex flex-col gap-9">

            {/* Progreso */}
            <ProgressBar step={step} />

            {/* Título del paso */}
            <div className="flex flex-col gap-2">
              <h1 className="text-[32px] sm:text-[42px] font-bold text-white tracking-tight leading-tight">
                {STEP_TITLES[step - 1]}
              </h1>
              {step === 1 && (
                <p className="text-[#aaa] text-base sm:text-lg leading-relaxed">
                  Completa tu perfil y nosotros construimos tu CV adaptado a la oferta que quieres.
                </p>
              )}
            </div>

            {/* ── Paso 1: Información personal ── */}
            {step === 1 && (
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
            )}

            {/* ── Paso 2: Educación escolar ── */}
            {step === 2 && (
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
            )}

            {/* ── Paso 3: Educación superior ── */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-[#aaa]">
                  ¿Realizaste o estás realizando estudios superiores?
                </p>
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
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3.5 text-base text-white focus:outline-none focus:border-white/20 transition-colors duration-150 cursor-pointer"
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
            )}

            {/* ── Paso 4: Experiencia profesional ── */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-[#aaa]">¿Cuentas con experiencia laboral?</p>
                <YesNo value={experiencia} onChange={setExperiencia} />
                {experiencia === "si" && (
                  <div className="flex flex-col gap-6">
                    {trabajos.map((tj, idx) => (
                      <div
                        key={tj.id}
                        className="flex flex-col gap-3 border border-[#222] rounded-xl p-5"
                      >
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
            )}

            {/* ── Paso 5: Competencias ── */}
            {step === 5 && (
              <div className="flex flex-col gap-5">
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
                </div>
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
            )}

            {/* ── Paso 6: Oferta e instrucciones ── */}
            {step === 6 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">Oferta de trabajo</p>
                      <span className="text-xs text-[#aaa] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                        Opcional
                      </span>
                    </div>
                    <p className="text-xs text-[#aaa] mt-0.5">
                      Si pegas una oferta, el CV se adapta a ella. Sin oferta, creamos un CV profesional general.
                    </p>
                  </div>
                  <textarea
                    rows={7}
                    placeholder="Pega aquí el texto completo de la oferta de trabajo..."
                    value={oferta}
                    onChange={(e) => setOferta(e.target.value)}
                    className={textareaClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Instrucciones adicionales</span>
                    <span className="text-xs text-[#aaa] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                      Opcional
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
                    value={instrucciones}
                    onChange={(e) => setInstrucciones(e.target.value)}
                    className={textareaClass}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Navegación */}
            <div className={`flex gap-3 ${step > 1 ? "justify-between" : "justify-end"}`}>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="px-6 py-3.5 text-sm font-medium text-white/50 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Atrás
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 sm:flex-none sm:min-w-[180px] py-3.5 px-6 bg-white text-black font-bold rounded-xl text-base tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3.5 px-6 bg-white text-black font-bold rounded-xl text-base tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? "Procesando..." : "Crear mi currículum →"}
                </button>
              )}
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-sm text-[#aaa]">Postulai está creando tu currículum...</span>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

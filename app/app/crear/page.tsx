"use client";

import { useState } from "react";

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

export default function CrearPage() {
  const [estudioSuperior, setEstudioSuperior] = useState<"si" | "no" | null>(null);
  const [estadoEstudio, setEstadoEstudio] = useState("");
  const [experiencia, setExperiencia] = useState<"si" | "no" | null>(null);
  const [trabajos, setTrabajos] = useState([{ id: 0 }]);
  const [nextId, setNextId] = useState(1);
  const [idioma, setIdioma] = useState<"si" | "no" | null>(null);
  const [nivelIdioma, setNivelIdioma] = useState<"basico" | "intermedio" | "avanzado" | null>(null);

  function addTrabajo() {
    setTrabajos((t) => [...t, { id: nextId }]);
    setNextId((n) => n + 1);
  }

  function removeTrabajo(id: number) {
    setTrabajos((t) => t.filter((tj) => tj.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Navbar */}
      <header className="w-full border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-black tracking-tight text-white hover:opacity-80 transition-opacity duration-150">
            Postulai
          </a>
          <button className="text-sm font-medium text-white/60 hover:text-white transition-colors duration-150">
            Mi cuenta
          </button>
        </div>
      </header>

      <main
        className="flex-1 flex flex-col items-center px-6 py-14"
        style={{
          backgroundImage: "linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="w-full max-w-[700px] flex flex-col gap-8">

          {/* Encabezado */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Tu currículum profesional, en minutos</h1>
            <p className="text-[#A0A0A0] text-base">Completa tu perfil y nosotros construimos tu CV adaptado a la oferta que quieres.</p>
          </div>

          {/* Sección 1 — Información personal */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Información personal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" placeholder="Nombre completo" className={inputClass} />
              <input type="email" placeholder="Correo electrónico" className={inputClass} />
              <input type="tel" placeholder="Teléfono" className={inputClass} />
              <input type="text" placeholder="Ciudad de residencia" className={inputClass} />
            </div>
          </div>

          <Divider />

          {/* Sección 2 — Educación escolar */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Educación escolar</p>
            <div className="flex flex-col gap-3">
              <input type="text" placeholder="Nombre del colegio o institución" className={inputClass} />
              <input type="text" placeholder="Año de egreso" className={inputClass} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#A0A0A0]">Opcional</label>
                <input type="text" placeholder="¿Algún logro o distinción que quieras destacar?" className={inputClass} />
              </div>
            </div>
          </div>

          <Divider />

          {/* Sección 3 — Educación superior */}
          <div className="flex flex-col gap-5">
            <p className="text-base font-bold text-white">Educación superior</p>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#A0A0A0]">¿Realizaste o estás realizando estudios superiores?</p>
              <YesNo value={estudioSuperior} onChange={setEstudioSuperior} />
              {estudioSuperior === "si" && (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Universidad, instituto o centro de formación técnica"
                    className={inputClass}
                  />
                  <input type="text" placeholder="Carrera o programa de estudios" className={inputClass} />
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
              <p className="text-sm text-[#A0A0A0]">¿Cuentas con experiencia laboral?</p>
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
                        <input type="text" placeholder="Empresa" className={inputClass} />
                        <input type="text" placeholder="Cargo" className={inputClass} />
                      </div>
                      <input type="text" placeholder="Período (ej. 2022 – 2024)" className={inputClass} />
                      <textarea
                        rows={3}
                        placeholder="Descripción breve del rol. ¿Qué hacías? ¿Qué lograste?"
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
              <p className="text-sm text-[#A0A0A0]">¿Manejas algún idioma además del español?</p>
              <YesNo value={idioma} onChange={setIdioma} />
              {idioma === "si" && (
                <div className="flex flex-col gap-3">
                  <input type="text" placeholder="Idioma (ej. Inglés, Portugués)" className={inputClass} />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-[#A0A0A0]">Nivel</p>
                    <div className="flex gap-2">
                      {(["basico", "intermedio", "avanzado"] as const).map((nivel) => (
                        <button
                          key={nivel}
                          type="button"
                          onClick={() => setNivelIdioma(nivel)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 capitalize ${
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
                  className={textareaClass}
                />
              </div>
            </div>
          </div>

          <Divider />

          {/* Instrucciones adicionales */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Instrucciones adicionales</span>
              <span className="text-xs text-[#A0A0A0] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">Opcional</span>
            </div>
            <textarea
              rows={3}
              placeholder="¿Quieres destacar algo en particular o ajustar el tono? Cuéntanos aquí."
              className={textareaClass}
            />
          </div>

          {/* Botón */}
          <button
            type="button"
            className="w-full py-4 bg-white text-black font-bold rounded-xl text-base tracking-tight hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
          >
            Crear mi currículum →
          </button>

        </div>
      </main>

    </div>
  );
}

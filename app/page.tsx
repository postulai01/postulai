import WaitlistForm from "./components/WaitlistForm";

const benefits = [
  {
    icon: (
      <svg className="w-7 h-7 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: "Tu currículum habla exactamente lo que buscan",
    description:
      "No importa si tienes poca experiencia o mucha. Postulai identifica lo que pide la oferta y reorganiza tu currículum para que el reclutador vea lo que necesita ver.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: "Una carta de presentación que suena a ti",
    description:
      "Sin frases genéricas ni copiar y pegar de internet. Postulai genera una carta adaptada al mercado laboral chileno, directa y profesional.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Sin perder horas en cada postulación",
    description:
      "Preparar una postulación puede tomar más de una hora. Con Postulai toma 30 segundos. El tiempo que ahorras lo usas en conseguir más entrevistas.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Navbar */}
      <header className="w-full border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <span className="text-xl font-bold tracking-tight text-black">
            Postulai
          </span>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-slate-100 rounded-full opacity-60 blur-3xl" />
            <div className="absolute top-32 -left-16 w-72 h-72 bg-slate-200 rounded-full opacity-30 blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 flex flex-col items-start gap-8">
            <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-sm font-medium px-4 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-slate-800 animate-pulse" />
              En construcción — Lista de espera abierta
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-black leading-tight max-w-3xl">
              Tu currículum, listo para cada trabajo que quieras.
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
              Sube tu currículum y la oferta de trabajo que te interesa. Postulai lo adapta y lo
              deja listo para enviar en menos de 30 segundos.
            </p>

            <WaitlistForm />

            <p className="text-sm text-slate-400">
              Sin spam. Solo te avisamos cuando esté lista.
            </p>
          </div>
        </section>

        {/* Context banner */}
        <section className="bg-slate-900 text-white py-5 px-6">
          <div className="max-w-5xl mx-auto text-center text-base sm:text-lg font-medium">
            ¿Recién egresado sin saber qué poner? ¿Años de experiencia pero el formato cambió?{" "}
            <span className="font-bold text-white">Postulai funciona para los dos.</span>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-black text-center mb-4">
              ¿Por qué Postulai?
            </h2>
            <p className="text-slate-500 text-center mb-14 max-w-xl mx-auto">
              Postular toma tiempo. Postulai te lo ahorra sin sacrificar calidad.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="flex flex-col gap-4 bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    {b.icon}
                  </div>
                  <h3 className="text-lg font-bold text-black leading-snug">{b.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tagline */}
        <section className="py-16 px-6 border-y border-slate-100 bg-slate-50">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-black tracking-tight">
              Postulai y listo.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-black text-center mb-3">
              Así de simple funciona
            </h2>
            <p className="text-slate-500 text-center mb-12 max-w-md mx-auto">
              Sin pasos raros. Dos entradas, un resultado listo para enviar.
            </p>

            {/* Tool mockup */}
            <div className="border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Mockup header bar */}
              <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="ml-3 text-xs text-slate-400 font-mono">postulai.cl/app</span>
              </div>

              <div className="p-6 sm:p-8 flex flex-col gap-6 bg-white">
                {/* Two upload areas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* CV upload */}
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center cursor-default hover:border-slate-400 transition-colors duration-150 min-h-[140px]">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Tu CV</p>
                      <p className="text-xs text-slate-400 mt-1">Pega el texto o sube el archivo</p>
                    </div>
                    <div className="mt-1 px-4 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-500 font-medium">
                      Subir CV
                    </div>
                  </div>

                  {/* Job offer upload */}
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center cursor-default hover:border-slate-400 transition-colors duration-150 min-h-[140px]">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">La oferta de trabajo</p>
                      <p className="text-xs text-slate-400 mt-1">Pega el texto o la URL de la oferta</p>
                    </div>
                    <div className="mt-1 px-4 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-500 font-medium">
                      Pegar oferta
                    </div>
                  </div>
                </div>

                {/* Optional field */}
                <textarea
                  disabled
                  rows={3}
                  placeholder="¿Algo que quieras agregar o cambiar? Cuéntanos aquí..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-400 placeholder-slate-300 bg-slate-50 text-sm resize-none cursor-default"
                />

                {/* CTA button */}
                <button
                  disabled
                  className="w-full py-3.5 bg-black text-white font-bold rounded-xl text-base tracking-wide cursor-default opacity-90"
                >
                  Adaptar mi CV
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 mt-5">
              Vista previa — la herramienta estará disponible pronto
            </p>
          </div>
        </section>

        {/* Second CTA */}
        <section className="py-16 px-6 bg-slate-50 border-t border-slate-100">
          <div className="max-w-5xl mx-auto flex flex-col items-center gap-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-black max-w-xl">
              ¿Listo para postular mejor?
            </h2>
            <p className="text-slate-500 max-w-md">
              Anótate y sé de los primeros en probarlo cuando lancemos.
            </p>
            <WaitlistForm />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-400 text-sm">
          <span className="font-semibold text-slate-600">Postulai</span>
          <span>Hecho en Chile 🇨🇱</span>
          <a
            href="mailto:contacto@postulai.cl"
            className="hover:text-black transition-colors duration-150"
          >
            contacto@postulai.cl
          </a>
        </div>
      </footer>
    </div>
  );
}

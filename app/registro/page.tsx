"use client";

export default function RegistroPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] flex flex-col items-center gap-8 text-center">

        <a
          href="/"
          className="text-2xl font-black tracking-tight text-white hover:opacity-70 transition-opacity duration-150"
        >
          Postulai
        </a>

        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-black tracking-tight">Acceso cerrado por el momento</h1>
          <p className="text-sm text-[#A0A0A0] leading-relaxed">
            Si tienes una invitación escríbenos a{" "}
            <a
              href="mailto:contacto@postulai.cl"
              className="text-white underline underline-offset-2 hover:opacity-70 transition-opacity duration-150"
            >
              contacto@postulai.cl
            </a>
          </p>
        </div>

        <a
          href="/"
          className="px-6 py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150"
        >
          Volver al inicio
        </a>

      </div>
    </div>
  );
}

import type { ReactNode } from "react";

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Navbar */}
      <header className="w-full border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <a href="/" className="text-xl font-black tracking-tight text-white hover:opacity-80 transition-opacity duration-150">
            Postulai
          </a>
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-[800px] mx-auto flex flex-col gap-12">

          {/* Encabezado */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Términos y Condiciones</h1>
            <p className="text-sm text-[#9CA3AF]">Última actualización: junio 2026</p>
            <p className="text-[#9CA3AF] text-base leading-relaxed mt-2">
              Al acceder o utilizar los servicios de Postulai, usted acepta quedar vinculado por estos Términos y Condiciones. Le rogamos que los lea detenidamente antes de utilizar la plataforma.
            </p>
          </div>

          <div className="w-full h-px bg-[#1a1a1a]" />

          {/* Secciones */}
          <div className="flex flex-col gap-10">

            <Section title="1. Objeto del servicio">
              Postulai es una plataforma web que utiliza inteligencia artificial para adaptar currículums vitae a ofertas de trabajo específicas y para crear currículums profesionales desde cero. El servicio incluye la generación de cartas de presentación y la entrega de documentos en formatos compatibles con los sistemas de selección automatizada (ATS) utilizados por empresas en Chile y a nivel internacional.
            </Section>

            <Section title="2. Condiciones de uso">
              El usuario declara ser mayor de 18 años o contar con autorización de su representante legal. El usuario es el único responsable de la veracidad y exactitud de la información proporcionada. Queda estrictamente prohibido el uso del servicio para fines ilegales, fraudulentos o de suplantación de identidad. El servicio es de uso personal e intransferible. Queda prohibida la reventa, cesión o explotación comercial del servicio sin autorización expresa del titular.
            </Section>

            <Section title="3. Registro y cuenta de usuario">
              Para acceder al servicio el usuario debe crear una cuenta personal con datos verídicos. El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso. Postulai se reserva el derecho de suspender o eliminar cuentas que infrinjan estos términos sin previo aviso.
            </Section>

            <Section title="4. Prueba gratuita y suscripción">
              Al crear una cuenta el usuario recibe 5 usos gratuitos para adaptar su CV y generar cartas de presentación, sin necesidad de proporcionar datos de pago. Los usos gratuitos no tienen fecha de vencimiento y se descuentan únicamente por uso efectivo del servicio. Una vez utilizados los usos gratuitos, el acceso al servicio requiere la contratación de una suscripción de pago. Los planes disponibles y sus precios se detallan en la página de planes de Postulai. Los pagos son procesados a través de plataformas de pago seguras. Las suscripciones se renuevan automáticamente salvo que el usuario las cancele antes de la fecha de renovación. No se realizan reembolsos una vez procesado el pago del período en curso, salvo casos excepcionales evaluados a criterio de Postulai.
            </Section>

            <Section title="5. Tratamiento de datos y privacidad">
              Los documentos y datos proporcionados por el usuario son procesados exclusivamente para generar el resultado solicitado. Postulai no almacena permanentemente los documentos subidos por el usuario. Los datos personales son tratados conforme a la legislación chilena vigente en materia de protección de datos personales, Ley N° 19.628. Postulai no vende, cede ni comparte datos personales con terceros sin consentimiento del usuario, salvo obligación legal. Para mayor información consulte nuestra{" "}
              <a href="/privacidad" className="text-white underline underline-offset-2 hover:opacity-70 transition-opacity duration-150">Política de Privacidad</a>.
            </Section>

            <Section title="6. Propiedad intelectual">
              El contenido generado por Postulai a partir de los datos del usuario es de propiedad del usuario. El código fuente, diseño, marca, logotipo y demás elementos de Postulai son de propiedad exclusiva de Pedro Ignacio Heresi Rivadeneira y están protegidos por la legislación chilena e internacional de propiedad intelectual. Queda prohibida su reproducción, distribución o uso sin autorización expresa.
            </Section>

            <Section title="7. Limitación de responsabilidad">
              Postulai no garantiza que el uso del servicio resulte en la obtención de empleo o en la selección del usuario en ningún proceso de reclutamiento. El servicio se presta en el estado en que se encuentra, sin garantías adicionales expresas o implícitas. Postulai no se hace responsable de interrupciones del servicio por causas ajenas a su control, incluyendo fallos de terceros proveedores tecnológicos.
            </Section>

            <Section title="8. Modificaciones">
              Postulai se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. Los cambios serán comunicados a los usuarios registrados con al menos 15 días de anticipación. El uso continuado del servicio tras la notificación implica la aceptación de los nuevos términos.
            </Section>

            <Section title="9. Ley aplicable y jurisdicción">
              Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia será sometida a los tribunales ordinarios de justicia de la ciudad de Santiago, Chile.
            </Section>

            <Section title="10. Identificación del titular">
              Postulai es un servicio digital operado por Pedro Ignacio Heresi Rivadeneira, con domicilio en Santiago, Chile. Correo de contacto: contacto@postulai.cl
            </Section>

            <Section title="11. Contacto">
              Para consultas, reclamos o ejercicio de derechos:{" "}
              <a href="mailto:contacto@postulai.cl" className="text-white underline underline-offset-2 hover:opacity-70 transition-opacity duration-150">contacto@postulai.cl</a>
            </Section>

          </div>

          <div className="w-full h-px bg-[#1a1a1a]" />

          <a href="/" className="text-sm text-[#9CA3AF] hover:text-white transition-colors duration-150 w-fit">
            ← Volver al inicio
          </a>

        </div>
      </main>

    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <p className="text-[#9CA3AF] text-sm leading-relaxed">{children}</p>
    </div>
  );
}

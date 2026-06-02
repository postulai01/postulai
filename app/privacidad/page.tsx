import type { ReactNode } from "react";

export default function PrivacidadPage() {
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
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Política de Privacidad</h1>
            <p className="text-sm text-[#9CA3AF]">Última actualización: junio 2026</p>
            <p className="text-[#9CA3AF] text-base leading-relaxed mt-2">
              En Postulai nos tomamos muy en serio la privacidad de nuestros usuarios. Esta política describe qué datos recopilamos, cómo los usamos y qué derechos tiene usted sobre ellos.
            </p>
          </div>

          <div className="w-full h-px bg-[#1a1a1a]" />

          {/* Secciones */}
          <div className="flex flex-col gap-10">

            <Section title="1. Datos que recopilamos">
              Recopilamos los siguientes tipos de datos: nombre completo y correo electrónico proporcionados al crear la cuenta; documentos subidos por el usuario (currículum y ofertas de trabajo) para procesar las solicitudes; y datos de uso de la plataforma como páginas visitadas, acciones realizadas y registros técnicos necesarios para el correcto funcionamiento del servicio.
            </Section>

            <Section title="2. Finalidad del tratamiento">
              Los datos recopilados se utilizan exclusivamente para: prestar el servicio de adaptación y creación de currículums solicitado por el usuario; mejorar la plataforma a partir del análisis de uso agregado y anonimizado; y enviar comunicaciones relacionadas con el servicio, como confirmaciones de cuenta, actualizaciones o avisos importantes. No utilizamos los datos con fines publicitarios ni los cedemos a terceros con fines comerciales.
            </Section>

            <Section title="3. Base legal del tratamiento">
              El tratamiento de los datos personales se basa en el consentimiento expreso del usuario, otorgado al momento de crear una cuenta y aceptar los Términos y Condiciones y la presente Política de Privacidad, de conformidad con la Ley N° 19.628 sobre Protección de la Vida Privada de Chile.
            </Section>

            <Section title="4. Conservación de datos">
              Los documentos subidos por el usuario (currículums y ofertas de trabajo) no se almacenan permanentemente en nuestros servidores una vez procesada la solicitud. Los datos de la cuenta del usuario — nombre, correo electrónico y preferencias — se conservan mientras la cuenta permanezca activa. Al eliminar la cuenta, los datos personales asociados son eliminados de nuestros sistemas en un plazo máximo de 30 días.
            </Section>

            <Section title="5. Derechos del usuario">
              De conformidad con la Ley N° 19.628, el usuario tiene derecho a acceder a sus datos personales; rectificar datos inexactos o incompletos; solicitar la cancelación de sus datos cuando ya no sean necesarios; y oponerse al tratamiento de sus datos en los casos previstos por la ley. Para ejercer cualquiera de estos derechos, el usuario puede escribir a{" "}
              <a href="mailto:contacto@postulai.cl" className="text-white underline underline-offset-2 hover:opacity-70 transition-opacity duration-150">contacto@postulai.cl</a>{" "}
              indicando el derecho que desea ejercer y adjuntando una identificación válida.
            </Section>

            <Section title="6. Cookies">
              Postulai utiliza cookies técnicas estrictamente necesarias para el funcionamiento del servicio, como el mantenimiento de la sesión del usuario. No utilizamos cookies de seguimiento publicitario ni compartimos datos de navegación con redes publicitarias. El usuario puede configurar su navegador para rechazar cookies, aunque esto puede afectar el correcto funcionamiento de la plataforma.
            </Section>

            <Section title="7. Seguridad">
              Aplicamos medidas técnicas y organizativas para proteger los datos personales de nuestros usuarios, incluyendo transmisión cifrada mediante HTTPS, acceso restringido a los datos únicamente al personal autorizado, y revisión periódica de nuestras prácticas de seguridad. No obstante, ningún sistema es completamente infalible y no podemos garantizar la seguridad absoluta de la información transmitida por internet.
            </Section>

            <Section title="8. Responsable del tratamiento">
              Postulai es operado por Pedro Ignacio Heresi Rivadeneira, con domicilio en Santiago, Chile. Para cualquier consulta relacionada con el tratamiento de datos personales puede contactarnos en:{" "}
              <a href="mailto:contacto@postulai.cl" className="text-white underline underline-offset-2 hover:opacity-70 transition-opacity duration-150">contacto@postulai.cl</a>
            </Section>

            <Section title="9. Contacto">
              Para consultas, solicitudes o el ejercicio de sus derechos en materia de protección de datos, puede contactarnos en:{" "}
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

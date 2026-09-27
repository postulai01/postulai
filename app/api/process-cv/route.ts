import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  normalizarParaComparar,
  calcularMatch,
  extraerPerfilProfesional,
  limpiarConocimientosEnDesarrollo,
  limpiarHabilidadesTecnicas,
} from "../../lib/cv-postprocess";
import { construirMensajeUsuario } from "../../lib/mensaje-usuario";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un consultor de empleabilidad chileno con amplia experiencia en reclutamiento en todos los sectores. Adaptas CVs para que consigan entrevistas: reescribes con decisión lo vago y lo débil, y nunca agregas nada que el candidato no haya entregado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPIOS (prevalecen sobre cualquier otra regla)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LA FUENTE es el CV original en MODO ADAPTAR, y los datos del candidato en MODO CREAR. Es la única fuente de hechos.

1. RESPALDO. Toda afirmación del CV (hecho, responsabilidad, resultado, herramienta, competencia, alcance, nivel de idioma) debe poder señalarse en una línea de LA FUENTE. Reescribes el lenguaje, nunca los hechos. El nombre de una carrera o mención académica no respalda por sí solo competencias específicas: solo cuentan un curso o ramo nombrado, un proyecto descrito, una herramienta nombrada o experiencia laboral directa.
2. CERO CIFRAS INVENTADAS, sin excepción. Ninguna cantidad, porcentaje, monto, plazo, tamaño de equipo ni rango puede aparecer si no está en LA FUENTE. No inventes, no estimes, no infieras. Si no hay cifra, describe el alcance o la escala de forma cualitativa, y ese descriptor también debe tener respaldo.
3. NINGUNA CIFRA SE PIERDE. Toda cifra de LA FUENTE relevante para la oferta se conserva al reescribir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISIS PREVIO (interno, no se muestra)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A) Nivel del candidato: estudiante, practicante o recién egresado (menos de 1 año de experiencia laboral), junior (1 a 4 años), mid (5 a 10), senior o ejecutivo (más de 10).
B) Sector y tono de la oferta: corporativo, técnico, comercial, startup o ejecutivo.
C) Palabras clave: 8 a 10 términos mencionados literalmente en la oferta (herramientas, metodologías, certificaciones, conocimientos, carreras requeridas, términos técnicos), nunca inferidos, generalizados ni parafraseados. Cada uno de 1 a 3 palabras; separa habilidades compuestas en términos distintos. Tómalos en el orden en que aparecen, priorizando las secciones de requisitos, conocimientos y funciones. Excluye el tipo de cargo o modalidad (práctica profesional, part-time, híbrido y similares). Esta es la lista que entregas en palabras_clave_oferta.
D) Clasifica cada palabra clave como con respaldo o sin respaldo en LA FUENTE. Integra en el CV todas las que tienen respaldo, usando el término exacto de la oferta. Las que no tienen respaldo no se integran de ninguna forma. No hay cuota mínima.
E) Puentes honestos: si una función de la oferta comparte la naturaleza del trabajo con una experiencia real del candidato, expresa esa experiencia con el vocabulario de la oferta. El puente conecta la naturaleza del trabajo; nunca iguala una escala, formalidad o contexto que LA FUENTE no respalda.
F) Brechas: ordena los cargos por fecha y calcula los meses entre el fin de uno y el inicio del siguiente. Ese cálculo es la única fuente de verdad, aunque el candidato no mencione la brecha.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DEL CV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ORDEN DE SECCIONES SEGÚN EL NIVEL (punto A del análisis previo):
- Estudiante, practicante o recién egresado con menos de 1 año de experiencia laboral: EDUCACIÓN va ANTES que EXPERIENCIA LABORAL. Orden: contacto, PERFIL PROFESIONAL, EDUCACIÓN, EXPERIENCIA LABORAL, HABILIDADES, IDIOMAS.
- Junior, mid, senior y ejecutivo: EXPERIENCIA LABORAL va antes que EDUCACIÓN. Orden: contacto, PERFIL PROFESIONAL, EXPERIENCIA LABORAL, EDUCACIÓN, HABILIDADES, IDIOMAS, CERTIFICACIONES (si aplica).

Formato obligatorio, del que depende el sistema:
- La primera línea es el nombre completo del candidato; debajo, sus datos de contacto.
- Cada sección se titula exactamente con uno de estos encabezados en MAYÚSCULAS: PERFIL PROFESIONAL, EXPERIENCIA LABORAL, EDUCACIÓN, HABILIDADES, IDIOMAS, CERTIFICACIONES. En la línea siguiente va ———————————————
- Línea de cargo: Cargo | Empresa — MM/AAAA – MM/AAAA · Ciudad. Cargo actual: MM/AAAA – Presente. Si LA FUENTE solo da el año, usa el año; no inventes meses.
- Cada bullet empieza con "- ".
- Sin tablas, columnas, íconos, gráficos, encabezados ni pies de página. Ninguna mención a Postulai.
- Extensión: 1 página para practicante y junior; 1 a 2 para mid; máximo 2 para senior y ejecutivo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFIL PROFESIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Nombra el cargo al que se postula, tal como lo nombra la oferta. Nunca el nombre de la empresa. Sin oferta, nombra el título o rol profesional del candidato.
2. Entre 50 y 100 palabras, en 2 a 4 líneas.
3. Contenido: nivel o etapa profesional y área de especialidad; 2 o 3 fortalezas o diferenciadores con respaldo, con el vocabulario de la oferta cuando hay respaldo; un logro o hecho concreto de LA FUENTE. Si el candidato está sin empleo y la oferta no fija fecha de inicio, indica disponibilidad inmediata.
4. Redacción impersonal, con frases nominales. Sin primera persona, explícita o implícita (yo soy, me considero, busco, busca, en búsqueda de). Sin tercera persona (ha liderado, ha desarrollado, ha gestionado).
5. En una enumeración, cada elemento necesita su propio respaldo. Un elemento sin respaldo se elimina; no se rescata como "en formación" ni "en desarrollo".
6. No resume toda la trayectoria: eso vive en EXPERIENCIA LABORAL.
7. Prohibido: proactivo, apasionado, dinámico, innovador, orientado a resultados, nuevos desafíos, ganas de aprender, soy una persona, me considero; apoyar, aportar, contribuir, colaborar, asistir (en cualquier conjugación); ciclo completo, end-to-end, de principio a fin, desde X hasta Y, productivo-comercial, operativo-comercial.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPERIENCIA LABORAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERBOS
- Cada bullet empieza con un verbo de acción en primera persona singular: presente en el cargo actual (el que termina en Presente), pasado en los anteriores.
- Repetición: dentro de un mismo cargo, cada bullet empieza con un verbo distinto. En todo el CV, un mismo verbo inicia como máximo 3 bullets. El presente y el pasado de un verbo son el mismo verbo; un verbo con prefijo (rediseñar frente a diseñar) es otro. Si un verbo se repetiría, usa otro verbo de la lista.
- Verbos recomendados (conjúgalos): gestionar, liderar, implementar, reducir, aumentar, coordinar, desarrollar, ejecutar, diseñar, negociar, optimizar, construir, lanzar, estructurar, analizar, capacitar, supervisar, dirigir, administrar, establecer, generar, lograr, impulsar, consolidar, transformar, reestructurar, proponer, pilotear, escalar, comercializar, identificar, evaluar. Elige el más específico para la acción.
- Prohibidos como verbo inicial: realizar, participar, apoyar, contribuir, colaborar, ayudar, asistir, estar a cargo de, ser responsable de.
- Prohibidos en cualquier parte: infinitivo como tarea pendiente, tercera persona, pasiva, frases nominales del tipo "encargado de", y los gerundios apoyando, contribuyendo, colaborando, aportando, participando.

CONTENIDO
- Cada bullet: verbo + qué hizo + resultado, cifra o alcance, todo con respaldo.
- Practicante y junior: 3 a 4 bullets por cargo. Mid, senior y ejecutivo: 4 a 6. Si LA FUENTE no da material para el mínimo sin inventar, escribe menos.
- El cargo actual es el que más pesa: reescribe sus bullets con prioridad. Si es consultoría o freelance, redáctalos como resultados entregados a clientes.
- Ningún bullet débil queda casi idéntico al original. Si la línea de LA FUENTE empieza con un verbo prohibido o tiene una construcción débil (gerundio de soporte, pasiva, frase nominal, frase prohibida), reescribe el bullet completo sin agregar hechos. Cambiar una sola palabra no basta si la debilidad se mantiene.
- Transformación activa: reencuadra cada bullet hacia el lenguaje y los procesos de la oferta cuando exista una conexión honesta. El reencuadre cambia el lenguaje; nunca agrega acciones, responsabilidades ni resultados.
- Principios 2 y 3 en cada bullet: ninguna cifra nueva, ninguna cifra perdida.
- Prohibido en todo el CV: multifuncional, proactivo, dinámico, sinergia, potenciando, resguardando, gestión integral, ciclo completo, end-to-end, de principio a fin, cubriendo todas las etapas, desde X hasta Y.

BRECHAS (según el cálculo del análisis previo)
- Menor a 3 meses: no se menciona.
- De 3 meses o más ENTRE dos cargos: entrada cronológica dentro de EXPERIENCIA LABORAL, con fechas en el mismo formato que un cargo, ubicada entre los dos cargos que la rodean. Título: "Período de búsqueda laboral". Solo si LA FUENTE menciona cursos, freelance o voluntariado en ese período, el título agrega "y desarrollo profesional" y se describen brevemente. Si supera 12 meses, el perfil puede además mencionar en una frase nominal breve a qué se dedicó el período, solo con respaldo.
- Brecha abierta hasta hoy (el último cargo terminó y no hay cargo posterior): NO agregues ninguna entrada por ese período. El perfil indica disponibilidad inmediata. Si la brecha abierta supera 12 meses y LA FUENTE menciona cursos, freelance u otra actividad en ese período, el perfil puede mencionarlo en una frase nominal breve.
- Nunca inventes ni comprimas fechas para ocultar una brecha.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDUCACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Formato: Carrera | Institución — MM/AAAA – MM/AAAA · Ciudad.
- Sin bullets. Única excepción: premio nacional, publicación académica, promedio sobre 6.0 o beca competitiva. No son excepción: magíster integrado, ramos eximidos, colegio bilingüe, duración de la carrera, lo implícito en el nombre de la institución.
- Usa la nomenclatura formal chilena (Enseñanza Media Completa, CFT, IP, Universidad) cuando sea evidente, sin inventar nombres formales.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HABILIDADES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada categoría en una sola línea, con estas etiquetas exactas y elementos separados por " · ":
Habilidades técnicas: máximo 6. Solo herramientas, software, plataformas, lenguajes o certificaciones con nombre propio mencionados en LA FUENTE. Las funciones o tareas no van aquí aunque la oferta las nombre: selección, reclutamiento, entrevistas, psicometría, análisis, gestión, atención al cliente, negociación, planificación, evaluación, coordinación, capacitación, ventas.
Habilidades blandas: máximo 5. Prohibidas: disposición al aprendizaje, aprendizaje rápido, multifuncional, dinámico, proactivo, y funciones disfrazadas de habilidad blanda (gestión operativa, análisis de procesos, organización a secas).
Conocimientos en desarrollo: solo con un indicio concreto en LA FUENTE (ramo, curso, proyecto o certificación en curso). Que la oferta pida algo nunca es un indicio. Sin indicio, omite la línea.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDIOMAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El nivel de cada idioma se copia tal cual de LA FUENTE; nunca se sube. Sin nivel declarado, se lista sin nivel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARTA DE PRESENTACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Entre 250 y 350 palabras, 3 párrafos.
1. Por qué esta empresa y este cargo, con algo concreto de la empresa.
2. Dos logros del candidato relevantes para la oferta, con cifras solo si están en LA FUENTE.
3. Cierre directo con disponibilidad y contacto.
Aperturas prohibidas: Mi nombre es, Me dirijo a usted, Estoy muy interesado, Por medio de la presente, A quien corresponda, Es un honor, Tengo el agrado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REVISIÓN FINAL (antes de entregar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Cada afirmación del perfil y de los bullets, incluidas cifras y descriptores de alcance, se puede señalar en una línea de LA FUENTE. Si no, elimínala.
2. Presente en el cargo actual, pasado en los anteriores; ningún bullet empieza con un verbo prohibido; ningún verbo se repite dentro de un cargo ni inicia más de 3 bullets en todo el CV.
3. El perfil nombra el cargo al que se postula y no nombra la empresa.
4. Ninguna cifra relevante de LA FUENTE se perdió al reescribir.
5. Orden de secciones según el nivel: EDUCACIÓN antes que EXPERIENCIA LABORAL solo para estudiante, practicante o recién egresado con menos de 1 año de experiencia laboral.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPUESTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Responde ÚNICAMENTE con un JSON válido con estos campos:
- cv_adaptado: string con el CV completo, en el formato indicado arriba.
- carta_presentacion: string con la carta.
- sugerencias: array de exactamente 3 strings, en este orden: visibilidad digital (qué cambiar en LinkedIn para este cargo), contacto directo (con el reclutador, la empresa o la red del sector), mejora de perfil o habilidad. Formato "Título breve: acción concreta"; el título tiene 2 a 4 palabras y el total no supera 20 palabras. Al menos una apunta a lo más relevante de la oferta que el candidato no tiene, como una acción concreta que puede empezar (un curso introductorio, un proyecto personal). Nunca sugieras decir en la entrevista que ya sabe o que está aprendiendo algo.
- principales_cambios: array de exactamente 5 strings en formato "qué había → qué hay ahora".
- titulo_postulacion: string. En MODO ADAPTAR o MODO CREAR CON OFERTA: "CV para [Empresa] · [Cargo]"; si no se identifica la empresa, "CV para [Cargo]". En MODO CREAR SIN OFERTA: "CV Profesional · [Título profesional del candidato]".
- palabras_clave_oferta: string[] con las palabras clave del punto C del análisis previo, en MODO ADAPTAR o MODO CREAR CON OFERTA. En MODO CREAR SIN OFERTA: array vacío [].`;

// ─── identity helpers (permanecen en route.ts) ──────────────────────────────

function normalizarNombre(nombre: string): string[] {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function nombresCoinciden(referencia: string, candidato: string): boolean {
  const refTokens = normalizarNombre(referencia);
  const candTokens = normalizarNombre(candidato);
  if (refTokens.length === 0 || candTokens.length === 0) return true;
  // Apellidos = últimos tokens del nombre (convención chilena: nombre(s) apellido1 apellido2)
  // Para nombres de 2 tokens: último 1; para 3+ tokens: últimos 2
  const numApellidos = Math.min(2, Math.max(1, refTokens.length - 1));
  const refApellidos = refTokens.slice(-numApellidos);
  return refApellidos.some(a => candTokens.includes(a));
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { modo, cv, oferta, datos_personales, instrucciones } = body;

    if (!modo || !["adaptar", "crear"].includes(modo)) {
      return NextResponse.json(
        { error: "El campo 'modo' es requerido y debe ser 'adaptar' o 'crear'." },
        { status: 400 }
      );
    }

    if (modo === "adaptar" && !oferta) {
      return NextResponse.json(
        { error: "En modo 'adaptar' el campo 'oferta' es requerido." },
        { status: 400 }
      );
    }

    if (modo === "adaptar" && !cv) {
      return NextResponse.json(
        { error: "En modo 'adaptar' el campo 'cv' es requerido." },
        { status: 400 }
      );
    }

    if (modo === "crear" && !datos_personales) {
      return NextResponse.json(
        { error: "En modo 'crear' el campo 'datos_personales' es requerido." },
        { status: 400 }
      );
    }

    let isIlimitado = false;
    const { data: usage } = await supabase
      .from("user_usage")
      .select("usos_gratis_restantes, ilimitado, nombre_referencia")
      .eq("user_id", user.id)
      .single();

    if (modo === "adaptar") {
      isIlimitado = usage?.ilimitado === true;
      if (!isIlimitado && usage !== null && usage.usos_gratis_restantes <= 0) {
        return NextResponse.json({ error: "sin_usos" }, { status: 403 });
      }
    }

    const userMessage = construirMensajeUsuario({ modo, cv, oferta, datos_personales, instrucciones });

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      thinking: { type: "disabled" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "La respuesta del modelo no contiene JSON válido." },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    if (typeof result.cv_adaptado === "string") {
      const perfilOriginal = extraerPerfilProfesional(result.cv_adaptado);
      if (perfilOriginal) {
        const palabrasPerfil = perfilOriginal.trim().split(/\s+/).filter(Boolean).length;
        if (palabrasPerfil > 300) {
          // Extraction failed — captured far more than a real profile (≤100 words).
          // Abort to protect the full CV; the profile will simply not be trimmed.
          console.error(
            `[postulai] extraerPerfilProfesional capturó ${palabrasPerfil} palabras — ` +
            `extracción fallida, se omite el recorte para no destruir el CV.`
          );
        } else if (palabrasPerfil > 100) {
          const trimResponse = await client.messages.create({
            model: "claude-sonnet-5",
            max_tokens: 300,
            thinking: { type: "disabled" },
            messages: [{
              role: "user",
              content: `Recorta el siguiente texto a máximo 100 palabras sin perder la idea principal. Devuelve ÚNICAMENTE el texto recortado, sin comillas, sin explicaciones, sin JSON.\n\nTEXTO:\n${perfilOriginal}`,
            }],
          });
          const perfilRecortado = trimResponse.content[0].type === "text"
            ? trimResponse.content[0].text.trim()
            : perfilOriginal;
          result.cv_adaptado = result.cv_adaptado.replace(perfilOriginal, perfilRecortado);
        }
      }
    }

    // ── filtro anti-fabricación: Conocimientos en desarrollo y Habilidades técnicas ─────────────
    if (typeof result.cv_adaptado === "string") {
      const fuenteOriginal = modo === "adaptar"
        ? (typeof cv === "string" ? cv : "")
        : (typeof datos_personales === "string"
            ? datos_personales
            : JSON.stringify(datos_personales ?? ""));
      result.cv_adaptado = limpiarConocimientosEnDesarrollo(
        result.cv_adaptado as string,
        fuenteOriginal
      );
      result.cv_adaptado = limpiarHabilidadesTecnicas(
        result.cv_adaptado as string,
        fuenteOriginal
      );
    }

    // ── verificación de identidad ─────────────────────────────────────────
    if (typeof result.cv_adaptado === "string") {
      const nombreCandidato = (result.cv_adaptado as string)
        .split("\n")
        .find((l: string) => l.trim().length > 0)
        ?.trim() ?? "";
      const nombreRef: string | null = usage?.nombre_referencia ?? null;

      if (nombreCandidato) {
        if (!nombreRef) {
          if (usage !== null) {
            await supabase
              .from("user_usage")
              .update({ nombre_referencia: nombreCandidato })
              .eq("user_id", user.id);
          } else {
            await supabase
              .from("user_usage")
              .insert({ user_id: user.id, nombre_referencia: nombreCandidato, usos_gratis_restantes: 5 });
          }
        } else if (!nombresCoinciden(nombreRef, nombreCandidato)) {
          return NextResponse.json({
            error: "nombre_no_coincide",
            message: "Esta cuenta está registrada para uso personal de un solo candidato. Si este CV es para otra persona, esa persona debe crear su propia cuenta. Si crees que esto es un error (por ejemplo, tu nombre registrado no coincide con cómo firmas tus CVs), puedes actualizarlo en tu perfil.",
          }, { status: 403 });
        }
      }
    }

    const keywords: string[] = Array.isArray(result.palabras_clave_oferta)
      ? result.palabras_clave_oferta
      : [];
    const cvOriginalText = modo === "adaptar"
      ? (typeof cv === "string" ? cv : "")
      : (typeof datos_personales === "string" ? datos_personales : JSON.stringify(datos_personales ?? ""));
    const matchData = keywords.length > 0
      ? calcularMatch(keywords, result.cv_adaptado ?? "", cvOriginalText)
      : { keywords_totales: 0, keywords_encontradas: 0, integradas: [], no_usadas_con_evidencia: [], gap: [] };

    if (modo === "adaptar" && !isIlimitado) {
      await supabase.rpc("decrementar_uso_gratis", { p_user_id: user.id });
    }

    return NextResponse.json({ ...result, ...matchData });
  } catch (error) {
    console.error("Error en /api/process-cv:", error);
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

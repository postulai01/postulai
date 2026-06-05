import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en recursos humanos y redacción de currículums profesionales para el mercado laboral chileno. Tienes dos modos de operación:

MODO ADAPTAR: Recibes un currículum existente y una oferta de trabajo. Reescribe el CV reorganizando y reformulando únicamente la información real del candidato para que calce perfectamente con los requisitos de la oferta. Usa las palabras clave exactas de la oferta. Identifica habilidades implícitas del candidato que se alineen con la oferta aunque no estén mencionadas explícitamente. IMPORTANTE: No inventes ni agregues información que no esté en el CV original. Solo reorganiza, reformula y destaca lo que ya existe. El candidato es responsable de la veracidad de su información.

MODO CREAR CON OFERTA: Recibes datos básicos del candidato y una oferta de trabajo. Construye un CV profesional desde cero adaptado específicamente a esa oferta. Usa las palabras clave de la oferta y destaca las habilidades del candidato que mejor se alineen con sus requisitos. No inventes información que el candidato no haya proporcionado.

MODO CREAR SIN OFERTA: Recibes únicamente datos básicos del candidato. Construye un CV profesional general y completo, optimizado para ATS 2026, que sirva para postular a cualquier trabajo relacionado con su perfil. Destaca habilidades, logros y formación de manera equilibrada y versátil. No inventes información que el candidato no haya proporcionado.

FORMATO DEL CV — ESTRUCTURA EXACTA Y OBLIGATORIA (ambos modos):

El CV debe seguir esta estructura, en este orden y con este formato exacto:

NOMBRE COMPLETO DEL CANDIDATO
(en la primera línea, en MAYÚSCULAS)

Título profesional real del candidato
(segunda línea, capitalización normal — OBLIGATORIO: refleja exactamente lo que el candidato estudia o estudió, incluyendo especialización o mención si la tiene. Ejemplos: "Estudiante de Ingeniería Comercial · Mención Finanzas Cuantitativas", "Ingeniero Civil Industrial · Especialización en Logística", "Contador Auditor · Mención en Tributación". NUNCA uses el cargo de la oferta de trabajo como título.)

Ciudad, País | Teléfono | Email
(tercera línea con los datos de contacto separados por |)

[línea en blanco]

PERFIL PROFESIONAL
Máximo 3 líneas describiendo al candidato, orientado a la oferta específica. Conciso y directo.

[línea en blanco]

EXPERIENCIA LABORAL
Por cada experiencia, exactamente en este formato:
Cargo | Empresa
Período · Ciudad
• Logro o responsabilidad 1
• Logro o responsabilidad 2
• Logro o responsabilidad 3
• Logro o responsabilidad 4 (máximo — nunca más de 4 puntos por experiencia)
[línea en blanco entre experiencias]

EDUCACIÓN
Título o carrera | Institución
Período · Ciudad
• Detalle relevante si corresponde (máximo 3 puntos por entrada de educación)
[línea en blanco entre entradas]

HABILIDADES
Herramientas y Software:
• Herramienta 1
• Herramienta 2

Idiomas:
• Español: Nativo
• Inglés: [nivel correspondiente]

Competencias:
• Competencia 1
• Competencia 2
• Competencia 3
(máximo 6 competencias en total)

REGLAS ESTRICTAS DE FORMATO:
- Máximo 2 páginas de contenido — los límites por sección son obligatorios: perfil 3 líneas, máx 4 puntos por experiencia, máx 3 puntos por educación, máx 6 competencias
- Sin tablas, sin columnas múltiples, sin gráficos, sin íconos, sin imágenes
- Títulos de sección siempre en MAYÚSCULAS (PERFIL PROFESIONAL, EXPERIENCIA LABORAL, EDUCACIÓN, HABILIDADES)
- Viñetas con el símbolo • para todos los puntos de lista, sin excepción
- Separadores de sección únicamente con líneas en blanco, NUNCA con ---, ===, %%% ni caracteres repetidos
- No uses caracteres decorativos de ningún tipo (─, ━, ●, ◆, ▪, etc.)
- No inventes ni agregues información que no esté en el CV original. Solo reorganiza y reformula lo que el candidato ya tiene
- Compatible 100% con sistemas ATS
- NO incluyas pie de página, nota al pie, ni ninguna mención a "Postulai" dentro del cv_adaptado

CARTA DE PRESENTACIÓN: Máximo 150 palabras. Directa, profesional, en tono chileno. En MODO CREAR CON OFERTA o MODO ADAPTAR: personalizada para la oferta específica. En MODO CREAR SIN OFERTA: carta de presentación general que destaque el perfil y valor del candidato.

REVISIÓN ORTOGRÁFICA Y GRAMATICAL (obligatoria antes de entregar): (1) Mayúsculas correctas en nombres de idiomas (Español, Inglés, Alemán, Francés), nombres propios, empresas e instituciones. (2) Tildes correctas en todas las palabras que las requieran. (3) Puntuación correcta — comas, puntos y punto y coma donde corresponda. (4) Tono formal y profesional en cada frase, sin coloquialismos. (5) Consistencia de estilo — verbos en la misma forma en toda la sección de experiencia. No entregues el resultado sin haber revisado ortografía y gramática en cada línea.

Responde ÚNICAMENTE con un JSON válido con estos campos:
- cv_adaptado: string con el CV completo formateado
- carta_presentacion: string con la carta (máximo 150 palabras)
- sugerencias: array de exactamente 3 strings concisos y específicos con recomendaciones para el candidato
- principales_cambios: array de máximo 5 strings cortos (máximo 8 palabras cada uno) describiendo los cambios más importantes al CV; en MODO CREAR describe las decisiones clave del CV construido
- titulo_postulacion: string con el título de la postulación. En MODO ADAPTAR o MODO CREAR CON OFERTA: formato exacto "CV para [Empresa] · [Cargo]" (ej: "CV para Banco Chile · Analista Financiero"); si no se identifica la empresa usar "CV para [Cargo]". En MODO CREAR SIN OFERTA: formato "CV Profesional · [Título profesional del candidato]" (ej: "CV Profesional · Ingeniero Civil Industrial", "CV Profesional · Estudiante de Administración de Empresas").`;

export async function POST(request: NextRequest) {
  try {
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

    let userMessage = "";

    if (modo === "adaptar") {
      userMessage = `MODO: ADAPTAR\n\nCV DEL CANDIDATO:\n${cv}\n\nOFERTA DE TRABAJO:\n${oferta}`;
    } else {
      const datosStr =
        typeof datos_personales === "string"
          ? datos_personales
          : JSON.stringify(datos_personales, null, 2);
      if (oferta) {
        userMessage = `MODO: CREAR CON OFERTA\n\nDATOS DEL CANDIDATO:\n${datosStr}\n\nOFERTA DE TRABAJO:\n${oferta}`;
      } else {
        userMessage = `MODO: CREAR SIN OFERTA\n\nDATOS DEL CANDIDATO:\n${datosStr}`;
      }
    }

    if (instrucciones) {
      userMessage += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${instrucciones}`;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
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
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en /api/process-cv:", error);
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

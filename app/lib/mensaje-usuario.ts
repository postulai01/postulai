// Construye el mensaje de usuario que recibe el modelo en /api/process-cv.
// Compartido con evals/critico-reclutador.ts para que las evals midan exactamente
// lo que recibe el usuario en producción.

export interface EntradaMensaje {
  modo: "adaptar" | "crear";
  cv?: string;
  oferta?: string;
  datos_personales?: unknown;
  instrucciones?: unknown;
}

export function construirMensajeUsuario({
  modo,
  cv,
  oferta,
  datos_personales,
  instrucciones,
}: EntradaMensaje): string {
  let userMessage = "";

  if (modo === "adaptar") {
    userMessage = `MODO: ADAPTAR\n\nEl CV original es la única fuente de hechos y cifras. Reescribe su lenguaje, estilo y estructura aplicando las reglas del system prompt; no cambies ni agregues hechos.\n\nCV ORIGINAL:\n${cv}\n\nOFERTA DE TRABAJO:\n${oferta}`;
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
    const instruccionesSafe = String(instrucciones).slice(0, 500);
    userMessage += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${instruccionesSafe}`;
  }

  return userMessage;
}

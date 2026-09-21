import React from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import CVDocumentTradicional from "./CVDocumentTradicional";
import CVDocumentModerno from "./CVDocumentModerno";
import CVDocumentEjecutivo from "./CVDocumentEjecutivo";

type PdfElement = React.ReactElement<DocumentProps>;

// Maps legacy formato values to the new 3-template system
function resolveFormato(formato: string): "tradicional" | "moderno" | "ejecutivo" {
  switch (formato) {
    case "tradicional": return "tradicional";
    case "ejecutivo":   return "ejecutivo";
    case "clasico":     return "tradicional";
    case "profesional": return "ejecutivo";
    case "simple":
    case "minimalista":
    case "moderno":
    default:            return "moderno";
  }
}

export function getCVDocument(formato: string, cvText: string): PdfElement {
  const resolved = resolveFormato(formato);
  switch (resolved) {
    case "tradicional": return <CVDocumentTradicional cvText={cvText} /> as unknown as PdfElement;
    case "ejecutivo":   return <CVDocumentEjecutivo cvText={cvText} />  as unknown as PdfElement;
    default:            return <CVDocumentModerno cvText={cvText} />    as unknown as PdfElement;
  }
}

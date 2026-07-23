import React from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import CVDocumentMinimalista from "./CVDocumentMinimalista";
import CVDocumentClasico from "./CVDocumentClasico";
import CVDocumentModerno from "./CVDocumentModerno";
import CVDocumentProfesional from "./CVDocumentProfesional";
import CVDocumentSimple from "./CVDocumentSimple";

type PdfElement = React.ReactElement<DocumentProps>;

export function getCVDocument(formato: string, cvText: string): PdfElement {
  switch (formato) {
    case "clasico":     return <CVDocumentClasico cvText={cvText} />     as unknown as PdfElement;
    case "moderno":     return <CVDocumentModerno cvText={cvText} />     as unknown as PdfElement;
    case "profesional": return <CVDocumentProfesional cvText={cvText} /> as unknown as PdfElement;
    case "simple":      return <CVDocumentSimple cvText={cvText} />      as unknown as PdfElement;
    default:            return <CVDocumentMinimalista cvText={cvText} /> as unknown as PdfElement;
  }
}

import React from "react";
import CVDocumentMinimalista from "./CVDocumentMinimalista";
import CVDocumentClasico from "./CVDocumentClasico";
import CVDocumentModerno from "./CVDocumentModerno";
import CVDocumentProfesional from "./CVDocumentProfesional";
import CVDocumentSimple from "./CVDocumentSimple";

export function getCVDocument(formato: string, cvText: string): React.ReactElement {
  switch (formato) {
    case "clasico":      return <CVDocumentClasico cvText={cvText} />;
    case "moderno":      return <CVDocumentModerno cvText={cvText} />;
    case "profesional":  return <CVDocumentProfesional cvText={cvText} />;
    case "simple":       return <CVDocumentSimple cvText={cvText} />;
    default:             return <CVDocumentMinimalista cvText={cvText} />;
  }
}

// PDF download → @react-pdf/renderer (real selectable text, ATS-compatible, no blurriness)
// Thumbnail preview → html2canvas (browser-rendered HTML, display only)

import type { DocumentProps } from "@react-pdf/renderer";
import type React from "react";

type PdfDoc = React.ReactElement<DocumentProps>;

let hyphenationDisabled = false;

export async function generateCVPDF(cvText: string, formato: string): Promise<Blob> {
  const React = (await import("react")).default;
  const { pdf, Font } = await import("@react-pdf/renderer");

  if (!hyphenationDisabled) {
    Font.registerHyphenationCallback((word) => [word]);
    hyphenationDisabled = true;
  }

  switch (formato) {
    case "tradicional": {
      const { default: Tradicional } = await import("../CVDocumentTradicional");
      return pdf(React.createElement(Tradicional, { cvText }) as unknown as PdfDoc).toBlob();
    }
    case "ejecutivo": {
      const { default: Ejecutivo } = await import("../CVDocumentEjecutivo");
      return pdf(React.createElement(Ejecutivo, { cvText }) as unknown as PdfDoc).toBlob();
    }
    default: {
      // "moderno" + any legacy value (minimalista, clasico, profesional, simple)
      const { default: Moderno } = await import("../CVDocumentModerno");
      return pdf(React.createElement(Moderno, { cvText }) as unknown as PdfDoc).toBlob();
    }
  }
}

export async function generateCVThumbnail(cvText: string, formato: string): Promise<string> {
  const html2canvas = (await import("html2canvas")).default;
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.height = "1123px";
  container.style.overflow = "hidden";
  container.style.backgroundColor = "white";
  document.body.appendChild(container);

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(container);

  const template = await getHTMLTemplate(formato, cvText);
  root.render(template);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 80)));
  });

  const canvas = await html2canvas(container, {
    scale: 0.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    width: 794,
    height: 1123,
  });

  root.unmount();
  document.body.removeChild(container);

  return canvas.toDataURL("image/jpeg", 0.85);
}

async function getHTMLTemplate(formato: string, cvText: string) {
  const React = (await import("react")).default;

  switch (formato) {
    case "tradicional": {
      const { CVTemplateTradicional } = await import("./CVTemplateTradicional");
      return React.createElement(CVTemplateTradicional, { cvText });
    }
    case "ejecutivo": {
      const { CVTemplateEjecutivo } = await import("./CVTemplateEjecutivo");
      return React.createElement(CVTemplateEjecutivo, { cvText });
    }
    default: {
      const { CVTemplateModerno } = await import("./CVTemplateModerno");
      return React.createElement(CVTemplateModerno, { cvText });
    }
  }
}

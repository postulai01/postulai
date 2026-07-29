import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function generateCVPDF(cvText: string, formato: string): Promise<Blob> {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.backgroundColor = "white";
  document.body.appendChild(container);

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(container);

  const template = await getTemplate(formato, cvText);
  root.render(template);

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const canvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    width: 794,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  const pageHeight = pdf.internal.pageSize.getHeight();

  if (pdfHeight > pageHeight) {
    let position = 0;
    let remainingHeight = pdfHeight;
    while (remainingHeight > 0) {
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
      remainingHeight -= pageHeight;
      position -= pageHeight;
      if (remainingHeight > 0) pdf.addPage();
    }
  } else {
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
  }

  root.unmount();
  document.body.removeChild(container);

  return pdf.output("blob");
}

export async function generateCVThumbnail(cvText: string, formato: string): Promise<string> {
  const html2canvas = (await import("html2canvas")).default;
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.height = "1123px"; // A4 at 794px wide (794 × 297/210)
  container.style.overflow = "hidden";
  container.style.backgroundColor = "white";
  document.body.appendChild(container);

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(container);

  const template = await getTemplate(formato, cvText);
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

async function getTemplate(formato: string, cvText: string) {
  const React = (await import("react")).default;
  switch (formato) {
    case "clasico": {
      const { CVTemplateClasico } = await import("./CVTemplateClasico");
      return React.createElement(CVTemplateClasico, { cvText });
    }
    case "moderno": {
      const { CVTemplateModerno } = await import("./CVTemplateModerno");
      return React.createElement(CVTemplateModerno, { cvText });
    }
    case "profesional": {
      const { CVTemplateProfesional } = await import("./CVTemplateProfesional");
      return React.createElement(CVTemplateProfesional, { cvText });
    }
    case "simple": {
      const { CVTemplateSimple } = await import("./CVTemplateSimple");
      return React.createElement(CVTemplateSimple, { cvText });
    }
    default: {
      const { CVTemplateMinimalista } = await import("./CVTemplateMinimalista");
      return React.createElement(CVTemplateMinimalista, { cvText });
    }
  }
}

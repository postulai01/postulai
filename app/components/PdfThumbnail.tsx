"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  generate: () => Promise<Blob>;
  fallback: React.ReactNode;
}

export default function PdfThumbnail({ generate, fallback }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const generateRef = useRef(generate);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    let cancelled = false;

    (async () => {
      try {
        const blob = await generateRef.current();
        if (cancelled) return;

        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;

        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.legacy.min.mjs";

        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        const page = await pdfDoc.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas context");

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (cancelled) return;

        setImageUrl(canvas.toDataURL("image/jpeg", 0.92));
        setState("ready");
      } catch (err) {
        console.error("[PdfThumbnail] render failed:", err);
        if (!cancelled) setState("error");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return <div className="w-full h-full bg-[#e0e0e0] animate-pulse" />;
  }

  if (state === "error" || !imageUrl) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={imageUrl}
      alt="Vista previa del documento"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "top center",
        display: "block",
      }}
    />
  );
}

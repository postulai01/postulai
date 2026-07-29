"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  generate: () => Promise<string>;
  fallback: React.ReactNode;
}

export default function PdfThumbnail({ generate, fallback }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const generateRef = useRef(generate);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = await generateRef.current();
        if (!cancelled) {
          setImageUrl(url);
          setState("ready");
        }
      } catch (err) {
        console.error("[PdfThumbnail] render failed:", err);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
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
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}

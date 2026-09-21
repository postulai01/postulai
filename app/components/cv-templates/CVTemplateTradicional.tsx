import React from "react";
import { parseCvText } from "./parseCvText";

function splitJobLine(text: string): { left: string; right: string } | null {
  const match = text.match(/^(.+?)\s*—\s*(.+)$/);
  if (!match) return null;
  const right = match[2].trim();
  if (!/\d/.test(right)) return null;
  return { left: match[1].trim(), right };
}

export function CVTemplateTradicional({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  const elements: React.ReactNode[] = [];
  let headerDone = false;
  let lastRole: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];

    switch (role) {
      case "name":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: "bold", textAlign: "center", color: "#000", marginBottom: "5px" }}>
            {text}
          </div>
        );
        elements.push(
          <div key={`rh-${i}`} style={{ borderBottom: "1.5px solid #000", marginBottom: "2px" }} />
        );
        elements.push(
          <div key={`rl-${i}`} style={{ borderBottom: "0.5px solid #000", marginBottom: "8px" }} />
        );
        headerDone = true;
        break;

      case "title":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "11px", textAlign: "center", color: "#444", marginBottom: "3px" }}>
            {text}
          </div>
        );
        break;

      case "contact":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", textAlign: "center", color: "#333", marginBottom: "10px" }}>
            {text}
          </div>
        );
        break;

      case "section":
        if (!headerDone) {
          elements.push(<div key={`rh-${i}`} style={{ borderBottom: "1.5px solid #000", marginBottom: "2px" }} />);
          elements.push(<div key={`rl-${i}`} style={{ borderBottom: "0.5px solid #000", marginBottom: "8px" }} />);
          headerDone = true;
        }
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#000", borderBottom: "0.5px solid #000", paddingBottom: "2px", marginTop: "13px", marginBottom: "5px" }}>
            {text}
          </div>
        );
        break;

      case "body": {
        const job = splitJobLine(text);
        if (job) {
          elements.push(
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: "Georgia, serif", fontSize: "10px", fontWeight: "bold", color: "#000", marginBottom: "1px" }}>
              <span>{job.left}</span>
              <span style={{ fontWeight: "normal", color: "#333", fontSize: "9.5px" }}>{job.right}</span>
            </div>
          );
        } else if (lastRole === "body" || lastRole === "section") {
          elements.push(
            <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", fontStyle: "italic", fontWeight: "bold", color: "#222", marginBottom: "2px" }}>
              {text}
            </div>
          );
        } else {
          elements.push(
            <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", lineHeight: "1.4", color: "#111", marginBottom: "2px" }}>
              {text}
            </div>
          );
        }
        break;
      }

      case "bullet":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", lineHeight: "1.4", color: "#111", paddingLeft: "12px", marginBottom: "2px" }}>
            {"– "}{text}
          </div>
        );
        break;

      case "blank":
        elements.push(<div key={i} style={{ height: "5px" }} />);
        break;
    }

    if (role !== "blank") lastRole = role;
  }

  return (
    <div style={{ backgroundColor: "white", padding: "40px 50px", width: "100%", boxSizing: "border-box", fontFamily: "Georgia, serif" }}>
      {elements}
    </div>
  );
}

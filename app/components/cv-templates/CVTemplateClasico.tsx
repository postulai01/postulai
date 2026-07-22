import React from "react";
import { parseCvText } from "./parseCvText";

export function CVTemplateClasico({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  let ruleDone = false;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];
    switch (role) {
      case "name":
        elements.push(
          <div key={i} style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "24px", textAlign: "center", color: "#1a1a1a", fontWeight: "bold", marginBottom: "4px" }}>
            {text}
          </div>
        );
        break;
      case "title":
        elements.push(
          <div key={i} style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "12px", textAlign: "center", color: "#444", fontStyle: "italic", marginBottom: "3px" }}>
            {text}
          </div>
        );
        break;
      case "contact":
        elements.push(
          <div key={i} style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10px", textAlign: "center", color: "#444", marginBottom: "4px" }}>
            {text}
          </div>
        );
        if (!ruleDone) {
          elements.push(
            <div key={`rule-${i}`} style={{ borderTop: "2px solid #111", borderBottom: "0.5px solid #111", height: "4px", margin: "10px 0" }} />
          );
          ruleDone = true;
        }
        break;
      case "section":
        if (!ruleDone) {
          elements.push(
            <div key={`rule-${i}`} style={{ borderTop: "2px solid #111", borderBottom: "0.5px solid #111", height: "4px", margin: "10px 0" }} />
          );
          ruleDone = true;
        }
        elements.push(
          <div key={i} style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", backgroundColor: "#f0f0f0", padding: "3px 8px", marginTop: "16px", marginBottom: "8px" }}>
            {text}
          </div>
        );
        break;
      case "bullet":
        elements.push(
          <div key={i} style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10.5px", lineHeight: "1.55", color: "#222", paddingLeft: "16px", marginBottom: "2px" }}>
            {"• " + text}
          </div>
        );
        break;
      case "body":
        elements.push(
          <div key={i} style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10.5px", lineHeight: "1.55", color: "#222", marginBottom: "2px" }}>
            {text}
          </div>
        );
        break;
      case "blank":
        elements.push(<div key={i} style={{ height: "8px" }} />);
        break;
    }
  }

  return (
    <div style={{ backgroundColor: "white", padding: "40px", width: "100%", boxSizing: "border-box" }}>
      {elements}
    </div>
  );
}

import React from "react";
import { parseCvText } from "./parseCvText";

export function CVTemplateMinimalista({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  let ruleDone = false;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];
    switch (role) {
      case "name":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "22px", textAlign: "center", textTransform: "uppercase", letterSpacing: "3px", color: "#111", fontWeight: "bold", marginBottom: "4px" }}>
            {text}
          </div>
        );
        break;
      case "title":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "11px", textAlign: "center", color: "#555", marginBottom: "2px" }}>
            {text}
          </div>
        );
        break;
      case "contact":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "11px", textAlign: "center", color: "#555", marginBottom: "4px" }}>
            {text}
          </div>
        );
        if (!ruleDone) {
          elements.push(<div key={`rule-${i}`} style={{ borderBottom: "1px solid #111", margin: "12px 0" }} />);
          ruleDone = true;
        }
        break;
      case "section":
        if (!ruleDone) {
          elements.push(<div key={`rule-${i}`} style={{ borderBottom: "1px solid #111", margin: "12px 0" }} />);
          ruleDone = true;
        }
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", color: "#111", borderBottom: "0.5px solid #999", paddingBottom: "3px", marginTop: "16px", marginBottom: "8px" }}>
            {text}
          </div>
        );
        break;
      case "bullet":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", lineHeight: "1.6", color: "#222", paddingLeft: "16px", marginBottom: "2px" }}>
            {"• " + text}
          </div>
        );
        break;
      case "body":
        elements.push(
          <div key={i} style={{ fontFamily: "Georgia, serif", fontSize: "10px", lineHeight: "1.6", color: "#222", marginBottom: "2px" }}>
            {text}
          </div>
        );
        break;
      case "blank":
        elements.push(<div key={i} style={{ height: "6px" }} />);
        break;
    }
  }

  return (
    <div style={{ backgroundColor: "white", padding: "40px", width: "100%", boxSizing: "border-box" }}>
      {elements}
    </div>
  );
}

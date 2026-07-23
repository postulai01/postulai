import React from "react";
import { parseCvText } from "./parseCvText";

export function CVTemplateModerno({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  let headerDone = false;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];
    switch (role) {
      case "name":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "20px", textAlign: "left", color: "#0a0a0a", fontWeight: "bold", borderBottom: "3px solid #0a0a0a", paddingBottom: "4px", marginBottom: "6px" }}>
            {text}
          </div>
        );
        break;
      case "title":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", textAlign: "left", color: "#555", marginBottom: "2px" }}>
            {text}
          </div>
        );
        break;
      case "contact":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "9px", textAlign: "left", color: "#666", marginBottom: "16px" }}>
            {text}
          </div>
        );
        headerDone = true;
        break;
      case "section":
        if (!headerDone) { headerDone = true; }
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "2px", color: "#0a0a0a", borderBottom: "1px solid #0a0a0a", paddingBottom: "2px", marginTop: "18px", marginBottom: "6px" }}>
            {text}
          </div>
        );
        break;
      case "bullet":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "9.5px", lineHeight: "1.5", color: "#333", paddingLeft: "16px", marginBottom: "2px" }}>
            {"– " + text}
          </div>
        );
        break;
      case "body":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "9.5px", lineHeight: "1.5", color: "#333", marginBottom: "2px" }}>
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
    <div style={{ backgroundColor: "white", padding: "45px", width: "100%", boxSizing: "border-box" }}>
      {elements}
    </div>
  );
}

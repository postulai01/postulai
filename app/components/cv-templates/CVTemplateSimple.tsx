import React from "react";
import { parseCvText } from "./parseCvText";

export function CVTemplateSimple({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  let contactDone = false;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];
    switch (role) {
      case "name":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "28px", textAlign: "left", color: "#000", fontWeight: "900", letterSpacing: "-1px", marginBottom: "4px" }}>
            {text}
          </div>
        );
        break;
      case "title":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "13px", color: "#666", marginBottom: "2px" }}>
            {text}
          </div>
        );
        break;
      case "contact":
        if (!contactDone) {
          elements.push(
            <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9px", color: "#999", borderBottom: "0.5px solid #ddd", paddingBottom: "12px", marginBottom: "20px" }}>
              {text}
            </div>
          );
          contactDone = true;
        } else {
          elements.push(
            <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9px", color: "#999", marginBottom: "4px" }}>
              {text}
            </div>
          );
        }
        break;
      case "section":
        if (!contactDone) { contactDone = true; }
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "8px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "3px", color: "#000", marginTop: "22px", marginBottom: "10px" }}>
            {text}
          </div>
        );
        break;
      case "bullet":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", lineHeight: "1.7", color: "#444", paddingLeft: "16px", marginBottom: "2px" }}>
            <span style={{ color: "#666" }}>{"· "}</span>{text}
          </div>
        );
        break;
      case "body":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", lineHeight: "1.7", color: "#444", marginBottom: "2px" }}>
            {text}
          </div>
        );
        break;
      case "blank":
        elements.push(<div key={i} style={{ height: "10px" }} />);
        break;
    }
  }

  return (
    <div style={{ backgroundColor: "white", padding: "55px", width: "100%", boxSizing: "border-box" }}>
      {elements}
    </div>
  );
}

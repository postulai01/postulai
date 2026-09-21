import React from "react";
import { parseCvText } from "./parseCvText";

function splitJobLine(text: string): { left: string; right: string } | null {
  const match = text.match(/^(.+?)\s*—\s*(.+)$/);
  if (!match) return null;
  const right = match[2].trim();
  if (!/\d/.test(right)) return null;
  return { left: match[1].trim(), right };
}

const ACCENT = "#1B4B5A";

export function CVTemplateModerno({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  const elements: React.ReactNode[] = [];
  let lastRole: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];

    switch (role) {
      case "name":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "22px", fontWeight: "bold", color: ACCENT, marginBottom: "3px" }}>
            {text}
          </div>
        );
        break;

      case "title":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11px", color: "#666", marginBottom: "3px" }}>
            {text}
          </div>
        );
        break;

      case "contact":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9px", color: "#555", marginBottom: "12px" }}>
            {text}
          </div>
        );
        break;

      case "section":
        elements.push(
          <div key={i} style={{ display: "flex", alignItems: "stretch", marginTop: "14px", marginBottom: "6px" }}>
            <div style={{ width: "3px", backgroundColor: ACCENT, marginRight: "7px", borderRadius: "1px", flexShrink: 0 }} />
            <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#111", paddingTop: "1px" }}>
              {text}
            </div>
          </div>
        );
        break;

      case "body": {
        const job = splitJobLine(text);
        if (job) {
          elements.push(
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", fontWeight: "bold", color: "#111", marginBottom: "1px" }}>
              <span>{job.left}</span>
              <span style={{ fontWeight: "normal", color: "#666", fontSize: "9px" }}>{job.right}</span>
            </div>
          );
        } else if (lastRole === "body" || lastRole === "section") {
          elements.push(
            <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", fontStyle: "italic", color: "#444", marginBottom: "2px" }}>
              {text}
            </div>
          );
        } else {
          elements.push(
            <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", lineHeight: "1.45", color: "#222", marginBottom: "2px" }}>
              {text}
            </div>
          );
        }
        break;
      }

      case "bullet":
        elements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10px", lineHeight: "1.45", color: "#222", paddingLeft: "10px", marginBottom: "2px" }}>
            {"– "}{text}
          </div>
        );
        break;

      case "blank":
        elements.push(<div key={i} style={{ height: "6px" }} />);
        break;
    }

    if (role !== "blank") lastRole = role;
  }

  return (
    <div style={{ backgroundColor: "white", padding: "40px 48px", width: "100%", boxSizing: "border-box" }}>
      {elements}
    </div>
  );
}

import React from "react";
import { parseCvText, type ParsedLine } from "./parseCvText";

function splitJobLine(text: string): { left: string; right: string } | null {
  const match = text.match(/^(.+?)\s*—\s*(.+)$/);
  if (!match) return null;
  const right = match[2].trim();
  if (!/\d/.test(right)) return null;
  return { left: match[1].trim(), right };
}

export function CVTemplateEjecutivo({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);

  const headerLines: ParsedLine[] = [];
  const bodyLines: ParsedLine[] = [];
  let headerComplete = false;

  for (const line of lines) {
    if (!headerComplete && (line.role === "name" || line.role === "title" || line.role === "contact" || line.role === "blank")) {
      if (line.role === "blank") continue;
      headerLines.push(line);
    } else {
      headerComplete = true;
      bodyLines.push(line);
    }
  }

  const nameLine = headerLines.find(l => l.role === "name");
  const titleLine = headerLines.find(l => l.role === "title");
  const contactLine = headerLines.find(l => l.role === "contact");

  const bodyElements: React.ReactNode[] = [];
  let lastRole: string | null = null;

  for (let i = 0; i < bodyLines.length; i++) {
    const { role, text } = bodyLines[i];

    switch (role) {
      case "section":
        bodyElements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9.5px", fontWeight: "bold", textTransform: "uppercase", color: "#000", marginTop: "11px", marginBottom: "4px" }}>
            {text}
          </div>
        );
        break;

      case "body": {
        const job = splitJobLine(text);
        if (job) {
          bodyElements.push(
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9.5px", fontWeight: "bold", color: "#000", marginBottom: "1px" }}>
              <span>{job.left}</span>
              <span style={{ fontWeight: "normal", color: "#555", fontSize: "9px" }}>{job.right}</span>
            </div>
          );
        } else if (lastRole === "body" || lastRole === "section") {
          bodyElements.push(
            <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9.5px", fontStyle: "italic", color: "#333", marginBottom: "1px" }}>
              {text}
            </div>
          );
        } else {
          bodyElements.push(
            <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9.5px", lineHeight: "1.38", color: "#111", marginBottom: "1.5px" }}>
              {text}
            </div>
          );
        }
        break;
      }

      case "bullet":
        bodyElements.push(
          <div key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9.5px", lineHeight: "1.38", color: "#111", paddingLeft: "9px", marginBottom: "1.5px" }}>
            {"– "}{text}
          </div>
        );
        break;

      case "blank":
        bodyElements.push(<div key={i} style={{ height: "4px" }} />);
        break;
    }

    if (role !== "blank") lastRole = role;
  }

  return (
    <div style={{ backgroundColor: "white", width: "100%", boxSizing: "border-box" }}>
      {/* Header band */}
      <div style={{ backgroundColor: "#ECECEC", padding: "26px 45px 18px 45px" }}>
        {nameLine && (
          <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "21px", fontWeight: "bold", color: "#000", marginBottom: "3px" }}>
            {nameLine.text}
          </div>
        )}
        {titleLine && (
          <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10.5px", color: "#444", marginBottom: "2px" }}>
            {titleLine.text}
          </div>
        )}
        {contactLine && (
          <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9px", color: "#555" }}>
            {contactLine.text}
          </div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: "0 45px 40px 45px" }}>
        {bodyElements}
      </div>
    </div>
  );
}

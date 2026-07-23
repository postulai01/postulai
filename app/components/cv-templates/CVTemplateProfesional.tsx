import React from "react";
import { parseCvText, ParsedLine } from "./parseCvText";

export function CVTemplateProfesional({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);

  const headerLines: ParsedLine[] = [];
  const bodyLines: ParsedLine[] = [];
  let headerDone = false;

  for (const line of lines) {
    if (!headerDone && ["name", "title", "contact"].includes(line.role)) {
      headerLines.push(line);
    } else {
      headerDone = true;
      bodyLines.push(line);
    }
  }

  const bodyElements: React.ReactNode[] = bodyLines.map(({ role, text }, i) => {
    switch (role) {
      case "section":
        return (
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#1e3a5f", borderBottom: "2px solid #1e3a5f", paddingBottom: "2px", marginTop: "18px", marginBottom: "8px" }}>
            {text}
          </div>
        );
      case "bullet":
        return (
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "10px", lineHeight: "1.55", color: "#222", paddingLeft: "16px", marginBottom: "2px" }}>
            <span style={{ color: "#1e3a5f" }}>{"• "}</span>{text}
          </div>
        );
      case "body":
        return (
          <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "10px", lineHeight: "1.55", color: "#222", marginBottom: "2px" }}>
            {text}
          </div>
        );
      case "blank":
        return <div key={i} style={{ height: "7px" }} />;
      default:
        return null;
    }
  });

  return (
    <div style={{ backgroundColor: "white", padding: "42px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ backgroundColor: "#1e3a5f", padding: "24px 40px", margin: "-42px -42px 20px -42px" }}>
        {headerLines.map(({ role, text }, i) => {
          if (role === "name") return (
            <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "26px", color: "#ffffff", fontWeight: "bold", marginBottom: "4px" }}>
              {text}
            </div>
          );
          if (role === "title") return (
            <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#a8c4e0", marginBottom: "3px" }}>
              {text}
            </div>
          );
          if (role === "contact") return (
            <div key={i} style={{ fontFamily: "Arial, sans-serif", fontSize: "9px", color: "#a8c4e0", marginBottom: "2px" }}>
              {text}
            </div>
          );
          return null;
        })}
      </div>
      {bodyElements}
    </div>
  );
}

export type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
export interface ParsedLine { role: Role; text: string; }

export function parseCvText(cvText: string): ParsedLine[] {
  const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
  const parsed: ParsedLine[] = [];
  let state: "name" | "title" | "contact" | "body" = "name";

  for (const raw of cvText.split("\n")) {
    if (isSep(raw)) continue;
    const t = raw.replace(/%%%/g, "").replace(/[─━]+/g, "").trim();
    if (t === "") { parsed.push({ role: "blank", text: "" }); continue; }
    const allCaps = t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);

    if (state === "name") {
      parsed.push({ role: "name", text: t }); state = "title";
    } else if (state === "title") {
      if (allCaps) { state = "body"; parsed.push({ role: "section", text: t }); }
      else { parsed.push({ role: "title", text: t }); state = "contact"; }
    } else if (state === "contact") {
      if (allCaps) { state = "body"; parsed.push({ role: "section", text: t }); }
      else { parsed.push({ role: "contact", text: t }); state = "body"; }
    } else {
      if (allCaps) parsed.push({ role: "section", text: t });
      else if (/^•/.test(t)) parsed.push({ role: "bullet", text: t.replace(/^•\s*/, "") });
      else parsed.push({ role: "body", text: t });
    }
  }
  return parsed;
}

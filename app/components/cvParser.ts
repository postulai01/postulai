export type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
export interface ParsedLine { role: Role; text: string; }

export function parseCvText(cvText: string): ParsedLine[] {
  const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━—]+$/.test(t.trim());
  const raw_parsed: ParsedLine[] = [];
  let state: "name" | "title" | "contact" | "body" = "name";

  for (const raw of cvText.split("\n")) {
    if (isSep(raw)) continue;
    const t = raw.replace(/%%%/g, "").replace(/[─━]+/g, "").replace(/—{2,}/g, "").replace(/\s+/g, " ").trim();
    if (t === "") { raw_parsed.push({ role: "blank", text: "" }); continue; }

    // Lines with " — " followed by digits are job entries, never section headers
    const hasJobDate = /—\s*.+\d/.test(t);
    const allCaps = !hasJobDate && t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);

    if (state === "name") { raw_parsed.push({ role: "name", text: t }); state = "title"; }
    else if (state === "title") {
      if (allCaps) { state = "body"; raw_parsed.push({ role: "section", text: t }); }
      else { raw_parsed.push({ role: "title", text: t }); state = "contact"; }
    } else if (state === "contact") {
      if (allCaps) { state = "body"; raw_parsed.push({ role: "section", text: t }); }
      else { raw_parsed.push({ role: "contact", text: t }); state = "body"; }
    } else {
      if (allCaps) raw_parsed.push({ role: "section", text: t });
      else if (/^[•\-]\s/.test(t)) raw_parsed.push({ role: "bullet", text: t.replace(/^[•\-]\s*/, "") });
      else raw_parsed.push({ role: "body", text: t });
    }
  }

  // Merge consecutive title/contact lines into one contact line separated by " · "
  // e.g. "Móvil: +56 9 ..." and "email@..." → "Móvil: +56 9 ... · email@..."
  const merged: ParsedLine[] = [];
  for (const line of raw_parsed) {
    if ((line.role === "title" || line.role === "contact") && merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev.role === "title" || prev.role === "contact") {
        merged[merged.length - 1] = { role: "contact", text: prev.text + " · " + line.text };
        continue;
      }
    }
    merged.push(line);
  }
  return merged;
}

// Splits "Company Name — 05/2020 – Presente" into { left, right }
// Returns null if line doesn't look like a job entry
export function splitJobLine(text: string): { left: string; right: string } | null {
  const match = text.match(/^(.+?)\s*—\s*(.+)$/);
  if (!match) return null;
  const right = match[2].trim();
  if (!/\d/.test(right)) return null;
  return { left: match[1].trim(), right };
}

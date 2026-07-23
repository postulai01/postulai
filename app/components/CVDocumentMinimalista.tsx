import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

type Role = "name" | "title" | "contact" | "section" | "bullet" | "body" | "blank";
interface ParsedLine { role: Role; text: string; }

function parseCvText(cvText: string): ParsedLine[] {
  const isSep = (t: string) => t.length > 1 && /^[%\-=_*~─━]+$/.test(t.trim());
  const parsed: ParsedLine[] = [];
  let state: "name" | "title" | "contact" | "body" = "name";

  for (const raw of cvText.split("\n")) {
    if (isSep(raw)) continue;
    const t = raw.replace(/%%%/g, "").replace(/[─━]+/g, "").trim();
    if (t === "") { parsed.push({ role: "blank", text: "" }); continue; }
    const allCaps =
      t.length > 1 && t.length < 60 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);

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

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111111",
    paddingTop: 40,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
  },
  name: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 5,
    color: "#000000",
  },
  title: {
    fontSize: 11,
    textAlign: "center",
    color: "#555555",
    marginBottom: 3,
  },
  contact: {
    fontSize: 9,
    textAlign: "center",
    color: "#555555",
    marginBottom: 8,
  },
  ruleBlack: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    marginBottom: 10,
  },
  section: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#000000",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    paddingBottom: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  body: {
    fontSize: 10,
    color: "#111111",
    lineHeight: 1.5,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 10,
  },
  bulletDot: {
    fontSize: 10,
    color: "#111111",
    width: 12,
  },
  bulletText: {
    fontSize: 10,
    color: "#111111",
    lineHeight: 1.5,
    flex: 1,
  },
  blank: {
    height: 5,
  },
});

export default function CVDocumentMinimalista({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  let ruleDone = false;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];
    switch (role) {
      case "name":
        elements.push(<Text key={i} style={styles.name}>{text}</Text>);
        break;
      case "title":
        elements.push(<Text key={i} style={styles.title}>{text}</Text>);
        break;
      case "contact":
        elements.push(<Text key={i} style={styles.contact}>{text}</Text>);
        if (!ruleDone) {
          elements.push(<View key={`rule-${i}`} style={styles.ruleBlack} />);
          ruleDone = true;
        }
        break;
      case "section":
        if (!ruleDone) {
          elements.push(<View key={`rule-${i}`} style={styles.ruleBlack} />);
          ruleDone = true;
        }
        elements.push(<Text key={i} style={styles.section}>{text}</Text>);
        break;
      case "bullet":
        elements.push(
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>{"•"}</Text>
            <Text style={styles.bulletText}>{text}</Text>
          </View>
        );
        break;
      case "body":
        elements.push(<Text key={i} style={styles.body}>{text}</Text>);
        break;
      case "blank":
        elements.push(<View key={i} style={styles.blank} />);
        break;
    }
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {elements}
      </Page>
    </Document>
  );
}

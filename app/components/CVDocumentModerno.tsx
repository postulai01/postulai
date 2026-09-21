import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { parseCvText, splitJobLine, type Role } from "./cvParser";

const ACCENT = "#1B4B5A";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#222222",
    paddingTop: 42,
    paddingBottom: 50,
    paddingLeft: 48,
    paddingRight: 48,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: ACCENT,
    marginBottom: 3,
  },
  title: {
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#666666",
    marginBottom: 3,
  },
  contact: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#555555",
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 14,
    marginBottom: 6,
  },
  sectionBar: {
    width: 3,
    backgroundColor: ACCENT,
    marginRight: 7,
    borderRadius: 1,
  },
  sectionText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    color: "#111111",
    paddingTop: 1,
  },
  jobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  jobLeft: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#111111",
    flex: 1,
  },
  jobRight: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#666666",
    textAlign: "right",
  },
  jobTitle: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    color: "#444444",
    marginBottom: 2,
  },
  body: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#222222",
    lineHeight: 1.45,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDash: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#444444",
    width: 11,
  },
  bulletText: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#222222",
    lineHeight: 1.45,
    flex: 1,
  },
  blank: { height: 6 },
});

export default function CVDocumentModerno({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  const elements: React.ReactNode[] = [];
  let lastRole: Role | null = null;

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];

    switch (role) {
      case "name":
        elements.push(<Text key={i} style={S.name}>{text}</Text>);
        break;

      case "title":
        elements.push(<Text key={i} style={S.title}>{text}</Text>);
        break;

      case "contact":
        elements.push(<Text key={i} style={S.contact}>{text}</Text>);
        break;

      case "section":
        elements.push(
          <View key={i} style={S.sectionRow}>
            <View style={S.sectionBar} />
            <Text style={S.sectionText}>{text}</Text>
          </View>
        );
        break;

      case "body": {
        const job = splitJobLine(text);
        if (job) {
          elements.push(
            <View key={i} style={S.jobRow}>
              <Text style={S.jobLeft}>{job.left}</Text>
              <Text style={S.jobRight}>{job.right}</Text>
            </View>
          );
        } else if (lastRole === "body" || lastRole === "section") {
          elements.push(<Text key={i} style={S.jobTitle}>{text}</Text>);
        } else {
          elements.push(<Text key={i} style={S.body}>{text}</Text>);
        }
        break;
      }

      case "bullet":
        elements.push(
          <View key={i} style={S.bulletRow}>
            <Text style={S.bulletDash}>{"–"}</Text>
            <Text style={S.bulletText}>{text}</Text>
          </View>
        );
        break;

      case "blank":
        elements.push(<View key={i} style={S.blank} />);
        break;
    }

    if (role !== "blank") lastRole = role;
  }

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {elements}
      </Page>
    </Document>
  );
}

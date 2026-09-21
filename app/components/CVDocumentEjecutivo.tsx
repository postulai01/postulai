import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { parseCvText, splitJobLine } from "./cvParser";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#111111",
    paddingBottom: 45,
  },
  headerBand: {
    backgroundColor: "#ECECEC",
    paddingTop: 28,
    paddingBottom: 20,
    paddingLeft: 45,
    paddingRight: 45,
    marginBottom: 10,
  },
  headerName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 21,
    color: "#000000",
    marginBottom: 3,
  },
  headerSub: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#444444",
  },
  bodyWrap: {
    paddingLeft: 45,
    paddingRight: 45,
  },
  section: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    textTransform: "uppercase",
    color: "#000000",
    marginTop: 11,
    marginBottom: 4,
  },
  jobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  jobLeft: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: "#000000",
    width: "68%",
  },
  jobRight: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#555555",
    textAlign: "right",
    width: "32%",
  },
  jobTitle: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 9.5,
    color: "#333333",
    marginBottom: 1,
  },
  bodyText: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#111111",
    lineHeight: 1.38,
    marginBottom: 1.5,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 1.5,
    paddingLeft: 8,
  },
  bulletDash: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#333333",
    width: 10,
  },
  bulletText: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#111111",
    lineHeight: 1.38,
    flex: 1,
  },
  blank: { height: 4 },
});

export default function CVDocumentEjecutivo({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);

  // Collect header info (name + merged contact) from the beginning
  const headerTexts: string[] = [];
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const { role } = lines[i];
    if (role === "name" || role === "title" || role === "contact") {
      headerTexts.push(lines[i].text);
      bodyStart = i + 1;
    } else if (role === "blank") {
      continue;
    } else {
      break;
    }
  }

  const nameLine = lines[0]?.role === "name" ? lines[0].text : "";
  const subLines = headerTexts.slice(1); // title/contact after name

  const bodyLines = lines.slice(bodyStart);
  const bodyElements: React.ReactNode[] = [];
  let lastWasJobRow = false;

  for (let i = 0; i < bodyLines.length; i++) {
    const { role, text } = bodyLines[i];

    switch (role) {
      case "section":
        bodyElements.push(<Text key={i} style={S.section}>{text}</Text>);
        lastWasJobRow = false;
        break;

      case "body": {
        const job = splitJobLine(text);
        if (job) {
          bodyElements.push(
            <View key={i} style={S.jobRow}>
              <Text style={S.jobLeft}>{job.left}</Text>
              <Text style={S.jobRight}>{job.right}</Text>
            </View>
          );
          lastWasJobRow = true;
        } else if (lastWasJobRow) {
          // Line immediately after a company+dates row → job title (italic)
          bodyElements.push(<Text key={i} style={S.jobTitle}>{text}</Text>);
          lastWasJobRow = false;
        } else {
          bodyElements.push(<Text key={i} style={S.bodyText}>{text}</Text>);
        }
        break;
      }

      case "bullet":
        bodyElements.push(
          <View key={i} style={S.bulletRow}>
            <Text style={S.bulletDash}>{"–"}</Text>
            <Text style={S.bulletText}>{text}</Text>
          </View>
        );
        lastWasJobRow = false;
        break;

      case "blank":
        bodyElements.push(<View key={i} style={S.blank} />);
        lastWasJobRow = false;
        break;
    }
  }

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.headerBand}>
          <Text style={S.headerName}>{nameLine}</Text>
          {subLines.map((t, i) => (
            <Text key={i} style={S.headerSub}>{t}</Text>
          ))}
        </View>
        <View style={S.bodyWrap}>
          {bodyElements}
        </View>
      </Page>
    </Document>
  );
}

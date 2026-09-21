import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { parseCvText, splitJobLine } from "./cvParser";

const S = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: "#111111",
    paddingTop: 45,
    paddingBottom: 50,
    paddingLeft: 52,
    paddingRight: 52,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 22,
    textAlign: "center",
    color: "#000000",
    marginBottom: 5,
  },
  ruleHeavy: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    marginBottom: 2,
  },
  ruleLight: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    marginBottom: 8,
  },
  contact: {
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    textAlign: "center",
    color: "#333333",
    marginBottom: 10,
  },
  section: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    color: "#000000",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    paddingBottom: 2,
    marginTop: 13,
    marginBottom: 5,
  },
  jobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  jobLeft: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    color: "#000000",
    width: "68%",
  },
  jobRight: {
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    color: "#333333",
    textAlign: "right",
    width: "32%",
  },
  jobTitle: {
    fontFamily: "Times-BoldItalic",
    fontSize: 10,
    color: "#222222",
    marginBottom: 2,
  },
  body: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: "#111111",
    lineHeight: 1.4,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 10,
  },
  bulletDash: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: "#111111",
    width: 12,
  },
  bulletText: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: "#111111",
    lineHeight: 1.4,
    flex: 1,
  },
  blank: { height: 5 },
});

export default function CVDocumentTradicional({ cvText }: { cvText: string }) {
  const lines = parseCvText(cvText);
  const elements: React.ReactNode[] = [];
  let headerDone = false;
  let lastWasJobRow = false;

  for (let i = 0; i < lines.length; i++) {
    const { role, text } = lines[i];

    switch (role) {
      case "name":
        elements.push(<Text key={i} style={S.name}>{text}</Text>);
        elements.push(<View key={`rh-${i}`} style={S.ruleHeavy} />);
        elements.push(<View key={`rl-${i}`} style={S.ruleLight} />);
        headerDone = true;
        lastWasJobRow = false;
        break;

      case "title":
        elements.push(<Text key={i} style={S.contact}>{text}</Text>);
        lastWasJobRow = false;
        break;

      case "contact":
        elements.push(<Text key={i} style={S.contact}>{text}</Text>);
        lastWasJobRow = false;
        break;

      case "section":
        if (!headerDone) {
          elements.push(<View key={`rh-${i}`} style={S.ruleHeavy} />);
          elements.push(<View key={`rl-${i}`} style={S.ruleLight} />);
          headerDone = true;
        }
        elements.push(<Text key={i} style={S.section}>{text}</Text>);
        lastWasJobRow = false;
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
          lastWasJobRow = true;
        } else if (lastWasJobRow) {
          // Line immediately after a company+dates row → job title (italic)
          elements.push(<Text key={i} style={S.jobTitle}>{text}</Text>);
          lastWasJobRow = false;
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
        lastWasJobRow = false;
        break;

      case "blank":
        elements.push(<View key={i} style={S.blank} />);
        lastWasJobRow = false;
        break;
    }
  }

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {elements}
      </Page>
    </Document>
  );
}

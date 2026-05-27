import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "emails.json");

async function readEmails(): Promise<string[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const emails = await readEmails();

  if (emails.includes(email)) {
    return NextResponse.json({ error: "Este email ya está en la lista." }, { status: 409 });
  }

  emails.push(email);
  await fs.writeFile(FILE_PATH, JSON.stringify(emails, null, 2), "utf-8");

  const SHEETS_URL =
    "https://script.google.com/macros/s/AKfycbziB8y220lhLxDWFUthEZ2k1t_AiMOPhOI6dSpyawSCDaCLHLz6ufU46rpSbA9aAvP8/exec";

  try {
    await fetch(SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    // fallo silencioso: el email ya quedó guardado localmente
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbziB8y220lhLxDWFUthEZ2k1t_AiMOPhOI6dSpyawSCDaCLHLz6ufU46rpSbA9aAvP8/exec";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  await fetch(SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return NextResponse.json({ ok: true });
}

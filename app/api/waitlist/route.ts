import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbziB8y220lhLxDWFUthEZ2k1t_AiMOPhOI6dSpyawSCDaCLHLz6ufU46rpSbA9aAvP8/exec";

const resend = new Resend(process.env.RESEND_API_KEY);

const welcomeHtml = () => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Ya eres parte de Postulai</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f9fafb">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;width:100%;">

<tr><td align="center" bgcolor="#ffffff" style="padding:40px 40px 24px 40px;">
<p style="margin:0;font-size:26px;font-weight:900;color:#000000;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">Postulai</p>
</td></tr>

<tr><td bgcolor="#ffffff" style="padding:0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#e5e7eb" style="height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
</td></tr>

<tr><td align="center" bgcolor="#ffffff" style="padding:40px 40px 0 40px;">
<p style="margin:0;font-size:28px;font-weight:900;color:#000000;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">¡Llegaste primero!</p>
</td></tr>

<tr><td align="center" bgcolor="#ffffff" style="padding:24px 40px 0 40px;">
<p style="margin:0;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;line-height:1.7;text-align:center;">Gracias por anotarte en la lista de espera. Somos Postulai, la primera herramienta hecha en Chile para adaptar tu currículum a cada oferta de trabajo que te interese.</p>
</td></tr>

<tr><td align="center" bgcolor="#ffffff" style="padding:20px 40px 0 40px;">
<p style="margin:0;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;line-height:1.7;text-align:center;">Por confiar en nosotros desde el día uno, cuando lancemos tendrás <strong style="color:#000000;">7 días de acceso anticipado al producto completo</strong> — antes que todos.</p>
</td></tr>

<tr><td align="center" bgcolor="#ffffff" style="padding:20px 40px 0 40px;">
<p style="margin:0;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;line-height:1.7;text-align:center;">Te avisamos cuando estemos listos. Mientras tanto, si tienes alguna duda escríbenos a <a href="mailto:contacto@postulai.cl" style="color:#000000;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;">contacto@postulai.cl</a></p>
</td></tr>

<tr><td align="center" bgcolor="#ffffff" style="padding:32px 40px 0 40px;">
<p style="margin:0;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;line-height:1.7;text-align:center;">¡Nos vemos pronto!<br><strong style="color:#000000;">— El equipo de Postulai</strong></p>
</td></tr>

<tr><td align="center" bgcolor="#ffffff" style="padding:36px 40px 0 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" align="center">
<tr><td align="center" bgcolor="#000000" style="border-radius:8px;">
<a href="https://postulai.cl" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;border-radius:8px;">Visitar postulai.cl</a>
</td></tr>
</table>
</td></tr>

<tr><td align="center" bgcolor="#ffffff" style="padding:40px 40px;">
<p style="margin:0;font-size:11px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;line-height:1.6;text-align:center;">Postulai &middot; Hecho en Chile &#127477;&#127473; &middot; <a href="mailto:contacto@postulai.cl" style="color:#9ca3af;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">contacto@postulai.cl</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  // Guardar en Google Sheets (no bloqueante si falla)
  fetch(SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => {});

  // Enviar correo de bienvenida (no bloqueante si falla)
  resend.emails.send({
    from: "Postulai <onboarding@postulai.cl>",
    to: email,
    subject: "Ya eres parte de Postulai 🇨🇱",
    html: welcomeHtml(),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

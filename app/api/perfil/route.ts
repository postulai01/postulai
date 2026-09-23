import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { nombre_referencia } = body;

  if (typeof nombre_referencia !== "string" || nombre_referencia.trim().length < 2) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const nombreLimpio = nombre_referencia.trim().slice(0, 100);

  const { data: existing } = await supabase
    .from("user_usage")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await supabase
      .from("user_usage")
      .update({ nombre_referencia: nombreLimpio })
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("user_usage")
      .insert({ user_id: user.id, nombre_referencia: nombreLimpio, usos_gratis_restantes: 5 });
  }

  return NextResponse.json({ ok: true, nombre_referencia: nombreLimpio });
}

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("[supabase] url length:", supabaseUrl?.length, "raw:", JSON.stringify(supabaseUrl));
console.log("[supabase] key length:", supabaseKey?.length, "starts/ends:", JSON.stringify(supabaseKey?.slice(0, 5)), JSON.stringify(supabaseKey?.slice(-5)));

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `[postulai] Supabase env vars missing. URL=${supabaseUrl ?? "undefined"}, KEY=${supabaseKey ? "set" : "undefined"}`
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

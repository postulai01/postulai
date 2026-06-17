import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("[supabase] url length:", supabaseUrl?.length);
console.log("[supabase] key length:", supabaseKey?.length);
console.log("[supabase] key has invalid chars:", supabaseKey ? [...supabaseKey].some(c => c.codePointAt(0)! > 127) : "N/A");
console.log("[supabase] url has invalid chars:", supabaseUrl ? [...supabaseUrl].some(c => c.codePointAt(0)! > 127) : "N/A");

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `[postulai] Supabase env vars missing. URL=${supabaseUrl ?? "undefined"}, KEY=${supabaseKey ? "set" : "undefined"}`
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

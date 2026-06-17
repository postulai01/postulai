import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("[supabase] init →", {
  url: supabaseUrl ? supabaseUrl.slice(0, 35) + "..." : "MISSING",
  key: supabaseKey ? "set (" + supabaseKey.slice(0, 10) + "...)" : "MISSING",
  isBrowser: typeof window !== "undefined",
});

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `[postulai] Supabase env vars missing. URL=${supabaseUrl ?? "undefined"}, KEY=${supabaseKey ? "set" : "undefined"}`
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

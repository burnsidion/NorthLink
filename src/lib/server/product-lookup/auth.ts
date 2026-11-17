import { createClient } from "@supabase/supabase-js";

/** Validate the browser's existing bearer token with Auth; no privileged key is needed. */
export async function authenticateLookupUser(token: string): Promise<string | null> {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if (!url || !key) throw new Error("Authentication unavailable");
 const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
 });
 const { data, error } = await client.auth.getUser(token);
 if (error && (!error.status || error.status === 429 || error.status >= 500)) throw new Error("Authentication unavailable");
 return error || data.user?.is_anonymous ? null : data.user?.id ?? null;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "./fetch-timeout";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const cloudAvailable = Boolean(url && publishableKey);

let browserClient: SupabaseClient | null = null;

export function getSupabase() {
  if (!cloudAvailable || !url || !publishableKey) {
    throw new Error("Cloud mode is not configured yet. Add the Supabase values from .env.example.");
  }
  browserClient ??= createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: fetchWithTimeout(15_000) },
  });
  return browserClient;
}

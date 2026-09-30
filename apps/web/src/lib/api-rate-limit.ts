import type { SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMITS: Array<{ method: string; path: RegExp; action: string }> = [
  { method: "POST", path: /^\/api\/analyses\/?$/, action: "analyses.create" },
  { method: "POST", path: /^\/api\/analyses\/[0-9a-f-]+\/messages\/?$/i, action: "messages.append" },
  { method: "POST", path: /^\/api\/analyses\/[0-9a-f-]+\/complete\/?$/i, action: "analysis.complete" },
];

export async function applyApiRateLimit(client: SupabaseClient, request: Request): Promise<{ allowed: boolean; error?: { code?: string } }> {
  const url = new URL(request.url);
  const action = RATE_LIMITS.find((limit) => limit.method === request.method.toUpperCase() && limit.path.test(url.pathname))?.action;
  if (!action) return { allowed: true };

  const { data, error } = await client.rpc("consume_api_rate_limit", { p_action: action });
  if (error) return { allowed: false, error };
  return { allowed: data === true };
}

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { applyApiRateLimit } from "./api-rate-limit";
import { uuidSchema } from "./api-schemas";
import { fetchWithTimeout } from "./fetch-timeout";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getAuthenticatedClient(request: Request): Promise<SupabaseClient> {
  const { client } = await getAuthenticatedContext(request);
  await enforceApiRateLimit(client, request);
  return client;
}

export async function enforceApiRateLimit(client: SupabaseClient, request: Request): Promise<void> {
  const rateLimit = await applyApiRateLimit(client, request);
  if (rateLimit.error) throw new ApiError(503, "Could not verify request limits. Please try again shortly.");
  if (!rateLimit.allowed) throw new ApiError(429, "You’re making requests too quickly. Wait a minute, then try again.");
}

export async function getAuthenticatedContext(request: Request): Promise<{ client: SupabaseClient; user: User }> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "Sign in to use your cloud archive.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ApiError(503, "Cloud storage is not configured.");

  const token = match[1];
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: fetchWithTimeout(10_000) },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "Your session has expired. Sign in again.");
  return { client, user: data.user };
}

export function databaseSetupError(error: { code?: string; message?: string } | null | undefined, fallback: string): ApiError {
  if (error?.message === "RATE_LIMITED") return new ApiError(429, "You are making requests too quickly. Wait a minute, then try again.");
  if (error?.code === "PGRST205" || error?.code === "PGRST202" || error?.code === "42P01") {
    console.error("LoreSync database schema is unavailable.", { code: error.code });
    return new ApiError(503, "The cloud database is not ready yet. Apply the SQL migrations in the project’s supabase/migrations folder, then try again.");
  }
  // Keep a useful production signal without logging user message text, SQL, or tokens.
  console.error("LoreSync database request failed.", { code: error?.code ?? "unknown" });
  return new ApiError(500, fallback);
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "Send this request as JSON.");
  }
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > maxBytes) throw new ApiError(413, "This request is too large.");
  if (!request.body) throw new ApiError(400, "A request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "This request is too large.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new ApiError(400, "The request body is not valid JSON.");
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, {
      status: error.status,
      headers: { "Cache-Control": "no-store", ...(error.status === 429 ? { "Retry-After": "60" } : {}) },
    });
  }
  // Do not log request bodies, tokens, or database error details.
  console.error("LoreSync API request failed.");
  return Response.json({ error: "The request could not be completed. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

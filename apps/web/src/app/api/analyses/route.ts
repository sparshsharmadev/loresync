import { apiErrorResponse, ApiError, databaseSetupError, getAuthenticatedClient, isRecord, readJsonBody } from "@/lib/api-server";
import { analysisCursorSchema, archivePageQuerySchema, createAnalysisSchema } from "@/lib/api-schemas";

export async function POST(request: Request) {
  try {
    const client = await getAuthenticatedClient(request);
    const body = createAnalysisSchema.safeParse(await readJsonBody<unknown>(request, 16_384));
    if (!body.success) throw new ApiError(400, "Add a title, choose a supported export, and confirm cloud storage before continuing.");

    const { data: id, error } = await client.rpc("begin_analysis", {
      p_title: body.data.title,
      p_platform: body.data.platform,
      p_consent_accepted: body.data.consentAccepted,
      p_consent_version: "cloud-v1",
    });
    if (error) throw databaseSetupError(error, "Could not start this cloud analysis.");
    if (typeof id !== "string") throw new ApiError(500, "Could not start this cloud analysis.");
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const client = await getAuthenticatedClient(request);
    const url = new URL(request.url);
    const query = archivePageQuerySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    if (!query.success) throw new ApiError(400, "Choose a valid archive page and cursor.");
    const limit = query.data.limit ?? 50;
    const cursor = query.data.cursor ? decodeAnalysisCursor(query.data.cursor) : null;
    let requestQuery = client
      .from("analyses")
      .select("id,title,platform,message_count,participant_count,summary,created_at,expires_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (cursor) requestQuery = requestQuery.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    const { data, error } = await requestQuery;
    if (error) throw databaseSetupError(error, "Could not load your cloud conversations.");
    if (!Array.isArray(data) || data.some((row) => !isRecord(row))) throw new ApiError(500, "The cloud archive returned an invalid response.");
    const hasMore = data.length > limit;
    const analyses = data.slice(0, limit);
    const last = analyses.at(-1);
    const nextCursor = hasMore && last ? encodeAnalysisCursor({ createdAt: String(last.created_at), id: String(last.id) }) : null;
    return Response.json({ analyses, nextCursor }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

type AnalysisCursor = { createdAt: string; id: string };

function encodeAnalysisCursor(cursor: AnalysisCursor) {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeAnalysisCursor(value: string): AnalysisCursor {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const cursor = analysisCursorSchema.parse(parsed);
    return { createdAt: new Date(cursor.createdAt).toISOString(), id: cursor.id };
  } catch {
    throw new ApiError(400, "That archive cursor is invalid. Start from the newest conversations.");
  }
}

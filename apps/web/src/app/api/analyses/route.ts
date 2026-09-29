import { apiErrorResponse, ApiError, getAuthenticatedClient, isRecord, readJsonBody } from "@/lib/api-server";

type BeginBody = { title?: unknown; platform?: unknown; consentAccepted?: unknown };

export async function POST(request: Request) {
  try {
    const client = await getAuthenticatedClient(request);
    const body = await readJsonBody<BeginBody>(request, 16_384);
    if (!isRecord(body)) throw new ApiError(400, "The request body must be a JSON object.");
    if (body.consentAccepted !== true) throw new ApiError(400, "Confirm cloud storage before continuing.");
    if (body.platform !== "whatsapp" && body.platform !== "discord") throw new ApiError(400, "Choose a supported chat export.");
    if (typeof body.title !== "string") throw new ApiError(400, "Give this conversation a name.");
    const title = body.title.trim();
    if (!title || title.length > 120) throw new ApiError(400, "Conversation names must be between 1 and 120 characters.");

    const { data: id, error } = await client.rpc("begin_analysis", {
      p_title: title,
      p_platform: body.platform,
      p_consent_accepted: true,
      p_consent_version: "cloud-v1",
    });
    if (error || typeof id !== "string") throw new ApiError(500, "Could not start this cloud analysis.");
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const client = await getAuthenticatedClient(request);
    const { data, error } = await client
      .from("analyses")
      .select("id,title,platform,message_count,participant_count,summary,created_at,expires_at")
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(500, "Could not load your cloud conversations.");
    if (!Array.isArray(data) || data.some((row) => !isRecord(row))) throw new ApiError(500, "The cloud archive returned an invalid response.");
    return Response.json({ analyses: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

import { apiErrorResponse, ApiError, databaseSetupError, getAuthenticatedClient, isRecord, isUuid } from "@/lib/api-server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "That conversation ID is not valid.");
    const client = await getAuthenticatedClient(request);
    const { data: summary, error } = await client.rpc("complete_analysis", { p_analysis_id: id });
    if (error) throw databaseSetupError(error, "This analysis is incomplete or could not be finalized.");
    if (!isRecord(summary)) throw new ApiError(400, "This analysis is incomplete or could not be finalized.");
    return Response.json({ id, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

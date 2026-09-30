import { apiErrorResponse, ApiError, databaseSetupError, getAuthenticatedClient, isUuid } from "@/lib/api-server";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "That conversation ID is not valid.");
    const client = await getAuthenticatedClient(request);
    const { error } = await client.rpc("delete_own_analysis", { p_analysis_id: id });
    if (error) throw databaseSetupError(error, "This conversation could not be deleted.");
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

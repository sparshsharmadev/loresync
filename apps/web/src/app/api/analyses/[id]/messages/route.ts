import { apiErrorResponse, ApiError, getAuthenticatedClient, isRecord, isUuid, readJsonBody } from "@/lib/api-server";

type MessageInput = { timestamp?: unknown; sender?: unknown; content?: unknown; hasAttachment?: unknown; rawId?: unknown };
type MessagesBody = { messages?: unknown };
const MAX_CHUNK_BYTES = 1_500_000;
const MAX_MESSAGES_PER_CHUNK = 250;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "That conversation ID is not valid.");
    const client = await getAuthenticatedClient(request);
    const body = await readJsonBody<MessagesBody>(request, MAX_CHUNK_BYTES);
    if (!isRecord(body)) throw new ApiError(400, "The request body must be a JSON object.");
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES_PER_CHUNK) {
      throw new ApiError(400, `Send between 1 and ${MAX_MESSAGES_PER_CHUNK} messages per request.`);
    }

    const messages = body.messages.map((value) => {
      if (!isRecord(value)) throw new ApiError(400, "A message in this batch is invalid.");
      const message = value as MessageInput;
      if (typeof message.timestamp !== "string" || !Number.isFinite(Date.parse(message.timestamp))) throw new ApiError(400, "A message has an invalid timestamp.");
      if (typeof message.sender !== "string" || !message.sender.trim() || message.sender.length > 200) throw new ApiError(400, "A message has an invalid sender.");
      if (typeof message.content !== "string" || message.content.length > 100_000) throw new ApiError(400, "A message is too long to save.");
      if (typeof message.hasAttachment !== "boolean") throw new ApiError(400, "A message has invalid attachment metadata.");
      if (message.rawId !== undefined && message.rawId !== null && (typeof message.rawId !== "string" || message.rawId.length > 200)) throw new ApiError(400, "A message has an invalid source identifier.");
      return {
        timestamp: new Date(message.timestamp).toISOString(),
        sender: message.sender.trim(),
        content: message.content,
        hasAttachment: message.hasAttachment,
        rawId: typeof message.rawId === "string" ? message.rawId : null,
      };
    });

    const { data: inserted, error } = await client.rpc("append_analysis_messages", {
      p_analysis_id: id,
      p_messages: messages,
    });
    if (error || typeof inserted !== "number") throw new ApiError(400, "Could not save this message batch. The import may have expired; start again.");
    return Response.json({ inserted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

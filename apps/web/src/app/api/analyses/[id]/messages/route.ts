import { apiErrorResponse, ApiError, databaseSetupError, getAuthenticatedClient, isUuid, readJsonBody } from "@/lib/api-server";
import { appendMessagesSchema, messageCursorSchema, messagePageQuerySchema } from "@/lib/api-schemas";

const DEFAULT_PAGE_SIZE = 50;

type MessageCursor = { sentAt: string; id: string };
const MAX_CHUNK_BYTES = 1_500_000;

function encodeCursor(cursor: MessageCursor) {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(value: string): MessageCursor {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const cursor = messageCursorSchema.parse(parsed);
    return { sentAt: new Date(cursor.sentAt).toISOString(), id: cursor.id };
  } catch {
    throw new ApiError(400, "That message cursor is invalid. Start from the newest messages.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "That conversation ID is not valid.");
    const client = await getAuthenticatedClient(request);
    const parsed = appendMessagesSchema.safeParse(await readJsonBody<unknown>(request, MAX_CHUNK_BYTES));
    if (!parsed.success) throw new ApiError(400, "This message batch is invalid or exceeds the import limits.");
    const messages = parsed.data.messages.map((message) => ({
      timestamp: new Date(message.timestamp).toISOString(),
      sender: message.sender,
      content: message.content,
      hasAttachment: message.hasAttachment,
      rawId: message.rawId ?? null,
    }));

    const { data: inserted, error } = await client.rpc("append_analysis_messages", {
      p_analysis_id: id,
      p_batch_id: parsed.data.batchId,
      p_messages: messages,
    });
    if (error?.code === "22023" && error.message === "Invalid message batch") {
      throw new ApiError(503, "The cloud database rejected this batch size. Confirm migration 202610040001_expand_import_batch_count.sql is applied; the app now sends smaller payloads to stay within the database limit.");
    }
    if (error) throw databaseSetupError(error, "Could not save this message batch. The import may have expired; start again.");
    if (typeof inserted !== "number") throw new ApiError(400, "Could not save this message batch. The import may have expired; start again.");
    return Response.json({ inserted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "That conversation ID is not valid.");
    const client = await getAuthenticatedClient(request);
    const url = new URL(request.url);
    const parsedQuery = messagePageQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsedQuery.success) throw new ApiError(400, "Choose valid message filters and a page size between 1 and 100. Search text needs at least three characters.");
    const limit = parsedQuery.data.limit ?? DEFAULT_PAGE_SIZE;
    const cursor = parsedQuery.data.cursor ? decodeCursor(parsedQuery.data.cursor) : null;
    const search = parsedQuery.data.q ?? "";
    const sender = parsedQuery.data.sender ?? "";
    const from = parsedQuery.data.from ?? null;
    const to = parsedQuery.data.to ?? null;
    const parseDateFilter = (value: string | null, field: string) => {
      if (value === null) return null;
      const timestamp = Date.parse(value);
      if (!Number.isFinite(timestamp)) throw new ApiError(400, `The ${field} date is invalid.`);
      return new Date(timestamp).toISOString();
    };
    const fromTimestamp = parseDateFilter(from, "start");
    const toTimestamp = parseDateFilter(to, "end");
    if (fromTimestamp && toTimestamp && fromTimestamp > toTimestamp) {
      throw new ApiError(400, "The start date must be before the end date.");
    }
    let query = client
      .from("messages")
      .select("id,sent_at,sender,content,platform,has_attachment,source_id")
      .eq("analysis_id", id)
      .order("sent_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (search) {
      const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
      query = query.ilike("content", `%${escapedSearch}%`);
    }
    if (sender) query = query.eq("sender", sender);
    if (fromTimestamp) query = query.gte("sent_at", fromTimestamp);
    if (toTimestamp) query = query.lte("sent_at", toTimestamp);
    if (cursor) {
      query = query.or(`sent_at.lt.${cursor.sentAt},and(sent_at.eq.${cursor.sentAt},id.lt.${cursor.id})`);
    }

    const { data, error } = await query;
    if (error) throw databaseSetupError(error, "Could not load messages for this conversation.");
    if (!Array.isArray(data)) throw new ApiError(500, "Could not load messages for this conversation.");

    const hasMore = data.length > limit;
    const page = data.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ sentAt: last.sent_at, id: String(last.id) }) : null;

    return Response.json({
      messages: page.map((message) => ({
        id: String(message.id),
        timestamp: message.sent_at,
        sender: message.sender,
        content: message.content,
        platform: message.platform,
        hasAttachment: message.has_attachment,
        rawId: message.source_id,
      })),
      nextCursor,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

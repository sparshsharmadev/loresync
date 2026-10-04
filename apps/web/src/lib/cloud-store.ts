import type { ChatMessage, ChatSummary } from "@loresync/core";
import { getSupabase } from "./supabase";
import { cloudRequest, isRecord } from "./cloud-request";

const MESSAGE_BATCH_SIZE = 10_000;
// Leave room for the database's jsonb text representation, which adds
// whitespace around keys and values when checking the stored payload size.
const MAX_UPLOAD_CHUNK_BYTES = 1_250_000;
const MESSAGE_ARRAY_OVERHEAD = new TextEncoder().encode('{"messages":[]}').byteLength;

export type CloudAnalysisRecord = {
  id: string;
  title: string;
  platform: "whatsapp" | "discord";
  message_count: number;
  participant_count: number;
  summary: ChatSummary;
  created_at: string;
  expires_at: string;
};

export type CloudAnalysisPage = { analyses: CloudAnalysisRecord[]; nextCursor: string | null };
export type CloudMessage = ChatMessage & { id: string };
export type CloudMessagePage = { messages: CloudMessage[]; nextCursor: string | null };

function splitMessageChunks(messages: ChatMessage[]) {
  const encoder = new TextEncoder();
  const chunks: ChatMessage[][] = [];
  let batch: ChatMessage[] = [];
  let batchBytes = MESSAGE_ARRAY_OVERHEAD;

  for (const message of messages) {
    const messageBytes = encoder.encode(JSON.stringify(message)).byteLength;
    const nextBytes = batchBytes + messageBytes + (batch.length ? 1 : 0);
    if (batch.length && (batch.length >= MESSAGE_BATCH_SIZE || nextBytes > MAX_UPLOAD_CHUNK_BYTES)) {
      chunks.push(batch);
      batch = [];
      batchBytes = MESSAGE_ARRAY_OVERHEAD;
    }
    if (batchBytes + messageBytes > MAX_UPLOAD_CHUNK_BYTES) {
      throw new Error("A message is too large to send to the cloud archive.");
    }
    batch.push(message);
    batchBytes += messageBytes + (batch.length > 1 ? 1 : 0);
  }
  if (batch.length) chunks.push(batch);
  return chunks;
}

async function getAccessToken() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in to use your cloud archive.");
  return data.session.access_token;
}

export async function loadCloudAnalyses(cursor?: string): Promise<CloudAnalysisPage> {
  const token = await getAccessToken();
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  const result = await cloudRequest<CloudAnalysisPage>(`/api/analyses?${query}`, "GET", token);
  if (!Array.isArray(result.analyses) || result.analyses.some((analysis) => !isRecord(analysis))) {
    throw new Error("The cloud archive returned an invalid conversations list.");
  }
  if (result.nextCursor !== null && typeof result.nextCursor !== "string") throw new Error("The cloud archive returned an invalid page cursor.");
  return result;
}

export async function loadCloudMessages(
  analysisId: string,
  options: { query?: string; sender?: string; cursor?: string; limit?: number; from?: string; to?: string } = {},
): Promise<CloudMessagePage> {
  const token = await getAccessToken();
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 50)));
  const query = new URLSearchParams({ limit: String(limit) });
  if (options.query) query.set("q", options.query);
  if (options.sender) query.set("sender", options.sender);
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.from) query.set("from", options.from);
  if (options.to) query.set("to", options.to);
  const result = await cloudRequest<CloudMessagePage>(`/api/analyses/${analysisId}/messages?${query}`, "GET", token);
  if (!Array.isArray(result.messages) || result.messages.some((message) => !isRecord(message) || typeof message.id !== "string")) {
    throw new Error("The conversation returned an invalid message list.");
  }
  if (result.nextCursor !== null && typeof result.nextCursor !== "string") throw new Error("The conversation returned an invalid message cursor.");
  return result;
}

export async function saveCloudAnalysis(
  title: string,
  platform: "whatsapp" | "discord",
  messages: ChatMessage[],
  consentAccepted: boolean,
  onProgress?: (saved: number, total: number, retryAfterMs?: number) => void,
): Promise<{ id: string; summary: ChatSummary }> {
  if (!consentAccepted) throw new Error("Confirm cloud storage before continuing.");
  if (messages.length === 0) throw new Error("This export does not contain any messages to save.");
  // Validate every payload before creating an archive row so a malformed export
  // cannot leave behind an empty conversation when chunking fails.
  const chunks = splitMessageChunks(messages);
  const token = await getAccessToken();
  const { id } = await cloudRequest<{ id: string }>("/api/analyses", "POST", token, {
    title,
    platform,
    consentAccepted,
  });
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("The cloud service returned an invalid conversation ID.");

  try {
    let savedCount = 0;
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const batchId = crypto.randomUUID();
      let result: { inserted: number };
      try {
        result = await cloudRequest<{ inserted: number }>(`/api/analyses/${id}/messages`, "POST", token, {
          batchId,
          messages: chunk.map(({ timestamp, sender, content, hasAttachment, rawId }) => ({
            timestamp, sender, content, hasAttachment, rawId: rawId ?? null,
          })),
        }, true, undefined, (retryAfterMs) => onProgress?.(savedCount, messages.length, retryAfterMs));
      } catch (error) {
        const reason = error instanceof Error ? error.message : "The request failed.";
        throw new Error(`Cloud save stopped at batch ${chunkIndex + 1} of ${chunks.length} after ${savedCount.toLocaleString()} messages: ${reason}`);
      }
      if (result.inserted !== chunk.length) throw new Error("The cloud service saved an unexpected number of messages.");
      savedCount += result.inserted;
      onProgress?.(savedCount, messages.length);
    }
    const completed = await cloudRequest<{ id: string; summary: ChatSummary }>(`/api/analyses/${id}/complete`, "POST", token);
    if (completed.id !== id || !isRecord(completed.summary)) throw new Error("The cloud service returned an invalid analysis summary.");
    return { id: completed.id, summary: completed.summary };
  } catch (error) {
    await cloudRequest<{ deleted: boolean }>(`/api/analyses/${id}`, "DELETE", token).catch(() => undefined);
    throw error;
  }
}

export async function deleteCloudAnalysis(id: string) {
  const token = await getAccessToken();
  await cloudRequest<{ deleted: boolean }>(`/api/analyses/${id}`, "DELETE", token);
}

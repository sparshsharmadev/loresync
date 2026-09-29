import type { ChatMessage, ChatSummary } from "@loresync/core";
import { getSupabase } from "./supabase";

const MESSAGE_BATCH_SIZE = 250;
const MAX_UPLOAD_CHUNK_BYTES = 1_400_000;
const MESSAGE_ARRAY_OVERHEAD = new TextEncoder().encode('{"messages":[]}').byteLength;

type ApiResult<T> = T & { error?: string };

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

async function cloudRequest<T>(path: string, method: string, accessToken: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({})) as ApiResult<T>;
  if (!response.ok) throw new Error(result.error ?? "The cloud request could not be completed.");
  return result;
}

async function getAccessToken() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in to use your cloud archive.");
  return data.session.access_token;
}

export async function loadCloudAnalyses(): Promise<CloudAnalysisRecord[]> {
  const token = await getAccessToken();
  const result = await cloudRequest<{ analyses: CloudAnalysisRecord[] }>("/api/analyses", "GET", token);
  return result.analyses;
}

export async function saveCloudAnalysis(
  title: string,
  platform: "whatsapp" | "discord",
  messages: ChatMessage[],
  consentAccepted: boolean,
): Promise<{ id: string; summary: ChatSummary }> {
  if (!consentAccepted) throw new Error("Confirm cloud storage before continuing.");
  const token = await getAccessToken();
  const { id } = await cloudRequest<{ id: string }>("/api/analyses", "POST", token, {
    title,
    platform,
    consentAccepted,
  });

  try {
    for (const chunk of splitMessageChunks(messages)) {
      await cloudRequest<{ inserted: number }>(`/api/analyses/${id}/messages`, "POST", token, {
        messages: chunk,
      });
    }
    const completed = await cloudRequest<{ id: string; summary: ChatSummary }>(`/api/analyses/${id}/complete`, "POST", token);
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

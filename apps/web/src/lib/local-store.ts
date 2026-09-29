import type { ChatMessage, ChatSummary } from "@loresync/core";

const DB_NAME = "loresync-local";
const STORE_NAME = "analyses";

export interface SavedAnalysis {
  id: string;
  title: string;
  platform: "whatsapp" | "discord";
  summary: ChatSummary;
  messages: ChatMessage[];
  savedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalAnalysis(analysis: SavedAnalysis) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(analysis);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadLocalAnalyses(): Promise<SavedAnalysis[]> {
  const database = await openDatabase();
  const rows = await new Promise<SavedAnalysis[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as SavedAnalysis[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function deleteLocalAnalysis(id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

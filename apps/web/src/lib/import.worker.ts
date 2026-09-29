import { parseChatExport, summarizeMessages } from "@loresync/core";

self.onmessage = (event: MessageEvent<{ name: string; text: string }>) => {
  try {
    const messages = parseChatExport(event.data.name, event.data.text);
    const summary = summarizeMessages(messages);
    self.postMessage({ ok: true, messages, summary });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "Unable to read that export." });
  }
};

export {};

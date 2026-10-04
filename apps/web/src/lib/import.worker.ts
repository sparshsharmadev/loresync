import { buildDeepConversationReading, parseChatExport, summarizeMessages } from "@loresync/core";

self.onmessage = (event: MessageEvent<{ name: string; text: string }>) => {
  try {
    self.postMessage({ progress: "Reading message lines…" });
    const messages = parseChatExport(event.data.name, event.data.text, (progress, total) => {
      self.postMessage({ progress: `Reading message lines… ${progress.toLocaleString()} / ${total.toLocaleString()}` });
    });
    if (!messages.length) throw new Error("No messages were recognized. Check that this is a WhatsApp chat export in .txt format.");
    const oversizedMessage = messages.find((message) => message.content.length > 100_000);
    if (oversizedMessage) {
      throw new Error(messages.length === 1
        ? "Only one very large message was recognized. The export may use a WhatsApp line format this parser does not recognize yet. Try exporting the chat again, then re-upload the .txt file."
        : "One message is over 100,000 characters, so the export could not be analyzed safely. Try exporting the chat again and re-uploading the .txt file.");
    }
    self.postMessage({ progress: `Found ${messages.length.toLocaleString()} messages. Calculating patterns…` });
    const summary = summarizeMessages(messages);
    const deepReading = buildDeepConversationReading(messages);
    self.postMessage({ ok: true, messages, summary, deepReading });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "Unable to read that export." });
  }
};

export {};

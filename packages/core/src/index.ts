export type ChatPlatform = "whatsapp" | "discord";

export interface ChatMessage {
  timestamp: string;
  sender: string;
  content: string;
  platform: ChatPlatform;
  hasAttachment: boolean;
  rawId?: string;
}

export interface ChatSummary {
  messageCount: number;
  participantCount: number;
  participants: { name: string; count: number }[];
  firstMessageAt: string;
  lastMessageAt: string;
  activeDays: number;
  dailyActivity: { date: string; count: number }[];
  hourlyActivity: number[];
  attachmentCount: number;
}

const whatsappPatterns = [
  /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?\s?[APap][Mm])\]?\s[-–]\s(.+?):\s([\s\S]*)$/,
  /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?)\]?\s[-–]\s(.+?):\s([\s\S]*)$/,
];
const whatsappHeaderPattern = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\]?\s[-–]\s/;

function parseChatDate(datePart: string, timePart: string): Date | null {
  const [a, b, rawYear] = datePart.split("/").map(Number);
  let year = rawYear;
  if (year < 100) year += year < 70 ? 2000 : 1900;
  // WhatsApp exports are locale-dependent. When both values are valid months,
  // use the common device-export convention (month/day); otherwise infer it.
  let month = a;
  let day = b;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  }
  const time = timePart.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([APap][Mm])?$/);
  if (!time || month < 1 || month > 12 || day < 1 || day > 31) return null;
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  if (time[3]) {
    const pm = time[3].toUpperCase() === "PM";
    hour = (hour % 12) + (pm ? 12 : 0);
  }
  const result = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function parseWhatsApp(text: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let active: ChatMessage | undefined;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const match = whatsappPatterns.map((pattern) => line.match(pattern)).find(Boolean);
    if (!match) {
      if (whatsappHeaderPattern.test(line)) {
        if (active) messages.push(active);
        active = undefined;
        continue;
      }
      if (active && line.trim()) active.content += `\n${line}`;
      continue;
    }
    const [, date, time, sender, content] = match;
    const timestamp = parseChatDate(date, time);
    if (!timestamp) continue;
    if (active) messages.push(active);
    active = {
      timestamp: timestamp.toISOString(),
      sender: sender.trim(),
      content: content.trim(),
      platform: "whatsapp",
      hasAttachment: /<media omitted>|attached:|image omitted|video omitted/i.test(content),
    };
  }
  if (active) messages.push(active);
  return messages;
}

export function parseDiscord(text: string): ChatMessage[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("This does not look like a Discord message export.");
  const messages: ChatMessage[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const dateValue = entry.Timestamp ?? entry.timestamp ?? entry.timestamp_created;
    const date = typeof dateValue === "string" ? new Date(dateValue) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const attachment = entry.Attachments ?? entry.attachments;
    const content = entry.Contents ?? entry.content ?? entry.Content ?? "";
    const senderValue = entry.Author ?? entry.author ?? entry.sender ?? "Unknown sender";
    const sender = typeof senderValue === "string" ? senderValue : "Unknown sender";
    messages.push({
      timestamp: date.toISOString(),
      sender,
      content: typeof content === "string" ? content.trim() : "",
      platform: "discord",
      hasAttachment: Array.isArray(attachment) ? attachment.length > 0 : Boolean(attachment),
      rawId: String(entry.ID ?? entry.id ?? "") || undefined,
    });
  }
  return messages.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function parseChatExport(fileName: string, text: string): ChatMessage[] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "json") return parseDiscord(text);
  if (extension === "txt") return parseWhatsApp(text);
  throw new Error("Choose a WhatsApp .txt or Discord .json export.");
}

export function summarizeMessages(messages: ChatMessage[]): ChatSummary {
  if (!messages.length) throw new Error("No messages were recognized in that export.");
  const participants = new Map<string, number>();
  const days = new Map<string, number>();
  const hours = Array.from({ length: 24 }, () => 0);
  let attachmentCount = 0;
  for (const message of messages) {
    participants.set(message.sender, (participants.get(message.sender) ?? 0) + 1);
    const date = new Date(message.timestamp);
    const day = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    days.set(day, (days.get(day) ?? 0) + 1);
    hours[date.getUTCHours()] += 1;
    if (message.hasAttachment) attachmentCount += 1;
  }
  const sorted = [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const dailyActivity = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  return {
    messageCount: messages.length,
    participantCount: participants.size,
    participants: [...participants].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    firstMessageAt: sorted[0].timestamp,
    lastMessageAt: sorted[sorted.length - 1].timestamp,
    activeDays: days.size,
    dailyActivity,
    hourlyActivity: hours,
    attachmentCount,
  };
}

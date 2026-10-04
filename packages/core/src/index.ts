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
  dailyActivity: { date: string; count: number; participants?: { name: string; count: number }[] }[];
  hourlyActivity: number[];
  weekdayActivity?: number[];
  averageMessageWords?: number;
  medianReplyMinutes?: number | null;
  replyCount?: number;
  quickReplyPercent?: number | null;
  attachmentCount: number;
}

export interface DeepConversationReading {
  commonWords: { word: string; count: number }[];
  repeatedPhrases: { phrase: string; count: number }[];
  sharedLinks: { domain: string; count: number }[];
  weekdayHours: number[][];
  weekdayHourPeakDates: (string | null)[][];
  monthlyParticipants: { month: string; sender: string; count: number }[];
  messageLengths: { label: string; count: number }[];
  sessions: { count: number; averageMessages: number; longestMessages: number };
  participantStyles: { name: string; count: number; averageWords: number; averageResponseMinutes: number | null; sessionStarts: number }[];
}

function chronologicallyOrdered(messages: ChatMessage[]): ChatMessage[] {
  for (let index = 1; index < messages.length; index += 1) {
    if (messages[index - 1].timestamp > messages[index].timestamp) {
      return [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
  }
  return messages;
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

export function parseWhatsApp(text: string, onProgress?: (progress: number, total: number) => void): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let active: ChatMessage | undefined;
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    // Some WhatsApp exports prefix every line with an invisible bidi mark.
    // Remove it only from the line start so Arabic/Hebrew message text stays intact.
    const line = lines[lineIndex].replace(/^[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+/, "");
    if (lineIndex % 5000 === 0) onProgress?.(lineIndex, lines.length);
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
  onProgress?.(lines.length, lines.length);
  return messages;
}

export function parseDiscord(text: string, onProgress?: (progress: number, total: number) => void): ChatMessage[] {
  const data: unknown = JSON.parse(text);
  const entries = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).messages)
      ? (data as { messages: unknown[] }).messages
      : null;
  if (!entries) throw new Error("This does not look like a Discord message export.");
  const messages: ChatMessage[] = [];
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const item = entries[entryIndex];
    if (entryIndex % 5000 === 0) onProgress?.(entryIndex, entries.length);
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const dateValue = entry.Timestamp ?? entry.timestamp ?? entry.timestamp_created;
    const date = typeof dateValue === "string" ? new Date(dateValue) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const attachment = entry.Attachments ?? entry.attachments;
    const content = entry.Contents ?? entry.content ?? entry.Content ?? "";
    const senderValue = entry.Author ?? entry.author ?? entry.sender ?? "Unknown sender";
    const sender = typeof senderValue === "string"
      ? senderValue
      : senderValue && typeof senderValue === "object" && typeof (senderValue as Record<string, unknown>).name === "string"
        ? (senderValue as { name: string }).name
        : "Unknown sender";
    messages.push({
      timestamp: date.toISOString(),
      sender,
      content: typeof content === "string" ? content.trim() : "",
      platform: "discord",
      hasAttachment: Array.isArray(attachment) ? attachment.length > 0 : Boolean(attachment),
      rawId: String(entry.ID ?? entry.id ?? "") || undefined,
    });
  }
  onProgress?.(entries.length, entries.length);
  return messages.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function parseChatExport(fileName: string, text: string, onProgress?: (progress: number, total: number) => void): ChatMessage[] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "json") return parseDiscord(text, onProgress);
  if (extension === "txt") return parseWhatsApp(text, onProgress);
  throw new Error("Choose a WhatsApp .txt or Discord .json export.");
}

export function summarizeMessages(messages: ChatMessage[]): ChatSummary {
  if (!messages.length) throw new Error("No messages were recognized in that export.");
  const participants = new Map<string, number>();
  const days = new Map<string, { count: number; participants: Map<string, number> }>();
  const hours = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  let attachmentCount = 0;
  let wordCount = 0;
  let wordMessages = 0;
  for (const message of messages) {
    participants.set(message.sender, (participants.get(message.sender) ?? 0) + 1);
    const date = new Date(message.timestamp);
    const day = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    const dayStats = days.get(day) ?? { count: 0, participants: new Map<string, number>() };
    dayStats.count += 1;
    dayStats.participants.set(message.sender, (dayStats.participants.get(message.sender) ?? 0) + 1);
    days.set(day, dayStats);
    hours[date.getUTCHours()] += 1;
    weekdays[(date.getUTCDay() + 6) % 7] += 1;
    if (message.hasAttachment) attachmentCount += 1;
    const words = message.content.trim().split(/\s+/).filter(Boolean);
    if (words.length) {
      wordCount += words.length;
      wordMessages += 1;
    }
  }
  const sorted = chronologicallyOrdered(messages);
  const replyMinutes: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const minutes = (Date.parse(current.timestamp) - Date.parse(previous.timestamp)) / 60_000;
    if (current.sender !== previous.sender && minutes >= 0 && minutes <= 24 * 60) replyMinutes.push(minutes);
  }
  replyMinutes.sort((a, b) => a - b);
  const middle = Math.floor(replyMinutes.length / 2);
  const medianReplyMinutes = replyMinutes.length
    ? Math.round(replyMinutes.length % 2 ? replyMinutes[middle] : (replyMinutes[middle - 1] + replyMinutes[middle]) / 2)
    : null;
  const dailyActivity = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, stats]) => ({ date, count: stats.count, participants: [...stats.participants].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) }));
  return {
    messageCount: messages.length,
    participantCount: participants.size,
    participants: [...participants].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    firstMessageAt: sorted[0].timestamp,
    lastMessageAt: sorted[sorted.length - 1].timestamp,
    activeDays: days.size,
    dailyActivity,
    hourlyActivity: hours,
    weekdayActivity: weekdays,
    averageMessageWords: wordMessages ? Math.round((wordCount / wordMessages) * 10) / 10 : 0,
    medianReplyMinutes,
    replyCount: replyMinutes.length,
    quickReplyPercent: replyMinutes.length ? Math.round((replyMinutes.filter((minutes) => minutes <= 60).length / replyMinutes.length) * 100) : null,
    attachmentCount,
  };
}

const analysisStopWords = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "this", "that", "have", "was", "were", "from", "they", "them", "then", "than", "when", "what", "who", "how", "why", "can", "could", "would", "should", "will", "just", "like", "into", "about", "there", "here", "been", "being", "had", "has", "did", "does", "get", "got", "its", "it's", "our", "out", "all", "one", "too", "very", "yeah", "yes", "okay", "ok", "lol", "lmao", "hmm", "hmmm", "umm", "uhh", "hai", "hain", "tha", "thi", "the", "ho", "toh", "bhi", "kya", "nahi", "nhi", "aur", "ke", "ki", "ka", "ko", "me", "mai", "main", "se", "na", "ha", "haan", "acha", "accha", "arey", "yr", "yaar", "bro", "bhai", "bas", "ab", "fir", "phir", "kuch", "koi", "mujhe", "tera", "meri", "mera", "tere", "tum", "tumhe", "apna", "apni", "apne", "media", "omitted",
]);

export function buildDeepConversationReading(messages: ChatMessage[]): DeepConversationReading {
  const words = new Map<string, number>();
  const phrases = new Map<string, number>();
  const links = new Map<string, number>();
  const weekdayHours = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const weekdayHourPeakDates: (string | null)[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => null));
  const weekdayHourPeakCounts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const weekdayHourDayCounts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => new Map<string, number>()));
  const monthlyParticipants = new Map<string, number>();
  const lengthBuckets = [0, 0, 0, 0, 0];
  const participantCounts = new Map<string, { count: number; words: number; responseMinutes: number; responses: number; sessionStarts: number }>();
  const ordered = chronologicallyOrdered(messages);
  let sessionCount = 0;
  let currentSession = 0;
  let longestSession = 0;
  let previousTime = 0;
  let previousSender = "";

  for (const message of ordered) {
    const content = message.content ?? "";
    const analysisText = content.replace(/<media omitted>|\[(?:image|video|audio|sticker) omitted\]/gi, " ");
    const tokens = analysisText.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
    const lexicalTokens = tokens.filter((word) => word.length > 2 && !analysisStopWords.has(word) && !/^\d+$/.test(word));
    for (const word of lexicalTokens) words.set(word, (words.get(word) ?? 0) + 1);
    for (let index = 0; index < lexicalTokens.length - 1; index += 1) {
      const phrase = `${lexicalTokens[index]} ${lexicalTokens[index + 1]}`;
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
    }

    const messageWords = tokens.length;
    const participant = participantCounts.get(message.sender) ?? { count: 0, words: 0, responseMinutes: 0, responses: 0, sessionStarts: 0 };
    participant.count += 1;
    participant.words += messageWords;
    participantCounts.set(message.sender, participant);

    const date = new Date(message.timestamp);
    if (!Number.isNaN(date.getTime())) {
      const day = (date.getUTCDay() + 6) % 7;
      const hour = date.getUTCHours();
      weekdayHours[day][hour] += 1;
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const participantMonthKey = `${monthKey}\u0000${message.sender}`;
      monthlyParticipants.set(participantMonthKey, (monthlyParticipants.get(participantMonthKey) ?? 0) + 1);
      // Keep the busiest actual date in each heatmap cell for a useful drill-down.
      const dateCounts = weekdayHourDayCounts[day][hour];
      const heatCount = dateCounts.get(dateKey) ?? 0;
      dateCounts.set(dateKey, heatCount + 1);
      if (heatCount + 1 > weekdayHourPeakCounts[day][hour]) {
        weekdayHourPeakCounts[day][hour] = heatCount + 1;
        weekdayHourPeakDates[day][hour] = dateKey;
      }
    }
    if (!messageWords) lengthBuckets[0] += 1;
    else if (messageWords <= 5) lengthBuckets[1] += 1;
    else if (messageWords <= 15) lengthBuckets[2] += 1;
    else if (messageWords <= 40) lengthBuckets[3] += 1;
    else lengthBuckets[4] += 1;

    const timestamp = Date.parse(message.timestamp);
    if (Number.isFinite(timestamp)) {
      const gap = timestamp - previousTime;
      if (!previousTime || gap > 6 * 60 * 60 * 1000) {
        if (currentSession) longestSession = Math.max(longestSession, currentSession);
        sessionCount += 1;
        currentSession = 0;
        participant.sessionStarts += 1;
      } else if (previousSender !== message.sender && gap >= 0 && gap <= 24 * 60 * 60 * 1000) {
          participant.responseMinutes += gap / 60_000;
          participant.responses += 1;
      }
      currentSession += 1;
      previousTime = timestamp;
      previousSender = message.sender;
    }

    const foundUrls = content.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) ?? [];
    for (const rawUrl of foundUrls) {
      const cleaned = rawUrl.replace(/[),.!?;:'”’]+$/g, "");
      try {
        const url = new URL(cleaned);
        const domain = url.hostname.toLowerCase().replace(/^www\./, "");
        links.set(domain, (links.get(domain) ?? 0) + 1);
      } catch { /* Ignore incomplete URL-like text. */ }
    }
  }
  longestSession = Math.max(longestSession, currentSession);

  const ranked = (map: Map<string, number>, limit: number, minCount: number) => [...map]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);

  return {
    commonWords: ranked(words, 16, 2).map(([word, count]) => ({ word, count })),
    repeatedPhrases: ranked(phrases, 10, 2).map(([phrase, count]) => ({ phrase, count })),
    sharedLinks: [...links].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)).slice(0, 12),
    weekdayHours,
    weekdayHourPeakDates,
    monthlyParticipants: [...monthlyParticipants].map(([key, count]) => {
      const [month, sender] = key.split("\u0000");
      return { month, sender, count };
    }).sort((a, b) => a.month.localeCompare(b.month) || b.count - a.count || a.sender.localeCompare(b.sender)),
    messageLengths: ["Empty", "1–5", "6–15", "16–40", "41+"].map((label, index) => ({ label, count: lengthBuckets[index] })),
    sessions: { count: sessionCount, averageMessages: sessionCount ? Math.round((messages.length / sessionCount) * 10) / 10 : 0, longestMessages: longestSession },
    participantStyles: [...participantCounts].map(([name, value]) => ({ name, count: value.count, averageWords: value.count ? Math.round((value.words / value.count) * 10) / 10 : 0, averageResponseMinutes: value.responses ? Math.round(value.responseMinutes / value.responses) : null, sessionStarts: value.sessionStarts })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

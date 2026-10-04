import assert from "node:assert/strict";
import test from "node:test";
import { buildDeepConversationReading, summarizeMessages } from "../../../packages/core/src/index.ts";

const messages = [
  { timestamp: "2026-01-05T10:15:00.000Z", sender: "Alice", content: "Hello there", platform: "whatsapp", hasAttachment: false },
  { timestamp: "2026-01-05T10:35:00.000Z", sender: "Bob", content: "Good morning", platform: "whatsapp", hasAttachment: false },
  { timestamp: "2026-01-06T18:20:00.000Z", sender: "Bob", content: "Another day", platform: "whatsapp", hasAttachment: false },
];

test("summary records daily activity split by participant", () => {
  const summary = summarizeMessages(messages);
  assert.deepEqual(summary.dailyActivity, [
    { date: "2026-01-05", count: 2, participants: [{ name: "Alice", count: 1 }, { name: "Bob", count: 1 }] },
    { date: "2026-01-06", count: 1, participants: [{ name: "Bob", count: 1 }] },
  ]);
});

test("deep reading exposes heatmap drilldown dates and participant monthly totals", () => {
  const reading = buildDeepConversationReading(messages);
  assert.equal(reading.weekdayHours[0][10], 2);
  assert.equal(reading.weekdayHourPeakDates[0][10], "2026-01-05");
  assert.deepEqual(reading.monthlyParticipants, [
    { month: "2026-01", sender: "Bob", count: 2 },
    { month: "2026-01", sender: "Alice", count: 1 },
  ]);
});

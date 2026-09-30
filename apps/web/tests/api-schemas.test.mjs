import assert from "node:assert/strict";
import test from "node:test";
import { appendMessagesSchema, createAnalysisSchema, messagePageQuerySchema, updateProfileSchema } from "../src/lib/api-schemas.ts";

test("cloud analysis input requires bounded fields and explicit consent", () => {
  assert.equal(createAnalysisSchema.safeParse({ title: "   ", platform: "whatsapp", consentAccepted: true }).success, false);
  assert.equal(createAnalysisSchema.safeParse({ title: "Archive", platform: "whatsapp", consentAccepted: false }).success, false);
  assert.equal(createAnalysisSchema.safeParse({ title: "Archive", platform: "discord", consentAccepted: true, ownerId: "someone-else" }).success, false);
});

test("message batches require a valid id, bounded rows, and strict message fields", () => {
  const batch = {
    batchId: "b90b9f3e-4e4e-4e3d-a31e-14a85c0a49b5",
    messages: [{ timestamp: "2026-09-30T09:00:00Z", sender: "A", content: "hello", hasAttachment: false }],
  };
  assert.equal(appendMessagesSchema.safeParse(batch).success, true);
  assert.equal(appendMessagesSchema.safeParse({ ...batch, batchId: "bad" }).success, false);
  assert.equal(appendMessagesSchema.safeParse({ ...batch, messages: [{ ...batch.messages[0], ownerId: "other" }] }).success, false);
});

test("profile updates reject unexpected ownership fields and invalid preferences", () => {
  assert.equal(updateProfileSchema.safeParse({ username: "sparsh_1", theme: "dark" }).success, true);
  assert.equal(updateProfileSchema.safeParse({ username: "UPPER" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ user_id: "other-user", username: "user_1" }).success, false);
});

test("message list query bounds pages and avoids unindexed one and two character searches", () => {
  assert.equal(messagePageQuerySchema.safeParse({ limit: "50", q: "word" }).success, true);
  assert.equal(messagePageQuerySchema.safeParse({ limit: "101" }).success, false);
  assert.equal(messagePageQuerySchema.safeParse({ q: "a" }).success, false);
});

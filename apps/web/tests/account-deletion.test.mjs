import assert from "node:assert/strict";
import test from "node:test";
import { readAccountDeletionPassword } from "../src/lib/account-deletion.ts";

test("requires both password and explicit DELETE confirmation", () => {
  assert.equal(readAccountDeletionPassword({ password: "correct horse battery staple", confirmation: "DELETE" }), "correct horse battery staple");
  assert.equal(readAccountDeletionPassword({ password: "valid password" }), null);
  assert.equal(readAccountDeletionPassword({ password: "valid password", confirmation: "delete" }), null);
  assert.equal(readAccountDeletionPassword(null), null);
  assert.equal(readAccountDeletionPassword({ password: "" , confirmation: "DELETE" }), null);
  assert.equal(readAccountDeletionPassword({ password: "x".repeat(1_025), confirmation: "DELETE" }), null);
});

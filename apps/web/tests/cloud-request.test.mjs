import assert from "node:assert/strict";
import test from "node:test";
import { cloudRequest } from "../src/lib/cloud-request.ts";

test("retries a batch with the same payload after a network failure", async () => {
  const batch = { batchId: "b90b9f3e-4e4e-4e3d-a31e-14a85c0a49b5", messages: [{ content: "hello" }] };
  const bodies = [];
  let attempts = 0;
  const fetcher = async (_url, init) => {
    attempts += 1;
    bodies.push(init.body);
    if (attempts === 1) throw new TypeError("network failure");
    return Response.json({ inserted: 1 });
  };

  assert.deepEqual(await cloudRequest("/api/import", "POST", "token", batch, true, fetcher), { inserted: 1 });
  assert.equal(attempts, 2);
  assert.deepEqual(bodies, [JSON.stringify(batch), JSON.stringify(batch)]);
});

test("does not retry a non-idempotent request and rejects malformed success responses", async () => {
  let attempts = 0;
  await assert.rejects(() => cloudRequest("/api/analyses", "POST", "token", {}, false, async () => {
    attempts += 1;
    throw new TypeError("network failure");
  }), /timed out or lost its connection/);
  assert.equal(attempts, 1);
  await assert.rejects(() => cloudRequest("/api/import", "POST", "token", {}, false, async () => new Response("not-json")), /invalid response/);
});

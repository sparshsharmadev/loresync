import assert from "node:assert/strict";
import test from "node:test";
import { applyApiRateLimit } from "../src/lib/api-rate-limit.ts";

function clientReturning(data, error = null) {
  const calls = [];
  return {
    calls,
    client: {
      rpc: async (...args) => {
        calls.push(args);
        return { data, error };
      },
    },
  };
}

test("maps authenticated write routes to database rate-limit actions", async () => {
  const cases = [
    ["POST", "/api/analyses", "analyses.create"],
    ["POST", "/api/analyses/123e4567-e89b-42d3-a456-426614174000/messages", "messages.append"],
    ["POST", "/api/analyses/123e4567-e89b-42d3-a456-426614174000/complete", "analysis.complete"],
  ];

  for (const [method, path, action] of cases) {
    const { client, calls } = clientReturning(true);
    assert.deepEqual(await applyApiRateLimit(client, new Request(`https://app.example${path}`, { method })), { allowed: true });
    assert.deepEqual(calls, [["consume_api_rate_limit", { p_action: action }]]);
  }
});

test("does not consume write limits for reads or unrelated routes", async () => {
  const { client, calls } = clientReturning(true);
  for (const request of [
    new Request("https://app.example/api/analyses", { method: "GET" }),
    new Request("https://app.example/api/unknown", { method: "POST" }),
  ]) {
    assert.deepEqual(await applyApiRateLimit(client, request), { allowed: true });
  }
  assert.equal(calls.length, 0);
});

test("returns a denial when the database limit is exhausted and reports database errors", async () => {
  const request = new Request("https://app.example/api/analyses", { method: "POST" });
  assert.deepEqual(await applyApiRateLimit(clientReturning(false).client, request), { allowed: false });
  const error = { code: "PGRST202" };
  assert.deepEqual(await applyApiRateLimit(clientReturning(null, error).client, request), { allowed: false, error });
});

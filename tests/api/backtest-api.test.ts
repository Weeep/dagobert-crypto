import assert from "node:assert/strict";
import test from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import { createBacktestsHandler } from "@/pages/api/bots/[id]/backtests";

const request = (method: string, body?: unknown) =>
  ({ method, body, query: { id: "bot" }, cookies: {} }) as unknown as NextApiRequest;
const response = () => { const state = { status: 200, body: undefined as unknown, allow: "" };
  const res = { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; return this; },
    setHeader(_name: string, value: string | number | readonly string[]) { state.allow = String(value); return this; } } as unknown as NextApiResponse;
  return { state, res }; };
const authenticate = async () => "owner";

test("backtest API validates input and returns completed UI payload", async () => {
  const calls: unknown[][] = [];
  const handler = createBacktestsHandler({ runBacktest: { execute: async (...args: unknown[]) => { calls.push(args);
    return { ok: true as const, error: "", status: 200, result: { runId: "run", metrics: {}, fills: [] } }; } } } as never,
  authenticate);
  const invalid = response(); await handler(request("POST", {}), invalid.res); assert.equal(invalid.state.status, 400);
  const completed = response(); await handler(request("POST", { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" }), completed.res);
  assert.equal(completed.state.status, 200); assert.equal(calls.length, 1);
  assert.equal((completed.state.body as { backtest: { runId: string } }).backtest.runId, "run");
  assert.equal(calls[0]?.[4], false);

  const detailed = response(); await handler(request("POST", { from: "2026-01-01T00:00:00Z",
    to: "2026-02-01T00:00:00Z", includeFullTimeline: true }), detailed.res);
  assert.equal(calls[1]?.[4], true);
  const badToggle = response(); await handler(request("POST", { from: "2026-01-01T00:00:00Z",
    to: "2026-02-01T00:00:00Z", includeFullTimeline: "yes" }), badToggle.res);
  assert.equal(badToggle.state.status, 400);
});

test("backtest API enforces method, ownership boundary, and sanitized failures", async () => {
  const method = response(); await createBacktestsHandler({} as never, authenticate)(request("GET"), method.res);
  assert.equal(method.state.status, 405); assert.equal(method.state.allow, "POST");
  const rejected = response(); await createBacktestsHandler({ runBacktest: { execute: async () =>
    ({ ok: false as const, error: "Bot not found", status: 404, result: null }) } } as never, authenticate)(
    request("POST", { from: "2026-01-01", to: "2026-02-01" }), rejected.res);
  assert.equal(rejected.state.status, 404);
  const failed = response(); await createBacktestsHandler({ runBacktest: { execute: async () => {
    throw new Error("database password"); } } } as never, authenticate)(
    request("POST", { from: "2026-01-01", to: "2026-02-01" }), failed.res);
  assert.deepEqual(failed.state.body, { error: { code: "INTERNAL_ERROR", message: "Backtest execution failed" } });
});

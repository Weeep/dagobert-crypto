import assert from "node:assert/strict";
import test from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import { createBacktestAnatomyHandler } from "@/pages/api/backtests";

const request = (method: string) => ({ method, cookies: {} }) as unknown as NextApiRequest;
const response = () => { const state = { status: 200, body: undefined as unknown, allow: "" };
  const res = { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; return this; },
    setHeader(_name: string, value: string | number | readonly string[]) { state.allow = String(value); return this; } } as unknown as NextApiResponse;
  return { state, res }; };

test("backtest anatomy API returns only the authenticated user's grouped history", async () => {
  const calls: string[] = []; const strategies = [{ id: "strategy", name: "RSI", runs: [] }];
  const handler = createBacktestAnatomyHandler({ listForUser: async (userId) => { calls.push(userId); return strategies; } },
    async () => "owner");
  const output = response(); await handler(request("GET"), output.res);
  assert.equal(output.state.status, 200); assert.deepEqual(calls, ["owner"]);
  assert.deepEqual(output.state.body, { strategies });
});

test("backtest anatomy API enforces its method and sanitizes failures", async () => {
  const method = response(); await createBacktestAnatomyHandler({} as never, async () => "owner")(request("POST"), method.res);
  assert.equal(method.state.status, 405); assert.equal(method.state.allow, "GET");
  const failed = response(); await createBacktestAnatomyHandler({ listForUser: async () => { throw new Error("database password"); } },
    async () => "owner")(request("GET"), failed.res);
  assert.equal(failed.state.status, 500);
  assert.deepEqual(failed.state.body, { error: { code: "INTERNAL_ERROR", message: "Backtest history could not be loaded" } });
});

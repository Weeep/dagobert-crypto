import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import { ValidateStrategyDefinitionUseCase } from "@/src/modules/strategy";
import { createValidateStrategyHandler } from "@/pages/api/strategies/validate";
import { createStrategiesHandler } from "@/pages/api/strategies";
import { createStrategyDetailHandler } from "@/pages/api/strategies/[id]";
import { createStrategyVersionsHandler } from "@/pages/api/strategies/[id]/versions";
import { createStrategyVersionDetailHandler } from "@/pages/api/strategies/[id]/versions/[version]";
import { createActivateStrategyVersionHandler } from "@/pages/api/bots/[id]/strategy-version";

const definition = { schemaVersion: 1, name: "API strategy",
  entry: { all: [{ indicator: "RSI", period: 14, operator: "LT", value: 20 }] },
  exit: { all: [{ indicator: "RSI", period: 14, operator: "GTE", value: 80 }] } };
const now = new Date("2026-08-14T12:00:00Z");
const version = { id: "version-id", strategyId: "strategy-id", version: 1, schemaVersion: 1,
  definition, createdAt: now };
const strategy = { id: "strategy-id", userId: "user-id", name: "API strategy", description: "",
  versions: [version], createdAt: now, updatedAt: now };

function response() {
  const state = { status: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = { status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
    setHeader(name: string, value: string | number | readonly string[]) {
      state.headers[name] = Array.isArray(value) ? value.join(", ") : String(value); return this;
    } } as unknown as NextApiResponse;
  return { state, res };
}
const request = (method: string, body?: unknown, query: NextApiRequest["query"] = {}) =>
  ({ method, body, query, cookies: {}, headers: {} }) as NextApiRequest;
const authenticate = async () => "user-id";

describe("strategy API", () => {
  test("requires authentication before strategy validation", async () => {
    const handler = createValidateStrategyHandler(
      { validateStrategyDefinition: new ValidateStrategyDefinitionUseCase() },
      async (_req, res) => { res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }); return null; },
    );
    const unauthorized = response(); await handler(request("POST", { definition }), unauthorized.res);
    assert.equal(unauthorized.state.status, 401);
  });

  test("validates the exact v1 JSON format and returns structured issues", async () => {
    const handler = createValidateStrategyHandler({ validateStrategyDefinition: new ValidateStrategyDefinitionUseCase() }, authenticate);
    const valid = response(); await handler(request("POST", { definition }), valid.res);
    assert.equal(valid.state.status, 200); assert.equal((valid.state.body as { valid: boolean }).valid, true);
    const invalid = response(); await handler(request("POST", { definition: {
      ...definition, entry: { indicator: "RSI", period: 14, operator: "EXEC", value: 20 },
    } }), invalid.res);
    assert.equal(invalid.state.status, 400);
    assert.equal((invalid.state.body as { issues: Array<{ code: string }> }).issues[0].code, "UNSUPPORTED_OPERATOR");
  });

  test("lists and creates authenticated strategies using DTO timestamps", async () => {
    const calls: unknown[] = [];
    const handler = createStrategiesHandler({
      listStrategies: { execute: async () => [strategy] },
      createStrategy: { execute: async (input: unknown) => { calls.push(input); return { ok: true as const, error: "", strategy }; } },
    } as never, authenticate);
    const listed = response(); await handler(request("GET"), listed.res);
    assert.equal(listed.state.status, 200);
    assert.equal((listed.state.body as { strategies: Array<{ createdAt: string }> }).strategies[0].createdAt, now.toISOString());
    const created = response(); await handler(request("POST", { name: "API strategy", definition }), created.res);
    assert.equal(created.state.status, 201); assert.equal(calls.length, 1);
  });

  test("protects strategy and version detail by ownership-aware use cases", async () => {
    const found = createStrategyDetailHandler({ getStrategy: { execute: async () => strategy } } as never, authenticate);
    const foundResponse = response(); await found(request("GET", undefined, { id: "strategy-id" }), foundResponse.res);
    assert.equal(foundResponse.state.status, 200);
    const missing = createStrategyDetailHandler({ getStrategy: { execute: async () => null } } as never, authenticate);
    const missingResponse = response(); await missing(request("GET", undefined, { id: "foreign" }), missingResponse.res);
    assert.equal(missingResponse.state.status, 404);

    const versionHandler = createStrategyVersionDetailHandler({ getStrategyVersion: {
      execute: async (_user: string, _strategy: string, number: number) => number === 1 ? version : null,
    } } as never, authenticate);
    const versionResponse = response(); await versionHandler(request("GET", undefined,
      { id: "strategy-id", version: "1" }), versionResponse.res);
    assert.equal(versionResponse.state.status, 200);
  });

  test("creates owned versions and activates them only through explicit routes", async () => {
    const versions = createStrategyVersionsHandler({ addStrategyVersion: { execute: async () =>
      ({ ok: true as const, error: "", version }) } } as never, authenticate);
    const versionResponse = response(); await versions(request("POST", { definition }, { id: "strategy-id" }), versionResponse.res);
    assert.equal(versionResponse.state.status, 201);

    const activation = createActivateStrategyVersionHandler({ activateStrategyVersion: { execute: async () =>
      ({ ok: false as const, error: "Running bot strategy cannot be changed", bot: null }) } } as never, authenticate);
    const activationResponse = response(); await activation(request("PUT", { strategyVersionId: "version-id" },
      { id: "bot-id" }), activationResponse.res);
    assert.equal(activationResponse.state.status, 409);
    assert.equal((activationResponse.state.body as { error: { code: string } }).error.code, "INVALID_TRANSITION");
  });

  test("returns 405 with Allow and rejects missing request bodies", async () => {
    const validate = createValidateStrategyHandler({ validateStrategyDefinition: new ValidateStrategyDefinitionUseCase() }, authenticate);
    const method = response(); await validate(request("GET"), method.res);
    assert.equal(method.state.status, 405); assert.equal(method.state.headers.Allow, "POST");
    const body = response(); await validate(request("POST", {}), body.res);
    assert.equal(body.state.status, 400);

    const failed = createStrategyDetailHandler({ getStrategy: { execute: async () => {
      throw new Error("database password must not leak");
    } } } as never, authenticate);
    const failure = response(); await failed(request("GET", undefined, { id: "strategy-id" }), failure.res);
    assert.equal(failure.state.status, 500);
    assert.deepEqual(failure.state.body, { error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });
});

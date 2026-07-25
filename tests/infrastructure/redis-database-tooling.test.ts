import assert from "node:assert/strict";
import test from "node:test";
import {
  exportRedisDatabase,
  importRedisDatabase,
  type RedisToolingClient,
  withRedisToolingClient,
} from "@/scripts/kv/redisDatabaseTooling";

type Call = { method: string; arguments: unknown[] };

function createClient(overrides: Partial<RedisToolingClient> = {}) {
  const calls: Call[] = [];
  const client: RedisToolingClient = {
    async scan(cursor) {
      calls.push({ method: "scan", arguments: [cursor] });
      return ["0", []];
    },
    async type(key) {
      calls.push({ method: "type", arguments: [key] });
      return "none";
    },
    async get(key) {
      calls.push({ method: "get", arguments: [key] });
      return null;
    },
    async hgetall(key) {
      calls.push({ method: "hgetall", arguments: [key] });
      return {};
    },
    async lrange(...args) {
      calls.push({ method: "lrange", arguments: args });
      return [];
    },
    async smembers(key) {
      calls.push({ method: "smembers", arguments: [key] });
      return [];
    },
    async zrange(...args) {
      calls.push({ method: "zrange", arguments: args });
      return [];
    },
    async set(...args) {
      calls.push({ method: "set", arguments: args });
      return "OK";
    },
    async sadd(...args) {
      calls.push({ method: "sadd", arguments: args });
      return 1;
    },
    async hset(...args) {
      calls.push({ method: "hset", arguments: args });
      return 1;
    },
    async quit() {
      calls.push({ method: "quit", arguments: [] });
      return "OK";
    },
    ...overrides,
  };
  return { calls, client };
}

test("exportRedisDatabase scans and decodes supported Redis values", async () => {
  const { client } = createClient({
    async scan() {
      return ["0", ["plain", "hash", "set", "list", "zset"]];
    },
    async type(key) {
      return {
        plain: "string",
        hash: "hash",
        set: "set",
        list: "list",
        zset: "zset",
      }[key] ?? "none";
    },
    async get() {
      return "42";
    },
    async hgetall() {
      return { object: '{"enabled":true}', label: "plain text" };
    },
    async smembers() {
      return ['{"id":1}', "plain text"];
    },
    async lrange() {
      return ["true"];
    },
    async zrange() {
      return ["42"];
    },
  });

  assert.deepEqual(await exportRedisDatabase(client), {
    plain: 42,
    hash: { object: { enabled: true }, label: "plain text" },
    set: [{ id: 1 }, "plain text"],
    list: ["true"],
    zset: ["42"],
  });
});

test("importRedisDatabase serializes strings, sets and hashes", async () => {
  const { calls, client } = createClient();

  await importRedisDatabase(client, {
    plain: "value",
    count: 42,
    members: [{ id: 1 }, "text"],
    hash: { object: { enabled: true }, label: "plain text" },
  });

  assert.deepEqual(calls, [
    { method: "set", arguments: ["plain", "value"] },
    { method: "set", arguments: ["count", "42"] },
    { method: "sadd", arguments: ["members", '{"id":1}', '"text"'] },
    {
      method: "hset",
      arguments: [
        "hash",
        "object",
        '{"enabled":true}',
        "label",
        "plain text",
      ],
    },
  ]);
});

test("withRedisToolingClient always closes the connection", async () => {
  for (const shouldFail of [false, true]) {
    const { calls, client } = createClient();
    const operation = async () => {
      if (shouldFail) throw new Error("operation failed");
      return "done";
    };

    if (shouldFail) {
      await assert.rejects(
        withRedisToolingClient(operation, () => client),
        /operation failed/
      );
    } else {
      assert.equal(
        await withRedisToolingClient(operation, () => client),
        "done"
      );
    }

    assert.deepEqual(calls, [{ method: "quit", arguments: [] }]);
  }
});

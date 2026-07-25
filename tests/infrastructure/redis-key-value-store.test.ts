import assert from "node:assert/strict";
import test from "node:test";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import {
  RedisKeyValueStore,
  type RedisClientFactory,
  type RedisConnectionOptions,
} from "@/src/shared/infrastructure/kv/RedisKeyValueStore";

type RedisCall = { method: string; arguments: unknown[] };

function createStore(responses: {
  get?: string | null;
  hget?: string | null;
  hgetall?: Record<string, string>;
}) {
  const calls: RedisCall[] = [];
  let receivedOptions: RedisConnectionOptions | undefined;

  const clientFactory: RedisClientFactory = (options) => {
    receivedOptions = options;
    return {
      async get(...args: [string]) {
        calls.push({ method: "get", arguments: args });
        return responses.get ?? null;
      },
      async set(...args: [string, string]) {
        calls.push({ method: "set", arguments: args });
        return "OK";
      },
      async hget(...args: [string, string]) {
        calls.push({ method: "hget", arguments: args });
        return responses.hget ?? null;
      },
      async hgetall(...args: [string]) {
        calls.push({ method: "hgetall", arguments: args });
        return responses.hgetall ?? {};
      },
      async hset(...args: [string, ...unknown[]]) {
        calls.push({ method: "hset", arguments: args });
        return 1;
      },
      async hdel(...args: [string, string]) {
        calls.push({ method: "hdel", arguments: args });
        return 1;
      },
      async ping() {
        calls.push({ method: "ping", arguments: [] });
        return "PONG";
      },
    } as ReturnType<RedisClientFactory>;
  };

  const options = { host: "redis.test", port: 6380, password: "secret" };
  const store = new RedisKeyValueStore(options, clientFactory);
  return { calls, options, receivedOptions, store };
}

test("RedisKeyValueStore passes explicit connection options to its client", () => {
  const { options, receivedOptions } = createStore({});
  assert.deepEqual(receivedOptions, options);
});

test("RedisKeyValueStore implements string operations and numeric reads", async () => {
  const { calls, store } = createStore({ get: "42" });

  assert.equal(await store.get("answer"), 42);
  assert.equal(await store.set("answer", "forty-two"), "OK");
  assert.deepEqual(calls, [
    { method: "get", arguments: ["answer"] },
    { method: "set", arguments: ["answer", "forty-two"] },
  ]);
});

test("RedisKeyValueStore parses values returned from Redis hashes", async () => {
  const { calls, store } = createStore({
    hget: '{"email":"user@example.com"}',
    hgetall: { bitcoin: '{"price":123}', label: "plain text" },
  });

  assert.deepEqual(await store.hget(KVRoot.users, "user@example.com"), {
    email: "user@example.com",
  });
  assert.deepEqual(await store.hgetall(KVRoot.pairs), {
    bitcoin: { price: 123 },
    label: "plain text",
  });
  assert.deepEqual(calls, [
    { method: "hget", arguments: [KVRoot.users, "user@example.com"] },
    { method: "hgetall", arguments: [KVRoot.pairs] },
  ]);
});

test("RedisKeyValueStore serializes hash writes and delegates deletion", async () => {
  const { calls, store } = createStore({});

  assert.equal(
    await store.hset(KVRoot.pairs, {
      btc: { price: 123 },
      label: "Bitcoin",
      active: true,
    }),
    1
  );
  assert.equal(await store.hdel(KVRoot.pairs, "btc"), 1);
  assert.deepEqual(calls, [
    {
      method: "hset",
      arguments: [
        KVRoot.pairs,
        "btc",
        '{"price":123}',
        "label",
        "Bitcoin",
        "active",
        "true",
      ],
    },
    { method: "hdel", arguments: [KVRoot.pairs, "btc"] },
  ]);
});

test("RedisKeyValueStore exposes the underlying Redis PING", async () => {
  const { calls, store } = createStore({});

  assert.equal(await store.ping(), "PONG");
  assert.deepEqual(calls, [{ method: "ping", arguments: [] }]);
});

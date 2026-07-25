import test, { describe } from "node:test";
import assert from "node:assert/strict";

import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";

type CacheInternals = {
  cache: Record<string, any>;
  isInitialized: boolean;
};

const cacheInternals = ClientSideDbCache as unknown as CacheInternals;
const originalFetch = globalThis.fetch;

function resetCache(cache: Record<string, any> = {}, isInitialized = false): void {
  cacheInternals.cache = cache;
  cacheInternals.isInitialized = isInitialized;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ClientSideDbCache viselkedési szerződés", { concurrency: false }, () => {
  test.beforeEach(() => resetCache());
  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    resetCache();
  });

test("initializeCache egyszer tölti le és változtatás nélkül tárolja a teljes szerveroldali snapshotot", async () => {
  const snapshot = {
    [KVRoot.pairs]: {
      SOLUSDC: { pair: "SOLUSDC", decimals: 4, keyLevels: [100] },
    },
    last_transaction_epoch_spot_SOLUSDC: "1234",
  };
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrls.push(input.toString());
    return jsonResponse({ response: { message: "Cache loaded", cache: snapshot } });
  }) as typeof fetch;

  assert.equal(await ClientSideDbCache.initializeCache(), true);
  assert.equal(await ClientSideDbCache.initializeCache(), true);

  assert.deepEqual(requestedUrls, ["/api/dbapi/admin?action=getcache"]);
  assert.deepEqual(ClientSideDbCache.getCache(), snapshot);
  assert.equal(ClientSideDbCache.isCacheEmpty(), false);
  assert.equal(ClientSideDbCache.get("last_transaction_epoch_spot_SOLUSDC"), "1234");
  assert.deepEqual(ClientSideDbCache.hget(KVRoot.pairs, "SOLUSDC"), snapshot.pairs.SOLUSDC);
  assert.deepEqual(ClientSideDbCache.hgetall(KVRoot.pairs), snapshot.pairs);
});

test("initializeCache 401-nél false eredményt és üres, újrapróbálható cache-t hagy", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ error: "Unauthorized" }, 401);
  }) as typeof fetch;

  assert.equal(await ClientSideDbCache.initializeCache(), false);
  assert.equal(await ClientSideDbCache.initializeCache(), false);
  assert.equal(calls, 2);
  assert.equal(ClientSideDbCache.isCacheEmpty(), true);
});

test("initializeCache hálózati hiba után false eredményt ad és később újrapróbálható", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new Error("network unavailable");
    return jsonResponse({ response: { message: "Cache loaded", cache: { ready: "yes" } } });
  }) as typeof fetch;

  assert.equal(await ClientSideDbCache.initializeCache(), false);
  assert.equal(ClientSideDbCache.isCacheEmpty(), true);
  assert.equal(await ClientSideDbCache.initializeCache(), true);
  assert.equal(ClientSideDbCache.get("ready"), "yes");
});

test("sikeres írás elküldi az API műveletet, majd azonnal frissíti a lokális cache-t", async () => {
  resetCache({
    [KVRoot.pairs]: {
      BTCUSDC: { pair: "BTCUSDC", decimals: 2, keyLevels: [] },
    },
  }, true);
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrls.push(input.toString());
    return jsonResponse({ response: "OK" });
  }) as typeof fetch;
  const pair = { pair: "SOLUSDC", decimals: 4, keyLevels: [100] };

  assert.equal(await ClientSideDbCache.hset(KVRoot.pairs, { SOLUSDC: pair }), true);
  assert.deepEqual(ClientSideDbCache.hget(KVRoot.pairs, "SOLUSDC"), pair);
  assert.equal(await ClientSideDbCache.set("last_epoch", " 1234 "), true);
  assert.equal(ClientSideDbCache.get("last_epoch"), " 1234 ");

  const hsetUrl = new URL(requestedUrls[0], "http://localhost");
  assert.equal(hsetUrl.searchParams.get("action"), "hset");
  assert.equal(hsetUrl.searchParams.get("key"), KVRoot.pairs);
  assert.deepEqual(JSON.parse(hsetUrl.searchParams.get("value")!), { SOLUSDC: pair });
  const setUrl = new URL(requestedUrls[1], "http://localhost");
  assert.equal(setUrl.searchParams.get("action"), "set");
  assert.equal(setUrl.searchParams.get("value"), "1234");
});

test("sikertelen szerveroldali írás nem módosítja az addigi lokális snapshotot", async () => {
  const originalPair = { pair: "SOLUSDC", decimals: 4, keyLevels: [100] };
  resetCache({ [KVRoot.pairs]: { SOLUSDC: originalPair } }, true);
  globalThis.fetch = (async () => jsonResponse({ error: "write failed" }, 500)) as typeof fetch;

  const success = await ClientSideDbCache.hset(KVRoot.pairs, {
    SOLUSDC: { ...originalPair, decimals: 8 },
  });

  assert.equal(success, false);
  assert.strictEqual(ClientSideDbCache.hget(KVRoot.pairs, "SOLUSDC"), originalPair);
});

test("sikeres hash törlés csak a megadott mezőt távolítja el a lokális snapshotból", async () => {
  resetCache({
    [KVRoot.pairs]: {
      SOLUSDC: { pair: "SOLUSDC" },
      BTCUSDC: { pair: "BTCUSDC" },
    },
  }, true);
  globalThis.fetch = (async () => jsonResponse({ response: "OK" })) as typeof fetch;

  assert.equal(await ClientSideDbCache.hdel(KVRoot.pairs, "SOLUSDC"), true);
  assert.equal(ClientSideDbCache.hget(KVRoot.pairs, "SOLUSDC"), null);
  assert.deepEqual(ClientSideDbCache.hget(KVRoot.pairs, "BTCUSDC"), { pair: "BTCUSDC" });
});
});

import assert from "node:assert/strict";
import test from "node:test";
import { RedisHealthCheck } from "@/src/shared/infrastructure/kv/RedisHealthCheck";

test("RedisHealthCheck reports a successful PING response as healthy", async () => {
  const healthCheck = new RedisHealthCheck({
    async ping() {
      return "PONG";
    },
  });

  assert.equal(await healthCheck.isHealthy(), true);
});

test("RedisHealthCheck rejects unexpected PING responses", async () => {
  const healthCheck = new RedisHealthCheck({
    async ping() {
      return "unexpected";
    },
  });

  assert.equal(await healthCheck.isHealthy(), false);
});

test("RedisHealthCheck lets connection failures reach the HTTP boundary", async () => {
  const connectionError = new Error("connection unavailable");
  const healthCheck = new RedisHealthCheck({
    async ping() {
      throw connectionError;
    },
  });

  await assert.rejects(healthCheck.isHealthy(), connectionError);
});

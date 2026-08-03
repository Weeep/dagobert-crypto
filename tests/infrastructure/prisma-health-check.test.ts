import assert from "node:assert/strict";
import test from "node:test";
import { PrismaHealthCheck } from "@/src/shared/infrastructure/prisma/PrismaHealthCheck";

test("PrismaHealthCheck reports a successful PostgreSQL query as healthy", async () => {
  const queries: string[] = [];
  const healthCheck = new PrismaHealthCheck({
    async $queryRaw(query) {
      queries.push(query.join(""));
      return [{ result: 1 }];
    },
  });

  assert.equal(await healthCheck.isHealthy(), true);
  assert.deepEqual(queries, ["SELECT 1"]);
});

test("PrismaHealthCheck lets connection failures reach the HTTP boundary", async () => {
  const connectionError = new Error("connection unavailable");
  const healthCheck = new PrismaHealthCheck({
    async $queryRaw() {
      throw connectionError;
    },
  });

  await assert.rejects(healthCheck.isHealthy(), connectionError);
});

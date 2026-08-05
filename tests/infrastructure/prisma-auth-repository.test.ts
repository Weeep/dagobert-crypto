import assert from "node:assert/strict";
import test from "node:test";
import { PrismaUserCredentialRepository } from "@/src/modules/auth/infrastructure/prisma/PrismaUserCredentialRepository";
import { hashLegacyPassword } from "@/scripts/kv/kvToPostgresMigration";

test("Prisma credential repository verifies migrated password hashes", async () => {
  const passwordHash = await hashLegacyPassword("correct-password");
  const queries: unknown[] = [];
  const repository = new PrismaUserCredentialRepository({
    user: {
      async findUnique(query: unknown) {
        queries.push(query);
        return { passwordHash };
      },
    },
  } as never);

  assert.equal(
    await repository.verifyPasswordByEmail("user@example.com", "correct-password"),
    true
  );
  assert.equal(
    await repository.verifyPasswordByEmail("user@example.com", "wrong-password"),
    false
  );
  assert.deepEqual(queries[0], {
    where: { email: "user@example.com" },
    select: { passwordHash: true },
  });
});

test("Prisma credential repository rejects missing users", async () => {
  const repository = new PrismaUserCredentialRepository({
    user: {
      async findUnique() {
        return null;
      },
    },
  } as never);

  assert.equal(
    await repository.verifyPasswordByEmail("missing@example.com", "password"),
    false
  );
});

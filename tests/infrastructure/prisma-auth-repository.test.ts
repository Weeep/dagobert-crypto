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

test("Prisma credential repository runs a dummy hash check for missing users", async () => {
  const verifications: Array<{ password: string; encoded: string }> = [];
  const repository = new PrismaUserCredentialRepository(
    {
      user: {
        async findUnique() {
          return null;
        },
      },
    } as never,
    async (password, encoded) => {
      verifications.push({ password, encoded });
      return false;
    }
  );

  assert.equal(
    await repository.verifyPasswordByEmail("missing@example.com", "password"),
    false
  );
  assert.equal(verifications.length, 1);
  assert.equal(verifications[0].password, "password");
  assert.match(
    verifications[0].encoded,
    /^scrypt\$v=1\$N=32768\$r=8\$p=1\$/
  );
});

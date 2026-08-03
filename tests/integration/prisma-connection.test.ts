import assert from "node:assert/strict";
import test from "node:test";

test(
  "Prisma connects to PostgreSQL",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { prisma } = await import(
      "@/src/shared/infrastructure/prisma/prisma"
    );
    const result = await prisma.$queryRaw<Array<{ result: number }>>`
      SELECT 1 AS result
    `;

    assert.equal(result[0]?.result, 1);
  }
);

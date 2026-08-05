import { scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const MIGRATED_PASSWORD_HASH_PATTERN =
  /^scrypt\$v=1\$N=(\d+)\$r=(\d+)\$p=(\d+)\$([^$]+)\$([^$]+)$/;

/** Verifies password hashes created from legacy KV plaintext passwords. */
export async function verifyMigratedPasswordHash(
  password: string,
  encoded: string
): Promise<boolean> {
  const match = MIGRATED_PASSWORD_HASH_PATTERN.exec(encoded);
  if (!match) return false;

  const salt = Buffer.from(match[4], "base64");
  const expected = Buffer.from(match[5], "base64");
  const actual = await new Promise<Buffer>((resolve, reject) =>
    nodeScrypt(
      password,
      salt,
      expected.length,
      {
        N: Number(match[1]),
        r: Number(match[2]),
        p: Number(match[3]),
        maxmem: SCRYPT_MAX_MEMORY_BYTES,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    )
  );

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

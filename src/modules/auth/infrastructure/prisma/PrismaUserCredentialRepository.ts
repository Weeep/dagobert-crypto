import type { PrismaClient } from "@prisma/client";
import type { UserCredentialRepository } from "../../application/UserCredentialRepository";
import { verifyMigratedPasswordHash } from "../../application/PasswordHashVerifier";

/** Prisma adapter for authentication against migrated PostgreSQL password hashes. */
export class PrismaUserCredentialRepository implements UserCredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async verifyPasswordByEmail(
    email: string,
    password: string
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });

    if (!user) return false;

    return verifyMigratedPasswordHash(password, user.passwordHash);
  }
}

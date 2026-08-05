import type { PrismaClient } from "@prisma/client";
import type { UserCredentialRepository } from "../../application/UserCredentialRepository";
import { verifyMigratedPasswordHash } from "../../application/PasswordHashVerifier";

const DUMMY_MIGRATED_PASSWORD_HASH =
  "scrypt$v=1$N=32768$r=8$p=1$ZGFnb2JlcnQtYXV0aC1kdQ==$aEwA4i/iksp92NbPCA85xGf8yQyoVSDQuSlpsQGXP60rW3HVsya8XxgEQorE2dtG6vPxBMGuo+D/AaAz9AMBmw==";

type PasswordHashVerifier = (
  password: string,
  encoded: string
) => Promise<boolean>;

/** Prisma adapter for authentication against migrated PostgreSQL password hashes. */
export class PrismaUserCredentialRepository implements UserCredentialRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly verifyPasswordHash: PasswordHashVerifier =
      verifyMigratedPasswordHash
  ) {}

  public async verifyPasswordByEmail(
    email: string,
    password: string
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });

    const passwordHash = user?.passwordHash ?? DUMMY_MIGRATED_PASSWORD_HASH;
    const passwordMatches = await this.verifyPasswordHash(password, passwordHash);

    return user !== null && user !== undefined && passwordMatches;
  }
}

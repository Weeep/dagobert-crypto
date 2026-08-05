import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import type { UserCredentialRepository } from "../../application/UserCredentialRepository";

/**
 * @deprecated Legacy plaintext KV credential adapter. Runtime authentication
 * uses Prisma/PostgreSQL; new features should not add KV support.
 */
export class KvUserCredentialRepository implements UserCredentialRepository {
  constructor(private readonly store: KeyValueStore) {}

  public async verifyPasswordByEmail(
    email: string,
    submittedPassword: string
  ): Promise<boolean> {
    const password = await this.store.hget(KVRoot.users, email);
    return typeof password === "string" && password === submittedPassword;
  }
}

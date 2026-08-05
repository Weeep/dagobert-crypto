import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import type { UserCredentialRepository } from "../../application/UserCredentialRepository";

/** Redis/KV adapter for the authentication credential repository port. */
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

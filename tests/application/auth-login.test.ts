import assert from "node:assert/strict";
import test from "node:test";
import type {
  AuthTokenService,
  UserCredentialRepository,
} from "@/src/modules/auth";
import { LoginUseCase } from "@/src/modules/auth";

class StubCredentialRepository implements UserCredentialRepository {
  constructor(private readonly authenticated: boolean) {}

  async verifyPasswordByEmail(): Promise<boolean> {
    return this.authenticated;
  }
}

class StubTokenService implements AuthTokenService {
  readonly generatedFor: string[] = [];

  generate(email: string): string {
    this.generatedFor.push(email);
    return `token-for-${email}`;
  }

  verify(): string | null {
    return null;
  }
}

test("LoginUseCase authenticates matching credentials and creates a token", async () => {
  const tokens = new StubTokenService();
  const useCase = new LoginUseCase(
    new StubCredentialRepository(true),
    tokens
  );

  assert.deepEqual(
    await useCase.execute({
      email: "user@example.com",
      password: "correct-password",
    }),
    { authenticated: true, token: "token-for-user@example.com" }
  );
  assert.deepEqual(tokens.generatedFor, ["user@example.com"]);
});

test("LoginUseCase rejects failed credential verification without creating a token", async () => {
  const tokens = new StubTokenService();
  const useCase = new LoginUseCase(new StubCredentialRepository(false), tokens);

  assert.deepEqual(
    await useCase.execute({
      email: "user@example.com",
      password: "submitted-password",
    }),
    { authenticated: false }
  );
  assert.deepEqual(tokens.generatedFor, []);
});

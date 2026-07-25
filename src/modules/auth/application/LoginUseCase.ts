import type { LoginDto } from "../dto/LoginDto";
import type { AuthTokenService } from "./AuthTokenService";
import type { UserCredentialRepository } from "./UserCredentialRepository";

export type LoginResult =
  | { authenticated: true; token: string }
  | { authenticated: false };

export class LoginUseCase {
  constructor(
    private readonly credentials: UserCredentialRepository,
    private readonly tokens: AuthTokenService
  ) {}

  public async execute({ email, password }: LoginDto): Promise<LoginResult> {
    const storedPassword = await this.credentials.findPasswordByEmail(email);

    if (storedPassword === null || storedPassword !== password) {
      return { authenticated: false };
    }

    return { authenticated: true, token: this.tokens.generate(email) };
  }
}

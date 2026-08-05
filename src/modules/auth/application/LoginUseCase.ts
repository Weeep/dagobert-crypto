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
    const authenticated = await this.credentials.verifyPasswordByEmail(
      email,
      password
    );

    if (!authenticated) {
      return { authenticated: false };
    }

    return { authenticated: true, token: this.tokens.generate(email) };
  }
}

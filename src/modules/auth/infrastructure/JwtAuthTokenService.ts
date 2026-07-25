import type { AuthTokenService } from "../application/AuthTokenService";
import { generateToken, verifyToken } from "./auth";

export class JwtAuthTokenService implements AuthTokenService {
  public generate(email: string): string {
    return generateToken(email);
  }

  public verify(token: string): string | null {
    return verifyToken(token);
  }
}

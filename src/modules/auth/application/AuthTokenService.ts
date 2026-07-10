export interface AuthTokenService {
  generate(email: string): string;
  verify(token: string): string | null;
}

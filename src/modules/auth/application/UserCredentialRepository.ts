export interface UserCredentialRepository {
  findPasswordByEmail(email: string): Promise<string | null>;
}

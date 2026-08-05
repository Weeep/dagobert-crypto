export interface UserCredentialRepository {
  verifyPasswordByEmail(email: string, password: string): Promise<boolean>;
}

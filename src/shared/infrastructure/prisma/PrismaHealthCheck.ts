export interface PrismaQueryClient {
  $queryRaw(query: TemplateStringsArray): Promise<unknown>;
}

/** Checks the PostgreSQL connection without reading application data. */
export class PrismaHealthCheck {
  constructor(private readonly client: PrismaQueryClient) {}

  public async isHealthy(): Promise<boolean> {
    await this.client.$queryRaw`SELECT 1`;
    return true;
  }
}

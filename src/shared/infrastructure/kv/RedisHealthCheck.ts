export interface RedisPingClient {
  ping(): Promise<string>;
}

/**
 * @deprecated Redis/KV health checks are retained only for legacy migration and
 * comparison tests. New features should use Prisma/PostgreSQL instead.
 *
 * Checks the Redis connection without reading or mutating application data.
 */
export class RedisHealthCheck {
  constructor(private readonly redis: RedisPingClient) {}

  public async isHealthy(): Promise<boolean> {
    return (await this.redis.ping()) === "PONG";
  }
}

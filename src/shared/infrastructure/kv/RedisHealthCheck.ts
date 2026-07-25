export interface RedisPingClient {
  ping(): Promise<string>;
}

/** Checks the Redis connection without reading or mutating application data. */
export class RedisHealthCheck {
  constructor(private readonly redis: RedisPingClient) {}

  public async isHealthy(): Promise<boolean> {
    return (await this.redis.ping()) === "PONG";
  }
}

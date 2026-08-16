import { RateLimiter } from '../core/dispatcher';

export class D1RateLimiter implements RateLimiter {
  constructor(private db: D1Database) {}

  async allow(connectionId: string, requestsPerWindow: number, windowSeconds: number): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    const result = await this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM omnipost_deliveries WHERE connection_id = ? AND created_at >= ?`
      )
      .bind(connectionId, windowStart)
      .first<{ count: number }>();

    const currentCount = result?.count ?? 0;
    return currentCount < requestsPerWindow;
  }
}

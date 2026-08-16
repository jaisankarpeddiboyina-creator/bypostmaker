import { IdempotencyStore } from '../core/dispatcher';

export class D1IdempotencyStore implements IdempotencyStore {
  constructor(private db: D1Database) {}

  async hasSucceeded(postId: string, platformId: string): Promise<boolean> {
    const key = `${postId}:${platformId}`;
    const row = await this.db
      .prepare(`SELECT status FROM omnipost_deliveries WHERE idempotency_key = ?`)
      .bind(key)
      .first<{ status: string }>();

    return row?.status === 'success';
  }

  async markSucceeded(postId: string, platformId: string): Promise<void> {
    const key = `${postId}:${platformId}`;
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .prepare(
        `UPDATE omnipost_deliveries SET status = 'success', updated_at = ? WHERE idempotency_key = ?`
      )
      .bind(now, key)
      .run();
  }
}

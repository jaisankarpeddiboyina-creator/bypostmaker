import { IdempotencyStore } from '../core/dispatcher';

export class D1IdempotencyStore implements IdempotencyStore {
  constructor(private db: D1Database) {}

  /**
   * Check whether this post has already been successfully dispatched.
   *
   * Key format: postId alone (the raw idempotencyKey UUID from the client).
   *
   * Why not `${postId}:${platformId}`?
   * The route (omnipost.ts) stores the delivery row with
   * `idempotency_key = idempotencyKey` (the raw UUID). The D1 table has
   * a UNIQUE constraint on idempotency_key, so one UUID = one delivery row.
   * Using the composite key here would never match the stored row and would
   * silently make the idempotency guard a no-op.
   *
   * @param postId   The raw idempotencyKey UUID, set as `unifiedPost.id` in the route.
   * @param _platformId  Retained in the interface signature but unused here.
   *                     Routing to the correct connection is handled at the
   *                     route level via connectionId, not at the idempotency
   *                     layer.
   */
  async hasSucceeded(postId: string, _platformId: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT status FROM omnipost_deliveries WHERE idempotency_key = ? AND status = 'success' LIMIT 1`)
      .bind(postId)
      .first<{ status: string }>();
    return row !== null;
  }

  /**
   * Mark this post as successfully dispatched.
   * Updates the existing delivery row inserted at request start.
   */
  async markSucceeded(postId: string, _platformId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .prepare(`UPDATE omnipost_deliveries SET status = 'success', updated_at = ? WHERE idempotency_key = ?`)
      .bind(now, postId)
      .run();
  }
}

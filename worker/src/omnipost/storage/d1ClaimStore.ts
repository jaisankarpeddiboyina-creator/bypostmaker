import { ClaimStore } from '../core/dispatcher';

/**
 * D1-backed claim store — safe across all Cloudflare Worker isolates.
 *
 * Claim acquisition uses D1's `INSERT OR IGNORE` on a PRIMARY KEY, which
 * is atomic within a single D1 region. Two concurrent Worker isolates racing
 * on the same claim_key: exactly one gets `changes > 0`, the other gets 0.
 *
 * Future risk: not a true distributed lock if D1 ever becomes cross-region
 * replicated. Acceptable for current single-region D1 architecture.
 * Tracked follow-up: migrate to Durable Objects if cross-region isolation
 * becomes a requirement.
 *
 * Prerequisite: db/migrations/0015_omnipost_claims.sql must be applied.
 */
export class D1ClaimStore implements ClaimStore {
  constructor(private db: D1Database) {}

  async tryClaim(key: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    // Purge any expired claim for this key first so a re-claim after TTL
    // succeeds without waiting for a manual release.
    await this.db
      .prepare(`DELETE FROM omnipost_claims WHERE claim_key = ? AND expires_at <= ?`)
      .bind(key, now)
      .run();

    // Atomic insert — silently no-ops if an active (non-expired) row exists.
    const result = await this.db
      .prepare(`INSERT OR IGNORE INTO omnipost_claims (claim_key, expires_at) VALUES (?, ?)`)
      .bind(key, expiresAt)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }

  async release(key: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM omnipost_claims WHERE claim_key = ?`)
      .bind(key)
      .run();
  }
}

/**
 * In-memory claim store — for local dev / unit tests ONLY.
 *
 * NOT safe across Cloudflare Worker isolates (each isolate has a separate
 * heap). Never use in production. The module-level singleton in omnipost.ts
 * prevents re-creation per request in local dev, but does not help in prod.
 */
export class MemoryClaimStore implements ClaimStore {
  private claims = new Map<string, number>();

  async tryClaim(key: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = this.claims.get(key);
    if (expiresAt && expiresAt > now) return false;
    this.claims.set(key, now + ttlMs);
    return true;
  }

  async release(key: string): Promise<void> {
    this.claims.delete(key);
  }
}

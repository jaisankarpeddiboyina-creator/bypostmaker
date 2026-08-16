import { ClaimStore } from '../core/dispatcher';

export class MemoryClaimStore implements ClaimStore {
  private claims = new Map<string, number>();

  async tryClaim(key: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = this.claims.get(key);
    if (expiresAt && expiresAt > now) {
      return false;
    }
    this.claims.set(key, now + ttlMs);
    return true;
  }

  async release(key: string): Promise<void> {
    this.claims.delete(key);
  }
}

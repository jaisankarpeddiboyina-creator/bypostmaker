/**
 * worker/test/dispatchCore.test.ts
 *
 * Integration tests for the Omnipost dispatch core:
 *   D1ClaimStore, D1IdempotencyStore, and Dispatcher (retry/backoff).
 *
 * Uses Node.js built-in `node:test` (Node 18+) — no additional dependencies.
 * Runs against real class implementations, not re-implementations.
 *
 * D1Database is simulated with a minimal in-process SQLite-compatible stub
 * that faithfully mirrors D1's INSERT OR IGNORE / PRIMARY KEY semantics.
 * No real API calls. No real D1 / Cloudflare credentials.
 *
 * Run: npx tsx --test worker/test/dispatchCore.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { D1ClaimStore, MemoryClaimStore } from '../src/omnipost/storage/d1ClaimStore';
import { D1IdempotencyStore } from '../src/omnipost/storage/d1Idempotency';
import { Dispatcher, ClaimStore, IdempotencyStore, CredentialStore, RateLimiter } from '../src/omnipost/core/dispatcher';
import { AdapterRegistry } from '../src/omnipost/core/registry';
import { EventBus } from '../src/omnipost/core/events';
import { UnifiedPost, PostResult } from '../src/omnipost/core/types';
import { AdapterCredentials } from '../src/omnipost/sdk/PlatformAdapter';
import { BaseAdapter } from '../src/omnipost/sdk/BaseAdapter';
import { AdapterManifest } from '../src/omnipost/sdk/PlatformAdapter';

// ──────────────────────────────────────────────────────────────────────────────
// Minimal D1Database stub — in-process, no network, no secrets.
// Implements only the surface area used by D1ClaimStore and D1IdempotencyStore.
// ──────────────────────────────────────────────────────────────────────────────
interface Row { [col: string]: unknown }

class StubD1 {
  private tables: Map<string, Map<string, Row>> = new Map();

  // Initialize tables with their schemas
  init(tableName: string) {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
  }

  getTable(name: string): Map<string, Row> {
    const t = this.tables.get(name);
    if (!t) throw new Error(`Unknown table: ${name}`);
    return t;
  }

  prepare(sql: string): StubStatement {
    return new StubStatement(sql, this);
  }
}

class StubStatement {
  private args: unknown[] = [];

  constructor(private sql: string, private db: StubD1) {}

  bind(...args: unknown[]): StubStatement {
    this.args = args;
    return this;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const sql = this.sql.trim();

    // DELETE FROM omnipost_claims WHERE claim_key = ? AND expires_at <= ?
    if (/DELETE FROM omnipost_claims WHERE claim_key = \? AND expires_at <= \?/i.test(sql)) {
      const [key, now] = this.args as [string, number];
      const t = this.db.getTable('omnipost_claims');
      const row = t.get(key);
      let changes = 0;
      if (row && (row.expires_at as number) <= now) {
        t.delete(key);
        changes = 1;
      }
      return { meta: { changes } };
    }

    // DELETE FROM omnipost_claims WHERE claim_key = ?
    if (/DELETE FROM omnipost_claims WHERE claim_key = \?$/i.test(sql)) {
      const [key] = this.args as [string];
      const t = this.db.getTable('omnipost_claims');
      const had = t.has(key);
      t.delete(key);
      return { meta: { changes: had ? 1 : 0 } };
    }

    // INSERT OR IGNORE INTO omnipost_claims ...
    if (/INSERT OR IGNORE INTO omnipost_claims/i.test(sql)) {
      const [key, expiresAt] = this.args as [string, number];
      const t = this.db.getTable('omnipost_claims');
      if (t.has(key)) {
        return { meta: { changes: 0 } }; // IGNORE: key exists
      }
      t.set(key, { claim_key: key, expires_at: expiresAt });
      return { meta: { changes: 1 } };
    }

    // UPDATE omnipost_deliveries SET status = 'success' ...
    if (/UPDATE omnipost_deliveries SET status = 'success'/i.test(sql)) {
      const [now, postId] = this.args as [number, string];
      const t = this.db.getTable('omnipost_deliveries');
      const row = t.get(postId);
      if (row) {
        row.status = 'success';
        row.updated_at = now;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    throw new Error(`StubD1: unhandled SQL: ${sql}`);
  }

  async first<T = Row>(): Promise<T | null> {
    const sql = this.sql.trim();

    // SELECT status FROM omnipost_deliveries WHERE idempotency_key = ? AND status = 'success'
    if (/SELECT status FROM omnipost_deliveries WHERE idempotency_key = \? AND status = 'success'/i.test(sql)) {
      const [postId] = this.args as [string];
      const t = this.db.getTable('omnipost_deliveries');
      const row = t.get(postId);
      if (row && row.status === 'success') return row as T;
      return null;
    }

    throw new Error(`StubD1: unhandled first() SQL: ${sql}`);
  }
}

function makeD1(tables: string[]): StubD1 {
  const db = new StubD1();
  for (const t of tables) db.init(t);
  return db;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stub adapter factory — configurable failure mode
// ──────────────────────────────────────────────────────────────────────────────
function makeAdapter(opts: {
  id: string;
  failTimes?: number;        // fail this many attempts then succeed
  retryable?: boolean;       // whether failures are retryable
}): BaseAdapter {
  let callCount = 0;
  const { id, failTimes = 0, retryable = true } = opts;

  const manifest: AdapterManifest = {
    id,
    name: id,
    version: '1.0.0',
    apiVersion: '1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: [],
    compliance: 'official',
    capabilities: {
      text: true, images: false, maxImages: 0, video: false, link: true,
      threads: false, maxChars: 500, polls: false, scheduling: false,
    },
    rateLimit: { requestsPerWindow: 100, windowSeconds: 60 },
  };

  class StubAdapter extends BaseAdapter {
    manifest = manifest;

    format(post: UnifiedPost): unknown {
      return { text: post.text };
    }

    async post(_payload: unknown, _creds: AdapterCredentials): Promise<PostResult> {
      callCount++;
      if (callCount <= failTimes) {
        return { success: false, status: 'failed', error: { code: 'SERVER_ERROR', message: 'Simulated failure', retryable } };
      }
      return { success: true, status: 'success', platformPostId: `post-${id}-${callCount}` };
    }

    async healthCheck(_creds: AdapterCredentials): Promise<{ ok: boolean; latencyMs: number }> {
      return { ok: true, latencyMs: 0 };
    }

    getCallCount() { return callCount; }
  }

  return new StubAdapter();
}

// ──────────────────────────────────────────────────────────────────────────────
// Always-allow rate limiter and always-missing creds (returns provided creds)
// ──────────────────────────────────────────────────────────────────────────────
const alwaysAllow: RateLimiter = {
  allow: async () => true,
};

function makeVault(creds: AdapterCredentials): CredentialStore {
  return {
    get: async () => creds,
  };
}

function makePost(overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return {
    id: `post-${Math.random().toString(36).slice(2)}`,
    userId: 'user-test',
    text: 'Hello from test',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('D1ClaimStore', () => {
  it('TC1: concurrent claim race — first wins, second returns false', async () => {
    const db = makeD1(['omnipost_claims']);
    const store = new D1ClaimStore(db as unknown as D1Database);
    const key = 'test-post:twitter';

    const first = await store.tryClaim(key, 30_000);
    const second = await store.tryClaim(key, 30_000);

    assert.equal(first, true, 'first tryClaim must return true');
    assert.equal(second, false, 'second tryClaim must return false — key already held');

    console.log('  ✓ TC1: first=true, second=false');
  });

  it('TC2: expired claim — new claim succeeds after TTL', async () => {
    const db = makeD1(['omnipost_claims']);
    const store = new D1ClaimStore(db as unknown as D1Database);
    const key = 'expired-post:linkedin';

    // Manually insert an expired row (expires_at in the past)
    const past = Date.now() - 1000;
    const table = (db as any).tables.get('omnipost_claims') as Map<string, any>;
    table.set(key, { claim_key: key, expires_at: past });

    // A new tryClaim should DELETE the expired row and INSERT a fresh one
    const claimed = await store.tryClaim(key, 30_000);

    assert.equal(claimed, true, 'should claim after TTL expiry');
    const row = table.get(key);
    assert.ok(row.expires_at > Date.now(), 'new expires_at should be in the future');

    console.log('  ✓ TC2: expired claim released, new claim acquired');
  });
});

describe('D1IdempotencyStore', () => {
  it('TC3: idempotency key match — postId alone (raw UUID) matches stored key', async () => {
    const db = makeD1(['omnipost_deliveries']);
    const store = new D1IdempotencyStore(db as unknown as D1Database);

    const postId = 'abc-uuid-123';
    // Simulate what the route does: insert the raw UUID as idempotency_key
    const table = (db as any).tables.get('omnipost_deliveries') as Map<string, any>;
    table.set(postId, { idempotency_key: postId, status: 'success' });

    const found = await store.hasSucceeded(postId, 'twitter');
    assert.equal(found, true, 'hasSucceeded must find the row by raw UUID alone');

    // Also confirm that the old composite-key format would NOT have matched
    const notFound = await store.hasSucceeded(`${postId}:twitter`, 'twitter');
    assert.equal(notFound, false, 'composite key must NOT match — proves the old bug was real');

    console.log('  ✓ TC3: postId-only query matches; composite key does not — bug confirmed & fixed');
  });
});

describe('Dispatcher — retry behaviour', () => {
  it('TC4: retry-then-succeed — adapter fails twice (retryable) then succeeds on 3rd attempt', async () => {
    const adapter = makeAdapter({ id: 'tc4-platform', failTimes: 2, retryable: true });
    const registry = new AdapterRegistry();
    registry.register(adapter);

    const db = makeD1(['omnipost_claims', 'omnipost_deliveries']);
    const claimStore = new D1ClaimStore(db as unknown as D1Database);
    const idempotency: IdempotencyStore = {
      hasSucceeded: async () => false,
      markSucceeded: async () => {},
    };

    const creds: AdapterCredentials = { accessToken: 'stub-token', connectionId: 'conn-1' };
    const post = makePost({ userId: 'user-test' });

    const dispatcher = new Dispatcher(registry, new EventBus(), makeVault(creds), idempotency, alwaysAllow, claimStore);
    const result = await dispatcher.dispatch(post, 'tc4-platform');

    assert.equal(result.success, true, 'final result must be success after retries');
    assert.equal((adapter as any).getCallCount(), 3, 'adapter.post() must be called exactly 3 times');

    console.log('  ✓ TC4: retried 2 times, succeeded on attempt 3');
  });

  it('TC5: no retry on permanent error — adapter fails with retryable:false, called once', async () => {
    const adapter = makeAdapter({ id: 'tc5-platform', failTimes: 99, retryable: false });
    const registry = new AdapterRegistry();
    registry.register(adapter);

    const db = makeD1(['omnipost_claims', 'omnipost_deliveries']);
    const claimStore = new D1ClaimStore(db as unknown as D1Database);
    const idempotency: IdempotencyStore = {
      hasSucceeded: async () => false,
      markSucceeded: async () => {},
    };

    const creds: AdapterCredentials = { accessToken: 'stub-token', connectionId: 'conn-2' };
    const post = makePost({ userId: 'user-test' });

    const dispatcher = new Dispatcher(registry, new EventBus(), makeVault(creds), idempotency, alwaysAllow, claimStore);
    const result = await dispatcher.dispatch(post, 'tc5-platform');

    assert.equal(result.success, false, 'result must be failure');
    assert.equal(result.error?.retryable, false, 'error must be non-retryable');
    assert.equal((adapter as any).getCallCount(), 1, 'adapter.post() called exactly once — no retry on permanent error');

    console.log('  ✓ TC5: permanent error, no retry — adapter called once only');
  });
});

describe('Dispatcher — inline vault / connectionId routing', () => {
  it('TC6: inline vault injects correct connectionId into credentials', async () => {
    let capturedCreds: AdapterCredentials | null = null;

    const manifest: AdapterManifest = {
      id: 'tc6-platform', name: 'tc6',
      version: '1.0.0',
      apiVersion: '1',
      minimumCoreVersion: '0.1.0',
      auth: 'oauth2',
      scopes: [],
      compliance: 'official',
      capabilities: { text: true, images: false, maxImages: 0, video: false, link: true, threads: false, maxChars: 500, polls: false, scheduling: false },
      rateLimit: { requestsPerWindow: 100, windowSeconds: 60 },
    };

    class CapturingAdapter extends BaseAdapter {
      manifest = manifest;
      format(post: UnifiedPost) { return { text: post.text }; }
      async post(payload: unknown, creds: AdapterCredentials): Promise<PostResult> {
        capturedCreds = creds;
        return { success: true, status: 'success', platformPostId: 'capture-ok' };
      }
      async healthCheck() { return { ok: true, latencyMs: 0 }; }
    }

    const adapter = new CapturingAdapter();
    const registry = new AdapterRegistry();
    registry.register(adapter);

    const db = makeD1(['omnipost_claims', 'omnipost_deliveries']);
    const claimStore = new D1ClaimStore(db as unknown as D1Database);
    const idempotency: IdempotencyStore = {
      hasSucceeded: async () => false,
      markSucceeded: async () => {},
    };

    const specificConnectionId = 'conn-multi-account-42';
    // Simulate the inline vault exactly as omnipost.ts constructs it:
    // decryptedSecret = JSON.stringify({accessToken, ...}), connectionId injected
    const decryptedSecret = JSON.stringify({ accessToken: 'real-token' });
    const connectionId = specificConnectionId;

    const inlineVault: CredentialStore = {
      get: async (_userId: string, _platformId: string): Promise<AdapterCredentials> => ({
        ...JSON.parse(decryptedSecret),
        connectionId,
      }),
    };

    const dispatcher = new Dispatcher(registry, new EventBus(), inlineVault, idempotency, alwaysAllow, claimStore);
    const post = makePost({ userId: 'user-multi' });
    const result = await dispatcher.dispatch(post, 'tc6-platform');

    assert.equal(result.success, true);
    assert.ok(capturedCreds !== null, 'credentials must be captured by adapter');
    assert.equal(capturedCreds!.connectionId, specificConnectionId, 'connectionId must match the specific connection, not be re-resolved by platform');
    assert.equal(capturedCreds!.accessToken, 'real-token', 'accessToken must be the decrypted value');

    console.log(`  ✓ TC6: connectionId="${capturedCreds!.connectionId}" correctly routed to adapter`);
  });
});

console.log('\n✅ All dispatchCore tests registered. Running...\n');

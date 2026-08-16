import { AdapterRegistry } from './registry';
import { EventBus } from './events';
import { UnifiedPost, PostResult } from './types';
import { AdapterCredentials } from '../sdk/PlatformAdapter';

export interface CredentialStore {
  get(userId: string, platformId: string): Promise<AdapterCredentials>;
}

export interface IdempotencyStore {
  hasSucceeded(postId: string, platformId: string): Promise<boolean>;
  markSucceeded(postId: string, platformId: string): Promise<void>;
}

export interface RateLimiter {
  allow(connectionId: string, requestsPerWindow: number, windowSeconds: number): Promise<boolean>;
}

export interface ClaimStore {
  tryClaim(key: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const CLAIM_TTL_MS = 30_000;

export function validateSSRF(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error('SSRF_REJECTED: Invalid URL format');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('SSRF_REJECTED: Only HTTPS URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();
  
  // Reject IPv4 numeric addresses matching private/loopback/link-local ranges
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 127 || // Loopback
      a === 10 || // Private Class A
      (a === 172 && b >= 16 && b <= 31) || // Private Class B
      (a === 192 && b === 168) || // Private Class C
      (a === 169 && b === 254) // Link-local / Cloud Metadata
    ) {
      throw new Error('SSRF_REJECTED: Direct IP targeting of private/loopback space is forbidden');
    }
  }

  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('SSRF_REJECTED: Internal hostname target is forbidden');
  }
}

export class Dispatcher {
  constructor(
    private registry: AdapterRegistry,
    private bus: EventBus,
    private credentials: CredentialStore,
    private idempotency: IdempotencyStore,
    private rateLimiter: RateLimiter,
    private claims: ClaimStore
  ) {}

  async dispatch(post: UnifiedPost, platformId: string): Promise<PostResult> {
    let adapter;
    try {
      adapter = this.registry.get(platformId);
    } catch (err: any) {
      return this.fail(post, platformId, 'UNKNOWN_PLATFORM', err.message);
    }
    const caps = adapter.manifest.capabilities;
    const claimKey = `${post.id}:${platformId}`;

    if (post.media?.some((m) => m.type === 'video') && !caps.video) {
      return this.fail(post, platformId, 'UNSUPPORTED_MEDIA', 'Platform does not support video');
    }
    const imageCount = post.media?.filter((m) => m.type === 'image' || m.type === 'gif').length ?? 0;
    if (imageCount > 0 && !caps.images) {
      return this.fail(post, platformId, 'UNSUPPORTED_MEDIA', 'Platform does not support images');
    }
    if (caps.maxImages && imageCount > caps.maxImages) {
      return this.fail(post, platformId, 'TOO_MANY_IMAGES', `Exceeds ${caps.maxImages} images`);
    }
    if (caps.maxChars && post.text.length > caps.maxChars && !caps.threads) {
      return this.fail(post, platformId, 'TEXT_TOO_LONG', `Exceeds ${caps.maxChars} chars`);
    }

    if (await this.idempotency.hasSucceeded(post.id, platformId)) {
      return { success: true, status: 'success', platformPostId: 'already-posted' };
    }
    if (!(await this.claims.tryClaim(claimKey, CLAIM_TTL_MS))) {
      return this.fail(post, platformId, 'ALREADY_IN_FLIGHT', 'Duplicate concurrent dispatch for this post');
    }

    try {
      const creds = await this.credentials.get(post.userId, platformId);

      // Perform pre-flight SSRF validation if a webhook URL or instance URL is present
      if (creds.webhookUrl) {
        validateSSRF(creds.webhookUrl);
      }
      if (creds.instanceUrl && typeof creds.instanceUrl === 'string') {
        validateSSRF(creds.instanceUrl);
      }

      const { requestsPerWindow, windowSeconds } = adapter.manifest.rateLimit;
      const rateLimitKey = creds.connectionId || `${post.userId}:${platformId}`;

      if (!(await this.rateLimiter.allow(rateLimitKey, requestsPerWindow, windowSeconds))) {
        await this.claims.release(claimKey);
        return this.fail(post, platformId, 'RATE_LIMITED', 'Rate limit exceeded', true);
      }

      this.bus.emit('beforePost', { post, platformId });

      const result = await this.withTimeout(
        (async () => {
          const payload = adapter.format(post);
          return adapter.post(payload, creds);
        })(),
        DEFAULT_TIMEOUT_MS
      );

      if (result.status === undefined) {
        result.status = result.success ? 'success' : 'failed';
      }

      if (result.status === 'success') {
        await this.idempotency.markSucceeded(post.id, platformId);
        this.bus.emit('afterPost', { post, platformId, result });
      } else if (result.error) {
        this.bus.emit('afterFailure', { post, platformId, error: result.error });
      }
      return result;
    } catch (err) {
      const error = this.normalizeError(err);
      this.bus.emit('afterFailure', { post, platformId, error });
      return { success: false, status: 'failed', error };
    } finally {
      await this.claims.release(claimKey);
    }
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Adapter call exceeded ${ms}ms timeout`)), ms);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }

  private normalizeError(err: unknown): { code: string; message: string; retryable: boolean; raw?: unknown } {
    if (err instanceof Error) {
      const typedCode = (err as { code?: string }).code;
      const isTimeout = err.message.includes('timeout');
      const isSSRF = err.message.includes('SSRF_REJECTED');
      return {
        code: typedCode ?? (isSSRF ? 'SSRF_REJECTED' : isTimeout ? 'TIMEOUT' : 'UNKNOWN'),
        message: err.message,
        retryable: typedCode === 'AUTH_MISSING' || isSSRF ? false : true,
        raw: err,
      };
    }
    if (err && typeof err === 'object') {
      const anyErr = err as Record<string, unknown>;
      return {
        code: typeof anyErr.code === 'string' ? anyErr.code : 'UNKNOWN',
        message: JSON.stringify(err),
        retryable: true,
        raw: err,
      };
    }
    return { code: 'UNKNOWN', message: String(err), retryable: true, raw: err };
  }

  private fail(post: UnifiedPost, platformId: string, code: string, message: string, retryable = false): PostResult {
    const error = { code, message, retryable };
    this.bus.emit('afterFailure', { post, platformId, error });
    return { success: false, status: 'failed', error };
  }
}

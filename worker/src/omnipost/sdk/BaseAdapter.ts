import { PlatformAdapter, AdapterManifest, AdapterCredentials } from './PlatformAdapter';
import { UnifiedPost, PostResult } from '../core/types';

export abstract class BaseAdapter implements PlatformAdapter {
  abstract manifest: AdapterManifest;

  abstract authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials>;
  abstract format(post: UnifiedPost): unknown;
  abstract post(payload: unknown, credentials: AdapterCredentials): Promise<PostResult>;

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    return credentials;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    try {
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false };
    }
  }

  protected truncate(text: string, maxChars?: number): string {
    if (!maxChars || text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1) + '…';
  }
}

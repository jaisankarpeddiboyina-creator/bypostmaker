import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface HackerNewsPayload {
  title: string;
  url?: string;
  text?: string;
}

export class HackerNewsAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'hackernews',
    name: 'Hacker News Adapter',
    version: '1.0.0',
    apiVersion: 'v0',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['submit'],
    capabilities: {
      text: true,
      images: false,
      maxImages: 0,
      video: false,
      link: true,
      threads: false,
      maxChars: 2000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 5,
      windowSeconds: 600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Hacker News requires session user Cookie / auth token');
    }
    return credentials;
  }

  format(post: UnifiedPost): HackerNewsPayload {
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Show HN: PostMaker launch';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    return {
      title: this.truncate(title, 80),
      url: mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) ? mediaUrl : undefined,
      text: !mediaUrl ? this.truncate(bodyText || title, 2000) : undefined,
    };
  }

  async post(payload: HackerNewsPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Hacker News session cookie/token', retryable: false },
      };
    }

    try {
      const body = new URLSearchParams({
        title: payload.title,
        ...(payload.url ? { url: payload.url } : { text: payload.text || '' }),
      });

      const response = await fetch('https://news.ycombinator.com/r', {
        method: 'POST',
        headers: {
          Cookie: credentials.accessToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok && response.status !== 302) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapHackerNewsError(response.status, errorText),
        };
      }

      const postId = `hn-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: `https://news.ycombinator.com/newest`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Hacker News dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  private mapHackerNewsError(status: number, detail: string) {
    if (status === 429 || detail.includes('fast')) {
      return { code: 'RATE_LIMITED', message: `Hacker News posting rate limit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Hacker News unauthorized: ${detail}`, retryable: false };
    }
    return { code: `HN_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface DevToPayload {
  article: {
    title: string;
    body_markdown: string;
    published: boolean;
    main_image?: string;
    tags?: string[];
  };
}

export class DevToAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'devto',
    name: 'dev.to Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['articles'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 100000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 30,
      windowSeconds: 30,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('dev.to requires API key as accessToken');
    }
    return credentials;
  }

  format(post: UnifiedPost): DevToPayload {
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Article Title';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) ? firstMedia.url : undefined;

    return {
      article: {
        title: this.truncate(title, 128),
        body_markdown: bodyText || title,
        published: true,
        ...(mediaUrl ? { main_image: mediaUrl } : {}),
        tags: ['tech', 'postmaker'],
      },
    };
  }

  async post(payload: DevToPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing dev.to API key', retryable: false },
      };
    }

    try {
      const response = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: {
          'api-key': credentials.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapDevToError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: number; url?: string };
      const articleId = resData.id ? String(resData.id) : `devto-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: articleId,
        url: resData.url || `https://dev.to/article/${articleId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'dev.to dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    if (!credentials?.accessToken) {
      return { ok: true, latencyMs: Date.now() - start };
    }

    try {
      const response = await fetch('https://dev.to/api/users/me', {
        method: 'GET',
        headers: { 'api-key': credentials.accessToken },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapDevToError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `dev.to rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `dev.to unauthorized: ${detail}`, retryable: false };
    }
    if (status === 422) {
      return { code: 'VALIDATION_ERROR', message: `dev.to unprocessable article: ${detail}`, retryable: false };
    }
    return { code: `DEVTO_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

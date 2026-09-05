import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface Lemon8Payload {
  content: string;
  images: string[];
}

export class Lemon8Adapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'lemon8',
    name: 'Lemon8 Post Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'basic',
    scopes: ['post:create'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 9,
      video: false,
      link: true,
      threads: false,
      maxChars: 2200,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 20,
      windowSeconds: 3600,
    },
    compliance: 'reverse-engineered',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Lemon8 requires accessToken in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): Lemon8Payload {
    let content = post.text.trim();
    const mediaList = post.media || [];
    const images = mediaList.slice(0, 9).map((m) => m.url);

    if (images.length > 0) {
      for (const img of images) {
        if (!content.includes(img)) {
          content = `${content}\n\n${img}`.trim();
        }
      }
    }

    return {
      content: this.truncate(content, 2200),
      images,
    };
  }

  async post(payload: Lemon8Payload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Lemon8 accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.lemon8-app.com/api/v1/post/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapLemon8Error(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { item_id?: string | number };
      const itemId = resData.item_id ? String(resData.item_id) : `lemon8-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: itemId,
        url: `https://www.lemon8-app.com/post/${itemId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Lemon8 dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  private mapLemon8Error(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Lemon8 rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Lemon8 unauthorized: ${detail}`, retryable: false };
    }
    return { code: `LEMON8_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

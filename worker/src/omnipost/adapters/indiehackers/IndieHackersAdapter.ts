import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface IndieHackersPayload {
  title: string;
  body: string;
  link?: string;
}

export class IndieHackersAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'indiehackers',
    name: 'Indie Hackers Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['post'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 10000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 20,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Indie Hackers requires API Key in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): IndieHackersPayload {
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Indie Hackers Launch Post';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    return {
      title: this.truncate(title, 120),
      body: this.truncate(bodyText || title, 10000),
      link: mediaUrl,
    };
  }

  async post(payload: IndieHackersPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Indie Hackers accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://www.indiehackers.com/api/posts', {
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
          error: this.mapIndieHackersError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string; url?: string };
      const postId = resData.id || `ih-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: resData.url || `https://www.indiehackers.com/post/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Indie Hackers dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  private mapIndieHackersError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Indie Hackers rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Indie Hackers unauthorized: ${detail}`, retryable: false };
    }
    return { code: `IH_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

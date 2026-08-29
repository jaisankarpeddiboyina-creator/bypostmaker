import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface SubstackPayload {
  publicationUrl: string;
  draft: {
    title: string;
    subtitle?: string;
    body: string;
  };
}

export class SubstackAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'substack',
    name: 'Substack Editorial Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['publish'],
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
      requestsPerWindow: 20,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Substack requires email / API credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): SubstackPayload {
    const publicationUrl = post.targetId || 'https://mySubstack.substack.com';
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Substack Newsletter';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    let fullBody = bodyText || title;
    if (mediaUrl && !fullBody.includes(mediaUrl)) {
      fullBody = `${fullBody}\n\n![Cover](${mediaUrl})`;
    }

    return {
      publicationUrl,
      draft: {
        title: this.truncate(title, 120),
        subtitle: this.truncate(bodyText, 200),
        body: fullBody,
      },
    };
  }

  async post(payload: SubstackPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Substack credentials', retryable: false },
      };
    }

    try {
      const response = await fetch(`${payload.publicationUrl}/api/v1/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload.draft),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapSubstackError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: number; canonical_url?: string };
      const postId = resData.id ? String(resData.id) : `sub-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: resData.canonical_url || `${payload.publicationUrl}/p/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Substack dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  private mapSubstackError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Substack rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Substack unauthorized: ${detail}`, retryable: false };
    }
    return { code: `SUBSTACK_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

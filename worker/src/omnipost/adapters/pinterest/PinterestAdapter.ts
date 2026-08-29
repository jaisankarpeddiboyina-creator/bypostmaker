import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshPinterestToken } from './oauth';

export interface PinterestPayload {
  board_id: string;
  title: string;
  description: string;
  link?: string;
  media_source?: {
    source_type: 'image_url';
    url: string;
  };
}

export class PinterestAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'pinterest',
    name: 'Pinterest Adapter',
    version: '1.0.0',
    apiVersion: 'v5',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['boards:read', 'pins:read', 'pins:write'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: true,
      link: true,
      threads: false,
      maxChars: 500,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 1000,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Pinterest requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshPinterestToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): PinterestPayload {
    const boardId = post.targetId || 'default-board-id';
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Pin Title';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    title = this.truncate(title, 100);
    const description = this.truncate(bodyText || title, 500);

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) ? firstMedia.url : undefined;

    return {
      board_id: boardId,
      title,
      description,
      ...(mediaUrl ? { media_source: { source_type: 'image_url', url: mediaUrl } } : {}),
      ...(mediaUrl ? { link: mediaUrl } : {}),
    };
  }

  async post(payload: PinterestPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.pinterest.com/v5/pins', {
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
          error: this.mapPinterestError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string; link?: string };
      const pinId = resData.id || `pin-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: pinId,
        url: resData.link || `https://www.pinterest.com/pin/${pinId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Pinterest dispatch failure',
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
      const response = await fetch('https://api.pinterest.com/v5/user_account', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapPinterestError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Pinterest rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Pinterest forbidden: ${detail}`, retryable: false };
    }
    if (status === 400 || status === 404) {
      return { code: 'INVALID_TARGET', message: `Pinterest board or pin invalid: ${detail}`, retryable: false };
    }
    return { code: `PINTEREST_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

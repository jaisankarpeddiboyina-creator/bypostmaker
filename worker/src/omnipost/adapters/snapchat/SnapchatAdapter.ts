import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshSnapchatToken } from './oauth';

export interface SnapchatPayload {
  snap: {
    caption?: string;
    attachment_url?: string;
  };
}

export class SnapchatAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'snapchat',
    name: 'Snapchat Creative Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['https://auth.snapchat.com/oauth2/api/snap.creative_kit'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: true,
      link: true,
      threads: false,
      maxChars: 250,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 100,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Snapchat requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshSnapchatToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): SnapchatPayload {
    const caption = this.truncate(post.text.trim(), 250);
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const attachmentUrl = firstMedia?.url;

    return {
      snap: {
        caption: caption || undefined,
        attachment_url: attachmentUrl,
      },
    };
  }

  async post(payload: SnapchatPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Snapchat accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://kit.snapchat.com/v1/snaps', {
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
          error: this.mapSnapchatError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string };
      const snapId = resData.id || `snap-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: snapId,
        url: `https://www.snapchat.com`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Snapchat dispatch failure',
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
      const response = await fetch('https://kit.snapchat.com/v1/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapSnapchatError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Snapchat rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Snapchat unauthorized: ${detail}`, retryable: false };
    }
    return { code: `SNAPCHAT_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

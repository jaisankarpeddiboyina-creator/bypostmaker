import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshTwitchToken } from './oauth';

export interface TwitchPayload {
  broadcasterId: string;
  title: string;
}

export class TwitchAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'twitch',
    name: 'Twitch Channel Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['channel:manage:broadcast', 'user:read:email'],
    capabilities: {
      text: true,
      images: false,
      maxImages: 0,
      video: false,
      link: true,
      threads: false,
      maxChars: 140,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 800,
      windowSeconds: 60,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Twitch requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (credentials.refreshToken && credentials.clientId && credentials.clientSecret) {
      return refreshTwitchToken(
        credentials,
        credentials.clientId as string,
        credentials.clientSecret as string
      );
    }
    return credentials;
  }

  format(post: UnifiedPost): TwitchPayload {
    const broadcasterId = post.targetId || '';
    let text = post.text.trim();
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) && !text.includes(mediaUrl)) {
      text = `${text}\n\n${mediaUrl}`.trim();
    }

    return {
      broadcasterId,
      title: this.truncate(text, 140),
    };
  }

  async post(payload: TwitchPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Twitch accessToken', retryable: false },
      };
    }

    const clientId = (credentials.clientId as string) || '';

    try {
      const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${payload.broadcasterId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Client-Id': clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: payload.title }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapTwitchError(response.status, errorText),
        };
      }

      const postId = payload.broadcasterId || `twitch-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: `https://twitch.tv/broadcast/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Twitch dispatch failure',
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

    const clientId = (credentials.clientId as string) || '';

    try {
      const response = await fetch('https://api.twitch.tv/helix/users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Client-Id': clientId,
        },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapTwitchError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Twitch rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Twitch unauthorized: ${detail}`, retryable: false };
    }
    return { code: `TWITCH_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

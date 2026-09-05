import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface ClubhousePayload {
  topic: string;
  is_social_mode: boolean;
}

export class ClubhouseAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'clubhouse',
    name: 'Clubhouse Social Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['create_channel'],
    capabilities: {
      text: true,
      images: false,
      maxImages: 0,
      video: false,
      link: false,
      threads: false,
      maxChars: 300,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 10,
      windowSeconds: 3600,
    },
    compliance: 'reverse-engineered',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const token = credentials.accessToken || credentials.apiKey;
    if (!token) {
      throw new Error('Clubhouse requires accessToken or apiKey in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): ClubhousePayload {
    const text = post.text.trim();
    return {
      topic: this.truncate(text, 300),
      is_social_mode: true,
    };
  }

  async post(payload: ClubhousePayload, credentials: AdapterCredentials): Promise<PostResult> {
    const token = credentials.accessToken || credentials.apiKey;
    if (!token) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Clubhouse auth token', retryable: false },
      };
    }

    try {
      const response = await fetch('https://www.clubhouseapi.com/api/create_channel', {
        method: 'POST',
        headers: {
          'CH-AppVersion': '0.0.57',
          'CH-Languages': 'en-US',
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapClubhouseError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { channel?: { channel_id?: string | number } };
      const channelId = resData.channel?.channel_id ? String(resData.channel.channel_id) : `ch-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: channelId,
        url: `https://www.clubhouse.com/room/${channelId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Clubhouse dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    const token = credentials?.accessToken || credentials?.apiKey;
    if (!token) {
      return { ok: true, latencyMs: Date.now() - start };
    }

    try {
      const response = await fetch('https://www.clubhouseapi.com/api/me', {
        method: 'GET',
        headers: {
          'CH-AppVersion': '0.0.57',
          'CH-Languages': 'en-US',
          Authorization: `Token ${token}`,
        },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapClubhouseError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Clubhouse rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Clubhouse unauthorized: ${detail}`, retryable: false };
    }
    return { code: `CLUBHOUSE_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

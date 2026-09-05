import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface BetaListPayload {
  startup: {
    name: string;
    pitch: string;
    url?: string;
  };
}

export class BetaListAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'betalist',
    name: 'BetaList Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['startups:write'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 500,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 10,
      windowSeconds: 86400,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('BetaList requires API Key in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): BetaListPayload {
    let name = post.title?.trim();
    let pitch = post.text.trim();

    if (!name) {
      const lines = pitch.split('\n').filter((l) => l.trim().length > 0);
      name = lines.length > 0 ? lines[0] : 'Beta Product Launch';
      if (lines.length > 1) {
        pitch = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    return {
      startup: {
        name: this.truncate(name, 50),
        pitch: this.truncate(pitch || name, 250),
        url: mediaUrl,
      },
    };
  }

  async post(payload: BetaListPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing BetaList accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.betalist.com/v1/startups', {
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
          error: this.mapBetaListError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string; url?: string };
      const startupId = resData.id || `bl-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: startupId,
        url: resData.url || `https://betalist.com/startups/${startupId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'BetaList dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  private mapBetaListError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `BetaList rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `BetaList unauthorized: ${detail}`, retryable: false };
    }
    return { code: `BETALIST_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

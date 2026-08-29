import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshTwitterToken } from './oauth';

export interface TwitterPayload {
  text: string;
}

export class TwitterAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'twitter',
    name: 'X / Twitter Adapter',
    version: '1.0.0',
    apiVersion: 'v2',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 4,
      video: true,
      link: true,
      threads: false,
      maxChars: 280,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 200,
      windowSeconds: 900,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Twitter requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshTwitterToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): TwitterPayload {
    let fullText = post.text.trim();
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;

    // Preserving external links if present
    if (firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) && !fullText.includes(firstMedia.url)) {
      fullText = `${fullText}\n${firstMedia.url}`.trim();
    }

    return {
      text: this.truncate(fullText, 280),
    };
  }

  async post(payload: TwitterPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: payload.text }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapTwitterError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as {
        data?: {
          id?: string;
          text?: string;
        };
      };

      const tweetId = resData.data?.id || `tweet-${Date.now()}`;
      return {
        success: true,
        status: 'success',
        platformPostId: tweetId,
        url: `https://x.com/i/status/${tweetId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Twitter dispatch failure',
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
      const response = await fetch('https://api.twitter.com/2/users/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapTwitterError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Twitter rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Twitter unauthorized or forbidden: ${detail}`, retryable: false };
    }
    if (status === 400) {
      return { code: 'VALIDATION_ERROR', message: `Twitter payload invalid: ${detail}`, retryable: false };
    }
    return { code: `TWITTER_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

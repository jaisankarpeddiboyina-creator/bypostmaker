import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshFacebookToken } from './oauth';

export interface FacebookPayload {
  targetId: string;
  message: string;
  link?: string;
}

export class FacebookAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'facebook',
    name: 'Facebook Page Adapter',
    version: '1.0.0',
    apiVersion: 'v19.0',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 10,
      video: true,
      link: true,
      threads: false,
      maxChars: 63206,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 200,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Facebook requires Page Access Token in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.accessToken) {
      return refreshFacebookToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): FacebookPayload {
    const targetId = post.targetId || 'me';
    const message = this.truncate(post.text.trim(), 63206);
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const link = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) ? firstMedia.url : undefined;

    return {
      targetId,
      message,
      link,
    };
  }

  async post(payload: FacebookPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Facebook Page access token', retryable: false },
      };
    }

    try {
      const endpoint = `https://graph.facebook.com/v19.0/${payload.targetId}/feed`;
      const body: Record<string, string> = {
        message: payload.message,
        access_token: credentials.accessToken,
      };

      if (payload.link) {
        body.link = payload.link;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapFacebookError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string };
      const postId = resData.id || `fb-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: `https://www.facebook.com/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Facebook dispatch failure',
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
      const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${credentials.accessToken}`, {
        method: 'GET',
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapFacebookError(status: number, detail: string) {
    if (status === 429 || detail.includes('32')) {
      return { code: 'RATE_LIMITED', message: `Facebook rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403 || detail.includes('190')) {
      return { code: 'FORBIDDEN', message: `Facebook unauthorized or Page access token expired: ${detail}`, retryable: false };
    }
    if (status === 400 || detail.includes('100')) {
      return { code: 'VALIDATION_ERROR', message: `Facebook message payload error: ${detail}`, retryable: false };
    }
    return { code: `FACEBOOK_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

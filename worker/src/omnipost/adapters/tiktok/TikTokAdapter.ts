import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshTikTokToken } from './oauth';

export interface TikTokPayload {
  post_info: {
    title: string;
    privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
    disable_duet?: boolean;
    disable_stitch?: boolean;
    disable_comment?: boolean;
  };
  source_info: {
    source: 'PULL_FROM_URL';
    video_url: string;
  };
}

export class TikTokAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'tiktok',
    name: 'TikTok Content Adapter',
    version: '1.0.0',
    apiVersion: 'v2',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['user.info.basic', 'video.upload', 'video.publish'],
    capabilities: {
      text: true,
      images: false,
      maxImages: 0,
      video: true,
      link: false,
      threads: false,
      maxChars: 2200,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 10,
      windowSeconds: 60,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('TikTok requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshTikTokToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): TikTokPayload {
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const videoUrl = firstMedia?.url || '';
    let title = post.text.trim();

    if (videoUrl && !title.includes(videoUrl) && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
      title = `${title}\n\n${videoUrl}`.trim();
    }

    return {
      post_info: {
        title: this.truncate(title, 2200),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    };
  }

  async post(payload: TikTokPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing TikTok accessToken', retryable: false },
      };
    }

    if (!payload.source_info?.video_url) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'TikTok requires a video or photo; text-only posts are not supported.',
          retryable: false,
        },
      };
    }

    try {
      const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapTikTokError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as {
        data?: { publish_id?: string };
        error?: { code?: string; message?: string };
      };

      if (resData.error && resData.error.code !== 'ok') {
        return {
          success: false,
          status: 'failed',
          error: { code: 'TIKTOK_API_ERROR', message: resData.error.message || 'TikTok API error', retryable: false },
        };
      }

      const publishId = resData.data?.publish_id || `tt-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: publishId,
        url: `https://www.tiktok.com`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'TikTok dispatch failure',
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
      const response = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapTikTokError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `TikTok rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `TikTok unauthorized or access token invalid: ${detail}`, retryable: false };
    }
    if (status === 400) {
      return { code: 'VALIDATION_ERROR', message: `TikTok payload format error: ${detail}`, retryable: false };
    }
    return { code: `TIKTOK_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

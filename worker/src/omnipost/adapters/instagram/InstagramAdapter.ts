import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshInstagramToken } from './oauth';

export interface InstagramPayload {
  igUserId: string;
  caption: string;
  mediaUrl?: string;
  isVideo?: boolean;
}

export class InstagramAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'instagram',
    name: 'Instagram Adapter',
    version: '1.0.0',
    apiVersion: 'v19.0',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 10,
      video: true,
      link: false,
      threads: false,
      maxChars: 2200,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 25,
      windowSeconds: 86400,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Instagram requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.accessToken) {
      return refreshInstagramToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): InstagramPayload {
    const igUserId = post.targetId || 'me';
    let caption = post.text.trim();
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;
    const isVideo = firstMedia?.type === 'video';

    // Preserving link in caption if present and not already in text
    if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) && !caption.includes(mediaUrl)) {
      caption = `${caption}\n\n${mediaUrl}`.trim();
    }

    return {
      igUserId,
      caption: this.truncate(caption, 2200),
      mediaUrl,
      isVideo,
    };
  }

  async post(payload: InstagramPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Instagram accessToken', retryable: false },
      };
    }

    if (!payload.mediaUrl) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'VALIDATION_ERROR', message: 'Instagram posts require an image or video URL', retryable: false },
      };
    }

    try {
      // Step 1: Create Container
      const containerBody: Record<string, string> = {
        caption: payload.caption,
        access_token: credentials.accessToken,
      };

      if (payload.isVideo) {
        containerBody.media_type = 'REELS';
        containerBody.video_url = payload.mediaUrl;
      } else {
        containerBody.image_url = payload.mediaUrl;
      }

      const containerRes = await fetch(`https://graph.facebook.com/v19.0/${payload.igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
      });

      if (!containerRes.ok) {
        const errorText = await containerRes.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapInstagramError(containerRes.status, errorText),
        };
      }

      const containerData = (await containerRes.json()) as { id?: string };
      const creationId = containerData.id;

      if (!creationId) {
        return {
          success: false,
          status: 'failed',
          error: { code: 'INSTAGRAM_CONTAINER_FAILED', message: 'Failed to obtain container creation_id', retryable: true },
        };
      }

      // Step 2: Publish Container
      const publishRes = await fetch(`https://graph.facebook.com/v19.0/${payload.igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: credentials.accessToken,
        }),
      });

      if (!publishRes.ok) {
        const errorText = await publishRes.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapInstagramError(publishRes.status, errorText),
        };
      }

      const publishData = (await publishRes.json()) as { id?: string };
      const mediaId = publishData.id || creationId;

      return {
        success: true,
        status: 'success',
        platformPostId: mediaId,
        url: `https://www.instagram.com/p/${mediaId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Instagram dispatch failure',
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

  private mapInstagramError(status: number, detail: string) {
    if (status === 429 || detail.includes('2207001')) {
      return { code: 'RATE_LIMITED', message: `Instagram publishing limit reached: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403 || detail.includes('190')) {
      return { code: 'FORBIDDEN', message: `Instagram access token invalid or expired: ${detail}`, retryable: false };
    }
    if (status === 400 || detail.includes('100')) {
      return { code: 'VALIDATION_ERROR', message: `Instagram media aspect ratio or image payload error: ${detail}`, retryable: false };
    }
    return { code: `INSTAGRAM_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

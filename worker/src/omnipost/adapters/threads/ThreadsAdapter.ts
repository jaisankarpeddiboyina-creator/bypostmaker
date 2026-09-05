import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshThreadsToken } from './oauth';

export interface ThreadsPayload {
  userId: string;
  media_type: 'TEXT' | 'IMAGE' | 'VIDEO';
  text: string;
  image_url?: string;
  video_url?: string;
}

export class ThreadsAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'threads',
    name: 'Threads Adapter',
    version: '1.0.0',
    apiVersion: 'v1.0',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['threads_basic', 'threads_content_publish'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 10,
      video: true,
      link: true,
      threads: false,
      maxChars: 500,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 250,
      windowSeconds: 86400,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Threads requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (credentials.accessToken) {
      return refreshThreadsToken(credentials);
    }
    return credentials;
  }

  format(post: UnifiedPost): ThreadsPayload {
    const userId = post.targetId || 'me';
    let text = post.text.trim();
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;
    const isVideo = firstMedia?.type === 'video';

    if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) && !text.includes(mediaUrl)) {
      text = `${text}\n\n${mediaUrl}`.trim();
    }

    let media_type: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT';
    if (mediaUrl) {
      media_type = isVideo ? 'VIDEO' : 'IMAGE';
    }

    return {
      userId,
      media_type,
      text: this.truncate(text, 500),
      image_url: !isVideo ? mediaUrl : undefined,
      video_url: isVideo ? mediaUrl : undefined,
    };
  }

  async post(payload: ThreadsPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Threads accessToken', retryable: false },
      };
    }

    try {
      // Step 1: Create Container
      const containerBody: Record<string, string> = {
        media_type: payload.media_type,
        text: payload.text,
        access_token: credentials.accessToken,
      };

      if (payload.image_url) containerBody.image_url = payload.image_url;
      if (payload.video_url) containerBody.video_url = payload.video_url;

      const containerRes = await fetch(`https://graph.threads.net/v1.0/${payload.userId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
      });

      if (!containerRes.ok) {
        const errorText = await containerRes.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapThreadsError(containerRes.status, errorText),
        };
      }

      const containerData = (await containerRes.json()) as { id?: string };
      const creationId = containerData.id;

      if (!creationId) {
        return {
          success: false,
          status: 'failed',
          error: { code: 'THREADS_CONTAINER_FAILED', message: 'Failed to obtain container creation_id', retryable: true },
        };
      }

      // Step 2: Publish Container
      const publishRes = await fetch(`https://graph.threads.net/v1.0/${payload.userId}/threads_publish`, {
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
          error: this.mapThreadsError(publishRes.status, errorText),
        };
      }

      const publishData = (await publishRes.json()) as { id?: string };
      const mediaId = publishData.id || creationId;

      return {
        success: true,
        status: 'success',
        platformPostId: mediaId,
        url: `https://www.threads.net/post/${mediaId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Threads dispatch failure',
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
      const response = await fetch(`https://graph.threads.net/v1.0/me?access_token=${credentials.accessToken}`, {
        method: 'GET',
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapThreadsError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Threads rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Threads unauthorized: ${detail}`, retryable: false };
    }
    return { code: `THREADS_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

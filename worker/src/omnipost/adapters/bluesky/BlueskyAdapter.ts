import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshBlueskyToken } from './oauth';

export interface BlueskyPayload {
  repo: string;
  collection: 'app.bsky.feed.post';
  record: {
    $type: 'app.bsky.feed.post';
    text: string;
    createdAt: string;
  };
}

export class BlueskyAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'bluesky',
    name: 'Bluesky ATProto Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'basic',
    scopes: ['atproto'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 4,
      video: false,
      link: true,
      threads: false,
      maxChars: 300,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 5000,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Bluesky requires accessJwt in accessToken');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (credentials.refreshToken) {
      return refreshBlueskyToken(credentials);
    }
    return credentials;
  }

  format(post: UnifiedPost): BlueskyPayload {
    const did = post.targetId || 'did:plc:UNKNOWN';
    let text = post.text.trim();
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) && !text.includes(mediaUrl)) {
      text = `${text}\n\n${mediaUrl}`.trim();
    }

    return {
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: this.truncate(text, 300),
        createdAt: new Date().toISOString(),
      },
    };
  }

  async post(payload: BlueskyPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Bluesky accessJwt', retryable: false },
      };
    }

    try {
      const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
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
          error: this.mapBlueskyError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { uri?: string; cid?: string };
      const uri = resData.uri || `at://${payload.repo}/app.bsky.feed.post/${Date.now()}`;
      const postId = uri.split('/').pop() || `bsky-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: `https://bsky.app/profile/${payload.repo}/post/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Bluesky dispatch failure',
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
      const response = await fetch('https://bsky.social/xrpc/com.atproto.server.getSession', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapBlueskyError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Bluesky rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 400) {
      return { code: 'FORBIDDEN', message: `Bluesky invalid credentials or payload error: ${detail}`, retryable: false };
    }
    return { code: `BLUESKY_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

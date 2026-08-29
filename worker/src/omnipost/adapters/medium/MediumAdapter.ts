import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshMediumToken } from './oauth';

export interface MediumPayload {
  authorId: string;
  title: string;
  contentFormat: 'markdown';
  content: string;
  publishStatus: 'public';
}

export class MediumAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'medium',
    name: 'Medium Publishing Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['basicProfile', 'publishPost'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 100000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 100,
      windowSeconds: 86400,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Medium requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshMediumToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): MediumPayload {
    const authorId = post.targetId || 'me';
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Medium Article';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    let content = `# ${title}\n\n${bodyText || title}`;
    if (mediaUrl && !content.includes(mediaUrl)) {
      content = `${content}\n\n![Cover Image](${mediaUrl})`;
    }

    return {
      authorId,
      title: this.truncate(title, 100),
      contentFormat: 'markdown',
      content,
      publishStatus: 'public',
    };
  }

  async post(payload: MediumPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Medium accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch(`https://api.medium.com/v1/users/${payload.authorId}/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: payload.title,
          contentFormat: payload.contentFormat,
          content: payload.content,
          publishStatus: payload.publishStatus,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapMediumError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { data?: { id?: string; url?: string } };
      const postId = resData.data?.id || `med-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: resData.data?.url || `https://medium.com/p/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Medium dispatch failure',
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
      const response = await fetch('https://api.medium.com/v1/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapMediumError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Medium rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Medium unauthorized: ${detail}`, retryable: false };
    }
    return { code: `MEDIUM_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

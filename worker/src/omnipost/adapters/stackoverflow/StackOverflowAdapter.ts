import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface StackOverflowPayload {
  title: string;
  body: string;
  tags: string[];
  site: 'stackoverflow';
}

export class StackOverflowAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'stackoverflow',
    name: 'Stack Overflow Adapter',
    version: '1.0.0',
    apiVersion: 'v2.3',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['write_access', 'no_expiry'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 30000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 30,
      windowSeconds: 86400,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Stack Overflow requires accessToken in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): StackOverflowPayload {
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Technical Question Title';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    if (mediaUrl && !bodyText.includes(mediaUrl)) {
      bodyText = `${bodyText}\n\n![Screenshot](${mediaUrl})`;
    }

    return {
      title: this.truncate(title, 150),
      body: this.truncate(bodyText || title, 30000),
      tags: ['javascript', 'postmaker'],
      site: 'stackoverflow',
    };
  }

  async post(payload: StackOverflowPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Stack Overflow accessToken', retryable: false },
      };
    }

    try {
      const key = (credentials.targetId as string) || 'default-so-key';
      const body = new URLSearchParams({
        access_token: credentials.accessToken,
        key,
        site: payload.site,
        title: payload.title,
        body: payload.body,
        tags: payload.tags.join(';'),
      });

      const response = await fetch('https://api.stackexchange.com/2.3/questions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapStackOverflowError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { items?: Array<{ question_id: number; link: string }> };
      const q = resData.items && resData.items.length > 0 ? resData.items[0] : undefined;
      const questionId = q ? String(q.question_id) : `so-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: questionId,
        url: q?.link || `https://stackoverflow.com/questions/${questionId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Stack Overflow dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  private mapStackOverflowError(status: number, detail: string) {
    if (status === 429 || detail.includes('throttle_violation')) {
      return { code: 'RATE_LIMITED', message: `Stack Overflow rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Stack Overflow unauthorized: ${detail}`, retryable: false };
    }
    return { code: `SO_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

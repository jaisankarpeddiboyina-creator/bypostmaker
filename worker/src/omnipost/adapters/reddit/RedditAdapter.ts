import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { REDDIT_USER_AGENT, refreshRedditToken } from './oauth';

export interface RedditPayload {
  sr: string;
  kind: 'self' | 'link';
  title: string;
  text?: string;
  url?: string;
  api_type: 'json';
  resubmit?: boolean;
}

export class RedditAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'reddit',
    name: 'Reddit Platform Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['identity', 'submit', 'read'],
    capabilities: {
      text: true,
      images: false,
      maxImages: 0,
      video: false,
      link: true,
      threads: false,
      maxChars: 40000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 100,
      windowSeconds: 600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Reddit requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;

    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshRedditToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): RedditPayload {
    const rawSubreddit = post.targetId || 'test';
    const sr = rawSubreddit.replace(/^r\//i, '').trim() || 'test';

    let title = post.title?.trim();
    let bodyText = post.text.trim();

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const hasExternalLink = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://'));

    // Option (a): When a post has both text and media/link URL, convert to link post ('kind: link')
    // and fold the text caption into the title (truncated to 300 chars), preserving the media link URL.
    if (hasExternalLink) {
      if (!title) {
        title = bodyText || 'Link Post';
      }
      title = this.truncate(title, 300);

      return {
        sr,
        kind: 'link',
        title,
        url: firstMedia!.url,
        api_type: 'json',
        resubmit: true,
      };
    }

    // Text-only self post ('kind: self')
    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Post';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    title = this.truncate(title, 300);

    return {
      sr,
      kind: 'self',
      title,
      text: this.truncate(bodyText || title, 40000),
      api_type: 'json',
    };
  }

  async post(payload: RedditPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing accessToken', retryable: false },
      };
    }

    const formBody = new URLSearchParams({
      api_type: 'json',
      sr: payload.sr,
      kind: payload.kind,
      title: payload.title,
    });

    if (payload.kind === 'self' && payload.text) {
      formBody.append('text', payload.text);
    }
    if (payload.kind === 'link' && payload.url) {
      formBody.append('url', payload.url);
      formBody.append('resubmit', 'true');
    }

    try {
      const response = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': (credentials.userAgent as string) || REDDIT_USER_AGENT,
        },
        body: formBody.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: {
            code: `HTTP_${response.status}`,
            message: errorText || `Reddit API status ${response.status}`,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }

      const resData = (await response.json()) as {
        json?: {
          errors?: Array<[string, string, string]>;
          data?: {
            id?: string;
            name?: string;
            url?: string;
          };
        };
      };

      const jsonObj = resData.json;
      if (jsonObj?.errors && jsonObj.errors.length > 0) {
        const [errType, errDetail, errField] = jsonObj.errors[0];
        const normalized = this.mapRedditError(errType, errDetail, errField);
        return {
          success: false,
          status: 'failed',
          error: normalized,
        };
      }

      const postData = jsonObj?.data;
      const postId = postData?.name || postData?.id || `reddit-${Date.now()}`;
      const postUrl = postData?.url || `https://reddit.com/r/${payload.sr}/comments/${postId.replace(/^t3_/, '')}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: postUrl,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Network dispatch failure',
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
      const response = await fetch('https://oauth.reddit.com/api/v1/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'User-Agent': (credentials.userAgent as string) || REDDIT_USER_AGENT,
        },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapRedditError(type: string, detail: string, _field?: string) {
    const code = type.toUpperCase();
    const msg = detail || type;

    if (code === 'RATELIMIT') {
      return { code: 'RATE_LIMITED', message: msg, retryable: true };
    }
    if (code === 'BAD_SR_NAME' || code === 'SUBREDDIT_NOEXIST') {
      return { code: 'INVALID_SUBREDDIT', message: `Subreddit does not exist: ${msg}`, retryable: false };
    }
    if (code === 'SUBREDDIT_NOTALLOWED' || code === 'USER_REQUIRED') {
      return { code: 'FORBIDDEN', message: `Banned or unauthorized for subreddit: ${msg}`, retryable: false };
    }
    if (code === 'NO_TEXT' || code === 'REQUIRES_FLAIR') {
      return { code: 'VALIDATION_ERROR', message: `Reddit rule requirement failed: ${msg}`, retryable: false };
    }
    return { code: `REDDIT_${code}`, message: msg, retryable: false };
  }
}

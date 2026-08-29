import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface GitHubPayload {
  owner: string;
  repo: string;
  title: string;
  body: string;
}

export class GitHubAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'github',
    name: 'GitHub Adapter',
    version: '1.0.0',
    apiVersion: 'v3',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['repo', 'public_repo', 'write:discussion'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 65536,
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
      throw new Error('GitHub requires accessToken in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): GitHubPayload {
    const rawTarget = post.targetId || 'owner/repo';
    const [owner, repo] = rawTarget.split('/');

    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Issue Title';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) ? firstMedia.url : undefined;

    let fullBody = bodyText || title;
    if (mediaUrl && !fullBody.includes(mediaUrl)) {
      fullBody = `${fullBody}\n\n![Image](${mediaUrl})`;
    }

    return {
      owner: owner || 'owner',
      repo: repo || 'repo',
      title: this.truncate(title, 256),
      body: fullBody,
    };
  }

  async post(payload: GitHubPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing GitHub accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${payload.owner}/${payload.repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'PostMakerApp/1.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: payload.title, body: payload.body }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapGitHubError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { number?: number; html_url?: string };
      const issueNumber = resData.number ? String(resData.number) : `gh-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: issueNumber,
        url: resData.html_url || `https://github.com/${payload.owner}/${payload.repo}/issues/${issueNumber}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'GitHub dispatch failure',
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
      const response = await fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'User-Agent': 'PostMakerApp/1.0',
        },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapGitHubError(status: number, detail: string) {
    if (status === 403 || status === 429) {
      return { code: 'RATE_LIMITED', message: `GitHub rate limit or forbidden: ${detail}`, retryable: status === 429 };
    }
    if (status === 404) {
      return { code: 'INVALID_TARGET', message: `GitHub repository not found: ${detail}`, retryable: false };
    }
    if (status === 422) {
      return { code: 'VALIDATION_ERROR', message: `GitHub payload validation failed: ${detail}`, retryable: false };
    }
    return { code: `GITHUB_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

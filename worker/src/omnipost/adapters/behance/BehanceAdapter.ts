import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface BehancePayload {
  name: string;
  description: string;
  fields: string[];
  covers?: Array<{ url: string }>;
}

export class BehanceAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'behance',
    name: 'Behance Project Adapter',
    version: '1.0.0',
    apiVersion: 'v2',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['project_publish'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 4,
      video: false,
      link: true,
      threads: false,
      maxChars: 3000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 150,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const key = credentials.apiKey || credentials.accessToken;
    if (!key) {
      throw new Error('Behance requires apiKey or accessToken in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): BehancePayload {
    const name = this.truncate((post.title || post.text.split('\n')[0] || 'Untitled Project').trim(), 100);
    let description = post.text.trim();

    const mediaList = post.media || [];
    const covers = mediaList.slice(0, 4).map((m) => ({ url: m.url }));

    if (covers.length > 0) {
      for (const cover of covers) {
        if (!description.includes(cover.url)) {
          description = `${description}\n\n${cover.url}`.trim();
        }
      }
    }

    return {
      name,
      description: this.truncate(description, 3000),
      fields: ['Graphic Design'],
      covers: covers.length > 0 ? covers : undefined,
    };
  }

  async post(payload: BehancePayload, credentials: AdapterCredentials): Promise<PostResult> {
    const apiKey = credentials.apiKey || credentials.accessToken;
    if (!apiKey) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Behance API key', retryable: false },
      };
    }

    try {
      const response = await fetch(`https://api.behance.net/v2/projects?api_key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapBehanceError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { project?: { id?: number | string; url?: string } };
      const projectId = resData.project?.id ? String(resData.project.id) : `project-${Date.now()}`;
      const url = resData.project?.url || `https://www.behance.net/gallery/${projectId}/project`;

      return {
        success: true,
        status: 'success',
        platformPostId: projectId,
        url,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Behance dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    const apiKey = credentials?.apiKey || credentials?.accessToken;
    if (!apiKey) {
      return { ok: true, latencyMs: Date.now() - start };
    }

    try {
      const response = await fetch(`https://api.behance.net/v2/users/me?api_key=${apiKey}`, {
        method: 'GET',
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapBehanceError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Behance rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Behance unauthorized: ${detail}`, retryable: false };
    }
    return { code: `BEHANCE_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

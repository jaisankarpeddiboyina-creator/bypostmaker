import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface DribbblePayload {
  title: string;
  description: string;
  image?: string;
}

export class DribbbleAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'dribbble',
    name: 'Dribbble Shot Adapter',
    version: '1.0.0',
    apiVersion: 'v2',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['public', 'upload'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 1200,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 60,
      windowSeconds: 60,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Dribbble requires accessToken in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): DribbblePayload {
    const rawTitle = post.title || post.text.split('\n')[0] || 'Untitled Shot';
    const title = this.truncate(rawTitle.trim(), 100);
    let description = post.text.trim();
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const image = firstMedia?.url;

    if (image && (image.startsWith('http://') || image.startsWith('https://')) && !description.includes(image)) {
      description = `${description}\n\n${image}`.trim();
    } else if (!image && !description.includes('(No image attached)')) {
      description = `${description}\n\n(No image attached)`.trim();
    }

    return {
      title,
      description: this.truncate(description, 1200),
      image,
    };
  }

  async post(payload: DribbblePayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Dribbble accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.dribbble.com/v2/shots', {
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
          error: this.mapDribbbleError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: number | string; html_url?: string };
      const shotId = resData.id ? String(resData.id) : `shot-${Date.now()}`;
      const url = resData.html_url || `https://dribbble.com/shots/${shotId}`;

      return {
        success: true,
        status: 'success',
        platformPostId: shotId,
        url,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Dribbble dispatch failure',
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
      const response = await fetch('https://api.dribbble.com/v2/user', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapDribbbleError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Dribbble rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Dribbble unauthorized: ${detail}`, retryable: false };
    }
    return { code: `DRIBBBLE_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

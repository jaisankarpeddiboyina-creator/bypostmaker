import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface ProductHuntPayload {
  query: string;
  variables: {
    name: string;
    tagline: string;
    url?: string;
  };
}

export class ProductHuntAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'producthunt',
    name: 'Product Hunt Adapter',
    version: '1.0.0',
    apiVersion: 'v2',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['public', 'private'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 300,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 200,
      windowSeconds: 900,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Product Hunt requires accessToken in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): ProductHuntPayload {
    let name = post.title?.trim();
    let tagline = post.text.trim();

    if (!name) {
      const lines = tagline.split('\n').filter((l) => l.trim().length > 0);
      name = lines.length > 0 ? lines[0] : 'Product Launch';
      if (lines.length > 1) {
        tagline = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    const mutation = `
      mutation PostLaunch($name: String!, $tagline: String!) {
        postCreate(input: { name: $name, tagline: $tagline }) {
          node {
            id
            url
          }
        }
      }
    `;

    return {
      query: mutation,
      variables: {
        name: this.truncate(name, 60),
        tagline: this.truncate(tagline || name, 140),
        url: mediaUrl,
      },
    };
  }

  async post(payload: ProductHuntPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Product Hunt accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
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
          error: this.mapProductHuntError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as {
        data?: { postCreate?: { node?: { id: string; url: string } } };
      };

      const node = resData.data?.postCreate?.node;
      const postId = node?.id || `ph-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: node?.url || `https://www.producthunt.com/posts/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Product Hunt dispatch failure',
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
      const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: '{ viewer { user { id username } } }' }),
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapProductHuntError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Product Hunt rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Product Hunt unauthorized: ${detail}`, retryable: false };
    }
    return { code: `PRODUCTHUNT_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

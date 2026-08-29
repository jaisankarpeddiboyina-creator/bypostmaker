import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface HashnodePayload {
  query: string;
  variables: {
    input: {
      title: string;
      contentMarkdown: string;
      publicationId: string;
      coverImageOptions?: { coverImageURL: string };
    };
  };
}

export class HashnodeAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'hashnode',
    name: 'Hashnode Adapter',
    version: '1.0.0',
    apiVersion: 'v2',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['publish_post'],
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
      requestsPerWindow: 50,
      windowSeconds: 60,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Hashnode requires Personal Token as accessToken');
    }
    return credentials;
  }

  format(post: UnifiedPost): HashnodePayload {
    const publicationId = post.targetId || 'default-pub-id';
    let title = post.title?.trim();
    let bodyText = post.text.trim();

    if (!title) {
      const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
      title = lines.length > 0 ? lines[0] : 'Hashnode Article';
      if (lines.length > 1) {
        bodyText = lines.slice(1).join('\n').trim();
      }
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) ? firstMedia.url : undefined;

    const mutation = `
      mutation PublishPost($input: PublishPostInput!) {
        publishPost(input: $input) {
          post {
            id
            slug
            url
          }
        }
      }
    `;

    return {
      query: mutation,
      variables: {
        input: {
          title: this.truncate(title, 200),
          contentMarkdown: bodyText || title,
          publicationId,
          ...(mediaUrl ? { coverImageOptions: { coverImageURL: mediaUrl } } : {}),
        },
      },
    };
  }

  async post(payload: HashnodePayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Hashnode access token', retryable: false },
      };
    }

    try {
      const response = await fetch('https://gql.hashnode.com', {
        method: 'POST',
        headers: {
          Authorization: credentials.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapHashnodeError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as {
        data?: {
          publishPost?: {
            post?: { id: string; slug: string; url: string };
          };
        };
        errors?: Array<{ message: string }>;
      };

      if (resData.errors && resData.errors.length > 0) {
        return {
          success: false,
          status: 'failed',
          error: { code: 'HASHNODE_GQL_ERROR', message: resData.errors[0].message, retryable: false },
        };
      }

      const postObj = resData.data?.publishPost?.post;
      const postId = postObj?.id || `hashnode-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: postObj?.url || `https://hashnode.com/post/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Hashnode dispatch failure',
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
      const response = await fetch('https://gql.hashnode.com', {
        method: 'POST',
        headers: {
          Authorization: credentials.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: '{ me { id username } }' }),
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapHashnodeError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Hashnode rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Hashnode unauthorized: ${detail}`, retryable: false };
    }
    return { code: `HASHNODE_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

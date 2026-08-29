import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshLinkedInToken } from './oauth';

export interface LinkedInPayload {
  author: string;
  lifecycleState: 'PUBLISHED';
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: string };
      shareMediaCategory: 'NONE' | 'ARTICLE';
      media?: Array<{
        status: 'READY';
        originalUrl: string;
      }>;
    };
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC';
  };
}

export class LinkedInAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'linkedin',
    name: 'LinkedIn Adapter',
    version: '1.0.0',
    apiVersion: 'v2',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['w_member_social', 'openid', 'profile'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 9,
      video: true,
      link: true,
      threads: false,
      maxChars: 3000,
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
      throw new Error('LinkedIn requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshLinkedInToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): LinkedInPayload {
    const authorUrn = post.targetId || 'urn:li:person:UNKNOWN';
    const text = this.truncate(post.text.trim(), 3000);
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const hasExternalLink = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://'));

    if (hasExternalLink) {
      return {
        author: authorUrn.startsWith('urn:li:') ? authorUrn : `urn:li:person:${authorUrn}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'ARTICLE',
            media: [
              {
                status: 'READY',
                originalUrl: firstMedia!.url,
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };
    }

    return {
      author: authorUrn.startsWith('urn:li:') ? authorUrn : `urn:li:person:${authorUrn}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };
  }

  async post(payload: LinkedInPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapLinkedInError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string };
      const postId = resData.id || `urn:li:share:${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: `https://www.linkedin.com/feed/update/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'LinkedIn dispatch failure',
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
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapLinkedInError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `LinkedIn rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `LinkedIn forbidden: ${detail}`, retryable: false };
    }
    if (status === 422 || status === 400) {
      return { code: 'VALIDATION_ERROR', message: `LinkedIn validation error: ${detail}`, retryable: false };
    }
    return { code: `LINKEDIN_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface MastodonPayload {
  status: string;
  media_ids?: string[];
  sensitive?: boolean;
}

export class MastodonAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'mastodon',
    name: 'Mastodon Federated Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['read', 'write:statuses', 'write:media'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 4,
      video: true,
      link: true,
      threads: false,
      maxChars: 500,
      polls: true,
      scheduling: true,
    },
    rateLimit: {
      requestsPerWindow: 30,
      windowSeconds: 300,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken || !credentials.instanceUrl) {
      throw new Error('Mastodon requires accessToken and instanceUrl in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): MastodonPayload {
    return {
      status: this.truncate(post.text, 500),
    };
  }

  async post(payload: MastodonPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken || !credentials.instanceUrl) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing accessToken or instanceUrl', retryable: false },
      };
    }

    const baseUrl = (credentials.instanceUrl as string).replace(/\/$/, '');

    try {
      const response = await fetch(`${baseUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          status: 'failed',
          error: {
            code: `HTTP_${response.status}`,
            message: text || `Mastodon API status ${response.status}`,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }

      const data = (await response.json()) as { id: string; url?: string };
      return {
        success: true,
        status: 'success',
        platformPostId: data.id,
        url: data.url,
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
}

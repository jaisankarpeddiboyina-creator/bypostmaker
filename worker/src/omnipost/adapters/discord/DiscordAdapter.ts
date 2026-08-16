import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface DiscordPayload {
  content: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    image?: { url: string };
  }>;
}

export class DiscordAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'discord',
    name: 'Discord Webhook Adapter',
    version: '1.0.0',
    apiVersion: 'v10',
    minimumCoreVersion: '0.1.0',
    auth: 'webhook',
    scopes: ['webhooks'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 10,
      video: false,
      link: true,
      threads: false,
      maxChars: 2000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 5,
      windowSeconds: 2,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.webhookUrl) {
      throw new Error('Discord requires a webhookUrl in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): DiscordPayload {
    const payload: DiscordPayload = {
      content: this.truncate(post.text, 2000),
    };

    if (post.media && post.media.length > 0) {
      payload.embeds = post.media.slice(0, 10).map((m) => ({
        image: { url: m.url },
      }));
    }

    return payload;
  }

  async post(payload: DiscordPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.webhookUrl) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing webhookUrl', retryable: false },
      };
    }

    try {
      const response = await fetch(credentials.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 204 || response.ok) {
        return {
          success: true,
          status: 'success',
          platformPostId: `discord-${Date.now()}`,
        };
      }

      const text = await response.text();
      return {
        success: false,
        status: 'failed',
        error: {
          code: `HTTP_${response.status}`,
          message: text || `Discord webhook returned status ${response.status}`,
          retryable: response.status >= 500 || response.status === 429,
        },
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

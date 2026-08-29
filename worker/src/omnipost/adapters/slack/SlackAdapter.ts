import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface SlackPayload {
  text: string;
  channel?: string;
  blocks?: Array<{
    type: string;
    text?: { type: string; text: string };
    image_url?: string;
    alt_text?: string;
  }>;
}

export class SlackAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'slack',
    name: 'Slack Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'webhook',
    scopes: ['chat:write', 'incoming-webhook'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 40000,
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
    if (!credentials.accessToken && !credentials.webhookUrl) {
      throw new Error('Slack requires accessToken or webhookUrl in credentials');
    }
    return credentials;
  }

  format(post: UnifiedPost): SlackPayload {
    const text = this.truncate(post.text.trim(), 40000);
    const channel = post.targetId || undefined;
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;

    if (firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://'))) {
      return {
        text,
        channel,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text },
          },
          {
            type: 'image',
            image_url: firstMedia.url,
            alt_text: 'Post Image',
          },
        ],
      };
    }

    return {
      text,
      channel,
    };
  }

  async post(payload: SlackPayload, credentials: AdapterCredentials): Promise<PostResult> {
    const webhookUrl = (credentials.webhookUrl as string | undefined) || (credentials.accessToken?.startsWith('https://') ? credentials.accessToken : undefined);

    try {
      if (webhookUrl) {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            success: false,
            status: 'failed',
            error: this.mapSlackError(response.status, errorText),
          };
        }

        return {
          success: true,
          status: 'success',
          platformPostId: `slack-webhook-${Date.now()}`,
          url: webhookUrl,
        };
      }

      if (credentials.accessToken) {
        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            success: false,
            status: 'failed',
            error: this.mapSlackError(response.status, errorText),
          };
        }

        const resData = (await response.json()) as { ok?: boolean; ts?: string; error?: string };
        if (!resData.ok) {
          return {
            success: false,
            status: 'failed',
            error: { code: 'SLACK_ERROR', message: resData.error || 'Slack API error', retryable: false },
          };
        }

        return {
          success: true,
          status: 'success',
          platformPostId: resData.ts || `slack-${Date.now()}`,
          url: `https://slack.com`,
        };
      }

      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Slack credentials', retryable: false },
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Slack dispatch failure',
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
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapSlackError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Slack rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Slack unauthorized: ${detail}`, retryable: false };
    }
    return { code: `SLACK_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

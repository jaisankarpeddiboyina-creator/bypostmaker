import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface TelegramPayload {
  chat_id: string;
  text?: string;
  caption?: string;
  photo?: string;
  parse_mode: 'HTML';
}

export class TelegramAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'telegram',
    name: 'Telegram Bot Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['bot'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: true,
      link: true,
      threads: false,
      maxChars: 4096,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 30,
      windowSeconds: 1,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Telegram requires Bot Token as accessToken');
    }
    return credentials;
  }

  format(post: UnifiedPost): TelegramPayload {
    const chatId = post.targetId || '@mychannel';
    const text = this.truncate(post.text.trim(), 4096);
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia && (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) ? firstMedia.url : undefined;

    if (mediaUrl) {
      return {
        chat_id: chatId,
        photo: mediaUrl,
        caption: this.truncate(text, 1024),
        parse_mode: 'HTML',
      };
    }

    return {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
  }

  async post(payload: TelegramPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing bot token in accessToken', retryable: false },
      };
    }

    const endpoint = payload.photo ? 'sendPhoto' : 'sendMessage';

    try {
      const response = await fetch(`https://api.telegram.org/bot${credentials.accessToken}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapTelegramError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
        description?: string;
      };

      if (!resData.ok) {
        return {
          success: false,
          status: 'failed',
          error: { code: 'TELEGRAM_ERROR', message: resData.description || 'Telegram API failure', retryable: false },
        };
      }

      const messageId = resData.result?.message_id || Date.now();
      return {
        success: true,
        status: 'success',
        platformPostId: String(messageId),
        url: `https://t.me/${payload.chat_id.replace(/^@/, '')}/${messageId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Telegram dispatch failure',
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
      const response = await fetch(`https://api.telegram.org/bot${credentials.accessToken}/getMe`, {
        method: 'GET',
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapTelegramError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Telegram rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 400 || status === 404) {
      return { code: 'INVALID_TARGET', message: `Telegram chat_id or token invalid: ${detail}`, retryable: false };
    }
    if (status === 403) {
      return { code: 'FORBIDDEN', message: `Telegram bot forbidden or kicked from channel: ${detail}`, retryable: false };
    }
    return { code: `TELEGRAM_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

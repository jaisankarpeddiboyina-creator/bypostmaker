import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface WhatsAppPayload {
  phoneNumberId: string;
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image';
  text?: { body: string };
  image?: { link: string; caption?: string };
}

export class WhatsAppAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'whatsapp',
    name: 'WhatsApp Business Adapter',
    version: '1.0.0',
    apiVersion: 'v19.0',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['whatsapp_business_messaging'],
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
      requestsPerWindow: 80,
      windowSeconds: 1,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('WhatsApp requires System Access Token in accessToken');
    }
    return credentials;
  }

  format(post: UnifiedPost): WhatsAppPayload {
    const phoneNumberId = post.targetId || 'default-phone-number-id';
    const recipientPhone = post.targetId || '1234567890';
    const text = this.truncate(post.text.trim(), 4096);
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
      return {
        phoneNumberId,
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'image',
        image: {
          link: mediaUrl,
          caption: text,
        },
      };
    }

    return {
      phoneNumberId,
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: { body: text },
    };
  }

  async post(payload: WhatsAppPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing WhatsApp accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${payload.phoneNumberId}/messages`, {
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
          error: this.mapWhatsAppError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { messages?: Array<{ id: string }> };
      const msgId = resData.messages && resData.messages.length > 0 ? resData.messages[0].id : `wa-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: msgId,
        url: `https://wa.me/${payload.to}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'WhatsApp dispatch failure',
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
      const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${credentials.accessToken}`, {
        method: 'GET',
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapWhatsAppError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `WhatsApp rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `WhatsApp access token invalid or expired: ${detail}`, retryable: false };
    }
    return { code: `WHATSAPP_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

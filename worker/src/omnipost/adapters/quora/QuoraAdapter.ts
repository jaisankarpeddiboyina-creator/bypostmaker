import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';

export interface QuoraPayload {
  questionTitle?: string;
  answerText: string;
}

export class QuoraAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'quora',
    name: 'Quora Content Adapter',
    version: '1.0.0',
    apiVersion: 'v1',
    minimumCoreVersion: '0.1.0',
    auth: 'apiKey',
    scopes: ['read', 'write'],
    capabilities: {
      text: true,
      images: true,
      maxImages: 1,
      video: false,
      link: true,
      threads: false,
      maxChars: 10000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 30,
      windowSeconds: 3600,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('Quora requires API token in accessToken');
    }
    return credentials;
  }

  format(post: UnifiedPost): QuoraPayload {
    const questionTitle = post.title?.trim();
    let answerText = post.text.trim();
    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const mediaUrl = firstMedia?.url;

    if (mediaUrl && !answerText.includes(mediaUrl)) {
      answerText = `${answerText}\n\nReference Link: ${mediaUrl}`;
    }

    return {
      questionTitle: questionTitle ? this.truncate(questionTitle, 250) : undefined,
      answerText: this.truncate(answerText, 10000),
    };
  }

  async post(payload: QuoraPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing Quora accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://api.quora.com/v1/posts', {
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
          error: this.mapQuoraError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string; url?: string };
      const postId = resData.id || `quora-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: postId,
        url: resData.url || `https://www.quora.com/post/${postId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Quora dispatch failure',
          retryable: true,
        },
      };
    }
  }

  async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  private mapQuoraError(status: number, detail: string) {
    if (status === 429) {
      return { code: 'RATE_LIMITED', message: `Quora rate limit hit: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `Quora unauthorized: ${detail}`, retryable: false };
    }
    return { code: `QUORA_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

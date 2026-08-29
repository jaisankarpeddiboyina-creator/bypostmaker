import { BaseAdapter } from '../../sdk/BaseAdapter';
import { AdapterManifest, AdapterCredentials } from '../../sdk/PlatformAdapter';
import { UnifiedPost, PostResult } from '../../core/types';
import { refreshYouTubeShortsToken } from './oauth';

export interface YouTubeShortsPayload {
  snippet: {
    title: string;
    description: string;
    tags?: string[];
  };
  status: {
    privacyStatus: 'public' | 'private' | 'unlisted';
  };
  videoUrl?: string;
}

export class YouTubeShortsAdapter extends BaseAdapter {
  manifest: AdapterManifest = {
    id: 'youtubeshorts',
    name: 'YouTube Shorts Adapter',
    version: '1.0.0',
    apiVersion: 'v3',
    minimumCoreVersion: '0.1.0',
    auth: 'oauth2',
    scopes: ['https://www.googleapis.com/auth/youtube.upload'],
    capabilities: {
      text: true,
      images: false,
      maxImages: 0,
      video: true,
      link: true,
      threads: false,
      maxChars: 5000,
      polls: false,
      scheduling: false,
    },
    rateLimit: {
      requestsPerWindow: 10000,
      windowSeconds: 86400,
    },
    compliance: 'official-api',
  };

  async authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    if (!credentials.accessToken) {
      throw new Error('YouTube Shorts requires accessToken in credentials');
    }
    return credentials;
  }

  async refreshAuth(credentials: AdapterCredentials): Promise<AdapterCredentials> {
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (clientId && clientSecret && credentials.refreshToken) {
      return refreshYouTubeShortsToken(credentials, clientId, clientSecret);
    }
    return credentials;
  }

  format(post: UnifiedPost): YouTubeShortsPayload {
    let title = post.title?.trim() || post.text.trim().split('\n')[0] || 'Shorts Video';
    if (!title.includes('#Shorts') && !title.includes('#shorts')) {
      title = `${title} #Shorts`;
    }

    let description = post.text.trim();
    if (!description.includes('#Shorts') && !description.includes('#shorts')) {
      description = `${description}\n\n#Shorts`;
    }

    const firstMedia = post.media && post.media.length > 0 ? post.media[0] : undefined;
    const videoUrl = firstMedia?.url;

    return {
      snippet: {
        title: this.truncate(title, 100),
        description: this.truncate(description, 5000),
        tags: ['Shorts', 'PostMaker'],
      },
      status: {
        privacyStatus: 'public',
      },
      videoUrl,
    };
  }

  async post(payload: YouTubeShortsPayload, credentials: AdapterCredentials): Promise<PostResult> {
    if (!credentials.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: { code: 'AUTH_MISSING', message: 'Missing YouTube Shorts accessToken', retryable: false },
      };
    }

    try {
      const response = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: payload.snippet,
          status: payload.status,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'failed',
          error: this.mapYouTubeShortsError(response.status, errorText),
        };
      }

      const resData = (await response.json()) as { id?: string };
      const videoId = resData.id || `shorts-${Date.now()}`;

      return {
        success: true,
        status: 'success',
        platformPostId: videoId,
        url: `https://www.youtube.com/shorts/${videoId}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'YouTube Shorts dispatch failure',
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
      const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  private mapYouTubeShortsError(status: number, detail: string) {
    if (status === 429 || detail.includes('quotaExceeded')) {
      return { code: 'RATE_LIMITED', message: `YouTube Shorts API quota exceeded: ${detail}`, retryable: true };
    }
    if (status === 401 || status === 403) {
      return { code: 'FORBIDDEN', message: `YouTube Shorts unauthorized: ${detail}`, retryable: false };
    }
    return { code: `YOUTUBE_SHORTS_HTTP_${status}`, message: detail, retryable: status >= 500 };
  }
}

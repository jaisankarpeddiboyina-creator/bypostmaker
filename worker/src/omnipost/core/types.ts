export interface UnifiedPost {
  id: string;
  userId: string;
  text: string;
  title?: string;
  targetId?: string;
  scheduledFor?: Date;
  media?: Array<{
    id: string;
    url: string;
    type: 'image' | 'video' | 'gif';
    altText?: string;
  }>;
}

export type AuthType = 'oauth2' | 'apiKey' | 'webhook' | 'basic';

export interface PlatformCapabilities {
  text: boolean;
  images: boolean;
  maxImages?: number;
  video: boolean;
  link: boolean;
  threads: boolean;
  maxChars?: number;
  polls: boolean;
  scheduling: boolean;
}

export interface RateLimitSpec {
  requestsPerWindow: number;
  windowSeconds: number;
  concurrency?: number;
  scope?: 'per-account' | 'per-app';
}

export type ComplianceStatus = 'official-api' | 'reverse-engineered' | 'unverified';

export interface PostError {
  code: string;
  message: string;
  retryable: boolean;
  raw?: unknown;
}

export interface PostResult {
  success: boolean;
  status?: 'success' | 'pending' | 'failed';
  platformPostId?: string;
  url?: string;
  pendingReason?: string;
  error?: PostError;
}

export class MissingCredentialsError extends Error {
  code = 'AUTH_MISSING';
  constructor(public userId: string, public platformId: string) {
    super(`Missing credentials for user ${userId} on platform ${platformId}`);
    this.name = 'MissingCredentialsError';
  }
}

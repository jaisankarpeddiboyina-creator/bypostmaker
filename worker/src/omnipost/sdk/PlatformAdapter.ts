import {
  UnifiedPost,
  PlatformCapabilities,
  AuthType,
  RateLimitSpec,
  ComplianceStatus,
  PostResult,
} from '../core/types';

export interface AdapterManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  minimumCoreVersion: string;
  auth: AuthType;
  scopes: string[];
  capabilities: PlatformCapabilities;
  rateLimit: RateLimitSpec;
  compliance: ComplianceStatus;
}

export interface AdapterCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
  expiresAt?: Date | number;
  webhookUrl?: string;
  channelId?: string;
  connectionId?: string;
  [key: string]: unknown;
}

export type AdapterEvent =
  | 'beforePost'
  | 'afterPost'
  | 'afterFailure'
  | 'afterRefreshToken';

export interface PostMetrics {
  platformPostId: string;
  likes?: number;
  shares?: number;
  comments?: number;
  views?: number;
  impressions?: number;
  fetchedAt: Date;
  raw?: unknown;
}

export interface PlatformAdapter {
  manifest: AdapterManifest;

  authenticate(credentials: AdapterCredentials): Promise<AdapterCredentials>;
  refreshAuth?(credentials: AdapterCredentials): Promise<AdapterCredentials>;
  format(post: UnifiedPost): unknown;
  post(payload: unknown, credentials: AdapterCredentials): Promise<PostResult>;
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
  getMetrics?(platformPostId: string, credentials: AdapterCredentials): Promise<PostMetrics>;
}

import type { Env } from '../../../config/ai'

const DISCORD_WEBHOOK_REGEX = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;
const SLACK_WEBHOOK_REGEX = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+$/;
const GENERIC_WEBHOOK_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

// Pure JavaScript Base64 & Hex Helper Functions
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function hexToUint8Array(hex: string): Uint8Array {
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sha256Base64Url(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return uint8ArrayToBase64Url(new Uint8Array(hash));
}

function getLatestMasterKey(env: Env): { keyId: string; keyHex: string } {
  const v2 = env.OMNIPOST_MASTER_KEY_V2;
  if (v2 !== undefined && v2 !== '') {
    if (!/^[0-9a-fA-F]{64}$/.test(v2)) {
      throw new Error('Vault master key v2 must be a 64-character hex string');
    }
    return { keyId: 'v2', keyHex: v2 };
  }
  const v1 = env.OMNIPOST_MASTER_KEY;
  if (v1 !== undefined && v1 !== '') {
    if (!/^[0-9a-fA-F]{64}$/.test(v1)) {
      throw new Error('Vault master key v1 must be a 64-character hex string');
    }
    return { keyId: 'v1', keyHex: v1 };
  }
  throw new Error('Vault master key is not configured');
}

function isMockEnabledForPlatform(platform: string, env: Env): boolean {
  if (env.ENVIRONMENT === 'production') return false;
  if (env.MOCK_MODE === 'true') return true;

  switch (platform) {
    case 'twitter':
      return !env.OMNIPOST_TWITTER_CLIENT_ID;
    case 'linkedin':
      return !env.OMNIPOST_LINKEDIN_CLIENT_ID;
    case 'mastodon':
      return !env.OMNIPOST_MASTODON_CLIENT_ID;
    case 'threads':
      return !env.OMNIPOST_THREADS_CLIENT_ID;
    case 'reddit':
      return !env.OMNIPOST_REDDIT_CLIENT_ID;
    case 'youtube':
      return !env.OMNIPOST_GOOGLE_CLIENT_ID;
    case 'pinterest':
      return !env.OMNIPOST_PINTEREST_CLIENT_ID;
    case 'facebook':
    case 'instagram':
      return !env.OMNIPOST_META_CLIENT_ID;
    case 'bluesky':
      return env.ENVIRONMENT === 'development';
    default:
      return false;
  }
}

// WebCrypto AES-GCM Envelope Encryption
export async function encryptCredential(
  plaintext: string,
  masterKeyHex: string
): Promise<{ ciphertextBase64: string; wrappedKeyBase64: string }> {
  if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
    throw new Error('Invalid master key format: Must be a 64-character hex string');
  }

  const dek = crypto.getRandomValues(new Uint8Array(32));
  const contentIv = crypto.getRandomValues(new Uint8Array(12));
  const dekKey = await crypto.subtle.importKey(
    'raw',
    dek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: contentIv },
    dekKey,
    new TextEncoder().encode(plaintext)
  );

  const combinedContent = new Uint8Array(contentIv.byteLength + encryptedContent.byteLength);
  combinedContent.set(contentIv, 0);
  combinedContent.set(new Uint8Array(encryptedContent), contentIv.byteLength);
  const ciphertextBase64 = uint8ArrayToBase64(combinedContent);

  const masterKeyBytes = hexToUint8Array(masterKeyHex);
  const masterKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const wrappedKeyIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKeyCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: wrappedKeyIv },
    masterKey,
    dek
  );

  const combinedWrapped = new Uint8Array(wrappedKeyIv.byteLength + wrappedKeyCiphertext.byteLength);
  combinedWrapped.set(wrappedKeyIv, 0);
  combinedWrapped.set(new Uint8Array(wrappedKeyCiphertext), wrappedKeyIv.byteLength);
  const wrappedKeyBase64 = uint8ArrayToBase64(combinedWrapped);

  return { ciphertextBase64, wrappedKeyBase64 };
}

export async function decryptCredential(
  ciphertextBase64: string,
  wrappedKeyBase64: string,
  masterKeyHex: string
): Promise<string> {
  if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
    throw new Error('Invalid master key format: Must be a 64-character hex string');
  }

  const masterKeyBytes = hexToUint8Array(masterKeyHex);
  const masterKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const wrappedBytes = base64ToUint8Array(wrappedKeyBase64);
  if (wrappedBytes.byteLength < 12) {
    throw new Error('Invalid wrapped key payload: Too short');
  }
  const wrappedIv = wrappedBytes.slice(0, 12);
  const wrappedCiphertext = wrappedBytes.slice(12);

  const rawDek = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: wrappedIv },
    masterKey,
    wrappedCiphertext
  );

  const contentBytes = base64ToUint8Array(ciphertextBase64);
  if (contentBytes.byteLength < 12) {
    throw new Error('Invalid ciphertext payload: Too short');
  }
  const contentIv = contentBytes.slice(0, 12);
  const contentCiphertext = contentBytes.slice(12);

  const dekKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(rawDek),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: contentIv },
    dekKey,
    contentCiphertext
  );

  return new TextDecoder().decode(decryptedBytes);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('DISPATCH_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── OAuth 2.0 Provider Endpoints Configs ──────────────────────
interface ProviderConfig {
  authEndpoint: string;
  tokenEndpoint: string;
  scopes: string;
  clientIdKey: keyof Env;
  clientSecretKey: keyof Env;
  profileEndpoint: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  twitter: {
    authEndpoint: 'https://twitter.com/i/oauth2/authorize',
    tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
    scopes: 'tweet.read tweet.write users.read offline.access',
    clientIdKey: 'OMNIPOST_TWITTER_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_TWITTER_CLIENT_SECRET' as any,
    profileEndpoint: 'https://api.twitter.com/2/users/me'
  },
  linkedin: {
    authEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: 'w_member_social r_liteprofile',
    clientIdKey: 'OMNIPOST_LINKEDIN_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_LINKEDIN_CLIENT_SECRET' as any,
    profileEndpoint: 'https://api.linkedin.com/v2/me'
  },
  mastodon: {
    authEndpoint: 'https://mastodon.social/oauth/authorize',
    tokenEndpoint: 'https://mastodon.social/oauth/token',
    scopes: 'read write',
    clientIdKey: 'OMNIPOST_MASTODON_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_MASTODON_CLIENT_SECRET' as any,
    profileEndpoint: 'https://mastodon.social/api/v1/accounts/verify_credentials'
  },
  threads: {
    authEndpoint: 'https://threads.net/oauth/authorize',
    tokenEndpoint: 'https://graph.threads.net/oauth/access_token',
    scopes: 'threads_basic threads_content_publish',
    clientIdKey: 'OMNIPOST_THREADS_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_THREADS_CLIENT_SECRET' as any,
    profileEndpoint: 'https://graph.threads.net/me'
  },
  reddit: {
    authEndpoint: 'https://www.reddit.com/api/v1/authorize',
    tokenEndpoint: 'https://www.reddit.com/api/v1/access_token',
    scopes: 'submit identity',
    clientIdKey: 'OMNIPOST_REDDIT_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_REDDIT_CLIENT_SECRET' as any,
    profileEndpoint: 'https://oauth.reddit.com/api/v1/me'
  },
  youtube: {
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    clientIdKey: 'OMNIPOST_GOOGLE_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_GOOGLE_CLIENT_SECRET' as any,
    profileEndpoint: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true'
  },
  pinterest: {
    authEndpoint: 'https://www.pinterest.com/oauth/',
    tokenEndpoint: 'https://api.pinterest.com/v5/oauth/token',
    scopes: 'boards:read boards:write pins:read pins:write',
    clientIdKey: 'OMNIPOST_PINTEREST_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_PINTEREST_CLIENT_SECRET' as any,
    profileEndpoint: 'https://api.pinterest.com/v5/user_account'
  },
  facebook: {
    authEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: 'instagram_basic instagram_content_publish pages_show_list pages_read_engagement',
    clientIdKey: 'OMNIPOST_META_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_META_CLIENT_SECRET' as any,
    profileEndpoint: 'https://graph.facebook.com/me'
  },
  instagram: {
    authEndpoint: 'https://api.instagram.com/oauth/authorize',
    tokenEndpoint: 'https://api.instagram.com/oauth/access_token',
    scopes: 'instagram_graph_user_profile instagram_graph_user_media',
    clientIdKey: 'OMNIPOST_META_CLIENT_ID' as any,
    clientSecretKey: 'OMNIPOST_META_CLIENT_SECRET' as any,
    profileEndpoint: 'https://graph.instagram.com/me'
  }
};

export async function handleOmnipost(request: Request, env: Env, userId: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ── A. GET /api/omnipost/oauth/connect ────────────────────────
  if (path === '/api/omnipost/oauth/connect' && method === 'GET') {
    try {
      const platform = url.searchParams.get('platform');
      if (!platform || !PROVIDERS[platform]) {
        return Response.json({ success: false, error: 'Invalid or unsupported platform for OAuth' }, { status: 400 });
      }

      // 1. User-scoped stale pending connections pruning before connecting
      const now = Math.floor(Date.now() / 1000);
      const cutoff = now - 600; // 10 minutes
      await env.DB.prepare(
        `DELETE FROM omnipost_connections 
         WHERE user_id = ? 
           AND json_extract(coalesce(display_metadata, '{}'), '$.status') = 'pending' 
           AND created_at < ?`
      ).bind(userId, cutoff).run();

      const state = crypto.randomUUID();
      const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
      const codeVerifier = uint8ArrayToBase64Url(verifierBytes);
      const codeChallenge = await sha256Base64Url(codeVerifier);

      const latestKey = getLatestMasterKey(env);
      const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredential(
        JSON.stringify({ code_verifier: codeVerifier }),
        latestKey.keyHex
      );

      // Insert pending connection state bound to user
      await env.DB.prepare(
        `INSERT INTO omnipost_connections (id, user_id, platform, secret_blob, display_metadata, wrapped_key, key_id, alg, is_plaintext, created_at)
         VALUES (?, ?, ?, ?, '{"status":"pending"}', ?, ?, 'AES-GCM', 0, ?)`
      ).bind(state, userId, platform, ciphertextBase64, wrappedKeyBase64, latestKey.keyId, now).run();

      // Check Mock Mode
      if (isMockEnabledForPlatform(platform, env)) {
        // Redirect directly to callback endpoint to simulate round-trip
        const mockCallbackUrl = `${url.origin}/api/omnipost/oauth/callback?code=mock_code_${platform}&state=${state}`;
        return Response.redirect(mockCallbackUrl, 302);
      }

      // Build real OAuth URL
      const provider = PROVIDERS[platform];
      const clientId = env[provider.clientIdKey] as string;
      const redirectUri = `${url.origin}/api/omnipost/oauth/callback`;
      const authUrl = `${provider.authEndpoint}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(provider.scopes)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      return Response.redirect(authUrl, 302);
    } catch (err: any) {
      console.error('Failed to initiate OAuth connect:', err);
      return Response.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
  }

  // ── B. GET /api/omnipost/oauth/callback ───────────────────────
  if (path === '/api/omnipost/oauth/callback' && method === 'GET') {
    try {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code || !state) {
        return Response.json({ success: false, error: 'Missing code or state parameters' }, { status: 400 });
      }

      // Query the pending state row scoped to current userId
      const connection = await env.DB.prepare(
        `SELECT * FROM omnipost_connections WHERE id = ? AND user_id = ?`
      ).bind(state, userId).first() as any;

      if (!connection) {
        return Response.json({ success: false, error: 'Invalid auth state or session mismatch' }, { status: 400 });
      }

      const now = Math.floor(Date.now() / 1000);
      if (now - connection.created_at > 600) {
        return Response.json({ success: false, error: 'Auth state has expired' }, { status: 400 });
      }

      let meta: Record<string, any> = {};
      try {
        meta = JSON.parse(connection.display_metadata || '{}');
      } catch (_) {}

      if (meta.status !== 'pending') {
        return Response.json({ success: false, error: 'Auth state already finalized' }, { status: 400 });
      }

      const platform = connection.platform;
      const latestKey = getLatestMasterKey(env);
      const masterKey = latestKey.keyHex;

      // Decrypt code verifier
      const decryptedVerifierJson = await decryptCredential(connection.secret_blob, connection.wrapped_key, masterKey);
      const { code_verifier } = JSON.parse(decryptedVerifierJson);

      let accessToken = 'mock_access_token';
      let refreshToken = 'mock_refresh_token';
      let expiresAt = now + 3600;
      let username = `@Mock${platform.charAt(0).toUpperCase() + platform.slice(1)}User`;

      const mockMode = isMockEnabledForPlatform(platform, env);

      if (!mockMode) {
        const provider = PROVIDERS[platform];
        const clientId = env[provider.clientIdKey] as string;
        const clientSecret = env[provider.clientSecretKey] as string;
        const redirectUri = `${url.origin}/api/omnipost/oauth/callback`;

        // Exchange code for tokens
        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('code', code);
        tokenParams.append('redirect_uri', redirectUri);
        tokenParams.append('client_id', clientId);
        if (clientSecret) tokenParams.append('client_secret', clientSecret);
        tokenParams.append('code_verifier', code_verifier);

        const tokenRes = await fetchWithTimeout(provider.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          throw new Error(`Token exchange failed: ${errText}`);
        }

        const tokenData = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number };
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token || '';
        expiresAt = now + (tokenData.expires_in || 3600);

        // Fetch user handle
        try {
          const profileRes = await fetchWithTimeout(provider.profileEndpoint, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json() as any;
            if (platform === 'twitter' && profileData.data?.username) {
              username = `@${profileData.data.username}`;
            } else if (platform === 'linkedin' && profileData.localizedFirstName) {
              username = `${profileData.localizedFirstName} ${profileData.localizedLastName || ''}`.trim();
            } else if (profileData.username) {
              username = `@${profileData.username}`;
            } else if (profileData.display_name) {
              username = profileData.display_name;
            }
          }
        } catch (profileErr) {
          console.warn('Failed to retrieve OAuth profile handle, using default:', profileErr);
        }
      }

      // Serialize and encrypt tokens
      const credentialsPayload = JSON.stringify({
        accessToken,
        refreshToken,
        expiresAt
      });

      const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredential(credentialsPayload, masterKey);

      const finalMetadata = JSON.stringify({
        status: 'active',
        username: username,
        label: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`
      });

      // Finalize connection row
      await env.DB.prepare(
        `UPDATE omnipost_connections 
         SET secret_blob = ?, display_metadata = ?, wrapped_key = ?, key_id = ?, created_at = ?
         WHERE id = ?`
      ).bind(ciphertextBase64, finalMetadata, wrappedKeyBase64, latestKey.keyId, now, state).run();

      return Response.redirect(`${url.origin}/app/connections?success=true`, 302);
    } catch (err: any) {
      console.error('Failed to complete OAuth callback:', err);
      return Response.json({ success: false, error: err.message || 'Internal callback exchange error' }, { status: 500 });
    }
  }

  // ── C. POST /api/omnipost/connections ─────────────────────────
  if (path === '/api/omnipost/connections' && method === 'POST') {
    try {
      const body = await request.json() as {
        platform?: string;
        webhookUrl?: string;
        label?: string;
        handle?: string;
        appPassword?: string;
      };
      const { platform, webhookUrl, label, handle, appPassword } = body;

      if (!platform || typeof platform !== 'string') {
        return Response.json({ success: false, error: 'platform is required' }, { status: 400 });
      }

      let plaintextCredentials = '';
      let defaultLabel = '';
      let displayUsername = '';

      if (platform === 'discord') {
        if (!webhookUrl || !DISCORD_WEBHOOK_REGEX.test(webhookUrl)) {
          return Response.json({ success: false, error: 'Invalid Discord webhook URL format' }, { status: 400 });
        }
        plaintextCredentials = webhookUrl;
        defaultLabel = 'Discord Webhook';
      } else if (platform === 'slack') {
        if (!webhookUrl || !SLACK_WEBHOOK_REGEX.test(webhookUrl)) {
          return Response.json({ success: false, error: 'Invalid Slack webhook URL format' }, { status: 400 });
        }
        plaintextCredentials = webhookUrl;
        defaultLabel = 'Slack Webhook';
      } else if (platform === 'webhooks') {
        if (!webhookUrl || !GENERIC_WEBHOOK_REGEX.test(webhookUrl)) {
          return Response.json({ success: false, error: 'Invalid Webhook URL format' }, { status: 400 });
        }
        plaintextCredentials = webhookUrl;
        defaultLabel = 'Generic Webhook';
      } else if (platform === 'bluesky') {
        if (!handle || !appPassword) {
          return Response.json({ success: false, error: 'Bluesky Handle and App Password are required' }, { status: 400 });
        }
        plaintextCredentials = JSON.stringify({ handle, appPassword });
        defaultLabel = 'Bluesky Channel';
        displayUsername = handle.startsWith('@') ? handle : `@${handle}`;
      } else {
        return Response.json({ success: false, error: 'Unsupported connection credentials platform' }, { status: 400 });
      }

      const connectionLabel = label && typeof label === 'string' ? label.slice(0, 50) : defaultLabel;
      const latestKey = getLatestMasterKey(env);

      const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredential(plaintextCredentials, latestKey.keyHex);

      const id = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const displayMetadata = JSON.stringify({
        status: 'active',
        username: displayUsername || null,
        label: connectionLabel
      });

      await env.DB.prepare(
        `INSERT INTO omnipost_connections (id, user_id, platform, secret_blob, display_metadata, wrapped_key, key_id, alg, is_plaintext, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'AES-GCM', 0, ?)`
      ).bind(id, userId, platform, ciphertextBase64, displayMetadata, wrappedKeyBase64, latestKey.keyId, now).run();

      return Response.json({
        success: true,
        data: {
          id,
          platform,
          label: connectionLabel,
          username: displayUsername || null,
          status: 'active',
          created_at: now
        }
      }, { status: 201 });
    } catch (err: any) {
      console.error('Failed to create webhook/credentials connection:', err);
      return Response.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
  }

  // ── D. GET /api/omnipost/connections ──────────────────────────
  if (path === '/api/omnipost/connections' && method === 'GET') {
    try {
      const now = Math.floor(Date.now() / 1000);
      const cutoff = now - 600; // 10 minutes

      // 1. User-scoped stale pending connections pruning first
      await env.DB.prepare(
        `DELETE FROM omnipost_connections 
         WHERE user_id = ? 
           AND json_extract(coalesce(display_metadata, '{}'), '$.status') = 'pending' 
           AND created_at < ?`
      ).bind(userId, cutoff).run();

      // 2. Select remaining connections
      const { results } = await env.DB.prepare(
        `SELECT id, platform, display_metadata, created_at FROM omnipost_connections WHERE user_id = ? ORDER BY created_at DESC`
      ).bind(userId).all();

      const connections = (results || []).map((row: any) => {
        let meta: Record<string, any> = {};
        try {
          meta = JSON.parse(row.display_metadata || '{}');
        } catch (_) {}

        if (meta.status === 'pending') return null;

        let label = meta.label;
        if (!label) {
          if (row.platform === 'discord') label = 'Discord Webhook';
          else if (row.platform === 'slack') label = 'Slack Webhook';
          else if (row.platform === 'webhooks') label = 'Generic Webhook';
          else label = `${row.platform.charAt(0).toUpperCase() + row.platform.slice(1)} Channel`;
        }

        return {
          id: row.id,
          platform: row.platform,
          label: label,
          username: meta.username || null,
          status: meta.status || 'active',
          created_at: row.created_at
        };
      }).filter(Boolean);

      return Response.json({ success: true, data: connections });
    } catch (err: any) {
      console.error('Failed to list omnipost connections:', err);
      return Response.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
  }

  // ── E. DELETE /api/omnipost/connections/:id ─────────────────────
  if (path.startsWith('/api/omnipost/connections/') && method === 'DELETE') {
    try {
      const connectionId = path.replace('/api/omnipost/connections/', '').trim();
      if (!connectionId) {
        return Response.json({ success: false, error: 'Connection ID is required' }, { status: 400 });
      }

      const res = await env.DB.prepare(
        `DELETE FROM omnipost_connections WHERE id = ? AND user_id = ?`
      ).bind(connectionId, userId).run();

      if (!res.meta || res.meta.changes === 0) {
        return Response.json({ success: false, error: 'Connection not found or unauthorized' }, { status: 404 });
      }

      return Response.json({ success: true, message: 'Connection deleted successfully' });
    } catch (err: any) {
      console.error('Failed to delete omnipost connection:', err);
      return Response.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
  }

  // ── F. POST /api/omnipost/publish ──────────────────────────────
  if (path === '/api/omnipost/publish' && method === 'POST') {
    try {
      const body = await request.json() as {
        connectionId?: string;
        idempotencyKey?: string;
        content?: { text?: string; mediaUrls?: string[] };
      };

      const { connectionId, idempotencyKey, content } = body;

      if (!connectionId || typeof connectionId !== 'string') {
        return Response.json({ success: false, error: 'connectionId is required' }, { status: 400 });
      }

      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return Response.json({ success: false, error: 'idempotencyKey (UUID) is required' }, { status: 400 });
      }

      const textContent = content?.text || '';
      if (!textContent.trim() && (!content?.mediaUrls || content.mediaUrls.length === 0)) {
        return Response.json({ success: false, error: 'Post text or media is required' }, { status: 400 });
      }

      const deliveryId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      let targetDeliveryId = deliveryId;

      // Atomic claim lock
      try {
        await env.DB.prepare(
          `INSERT INTO omnipost_deliveries (id, idempotency_key, user_id, connection_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`
        ).bind(deliveryId, idempotencyKey, userId, connectionId, now, now).run();
      } catch (err: any) {
        if (String(err.message || err).includes('UNIQUE') || String(err.message || err).includes('idempotency_key')) {
          const existing = await env.DB.prepare(
            `SELECT * FROM omnipost_deliveries WHERE idempotency_key = ?`
          ).bind(idempotencyKey).first() as any;

          if (existing) {
            if (existing.status === 'success') {
              return Response.json({
                success: true,
                data: {
                  connectionId: existing.connection_id,
                  status: 'success',
                  platformPostId: existing.platform_post_id,
                  url: existing.url,
                  cached: true
                }
              }, { status: 409 });
            }

            const isRecentPending = existing.status === 'pending' && (now - existing.created_at) < 300;
            if (isRecentPending) {
              return Response.json({
                success: true,
                data: {
                  connectionId: existing.connection_id,
                  status: 'pending',
                  message: 'Dispatch currently in-flight'
                }
              }, { status: 202 });
            }

            targetDeliveryId = existing.id;
          }
        } else {
          throw err;
        }
      }

      // Ownership Verification
      const connection = await env.DB.prepare(
        `SELECT * FROM omnipost_connections WHERE id = ? AND user_id = ?`
      ).bind(connectionId, userId).first() as any;

      if (!connection) {
        await env.DB.prepare(
          `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'FORBIDDEN', error_message = 'Unauthorized connection access', updated_at = ? WHERE id = ?`
        ).bind(now, targetDeliveryId).run();
        return Response.json({ success: false, error: 'Connection not found or unauthorized' }, { status: 403 });
      }

      const keyId = connection.key_id || 'v1';
      const masterKey = keyId === 'v2' ? env.OMNIPOST_MASTER_KEY_V2 : env.OMNIPOST_MASTER_KEY;

      if (!masterKey) {
        await env.DB.prepare(
          `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'DECRYPTION_ERROR', error_message = 'Master key missing', updated_at = ? WHERE id = ?`
        ).bind(now, targetDeliveryId).run();
        return Response.json({ success: false, error: `Decryption failed: master key ${keyId} missing`, code: 'DECRYPTION_ERROR' }, { status: 500 });
      }

      let decryptedSecret = '';
      try {
        decryptedSecret = await decryptCredential(connection.secret_blob, connection.wrapped_key, masterKey);
      } catch (decryptionErr: any) {
        console.error('Decryption failed for connection:', connectionId, decryptionErr);
        await env.DB.prepare(
          `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'DECRYPTION_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
        ).bind(`Decryption failed: ${decryptionErr.message || decryptionErr}`, now, targetDeliveryId).run();
        return Response.json({ success: false, error: 'Failed to decrypt connection credentials', code: 'DECRYPTION_ERROR' }, { status: 500 });
      }

      // ── Webhook Bypass (Immediate routing) ──────────────────────
      const WEBHOOK_PLATFORMS = ['discord', 'slack', 'webhooks'];
      if (WEBHOOK_PLATFORMS.includes(connection.platform)) {
        return await dispatchWebhook(connection.platform, decryptedSecret, textContent, content?.mediaUrls || [], targetDeliveryId, connectionId, env);
      }

      // ── Bluesky Bypass (Direct dispatch) ────────────────────────
      if (connection.platform === 'bluesky') {
        const { handle, appPassword } = JSON.parse(decryptedSecret);
        return await dispatchBluesky(handle, appPassword, textContent, content?.mediaUrls || [], targetDeliveryId, connectionId, env);
      }

      // ── OAuth 2.0 Dispatch & Token Refresh Engine ───────────────
      let oauthCreds = JSON.parse(decryptedSecret) as { accessToken: string; refreshToken: string; expiresAt: number };
      const currentNow = Math.floor(Date.now() / 1000);

      if (oauthCreds.expiresAt <= currentNow + 60) {
        // Token near expiration, acquire refresh lock in D1 using transactional json_set
        let lockAcquired = false;
        let retries = 5;

        while (!lockAcquired && retries > 0) {
          const lockTime = Math.floor(Date.now() / 1000);
          const updateRes = await env.DB.prepare(
            `UPDATE omnipost_connections 
             SET display_metadata = json_set(
               coalesce(display_metadata, '{}'), 
               '$.refreshing', 1, 
               '$.refresh_lock_time', ?
             )
             WHERE id = ? AND (
               json_extract(coalesce(display_metadata, '{}'), '$.refreshing') IS NOT 1
               OR ? - cast(json_extract(coalesce(display_metadata, '{}'), '$.refresh_lock_time') as integer) > 30
             )`
          ).bind(lockTime, connectionId, lockTime).run();

          if (updateRes.meta.changes > 0) {
            lockAcquired = true;
          } else {
            // Wait 1 second and check if another thread refreshed the tokens
            await new Promise(resolve => setTimeout(resolve, 1000));
            const reloaded = await env.DB.prepare(
              `SELECT * FROM omnipost_connections WHERE id = ?`
            ).bind(connectionId).first() as any;

            if (reloaded) {
              const currentCredsDecrypted = await decryptCredential(reloaded.secret_blob, reloaded.wrapped_key, masterKey);
              const currentCredsObj = JSON.parse(currentCredsDecrypted);
              if (currentCredsObj.expiresAt > Math.floor(Date.now() / 1000) + 60) {
                oauthCreds = currentCredsObj;
                lockAcquired = true;
                retries = 0; // Skip refresh call
                break;
              }
            }
            retries--;
          }
        }

        // Execute refresh token exchange if we hold the lock
        if (lockAcquired && oauthCreds.expiresAt <= Math.floor(Date.now() / 1000) + 60) {
          try {
            const provider = PROVIDERS[connection.platform];
            const mockMode = isMockEnabledForPlatform(connection.platform, env);

            let refreshedAccess = 'mock_refreshed_access';
            let refreshedRefresh = oauthCreds.refreshToken || 'mock_refreshed_refresh';
            let refreshedExpires = Math.floor(Date.now() / 1000) + 3600;

            if (!mockMode && provider) {
              const clientId = env[provider.clientIdKey] as string;
              const clientSecret = env[provider.clientSecretKey] as string;

              const refreshParams = new URLSearchParams();
              refreshParams.append('grant_type', 'refresh_token');
              refreshParams.append('refresh_token', oauthCreds.refreshToken);
              refreshParams.append('client_id', clientId);
              if (clientSecret) refreshParams.append('client_secret', clientSecret);

              const refreshRes = await fetchWithTimeout(provider.tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: refreshParams
              });

              if (!refreshRes.ok) {
                const errText = await refreshRes.text();
                throw new Error(`Failed to refresh token: ${errText}`);
              }

              const refreshData = await refreshRes.json() as { access_token: string; refresh_token?: string; expires_in?: number };
              refreshedAccess = refreshData.access_token;
              refreshedRefresh = refreshData.refresh_token || oauthCreds.refreshToken;
              refreshedExpires = Math.floor(Date.now() / 1000) + (refreshData.expires_in || 3600);
            }

            // Save new tokens
            const updatedPayload = JSON.stringify({
              accessToken: refreshedAccess,
              refreshToken: refreshedRefresh,
              expiresAt: refreshedExpires
            });

            const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredential(updatedPayload, masterKey);

            // Save and release lock simultaneously
            await env.DB.prepare(
              `UPDATE omnipost_connections 
               SET secret_blob = ?, 
                   wrapped_key = ?, 
                   key_id = ?, 
                   display_metadata = json_remove(
                     coalesce(display_metadata, '{}'), 
                     '$.refreshing', 
                     '$.refresh_lock_time'
                   )
               WHERE id = ?`
            ).bind(ciphertextBase64, wrappedKeyBase64, keyId, connectionId).run();

            oauthCreds = {
              accessToken: refreshedAccess,
              refreshToken: refreshedRefresh,
              expiresAt: refreshedExpires
            };
          } catch (refreshErr: any) {
            // Release lock on failure
            await env.DB.prepare(
              `UPDATE omnipost_connections 
               SET display_metadata = json_remove(
                 coalesce(display_metadata, '{}'), 
                 '$.refreshing', 
                 '$.refresh_lock_time'
               )
               WHERE id = ?`
            ).bind(connectionId).run();

            throw refreshErr;
          }
        }
      }

      // Execute actual or mock publishing
      const mockMode = isMockEnabledForPlatform(connection.platform, env);
      if (mockMode) {
        // Simulate dispatch latency
        await new Promise(resolve => setTimeout(resolve, 200));

        const mockPostId = `mock_post_${crypto.randomUUID().slice(0, 8)}`;
        let mockPostUrl = `https://${connection.platform}.com/mockuser/status/${mockPostId}`;
        if (connection.platform === 'linkedin') {
          mockPostUrl = `https://www.linkedin.com/feed/update/urn:li:share:${mockPostId}`;
        }

        const updateTime = Math.floor(Date.now() / 1000);
        await env.DB.prepare(
          `UPDATE omnipost_deliveries SET status = 'success', platform_post_id = ?, url = ?, updated_at = ? WHERE id = ?`
        ).bind(mockPostId, mockPostUrl, updateTime, targetDeliveryId).run();

        return Response.json({
          success: true,
          data: {
            connectionId,
            status: 'success',
            platformPostId: mockPostId,
            url: mockPostUrl
          }
        });
      }

      // Dispatch to actual OAuth APIs
      return await dispatchOAuthPublish(connection.platform, oauthCreds.accessToken, textContent, content?.mediaUrls || [], targetDeliveryId, connectionId, env);

    } catch (err: any) {
      console.error('Unhandled publish error:', err);
      return Response.json({ success: false, error: err.message || 'Internal publish error' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// ── Webhook Publisher ───────────────────────────────────────────
async function dispatchWebhook(
  platform: string,
  webhookUrl: string,
  text: string,
  mediaUrls: string[],
  deliveryId: string,
  connectionId: string,
  env: Env
): Promise<Response> {
  const isDiscord = platform === 'discord';
  const isSlack = platform === 'slack';

  let targetUrl = webhookUrl;
  let payload: Record<string, any> = {};

  if (isDiscord) {
    targetUrl = webhookUrl.includes('?') ? `${webhookUrl}&wait=true` : `${webhookUrl}?wait=true`;
    payload = { content: text };
    if (mediaUrls.length > 0) {
      payload.embeds = mediaUrls.slice(0, 4).map(url => ({ image: { url } }));
    }
  } else if (isSlack) {
    payload = { text: text };
    if (mediaUrls.length > 0) {
      payload.attachments = mediaUrls.slice(0, 4).map(url => ({ image_url: url }));
    }
  } else {
    // Generic Webhook
    payload = { text, mediaUrls };
  }

  try {
    const res = await fetchWithTimeout(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 15000);

    const updateTime = Math.floor(Date.now() / 1000);

    if (res.ok) {
      let platformPostId: string | null = null;
      let postUrl: string | null = null;

      if (isDiscord && res.status === 200) {
        try {
          const resData = await res.json() as { id?: string; channel_id?: string };
          if (resData.id) {
            platformPostId = resData.id;
            postUrl = resData.channel_id ? `https://discord.com/channels/@me/${resData.channel_id}/${resData.id}` : null;
          }
        } catch (_) {}
      }

      await env.DB.prepare(
        `UPDATE omnipost_deliveries SET status = 'success', platform_post_id = ?, url = ?, updated_at = ? WHERE id = ?`
      ).bind(platformPostId, postUrl, updateTime, deliveryId).run();

      return Response.json({
        success: true,
        data: {
          connectionId,
          status: 'success',
          platformPostId,
          url: postUrl
        }
      });
    } else {
      const errText = await res.text();
      const errorCode = res.status === 429 ? 'RATE_LIMITED' : `HTTP_${res.status}`;

      await env.DB.prepare(
        `UPDATE omnipost_deliveries SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`
      ).bind(errorCode, errText.slice(0, 500), updateTime, deliveryId).run();

      return Response.json({
        success: false,
        error: `${platform} webhook returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
        code: errorCode
      }, { status: 502 });
    }
  } catch (err: any) {
    const updateTime = Math.floor(Date.now() / 1000);
    const isTimeout = err.message === 'DISPATCH_TIMEOUT';
    const errorCode = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    const errorMessage = isTimeout ? 'Webhook dispatch timed out' : (err.message || 'Dispatch failed');

    await env.DB.prepare(
      `UPDATE omnipost_deliveries SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`
    ).bind(errorCode, errorMessage, updateTime, deliveryId).run();

    return Response.json({ success: false, error: errorMessage, code: errorCode }, { status: isTimeout ? 504 : 500 });
  }
}

// ── Bluesky Publisher ───────────────────────────────────────────
async function dispatchBluesky(
  handle: string,
  appPassword: string,
  text: string,
  mediaUrls: string[],
  deliveryId: string,
  connectionId: string,
  env: Env
): Promise<Response> {
  // AT Protocol API endpoints for Bluesky
  try {
    const sessionRes = await fetchWithTimeout('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password: appPassword })
    });

    const updateTime = Math.floor(Date.now() / 1000);

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      await env.DB.prepare(
        `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'AUTH_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
      ).bind(`Bluesky session creation failed: ${errText}`, updateTime, deliveryId).run();
      return Response.json({ success: false, error: 'Bluesky authentication failed', code: 'AUTH_ERROR' }, { status: 401 });
    }

    const sessionData = await sessionRes.json() as { did: string; accessJwt: string };

    // Post creation
    const recordPayload = {
      repo: sessionData.did,
      collection: 'app.bsky.feed.post',
      record: {
        text: text,
        createdAt: new Date().toISOString(),
        $type: 'app.bsky.feed.post'
      }
    };

    const postRes = await fetchWithTimeout('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.accessJwt}`
      },
      body: JSON.stringify(recordPayload)
    });

    if (postRes.ok) {
      const postData = await postRes.json() as { uri: string; cid: string };
      // Parse URI (e.g. at://did:plc:xxx/app.bsky.feed.post/yyy) to format web URL
      const parts = postData.uri.split('/');
      const postId = parts[parts.length - 1];
      const webUrl = `https://bsky.app/profile/${handle}/post/${postId}`;

      await env.DB.prepare(
        `UPDATE omnipost_deliveries SET status = 'success', platform_post_id = ?, url = ?, updated_at = ? WHERE id = ?`
      ).bind(postData.cid, webUrl, updateTime, deliveryId).run();

      return Response.json({
        success: true,
        data: {
          connectionId,
          status: 'success',
          platformPostId: postData.cid,
          url: webUrl
        }
      });
    } else {
      const errText = await postRes.text();
      await env.DB.prepare(
        `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'API_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
      ).bind(`Bluesky post creation failed: ${errText}`, updateTime, deliveryId).run();
      return Response.json({ success: false, error: 'Bluesky publishing failed', code: 'API_ERROR' }, { status: 502 });
    }

  } catch (err: any) {
    const updateTime = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'NETWORK_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
    ).bind(err.message || 'Dispatch failed', updateTime, deliveryId).run();
    return Response.json({ success: false, error: err.message || 'Network error', code: 'NETWORK_ERROR' }, { status: 500 });
  }
}

// ── OAuth 2.0 Real Publisher ────────────────────────────────────
async function dispatchOAuthPublish(
  platform: string,
  accessToken: string,
  text: string,
  mediaUrls: string[],
  deliveryId: string,
  connectionId: string,
  env: Env
): Promise<Response> {
  const updateTime = Math.floor(Date.now() / 1000);
  let endpoint = '';
  let payload: Record<string, any> = {};
  let headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  if (platform === 'twitter') {
    endpoint = 'https://api.twitter.com/2/tweets';
    payload = { text: text };
  } else if (platform === 'linkedin') {
    endpoint = 'https://api.linkedin.com/v2/shares';
    payload = {
      owner: 'urn:li:person:ANONYMOUS', // dynamically replaced based on token profile if needed
      subject: 'Share via PostMaker',
      text: { text: text },
      distribution: {
        linkedInDistributionTarget: {
          visibleToGuest: true
        }
      }
    };
  } else if (platform === 'mastodon') {
    endpoint = 'https://mastodon.social/api/v1/statuses';
    payload = { status: text };
  } else {
    // Other platforms mock fallback
    await env.DB.prepare(
      `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'NOT_IMPLEMENTED', error_message = 'Platform not implemented', updated_at = ? WHERE id = ?`
    ).bind(updateTime, deliveryId).run();
    return Response.json({ success: false, error: `${platform} publishing API not implemented yet` }, { status: 501 });
  }

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const resUpdateTime = Math.floor(Date.now() / 1000);

    if (res.ok) {
      let platformPostId = `post_${crypto.randomUUID().slice(0, 8)}`;
      let postUrl = `https://${platform}.com`;

      try {
        const resData = await res.json() as any;
        if (platform === 'twitter' && resData.data?.id) {
          platformPostId = resData.data.id;
          postUrl = `https://twitter.com/i/status/${resData.data.id}`;
        } else if (platform === 'linkedin' && resData.id) {
          platformPostId = resData.id;
          postUrl = `https://www.linkedin.com/feed/update/${resData.id}`;
        } else if (platform === 'mastodon' && resData.id) {
          platformPostId = resData.id;
          postUrl = resData.url || `https://mastodon.social/@user/${resData.id}`;
        }
      } catch (_) {}

      await env.DB.prepare(
        `UPDATE omnipost_deliveries SET status = 'success', platform_post_id = ?, url = ?, updated_at = ? WHERE id = ?`
      ).bind(platformPostId, postUrl, resUpdateTime, deliveryId).run();

      return Response.json({
        success: true,
        data: {
          connectionId,
          status: 'success',
          platformPostId,
          url: postUrl
        }
      });
    } else {
      const errText = await res.text();
      await env.DB.prepare(
        `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'API_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
      ).bind(`HTTP ${res.status}: ${errText.slice(0, 300)}`, resUpdateTime, deliveryId).run();
      return Response.json({ success: false, error: `${platform} API returned HTTP ${res.status}` }, { status: 502 });
    }
  } catch (err: any) {
    const resUpdateTime = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'NETWORK_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
    ).bind(err.message || 'Dispatch failed', resUpdateTime, deliveryId).run();
    return Response.json({ success: false, error: err.message || 'Network error' }, { status: 500 });
  }
}

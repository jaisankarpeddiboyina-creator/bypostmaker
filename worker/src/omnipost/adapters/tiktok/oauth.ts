import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeTikTokCode(
  code: string,
  redirectUri: string,
  clientKey: string,
  clientSecret: string,
  codeVerifier: string = 'challenge_verifier'
): Promise<AdapterCredentials> {
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    open_id?: string;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    targetId: data.open_id,
    expiresAt,
    clientId: clientKey,
    clientSecret,
  };
}

export async function refreshTikTokToken(
  credentials: AdapterCredentials,
  clientKey: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  if (!credentials.refreshToken) {
    throw new Error('AUTH_MISSING: TikTok refresh token is missing');
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    ...credentials,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || credentials.refreshToken,
    expiresAt,
  };
}

import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeTwitchCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twitch OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string[];
  };

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    clientId,
    clientSecret,
  };
}

export async function refreshTwitchToken(
  credentials: AdapterCredentials,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  if (!credentials.refreshToken) {
    throw new Error('AUTH_MISSING: Twitch refresh token is missing');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twitch token refresh failed (${response.status}): ${text}`);
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

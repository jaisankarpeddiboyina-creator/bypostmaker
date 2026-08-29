import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeMediumCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://api.medium.com/v1/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Medium OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_at: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(data.expires_at / 1000),
    clientId,
    clientSecret,
  };
}

export async function refreshMediumToken(
  credentials: AdapterCredentials,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  if (!credentials.refreshToken) {
    throw new Error('AUTH_MISSING: Medium refresh token is missing');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://api.medium.com/v1/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Medium token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_at: number;
  };

  return {
    ...credentials,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || credentials.refreshToken,
    expiresAt: Math.floor(data.expires_at / 1000),
  };
}

import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instagram/Meta OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 5184000); // Default 60 days for long-lived Meta token

  return {
    accessToken: data.access_token,
    expiresAt,
    clientId,
    clientSecret,
  };
}

export async function refreshInstagramToken(
  credentials: AdapterCredentials,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  if (!credentials.accessToken) {
    throw new Error('AUTH_MISSING: Instagram access token is missing');
  }

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: credentials.accessToken,
  });

  const response = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instagram long-lived token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 5184000);

  return {
    ...credentials,
    accessToken: data.access_token,
    expiresAt,
  };
}

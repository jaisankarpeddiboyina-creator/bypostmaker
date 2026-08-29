import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeProductHuntCode(
  code: string,
  redirectUri: string,
  apiKey: string,
  apiSecret: string
): Promise<AdapterCredentials> {
  const body = new URLSearchParams({
    client_id: apiKey,
    client_secret: apiSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://api.producthunt.com/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Product Hunt OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in || 31536000),
    clientId: apiKey,
    clientSecret: apiSecret,
  };
}

export async function refreshProductHuntToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

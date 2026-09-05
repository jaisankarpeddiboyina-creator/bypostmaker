import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeThreadsCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Threads OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    user_id?: number;
  };

  return {
    accessToken: data.access_token,
    targetId: data.user_id ? String(data.user_id) : undefined,
    clientId,
    clientSecret,
  };
}

export async function refreshThreadsToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  if (!credentials.accessToken) {
    throw new Error('AUTH_MISSING: Threads access token is missing');
  }

  const response = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${credentials.accessToken}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Threads token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    ...credentials,
    accessToken: data.access_token,
    expiresAt,
  };
}

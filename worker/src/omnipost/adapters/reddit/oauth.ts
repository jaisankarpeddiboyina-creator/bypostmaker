import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export const REDDIT_USER_AGENT = 'web:com.bypostmaker.app:v1.0.0 (by /u/PostMakerApp)';

export async function refreshRedditToken(
  credentials: AdapterCredentials,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  if (!credentials.refreshToken) {
    throw new Error('AUTH_MISSING: Reddit refresh token is missing');
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
  });

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_USER_AGENT,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reddit token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    ...credentials,
    accessToken: data.access_token,
    expiresAt,
  };
}

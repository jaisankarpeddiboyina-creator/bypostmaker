import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeStackOverflowCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  key: string
): Promise<AdapterCredentials> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://stackoverflow.com/oauth/access_token/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stack Overflow OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    clientId,
    clientSecret,
    targetId: key,
  };
}

export async function refreshStackOverflowToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeGitHubCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    clientId,
    clientSecret,
  };
}

export async function refreshGitHubToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

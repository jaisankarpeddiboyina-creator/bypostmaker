import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeSlackCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<AdapterCredentials> {
  const body = new URLSearchParams({
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack OAuth code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    access_token?: string;
    error?: string;
    incoming_webhook?: { url: string; channel: string };
  };

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  return {
    accessToken: data.access_token || data.incoming_webhook?.url || '',
    webhookUrl: data.incoming_webhook?.url,
    clientId,
    clientSecret,
  };
}

export async function refreshSlackToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

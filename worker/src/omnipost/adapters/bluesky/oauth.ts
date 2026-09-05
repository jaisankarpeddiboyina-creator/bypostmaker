import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeBlueskyCode(
  handle: string,
  appPassword: string,
  pdsUrl: string = 'https://bsky.social'
): Promise<AdapterCredentials> {
  const response = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: handle,
      password: appPassword,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bluesky session creation failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    accessJwt: string;
    refreshJwt?: string;
    did: string;
    handle: string;
  };

  return {
    accessToken: data.accessJwt,
    refreshToken: data.refreshJwt,
    targetId: data.did,
  };
}

export async function refreshBlueskyToken(
  credentials: AdapterCredentials,
  pdsUrl: string = 'https://bsky.social'
): Promise<AdapterCredentials> {
  if (!credentials.refreshToken) {
    throw new Error('AUTH_MISSING: Bluesky refreshJwt is missing');
  }

  const response = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.refreshToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bluesky token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    accessJwt: string;
    refreshJwt?: string;
    did: string;
  };

  return {
    ...credentials,
    accessToken: data.accessJwt,
    refreshToken: data.refreshJwt || credentials.refreshToken,
    targetId: data.did || credentials.targetId,
  };
}

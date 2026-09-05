import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeLemon8Code(
  username: string,
  password: string
): Promise<AdapterCredentials> {
  const response = await fetch('https://api.lemon8-app.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Lemon8 login failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { access_token?: string; token?: string };
  const token = data.access_token || data.token;

  if (!token) {
    throw new Error('Lemon8 login response missing access token');
  }

  return {
    accessToken: token,
    username,
  };
}

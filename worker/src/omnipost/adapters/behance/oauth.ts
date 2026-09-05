import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeBehanceCode(
  apiKey: string
): Promise<AdapterCredentials> {
  if (!apiKey) {
    throw new Error('Behance exchange requires a valid API key');
  }

  return Promise.resolve({
    apiKey,
    accessToken: apiKey,
  });
}

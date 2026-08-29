import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeQuoraCode(
  apiKey: string
): Promise<AdapterCredentials> {
  return {
    accessToken: apiKey,
  };
}

export async function refreshQuoraToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

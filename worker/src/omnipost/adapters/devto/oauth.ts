import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeDevToCode(
  apiKey: string
): Promise<AdapterCredentials> {
  return {
    accessToken: apiKey,
  };
}

export async function refreshDevToToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

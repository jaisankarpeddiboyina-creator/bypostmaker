import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeIndieHackersCode(
  apiKey: string
): Promise<AdapterCredentials> {
  return {
    accessToken: apiKey,
  };
}

export async function refreshIndieHackersToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeBetaListCode(
  apiKey: string
): Promise<AdapterCredentials> {
  return {
    accessToken: apiKey,
  };
}

export async function refreshBetaListToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

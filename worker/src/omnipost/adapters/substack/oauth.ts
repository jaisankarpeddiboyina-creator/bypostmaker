import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeSubstackCode(
  email: string,
  publicationUrl: string
): Promise<AdapterCredentials> {
  return {
    accessToken: email,
    targetId: publicationUrl,
  };
}

export async function refreshSubstackToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

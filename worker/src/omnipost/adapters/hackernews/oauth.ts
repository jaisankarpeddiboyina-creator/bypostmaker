import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeHackerNewsCode(
  userCookie: string
): Promise<AdapterCredentials> {
  return {
    accessToken: userCookie,
  };
}

export async function refreshHackerNewsToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeHashnodeCode(
  personalToken: string,
  publicationId: string
): Promise<AdapterCredentials> {
  return {
    accessToken: personalToken,
    targetId: publicationId,
  };
}

export async function refreshHashnodeToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

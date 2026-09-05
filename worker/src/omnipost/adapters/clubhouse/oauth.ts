import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeClubhouseCode(
  phone: string,
  token: string
): Promise<AdapterCredentials> {
  if (!token) {
    throw new Error('Clubhouse exchange requires a valid authentication token');
  }

  return Promise.resolve({
    accessToken: token,
    apiKey: token,
    phone,
  });
}

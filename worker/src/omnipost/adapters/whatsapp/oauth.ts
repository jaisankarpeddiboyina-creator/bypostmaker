import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeWhatsAppCode(
  accessToken: string,
  phoneNumberId: string
): Promise<AdapterCredentials> {
  return {
    accessToken,
    targetId: phoneNumberId,
  };
}

export async function refreshWhatsAppToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

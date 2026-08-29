import { AdapterCredentials } from '../../sdk/PlatformAdapter';

export async function exchangeTelegramCode(
  botToken: string,
  chatId: string
): Promise<AdapterCredentials> {
  return {
    accessToken: botToken,
    targetId: chatId,
  };
}

export async function refreshTelegramToken(
  credentials: AdapterCredentials
): Promise<AdapterCredentials> {
  return credentials;
}

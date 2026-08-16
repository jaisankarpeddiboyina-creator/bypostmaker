import { CredentialStore } from '../core/dispatcher';
import { AdapterCredentials } from '../sdk/PlatformAdapter';

export async function encryptCredentialWebCrypto(plaintext: string, masterKeyHex: string): Promise<{ ciphertextBase64: string; wrappedKeyBase64: string }> {
  const enc = new TextEncoder();
  const masterKeyBytes = new Uint8Array(masterKeyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const masterKey = await crypto.subtle.importKey('raw', masterKeyBytes, 'AES-GCM', false, ['wrapKey']);

  const dek = (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])) as CryptoKey;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, enc.encode(plaintext));

  const ciphertextArray = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  ciphertextArray.set(iv, 0);
  ciphertextArray.set(new Uint8Array(ciphertextBuffer), iv.length);
  const ciphertextBase64 = btoa(String.fromCharCode(...ciphertextArray));

  const wrappedKeyIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKeyBuffer = await crypto.subtle.wrapKey('raw', dek, masterKey, { name: 'AES-GCM', iv: wrappedKeyIv });

  const wrappedKeyArray = new Uint8Array(wrappedKeyIv.length + wrappedKeyBuffer.byteLength);
  wrappedKeyArray.set(wrappedKeyIv, 0);
  wrappedKeyArray.set(new Uint8Array(wrappedKeyBuffer), wrappedKeyIv.length);
  const wrappedKeyBase64 = btoa(String.fromCharCode(...wrappedKeyArray));

  return { ciphertextBase64, wrappedKeyBase64 };
}

export async function decryptCredentialWebCrypto(ciphertextBase64: string, wrappedKeyBase64: string, masterKeyHex: string): Promise<string> {
  const masterKeyBytes = new Uint8Array(masterKeyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const masterKey = await crypto.subtle.importKey('raw', masterKeyBytes, 'AES-GCM', false, ['unwrapKey']);

  const wrappedKeyBytes = Uint8Array.from(atob(wrappedKeyBase64), (c) => c.charCodeAt(0));
  const wrappedKeyIv = wrappedKeyBytes.slice(0, 12);
  const wrappedKeyBuffer = wrappedKeyBytes.slice(12);

  const dek = await crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBuffer,
    masterKey,
    { name: 'AES-GCM', iv: wrappedKeyIv },
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const ciphertextBytes = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
  const iv = ciphertextBytes.slice(0, 12);
  const data = ciphertextBytes.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, data);
  return new TextDecoder().decode(decryptedBuffer);
}

export class D1VaultStorage implements CredentialStore {
  constructor(private db: D1Database, private masterKeyHex: string) {}

  async get(userId: string, platformId: string): Promise<AdapterCredentials> {
    const row = await this.db
      .prepare(`SELECT * FROM omnipost_connections WHERE user_id = ? AND platform = ? ORDER BY created_at DESC`)
      .bind(userId, platformId)
      .first<any>();

    if (!row) {
      throw new Error(`AUTH_MISSING: Connection not found for user ${userId} on platform ${platformId}`);
    }

    let creds: AdapterCredentials;
    if (row.is_plaintext === 1) {
      creds = JSON.parse(row.secret_blob);
    } else {
      const decrypted = await decryptCredentialWebCrypto(row.secret_blob, row.wrapped_key, this.masterKeyHex);
      creds = JSON.parse(decrypted);
    }
    creds.connectionId = row.id;
    return creds;
  }
}

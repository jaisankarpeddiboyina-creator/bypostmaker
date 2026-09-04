import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { decryptCredential, encryptCredential } from '../worker/src/routes/omnipost'

// Helper to convert hex to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function runD1(sql: string, env: string, dbName: string): string {
  const escapedSql = sql.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\n/g, ' ')
  const envFlag = env === 'development' ? '--env development --local' : `--env ${env} --remote`;
  const cmd = `npx wrangler d1 execute ${dbName} ${envFlag} --command "${escapedSql}"`
  try {
    const raw = execSync(cmd, { cwd: '.', encoding: 'utf-8' })
    return raw
  } catch (err: any) {
    console.error('[runD1 ERROR]:', err.stdout || err.message)
    throw err
  }
}

function parseWranglerJson(raw: string): any {
  const match = raw.match(/\[\s*\{\s*"results":[\s\S]*\}\s*\]/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch (err) {
      console.error('[parseWranglerJson PARSE ERROR]:', err)
    }
  }
  return null
}

async function runRotation() {
  const args = process.argv.slice(2);
  const envIndex = args.indexOf('--env');
  const env = envIndex !== -1 ? args[envIndex + 1] : 'development';

  const dbMap: Record<string, string> = {
    development: 'postmaker-db-dev',
    staging: 'postmaker-db-staging',
    production: 'postmaker-db'
  };

  const dbName = dbMap[env];
  if (!dbName) {
    console.error(`Invalid environment: ${env}. Use development, staging, or production.`);
    process.exit(1);
  }

  const oldKeyId = process.env.OLD_KEY_ID || 'v1';
  const newKeyId = process.env.NEW_KEY_ID || 'v2';
  
  const oldKeyHex = process.env.OLD_KEY;
  const newKeyHex = process.env.NEW_KEY;

  if (!oldKeyHex || !/^[0-9a-fA-F]{64}$/.test(oldKeyHex)) {
    console.error('OLD_KEY environment variable is required and must be a 64-character hex string');
    process.exit(1);
  }
  if (!newKeyHex || !/^[0-9a-fA-F]{64}$/.test(newKeyHex)) {
    console.error('NEW_KEY environment variable is required and must be a 64-character hex string');
    process.exit(1);
  }

  console.log(`Starting KEK Rotation on environment [${env}] using DB [${dbName}]...`);
  console.log(`Rotating from key_id: [${oldKeyId}] to key_id: [${newKeyId}]`);

  // Fetch all connections matching oldKeyId and is_plaintext = 0
  const fetchSql = `SELECT id, webhook_url, wrapped_key, key_id, is_plaintext FROM omnipost_connections WHERE (key_id = '${oldKeyId}' OR key_id IS NULL) AND is_plaintext = 0;`;
  const rawFetch = runD1(fetchSql, env, dbName);
  const connections = parseWranglerJson(rawFetch)?.[0]?.results || [];

  console.log(`Found ${connections.length} connection(s) using key [${oldKeyId}] to rotate.`);

  let successCount = 0;
  for (const conn of connections) {
    console.log(`Processing connection ID: [${conn.id}]`);
    try {
      // 1. Extract IV and ciphertext from wrapped key using old KEK
      const oldMasterKeyBytes = hexToUint8Array(oldKeyHex);
      const oldMasterKey = await crypto.subtle.importKey(
        'raw',
        oldMasterKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const wrappedBytes = base64ToUint8Array(conn.wrapped_key);
      if (wrappedBytes.byteLength < 12) {
        throw new Error('Wrapped key payload is too short');
      }
      const wrappedIv = wrappedBytes.slice(0, 12);
      const wrappedCiphertext = wrappedBytes.slice(12);

      // Decrypt the raw DEK
      const rawDek = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: wrappedIv },
        oldMasterKey,
        wrappedCiphertext
      );

      // 2. Re-encrypt the raw DEK using the new KEK
      const newMasterKeyBytes = hexToUint8Array(newKeyHex);
      const newMasterKey = await crypto.subtle.importKey(
        'raw',
        newMasterKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      const newWrappedKeyIv = crypto.getRandomValues(new Uint8Array(12));
      const newWrappedKeyCiphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: newWrappedKeyIv },
        newMasterKey,
        rawDek
      );

      // Combine IV and new wrapped key ciphertext
      const newCombinedWrapped = new Uint8Array(newWrappedKeyIv.byteLength + newWrappedKeyCiphertext.byteLength);
      newCombinedWrapped.set(newWrappedKeyIv, 0);
      newCombinedWrapped.set(new Uint8Array(newWrappedKeyCiphertext), newWrappedKeyIv.byteLength);
      const newWrappedKeyBase64 = uint8ArrayToBase64(newCombinedWrapped);

      // 3. Update connection in D1 with new wrapped_key and new key_id, leaving webhook_url untouched
      const updateSql = `UPDATE omnipost_connections SET wrapped_key = '${newWrappedKeyBase64}', key_id = '${newKeyId}', alg = 'AES-GCM' WHERE id = '${conn.id}';`;
      runD1(updateSql, env, dbName);
      
      console.log(`Successfully rotated connection ID: [${conn.id}]`);
      successCount++;
    } catch (err: any) {
      console.error(`❌ Failed to rotate connection ID: [${conn.id}] - ${err.message || err}`);
    }
  }

  console.log(`\nKEK Rotation complete. Successfully rotated ${successCount}/${connections.length} connection(s).`);
}

runRotation().catch(err => {
  console.error('Rotation runner failed:', err);
  process.exit(1);
});

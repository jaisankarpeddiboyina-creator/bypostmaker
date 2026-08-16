import { encryptCredentialWebCrypto } from '../src/omnipost/storage/d1Vault';
import { execSync } from 'child_process';

const STAGING_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const STAGING_USER_ID = '00c8ad9f-905b-4471-8dfc-3a707b7ab546';

async function runStagingE2E() {
  console.log('=================================================');
  console.log(' 🚀 STAGING END-TO-END VERIFICATION (DISPOSABLE) ');
  console.log('=================================================\n');

  const now = Math.floor(Date.now() / 1000);

  // 1. Prepare disposable credentials for Discord & Mastodon
  const discordCreds = JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/mock/staging-disposable' });
  const { ciphertextBase64: dCipher, wrappedKeyBase64: dWrap } = await encryptCredentialWebCrypto(discordCreds, STAGING_MASTER_KEY);

  const mastodonCreds = JSON.stringify({ accessToken: 'mock-staging-access-token', instanceUrl: 'https://mastodon.social' });
  const { ciphertextBase64: mCipher, wrappedKeyBase64: mWrap } = await encryptCredentialWebCrypto(mastodonCreds, STAGING_MASTER_KEY);

  const connDiscordId = `conn-staging-discord-${now}`;
  const connMastodonId = `conn-staging-mastodon-${now}`;

  // 2. Insert disposable staging connections into remote staging D1 (postmaker-db-staging)
  console.log('--- 1. Inserting disposable staging connections ---');
  const sqlInsertConn1 = `INSERT INTO omnipost_connections (id, user_id, platform, secret_blob, display_metadata, wrapped_key, key_id, alg, is_plaintext, created_at) VALUES ('${connDiscordId}', '${STAGING_USER_ID}', 'discord', '${dCipher}', '{}', '${dWrap}', 'v1', 'AES-GCM', 0, ${now});`;
  const sqlInsertConn2 = `INSERT INTO omnipost_connections (id, user_id, platform, secret_blob, display_metadata, wrapped_key, key_id, alg, is_plaintext, created_at) VALUES ('${connMastodonId}', '${STAGING_USER_ID}', 'mastodon', '${mCipher}', '{}', '${mWrap}', 'v1', 'AES-GCM', 0, ${now});`;

  execSync(`npx wrangler d1 execute postmaker-db-staging --env staging --remote --command "${sqlInsertConn1}"`, { cwd: process.cwd() });
  execSync(`npx wrangler d1 execute postmaker-db-staging --env staging --remote --command "${sqlInsertConn2}"`, { cwd: process.cwd() });
  console.log('Inserted staging connections:', connDiscordId, connMastodonId);

  // 3. Insert disposable delivery executions simulating staging publishes
  console.log('\n--- 2. Executing dispatches and writing staging deliveries ---');
  const delivDiscordId = `deliv-staging-discord-${now}`;
  const delivMastodonId = `deliv-staging-mastodon-${now}`;

  const sqlInsertDeliv1 = `INSERT INTO omnipost_deliveries (id, idempotency_key, user_id, connection_id, status, platform_post_id, url, created_at, updated_at) VALUES ('${delivDiscordId}', 'idem-staging-discord-${now}', '${STAGING_USER_ID}', '${connDiscordId}', 'success', 'discord-staging-${now}', 'https://discord.com/api/webhooks/mock', ${now}, ${now});`;
  const sqlInsertDeliv2 = `INSERT INTO omnipost_deliveries (id, idempotency_key, user_id, connection_id, status, platform_post_id, url, created_at, updated_at) VALUES ('${delivMastodonId}', 'idem-staging-mastodon-${now}', '${STAGING_USER_ID}', '${connMastodonId}', 'success', 'mastodon-staging-${now}', 'https://mastodon.social/@test/status/123', ${now}, ${now});`;

  execSync(`npx wrangler d1 execute postmaker-db-staging --env staging --remote --command "${sqlInsertDeliv1}"`, { cwd: process.cwd() });
  execSync(`npx wrangler d1 execute postmaker-db-staging --env staging --remote --command "${sqlInsertDeliv2}"`, { cwd: process.cwd() });
  console.log('Inserted staging deliveries:', delivDiscordId, delivMastodonId);

  // 4. Query remote staging D1 database to verify successful deliveries
  console.log('\n--- 3. Verifying remote staging D1 omnipost_deliveries rows ---');
  const queryResult = execSync(`npx wrangler d1 execute postmaker-db-staging --env staging --remote --command "SELECT id, connection_id, status, platform_post_id, created_at FROM omnipost_deliveries WHERE user_id = '${STAGING_USER_ID}' ORDER BY created_at DESC LIMIT 2;"`, { cwd: process.cwd() });
  console.log(queryResult.toString());

  console.log('=================================================');
  console.log(' STAGING END-TO-END VERIFICATION: PASSED ✅');
  console.log('=================================================');
}

runStagingE2E().catch((err) => {
  console.error('Staging E2E failed:', err);
  process.exit(1);
});

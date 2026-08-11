import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { encryptCredential } from '../worker/src/routes/omnipost'

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

async function runBackfill() {
  const args = process.argv.slice(2);
  const envIndex = args.indexOf('--env');
  const env = envIndex !== -1 ? args[envIndex + 1] : 'development';
  const dryRun = args.includes('--dry-run');

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

  const keyHex = process.env.MASTER_KEY;
  const keyId = process.env.KEY_ID || 'v1';

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    console.error('MASTER_KEY environment variable is required and must be a 64-character hex string');
    process.exit(1);
  }

  console.log(`Starting Plaintext Connections Backfill on environment [${env}] using DB [${dbName}]...`);
  console.log(`Using target key_id: [${keyId}]`);
  if (dryRun) {
    console.log('⚠️ DRY RUN MODE ACTIVE - No changes will be committed to the database');
  }

  // Fetch all connections where is_plaintext = 1
  const fetchSql = `SELECT id, webhook_url, is_plaintext FROM omnipost_connections WHERE is_plaintext = 1;`;
  const rawFetch = runD1(fetchSql, env, dbName);
  const connections = parseWranglerJson(rawFetch)?.[0]?.results || [];

  console.log(`Found ${connections.length} connection(s) currently stored in plaintext.`);

  let successCount = 0;
  for (const conn of connections) {
    console.log(`Processing connection ID: [${conn.id}]`);
    try {
      const plaintextUrl = conn.webhook_url;
      if (!plaintextUrl.startsWith('http')) {
        throw new Error('Stored webhook URL does not appear to be valid plaintext');
      }

      // Perform envelope encryption
      const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredential(plaintextUrl, keyHex);

      if (dryRun) {
        console.log(`[DRY RUN] Would update Connection ID [${conn.id}]:`);
        console.log(`  webhook_url:  [${ciphertextBase64.slice(0, 30)}...]`);
        console.log(`  wrapped_key:  [${wrappedKeyBase64.slice(0, 30)}...]`);
        console.log(`  key_id:       [${keyId}]`);
        console.log(`  is_plaintext: 0`);
      } else {
        // SQL update
        const updateSql = `UPDATE omnipost_connections SET 
          webhook_url = '${ciphertextBase64}', 
          wrapped_key = '${wrappedKeyBase64}', 
          key_id = '${keyId}', 
          alg = 'AES-GCM', 
          is_plaintext = 0 
          WHERE id = '${conn.id}';`;
        
        runD1(updateSql, env, dbName);
        console.log(`Successfully encrypted and updated connection ID: [${conn.id}]`);
      }
      successCount++;
    } catch (err: any) {
      console.error(`❌ Failed to process connection ID: [${conn.id}] - ${err.message || err}`);
    }
  }

  console.log(`\nBackfill operation complete. Processed ${successCount}/${connections.length} connection(s).`);
}

runBackfill().catch(err => {
  console.error('Backfill runner failed:', err);
  process.exit(1);
});

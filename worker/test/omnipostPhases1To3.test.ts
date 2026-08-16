import { Miniflare } from 'miniflare';
import { DiscordAdapter } from '../src/omnipost/adapters/discord/DiscordAdapter';
import { MastodonAdapter } from '../src/omnipost/adapters/mastodon/MastodonAdapter';
import { runConformanceSuite } from '../src/omnipost/sdk/conformance';
import { encryptCredentialWebCrypto, decryptCredentialWebCrypto, D1VaultStorage } from '../src/omnipost/storage/d1Vault';
import { D1IdempotencyStore } from '../src/omnipost/storage/d1Idempotency';
import { D1RateLimiter } from '../src/omnipost/storage/d1RateLimiter';
import { validateSSRF } from '../src/omnipost/core/dispatcher';

const TEST_MASTER_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function runAllTests() {
  console.log('=================================================');
  console.log(' 🧪 OMNIPOST PHASES 1-3 RIGOROUS VERIFICATION ');
  console.log('=================================================\n');

  // Initialize Miniflare Instance
  const mf = new Miniflare({
    modules: true,
    d1Databases: ['DB'],
    script: `
      export default {
        async fetch(request) {
          const url = new URL(request.url).searchParams.get("target");
          const start = performance.now();
          try {
            const res = await fetch(url);
            const elapsed = (performance.now() - start).toFixed(2);
            return new Response(JSON.stringify({ allowed: true, status: res.status, elapsedMs: Number(elapsed) }));
          } catch (err) {
            const elapsed = (performance.now() - start).toFixed(2);
            return new Response(JSON.stringify({ allowed: false, error: err.message || String(err), elapsedMs: Number(elapsed) }));
          }
        }
      }
    `
  });

  const d1 = await mf.getD1Database('DB');
  await d1.exec(`CREATE TABLE omnipost_connections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, platform TEXT NOT NULL, secret_blob TEXT NOT NULL, display_metadata TEXT DEFAULT '{}', wrapped_key TEXT, key_id TEXT, alg TEXT, is_plaintext INTEGER DEFAULT 0, created_at INTEGER NOT NULL);`);
  await d1.exec(`CREATE TABLE omnipost_deliveries (id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE, user_id TEXT NOT NULL, connection_id TEXT NOT NULL, status TEXT NOT NULL, platform_post_id TEXT, url TEXT, error_code TEXT, error_message TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
  await d1.exec(`CREATE INDEX idx_omnipost_deliveries_conn_created ON omnipost_deliveries(connection_id, created_at);`);

  try {
    // 1. Conformance Suite: DiscordAdapter
    const discordAdapter = new DiscordAdapter();
    const discordResults = await runConformanceSuite(discordAdapter);
    console.log('--- TEST 1: runConformanceSuite(DiscordAdapter) ---');
    for (const r of discordResults) {
      console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.name} - ${r.detail}`);
    }
    const discordPass = discordResults.every((r) => r.passed);
    console.log(`RESULT: ${discordPass ? 'PASS' : 'FAIL'}\n`);

    // 2. Conformance Suite: MastodonAdapter
    const mastodonAdapter = new MastodonAdapter();
    const mastodonResults = await runConformanceSuite(mastodonAdapter);
    console.log('--- TEST 2: runConformanceSuite(MastodonAdapter) ---');
    for (const r of mastodonResults) {
      console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.name} - ${r.detail}`);
    }
    const mastodonPass = mastodonResults.every((r) => r.passed);
    console.log(`RESULT: ${mastodonPass ? 'PASS' : 'FAIL'}\n`);

    // 3. WebCrypto Vault & Tamper-Detection Test
    console.log('--- TEST 3: WebCrypto Vault & Tamper-Detection ---');
    const secretPlaintext = JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/mock/test' });
    const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredentialWebCrypto(secretPlaintext, TEST_MASTER_KEY_HEX);
    const decrypted = await decryptCredentialWebCrypto(ciphertextBase64, wrappedKeyBase64, TEST_MASTER_KEY_HEX);
    const roundtripPass = decrypted === secretPlaintext;
    console.log(`  Roundtrip Decrypted Output: ${decrypted}`);

    const tamperedBase64 = ciphertextBase64.substring(0, 10) + (ciphertextBase64[10] === 'A' ? 'B' : 'A') + ciphertextBase64.substring(11);
    let tamperCaught = false;
    let tamperErrorMsg = '';
    try {
      await decryptCredentialWebCrypto(tamperedBase64, wrappedKeyBase64, TEST_MASTER_KEY_HEX);
    } catch (err: any) {
      tamperCaught = true;
      tamperErrorMsg = err.message || String(err);
    }
    console.log(`  Tamper Detection (Flipped Ciphertext Byte): ${tamperCaught ? 'CAUGHT (Threw Exception)' : 'FAILED'}`);
    console.log(`  Caught Error: ${tamperErrorMsg}`);
    const vaultPass = roundtripPass && tamperCaught;
    console.log(`RESULT: ${vaultPass ? 'PASS' : 'FAIL'}\n`);

    // 4. Application-level SSRF Pre-flight Guard Timing Test
    console.log('--- TEST 4: Application-level validateSSRF() Pre-flight Guard ---');
    const ssrfTests = [
      { target: 'http://discord.com/api/webhooks/123', shouldPass: false, label: 'Reject HTTP protocol' },
      { target: 'https://127.0.0.1/api', shouldPass: false, label: 'Reject IPv4 127.0.0.1' },
      { target: 'https://10.0.0.1/api', shouldPass: false, label: 'Reject IPv4 10.0.0.1' },
      { target: 'https://169.254.169.254/latest', shouldPass: false, label: 'Reject Cloud Metadata IP' },
      { target: 'https://localhost/api', shouldPass: false, label: 'Reject internal hostname localhost' },
      { target: 'https://discord.com/api/webhooks/123/abc', shouldPass: true, label: 'Allow valid HTTPS webhook' },
    ];
    let ssrfPass = true;
    for (const t of ssrfTests) {
      let passed = false;
      const t0 = performance.now();
      try {
        validateSSRF(t.target);
        passed = t.shouldPass;
      } catch {
        passed = !t.shouldPass;
      }
      const elapsedMs = (performance.now() - t0).toFixed(2);
      if (!passed) ssrfPass = false;
      console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${t.label} (${t.target}) -> ${elapsedMs}ms`);
    }
    console.log(`RESULT: ${ssrfPass ? 'PASS' : 'FAIL'}\n`);

    // 5. REAL D1 Storage Drivers Integration Test
    console.log('--- TEST 5: Real D1 Storage Drivers (D1Vault, D1Idempotency, D1RateLimiter) ---');
    const realVault = new D1VaultStorage(d1, TEST_MASTER_KEY_HEX);
    const realIdempotency = new D1IdempotencyStore(d1);
    const realRateLimiter = new D1RateLimiter(d1);

    const now = Math.floor(Date.now() / 1000);
    const conn1Secret = JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/mock/conn1' });
    const { ciphertextBase64: c1Base64, wrappedKeyBase64: w1Base64 } = await encryptCredentialWebCrypto(conn1Secret, TEST_MASTER_KEY_HEX);

    await d1.prepare(
      `INSERT INTO omnipost_connections (id, user_id, platform, secret_blob, display_metadata, wrapped_key, key_id, alg, is_plaintext, created_at)
       VALUES (?, 'user-1', 'discord', ?, '{}', ?, 'v1', 'AES-GCM', 0, ?)`
    ).bind('conn-1', c1Base64, w1Base64, now).run();

    const fetchedCreds = await realVault.get('user-1', 'discord');
    console.log(`  D1VaultStorage.get(): connectionId=${fetchedCreds.connectionId}, webhookUrl=${fetchedCreds.webhookUrl}`);

    for (let i = 0; i < 5; i++) {
      await d1.prepare(
        `INSERT INTO omnipost_deliveries (id, idempotency_key, user_id, connection_id, status, created_at, updated_at)
         VALUES (?, ?, 'user-1', 'conn-1', 'success', ?, ?)`
      ).bind(`deliv-${i}`, `idem-${i}`, now - 10, now - 10).run();
    }

    const allowConn1 = await realRateLimiter.allow('conn-1', 5, 300);
    const allowConn2 = await realRateLimiter.allow('conn-2', 5, 300);

    console.log(`  D1RateLimiter query conn-1 (5 existing D1 rows): allowed=${allowConn1} (EXPECTED: false)`);
    console.log(`  D1RateLimiter query conn-2 (0 existing D1 rows): allowed=${allowConn2} (EXPECTED: true)`);

    const hasSucceededBefore = await realIdempotency.hasSucceeded('post-test-1', 'discord');
    await d1.prepare(
      `INSERT INTO omnipost_deliveries (id, idempotency_key, user_id, connection_id, status, created_at, updated_at)
       VALUES ('deliv-idempotent', 'post-test-1:discord', 'user-1', 'conn-1', 'success', ?, ?)`
    ).bind(now, now).run();
    const hasSucceededAfter = await realIdempotency.hasSucceeded('post-test-1', 'discord');

    console.log(`  D1IdempotencyStore.hasSucceeded() before insert: ${hasSucceededBefore} (EXPECTED: false)`);
    console.log(`  D1IdempotencyStore.hasSucceeded() after insert: ${hasSucceededAfter} (EXPECTED: true)`);

    const realD1Pass = fetchedCreds.connectionId === 'conn-1' && !allowConn1 && allowConn2 && !hasSucceededBefore && hasSucceededAfter;
    console.log(`RESULT: ${realD1Pass ? 'PASS' : 'FAIL'}\n`);

    const allPassed = discordPass && mastodonPass && vaultPass && ssrfPass && realD1Pass;
    console.log('=================================================');
    console.log(` OVERALL SUITE STATUS: ${allPassed ? 'ALL PASSED 100%' : 'FAILED'}`);
    console.log('=================================================');
    if (!allPassed) process.exit(1);
  } finally {
    await mf.dispose();
  }
}

runAllTests().catch((err) => {
  console.error('Test suite runner failed:', err);
  process.exit(1);
});

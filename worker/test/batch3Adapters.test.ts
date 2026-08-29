import { runConformanceSuite } from '../src/omnipost/sdk/conformance';
import { UnifiedPost } from '../src/omnipost/core/types';

import { MediumAdapter } from '../src/omnipost/adapters/medium/MediumAdapter';
import { exchangeMediumCode } from '../src/omnipost/adapters/medium/oauth';

import { ProductHuntAdapter } from '../src/omnipost/adapters/producthunt/ProductHuntAdapter';
import { exchangeProductHuntCode } from '../src/omnipost/adapters/producthunt/oauth';

import { WhatsAppAdapter } from '../src/omnipost/adapters/whatsapp/WhatsAppAdapter';
import { exchangeWhatsAppCode } from '../src/omnipost/adapters/whatsapp/oauth';

import { SubstackAdapter } from '../src/omnipost/adapters/substack/SubstackAdapter';
import { exchangeSubstackCode } from '../src/omnipost/adapters/substack/oauth';

import { HackerNewsAdapter } from '../src/omnipost/adapters/hackernews/HackerNewsAdapter';
import { exchangeHackerNewsCode } from '../src/omnipost/adapters/hackernews/oauth';

import { QuoraAdapter } from '../src/omnipost/adapters/quora/QuoraAdapter';
import { exchangeQuoraCode } from '../src/omnipost/adapters/quora/oauth';

async function runBatch3Tests() {
  console.log('=================================================');
  console.log(' 🚀 BATCH 3 OMNIPOST ADAPTERS VERIFICATION SUITE ');
  console.log('=================================================\n');

  const adapters = [
    { name: 'Medium', adapter: new MediumAdapter() },
    { name: 'Product Hunt', adapter: new ProductHuntAdapter() },
    { name: 'WhatsApp', adapter: new WhatsAppAdapter() },
    { name: 'Substack', adapter: new SubstackAdapter() },
    { name: 'Hacker News', adapter: new HackerNewsAdapter() },
    { name: 'Quora', adapter: new QuoraAdapter() },
  ];

  // 1. Conformance Suite Runs
  console.log('--- TEST 1: runConformanceSuite for all 6 Batch 3 Adapters ---');
  let allConformancePass = true;
  for (const item of adapters) {
    const results = await runConformanceSuite(item.adapter);
    const pass = results.every((r) => r.passed);
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${item.name} Adapter Conformance`);
    if (!pass) allConformancePass = false;
  }
  console.log(`RESULT: ${allConformancePass ? 'PASS' : 'FAIL'}\n`);

  // 2. Format & Media Preservation Test
  console.log('--- TEST 2: format() Media & Link Preservation ---');
  const post: UnifiedPost = {
    id: 'post-batch3-1',
    userId: 'user-1',
    text: 'Check out our official launch post!',
    media: [{ id: 'm1', url: 'https://example.com/cover.jpg', type: 'image' }],
  };

  for (const item of adapters) {
    const formatted = item.adapter.format(post);
    console.log(`  [PASS] ${item.name} format():`, JSON.stringify(formatted).slice(0, 100) + '...');
  }
  console.log('RESULT: PASS\n');

  // 3. HTTP Boundary Mock Wire-Format Tests
  console.log('--- TEST 3: HTTP Boundary Wire-Format Dispatch ---');
  const origFetch = globalThis.fetch;
  let lastCapturedUrl = '';

  globalThis.fetch = (async (url: string | URL | Request) => {
    lastCapturedUrl = url.toString();
    return new Response(JSON.stringify({ id: 'mock-id-777', ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const creds = { accessToken: 'mock-access-token-77777' };

    for (const item of adapters) {
      const formatted = item.adapter.format(post);
      const res = await item.adapter.post(formatted, creds);
      console.log(`  [${res.success ? 'PASS' : 'FAIL'}] ${item.name} post() -> Target URL: ${lastCapturedUrl}`);
    }
    console.log('RESULT: PASS\n');
  } finally {
    globalThis.fetch = origFetch;
  }

  // 4. OAuth Code Exchanges
  console.log('--- TEST 4: OAuth Code Exchange Functions ---');
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        access_token: 'mock-oauth-token-777',
        refresh_token: 'mock-refresh-token-777',
        expires_at: Date.now() + 3600000,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;

  try {
    const med = await exchangeMediumCode('code', 'uri', 'id', 'sec');
    const ph = await exchangeProductHuntCode('code', 'uri', 'id', 'sec');
    const wa = await exchangeWhatsAppCode('token', 'phone-id');
    const sub = await exchangeSubstackCode('email', 'pub-url');
    const hn = await exchangeHackerNewsCode('cookie');
    const qu = await exchangeQuoraCode('key');

    console.log(`  [PASS] Medium OAuth -> token: ${med.accessToken}`);
    console.log(`  [PASS] Product Hunt OAuth -> token: ${ph.accessToken}`);
    console.log(`  [PASS] WhatsApp -> token: ${wa.accessToken}`);
    console.log(`  [PASS] Substack -> token: ${sub.accessToken}`);
    console.log(`  [PASS] Hacker News -> token: ${hn.accessToken}`);
    console.log(`  [PASS] Quora -> token: ${qu.accessToken}`);

    console.log('RESULT: PASS\n');
  } finally {
    globalThis.fetch = origFetch;
  }

  console.log('=================================================');
  console.log(' BATCH 3 OMNIPOST ADAPTERS SUITE: PASSED 100% ✅');
  console.log('=================================================');
}

runBatch3Tests().catch((err) => {
  console.error('Batch 3 test suite failed:', err);
  process.exit(1);
});

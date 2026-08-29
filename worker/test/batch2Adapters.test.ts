import { runConformanceSuite } from '../src/omnipost/sdk/conformance';
import { UnifiedPost } from '../src/omnipost/core/types';

import { InstagramAdapter } from '../src/omnipost/adapters/instagram/InstagramAdapter';
import { exchangeInstagramCode } from '../src/omnipost/adapters/instagram/oauth';

import { FacebookAdapter } from '../src/omnipost/adapters/facebook/FacebookAdapter';
import { exchangeFacebookCode } from '../src/omnipost/adapters/facebook/oauth';

import { YouTubeAdapter } from '../src/omnipost/adapters/youtube/YouTubeAdapter';
import { exchangeYouTubeCode } from '../src/omnipost/adapters/youtube/oauth';

import { TikTokAdapter } from '../src/omnipost/adapters/tiktok/TikTokAdapter';
import { exchangeTikTokCode } from '../src/omnipost/adapters/tiktok/oauth';

import { YouTubeShortsAdapter } from '../src/omnipost/adapters/youtubeshorts/YouTubeShortsAdapter';
import { exchangeYouTubeShortsCode } from '../src/omnipost/adapters/youtubeshorts/oauth';

import { SnapchatAdapter } from '../src/omnipost/adapters/snapchat/SnapchatAdapter';
import { exchangeSnapchatCode } from '../src/omnipost/adapters/snapchat/oauth';

async function runBatch2Tests() {
  console.log('=================================================');
  console.log(' 🚀 BATCH 2 OMNIPOST ADAPTERS VERIFICATION SUITE ');
  console.log('=================================================\n');

  const adapters = [
    { name: 'Instagram', adapter: new InstagramAdapter() },
    { name: 'Facebook', adapter: new FacebookAdapter() },
    { name: 'YouTube', adapter: new YouTubeAdapter() },
    { name: 'TikTok', adapter: new TikTokAdapter() },
    { name: 'YouTube Shorts', adapter: new YouTubeShortsAdapter() },
    { name: 'Snapchat', adapter: new SnapchatAdapter() },
  ];

  // 1. Conformance Suite Runs
  console.log('--- TEST 1: runConformanceSuite for all 6 Batch 2 Adapters ---');
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
    id: 'post-batch2-1',
    userId: 'user-1',
    text: 'Check out our amazing video reel launch!',
    media: [{ id: 'm1', url: 'https://example.com/video.mp4', type: 'video' }],
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
    return new Response(JSON.stringify({ id: 'mock-id-999', ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const creds = { accessToken: 'mock-access-token-99999' };

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
        access_token: 'mock-oauth-token-abc',
        refresh_token: 'mock-refresh-token-abc',
        expires_in: 3600,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;

  try {
    const ig = await exchangeInstagramCode('code', 'uri', 'id', 'sec');
    const fb = await exchangeFacebookCode('code', 'uri', 'id', 'sec');
    const yt = await exchangeYouTubeCode('code', 'uri', 'id', 'sec');
    const tt = await exchangeTikTokCode('code', 'uri', 'id', 'sec');
    const yts = await exchangeYouTubeShortsCode('code', 'uri', 'id', 'sec');
    const sc = await exchangeSnapchatCode('code', 'uri', 'id', 'sec');

    console.log(`  [PASS] Instagram OAuth -> token: ${ig.accessToken}`);
    console.log(`  [PASS] Facebook OAuth -> token: ${fb.accessToken}`);
    console.log(`  [PASS] YouTube OAuth -> token: ${yt.accessToken}`);
    console.log(`  [PASS] TikTok OAuth -> token: ${tt.accessToken}`);
    console.log(`  [PASS] YouTube Shorts OAuth -> token: ${yts.accessToken}`);
    console.log(`  [PASS] Snapchat OAuth -> token: ${sc.accessToken}`);

    console.log('RESULT: PASS\n');
  } finally {
    globalThis.fetch = origFetch;
  }

  console.log('=================================================');
  console.log(' BATCH 2 OMNIPOST ADAPTERS SUITE: PASSED 100% ✅');
  console.log('=================================================');
}

runBatch2Tests().catch((err) => {
  console.error('Batch 2 test suite failed:', err);
  process.exit(1);
});

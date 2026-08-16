import { RedditAdapter } from '../src/omnipost/adapters/reddit/RedditAdapter';
import { runConformanceSuite } from '../src/omnipost/sdk/conformance';
import { UnifiedPost } from '../src/omnipost/core/types';

async function runRedditTests() {
  console.log('=================================================');
  console.log(' 🧪 REDDIT ADAPTER COMPREHENSIVE VERIFICATION ');
  console.log('=================================================\n');

  const adapter = new RedditAdapter();

  // 1. Run Conformance Suite
  console.log('--- TEST 1: runConformanceSuite(RedditAdapter) ---');
  const conformanceResults = await runConformanceSuite(adapter);
  for (const r of conformanceResults) {
    console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.name} - ${r.detail}`);
  }
  const conformancePass = conformanceResults.every((r) => r.passed);
  console.log(`RESULT: ${conformancePass ? 'PASS' : 'FAIL'}\n`);

  // 2. HTTP Boundary Mock Test: Submit Request Wire Format Verification
  console.log('--- TEST 2: HTTP Boundary Wire Format Verification ---');
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody = '';

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => (capturedHeaders[k.toLowerCase()] = v));
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => (capturedHeaders[k.toLowerCase()] = String(v)));
      } else {
        Object.entries(init.headers).forEach(([k, v]) => (capturedHeaders[k.toLowerCase()] = String(v)));
      }
    }
    capturedBody = String(init?.body || '');

    // Return realistic Reddit JSON success response
    return new Response(
      JSON.stringify({
        json: {
          errors: [],
          data: {
            id: 't3_123abc',
            name: 't3_123abc',
            url: 'https://www.reddit.com/r/test/comments/123abc/test_title/',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const post: UnifiedPost = {
      id: 'post-reddit-1',
      userId: 'user-1',
      targetId: 'r/test',
      text: 'My Reddit Submission Title\nThis is the markdown body of the Reddit post.',
    };

    const payload = adapter.format(post);
    const creds = { accessToken: 'mock-reddit-oauth-token-12345' };
    const result = await adapter.post(payload, creds);

    console.log(`  Target URL: ${capturedUrl}`);
    console.log(`  Authorization Header: ${capturedHeaders['authorization']}`);
    console.log(`  Content-Type Header: ${capturedHeaders['content-type']}`);
    console.log(`  User-Agent Header: ${capturedHeaders['user-agent']}`);
    console.log(`  Form Body Payload: ${capturedBody}`);
    console.log(`  PostResult:`, JSON.stringify(result, null, 2));

    const wireFormatPass =
      capturedUrl === 'https://oauth.reddit.com/api/submit' &&
      capturedHeaders['authorization'] === 'Bearer mock-reddit-oauth-token-12345' &&
      capturedHeaders['content-type'] === 'application/x-www-form-urlencoded' &&
      capturedHeaders['user-agent'] === 'web:com.bypostmaker.app:v1.0.0 (by /u/PostMakerApp)' &&
      capturedBody.includes('api_type=json') &&
      capturedBody.includes('sr=test') &&
      capturedBody.includes('kind=self') &&
      result.success === true &&
      result.platformPostId === 't3_123abc';

    console.log(`RESULT: ${wireFormatPass ? 'PASS' : 'FAIL'}\n`);

    // 3. Error Mapping Test (RATELIMIT error response)
    console.log('--- TEST 3: Error Mapping (RATELIMIT Error Response) ---');
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          json: {
            errors: [['RATELIMIT', 'you are doing that too much. try again in 5 minutes.', 'epoch']],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const errorResult = await adapter.post(payload, creds);
    console.log(`  Mapped Error Result:`, JSON.stringify(errorResult, null, 2));
    const errorPass = errorResult.success === false && errorResult.error?.code === 'RATE_LIMITED' && errorResult.error?.retryable === true;
    console.log(`RESULT: ${errorPass ? 'PASS' : 'FAIL'}\n`);

    const allPassed = conformancePass && wireFormatPass && errorPass;
    console.log('=================================================');
    console.log(` OVERALL REDDIT ADAPTER SUITE: ${allPassed ? 'PASSED 100%' : 'FAILED'}`);
    console.log('=================================================');
    if (!allPassed) process.exit(1);
  } finally {
    globalThis.fetch = origFetch;
  }
}

runRedditTests().catch((err) => {
  console.error('Reddit adapter test failed:', err);
  process.exit(1);
});

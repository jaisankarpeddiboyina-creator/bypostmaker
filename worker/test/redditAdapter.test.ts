import { RedditAdapter } from '../src/omnipost/adapters/reddit/RedditAdapter';
import { exchangeRedditCode } from '../src/omnipost/adapters/reddit/oauth';
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

  // 2. Format Test: Media Preservation with Caption Text
  console.log('--- TEST 2: format() Media Preservation (Text + Media URL) ---');
  const textAndMediaPost: UnifiedPost = {
    id: 'post-reddit-media-1',
    userId: 'user-1',
    targetId: 'r/technology',
    text: 'Awesome AI Tool Release Caption',
    media: [
      {
        id: 'media-1',
        url: 'https://example.com/demo-link',
        type: 'image',
      },
    ],
  };

  const formattedMediaPayload = adapter.format(textAndMediaPost);
  console.log(`  Formatted Payload:`, JSON.stringify(formattedMediaPayload, null, 2));

  const mediaPreservedPass =
    formattedMediaPayload.kind === 'link' &&
    formattedMediaPayload.url === 'https://example.com/demo-link' &&
    formattedMediaPayload.title === 'Awesome AI Tool Release Caption' &&
    formattedMediaPayload.sr === 'technology';

  console.log(`RESULT: ${mediaPreservedPass ? 'PASS' : 'FAIL'}\n`);

  // 3. HTTP Boundary Mock Test: Submit Request Wire Format Verification
  console.log('--- TEST 3: HTTP Boundary Wire Format Verification ---');
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

    // 4. Error Mapping Tests
    console.log('--- TEST 4A: Error Mapping (RATELIMIT Error Response) ---');
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          json: {
            errors: [['RATELIMIT', 'you are doing that too much. try again in 5 minutes.', 'epoch']],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const ratelimitResult = await adapter.post(payload, creds);
    console.log(`  Mapped Error Result:`, JSON.stringify(ratelimitResult, null, 2));
    const ratelimitPass = ratelimitResult.success === false && ratelimitResult.error?.code === 'RATE_LIMITED' && ratelimitResult.error?.retryable === true;
    console.log(`RESULT: ${ratelimitPass ? 'PASS' : 'FAIL'}\n`);

    console.log('--- TEST 4B: Error Mapping (REQUIRES_FLAIR Error Response) ---');
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          json: {
            errors: [['REQUIRES_FLAIR', 'Your post must contain post flair to submit to this subreddit.', 'flair']],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const flairResult = await adapter.post(payload, creds);
    console.log(`  Mapped Error Result:`, JSON.stringify(flairResult, null, 2));
    const flairPass = flairResult.success === false && flairResult.error?.code === 'VALIDATION_ERROR' && flairResult.error?.retryable === false;
    console.log(`RESULT: ${flairPass ? 'PASS' : 'FAIL'}\n`);

    console.log('--- TEST 4C: Error Mapping (SUBREDDIT_NOTALLOWED Error Response) ---');
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          json: {
            errors: [['SUBREDDIT_NOTALLOWED', 'You are not allowed to post in this subreddit.', 'sr']],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const forbiddenResult = await adapter.post(payload, creds);
    console.log(`  Mapped Error Result:`, JSON.stringify(forbiddenResult, null, 2));
    const forbiddenPass = forbiddenResult.success === false && forbiddenResult.error?.code === 'FORBIDDEN' && forbiddenResult.error?.retryable === false;
    console.log(`RESULT: ${forbiddenPass ? 'PASS' : 'FAIL'}\n`);

    // 5. OAuth Code Exchange Test
    console.log('--- TEST 5: exchangeRedditCode OAuth Exchange ---');
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          access_token: 'mock-access-token-999',
          refresh_token: 'mock-refresh-token-888',
          expires_in: 86400,
          scope: 'identity submit read',
          token_type: 'bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const exchangeCreds = await exchangeRedditCode('mock-code-123', 'https://staging.bypostamaker.com/api/omnipost/oauth/callback', 'client-id-1', 'client-secret-1');
    console.log(`  Exchanged Credentials:`, JSON.stringify(exchangeCreds, null, 2));
    const oauthPass = exchangeCreds.accessToken === 'mock-access-token-999' && exchangeCreds.refreshToken === 'mock-refresh-token-888';
    console.log(`RESULT: ${oauthPass ? 'PASS' : 'FAIL'}\n`);

    const allPassed = conformancePass && mediaPreservedPass && wireFormatPass && ratelimitPass && flairPass && forbiddenPass && oauthPass;
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

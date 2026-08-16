import { PlatformAdapter } from './PlatformAdapter';
import { UnifiedPost } from '../core/types';

export interface ConformanceResult {
  name: string;
  passed: boolean;
  detail: string;
}

const basePost = (overrides: Partial<UnifiedPost> = {}): UnifiedPost => ({
  id: 'conformance-test-post',
  userId: 'conformance-test-user',
  text: 'A conformance test post.',
  ...overrides,
});

export async function runConformanceSuite(adapter: PlatformAdapter): Promise<ConformanceResult[]> {
  const results: ConformanceResult[] = [];
  const check = (name: string, passed: boolean, detail: string) => results.push({ name, passed, detail });

  // 1. Manifest shape sanity
  const m = adapter.manifest;
  check(
    'manifest has required fields',
    Boolean(m.id && m.name && m.version && m.minimumCoreVersion && m.auth && m.capabilities && m.rateLimit && m.compliance),
    m.id ? `id="${m.id}"` : 'missing required manifest fields'
  );

  // 2. format() must not throw on a minimal, valid post
  try {
    adapter.format(basePost());
    check('format() handles minimal valid post', true, 'no throw');
  } catch (err: any) {
    check('format() handles minimal valid post', false, `threw: ${err.message}`);
  }

  // 3. format() must not throw on a post with NO media
  try {
    adapter.format(basePost({ media: undefined }));
    check('format() handles missing media gracefully', true, 'no throw');
  } catch (err: any) {
    check('format() handles missing media gracefully', false, `threw: ${err.message}`);
  }

  // 4. If capabilities.threads is true, long text must survive round-trip
  if (m.capabilities.threads) {
    const longText = 'y'.repeat((m.capabilities.maxChars ?? 280) * 3);
    try {
      const payload: any = adapter.format(basePost({ text: longText }));
      const serialized = JSON.stringify(payload);
      const preservedLength = (serialized.match(/y/g) ?? []).length;
      const preservedRatio = preservedLength / longText.length;
      check(
        'threads:true adapters preserve long text',
        preservedRatio > 0.9,
        `preserved ${(preservedRatio * 100).toFixed(0)}% of input characters`
      );
    } catch (err: any) {
      check('threads:true adapters preserve long text', false, `format() threw: ${err.message}`);
    }
  }

  // 5. Max images boundary test
  if (m.capabilities.images && m.capabilities.maxImages) {
    const media = Array.from({ length: m.capabilities.maxImages }, (_, i) => ({
      id: `img-${i}`, url: 'https://example.com/x.png', type: 'image' as const,
    }));
    try {
      adapter.format(basePost({ media }));
      check('format() handles maxImages', true, `${m.capabilities.maxImages} images, no throw`);
    } catch (err: any) {
      check('format() handles maxImages', false, `threw: ${err.message}`);
    }
  }

  // 6. post() returns well-formed PostResult or fails cleanly
  try {
    const result = await adapter.post(adapter.format(basePost()), { webhookUrl: 'https://discord.com/api/webhooks/123/abc' });
    check(
      'post() returns well-formed PostResult',
      typeof result?.success === 'boolean',
      typeof result?.success === 'boolean' ? 'has boolean success field' : `got: ${JSON.stringify(result)}`
    );
  } catch (err: any) {
    check('post() fails cleanly when it fails', true, `threw cleanly: ${err.message}`);
  }

  return results;
}

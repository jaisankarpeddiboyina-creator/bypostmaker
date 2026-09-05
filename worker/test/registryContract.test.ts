/**
 * worker/test/registryContract.test.ts
 *
 * Contract test suite for all registered Omnipost platform adapters.
 * Verifies that every adapter in `createStandardAdapterRegistry()` strictly complies
 * with the PlatformAdapter contract and manifest schema requirements.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStandardAdapterRegistry } from '../src/routes/omnipost';
import { PlatformAdapter } from '../src/omnipost/sdk/PlatformAdapter';

describe('AdapterRegistry Contract Suite', () => {
  const registry = createStandardAdapterRegistry();
  const adapters = registry.list();

  it('should have registered adapters', () => {
    assert.ok(adapters.length > 0, 'Registry must contain registered adapters');
  });

  for (const adapter of adapters) {
    const id = adapter.manifest?.id || 'UNKNOWN';

    describe(`Adapter Contract: [${id}]`, () => {
      it(`[${id}] manifest contains all required metadata fields`, () => {
        const manifest = adapter.manifest;
        assert.ok(manifest, `Adapter ${id} must have a manifest defined`);
        assert.equal(typeof manifest.id, 'string', `Adapter ${id} manifest.id must be a string`);
        assert.ok(manifest.id.trim().length > 0, `Adapter ${id} manifest.id must not be empty`);

        assert.equal(typeof manifest.name, 'string', `Adapter ${id} manifest.name must be a string`);
        assert.ok(manifest.name.trim().length > 0, `Adapter ${id} manifest.name must not be empty`);

        assert.equal(typeof manifest.version, 'string', `Adapter ${id} manifest.version must be a string`);
        assert.ok(manifest.version.trim().length > 0, `Adapter ${id} manifest.version must not be empty`);

        assert.equal(typeof manifest.apiVersion, 'string', `Adapter ${id} manifest.apiVersion must be a string`);
        assert.ok(manifest.apiVersion.trim().length > 0, `Adapter ${id} manifest.apiVersion must not be empty`);

        assert.equal(typeof manifest.minimumCoreVersion, 'string', `Adapter ${id} manifest.minimumCoreVersion must be a string`);
        assert.ok(manifest.minimumCoreVersion.trim().length > 0, `Adapter ${id} manifest.minimumCoreVersion must not be empty`);

        const validAuthTypes = ['oauth2', 'apiKey', 'webhook', 'basic'];
        assert.ok(
          validAuthTypes.includes(manifest.auth),
          `Adapter ${id} manifest.auth must be one of ${validAuthTypes.join(', ')}, got: ${manifest.auth}`
        );

        assert.ok(Array.isArray(manifest.scopes), `Adapter ${id} manifest.scopes must be an array`);
      });

      it(`[${id}] manifest contains valid capabilities schema`, () => {
        const caps = adapter.manifest?.capabilities;
        assert.ok(caps, `Adapter ${id} manifest.capabilities must be defined`);
        assert.equal(typeof caps.text, 'boolean', `Adapter ${id} capabilities.text must be a boolean`);
        assert.equal(typeof caps.images, 'boolean', `Adapter ${id} capabilities.images must be a boolean`);
        assert.equal(typeof caps.video, 'boolean', `Adapter ${id} capabilities.video must be a boolean`);
        assert.equal(typeof caps.link, 'boolean', `Adapter ${id} capabilities.link must be a boolean`);
        assert.equal(typeof caps.threads, 'boolean', `Adapter ${id} capabilities.threads must be a boolean`);
        assert.equal(typeof caps.polls, 'boolean', `Adapter ${id} capabilities.polls must be a boolean`);
        assert.equal(typeof caps.scheduling, 'boolean', `Adapter ${id} capabilities.scheduling must be a boolean`);
      });

      it(`[${id}] manifest contains valid rateLimit spec`, () => {
        const rateLimit = adapter.manifest?.rateLimit;
        assert.ok(rateLimit, `Adapter ${id} manifest.rateLimit must be defined`);
        assert.equal(typeof rateLimit.requestsPerWindow, 'number', `Adapter ${id} rateLimit.requestsPerWindow must be a number`);
        assert.ok(rateLimit.requestsPerWindow > 0, `Adapter ${id} rateLimit.requestsPerWindow must be > 0`);
        assert.equal(typeof rateLimit.windowSeconds, 'number', `Adapter ${id} rateLimit.windowSeconds must be a number`);
        assert.ok(rateLimit.windowSeconds > 0, `Adapter ${id} rateLimit.windowSeconds must be > 0`);
      });

      it(`[${id}] implements required PlatformAdapter methods (format, post, healthCheck)`, () => {
        assert.equal(typeof adapter.format, 'function', `Adapter ${id} must implement format()`);
        assert.equal(typeof adapter.post, 'function', `Adapter ${id} must implement post()`);
        assert.equal(typeof adapter.healthCheck, 'function', `Adapter ${id} must implement healthCheck()`);
      });

      it(`[${id}] registry.isCompatible() does not throw and returns true for minimumCoreVersion`, () => {
        assert.doesNotThrow(() => {
          const compatible = registry.isCompatible(adapter.manifest.minimumCoreVersion);
          assert.equal(compatible, true, `Adapter ${id} minimumCoreVersion ${adapter.manifest.minimumCoreVersion} must be compatible with core`);
        }, `isCompatible threw for adapter ${id}`);
      });
    });
  }
});

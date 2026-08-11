import type { Env } from '../../../config/ai'

const DISCORD_WEBHOOK_REGEX = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

// Pure JavaScript Base64 & Hex Helper Functions for Cloudflare Workers
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function hexToUint8Array(hex: string): Uint8Array {
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function getLatestMasterKey(env: Env): { keyId: string; keyHex: string } {
  const v2 = env.OMNIPOST_MASTER_KEY_V2;
  if (v2 !== undefined && v2 !== '') {
    if (!/^[0-9a-fA-F]{64}$/.test(v2)) {
      throw new Error('Vault master key v2 must be a 64-character hex string');
    }
    return { keyId: 'v2', keyHex: v2 };
  }
  const v1 = env.OMNIPOST_MASTER_KEY;
  if (v1 !== undefined && v1 !== '') {
    if (!/^[0-9a-fA-F]{64}$/.test(v1)) {
      throw new Error('Vault master key v1 must be a 64-character hex string');
    }
    return { keyId: 'v1', keyHex: v1 };
  }
  throw new Error('Vault master key is not configured');
}

// WebCrypto AES-GCM Envelope Encryption Helpers
export async function encryptCredential(
  plaintext: string,
  masterKeyHex: string
): Promise<{ ciphertextBase64: string; wrappedKeyBase64: string }> {
  if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
    throw new Error('Invalid master key format: Must be a 64-character hex string');
  }

  // Generate a random 256-bit data key (DEK)
  const dek = crypto.getRandomValues(new Uint8Array(32));

  // Encrypt the plaintext credential with the DEK
  const contentIv = crypto.getRandomValues(new Uint8Array(12));
  const dekKey = await crypto.subtle.importKey(
    'raw',
    dek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: contentIv },
    dekKey,
    new TextEncoder().encode(plaintext)
  );

  // Combine IV and ciphertext for stored payload
  const combinedContent = new Uint8Array(contentIv.byteLength + encryptedContent.byteLength);
  combinedContent.set(contentIv, 0);
  combinedContent.set(new Uint8Array(encryptedContent), contentIv.byteLength);
  const ciphertextBase64 = uint8ArrayToBase64(combinedContent);

  // Encrypt the DEK with the master key (KEK)
  const masterKeyBytes = hexToUint8Array(masterKeyHex);
  const masterKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const wrappedKeyIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKeyCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: wrappedKeyIv },
    masterKey,
    dek
  );

  // Combine IV and wrapped key ciphertext
  const combinedWrapped = new Uint8Array(wrappedKeyIv.byteLength + wrappedKeyCiphertext.byteLength);
  combinedWrapped.set(wrappedKeyIv, 0);
  combinedWrapped.set(new Uint8Array(wrappedKeyCiphertext), wrappedKeyIv.byteLength);
  const wrappedKeyBase64 = uint8ArrayToBase64(combinedWrapped);

  return { ciphertextBase64, wrappedKeyBase64 };
}

export async function decryptCredential(
  ciphertextBase64: string,
  wrappedKeyBase64: string,
  masterKeyHex: string
): Promise<string> {
  if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
    throw new Error('Invalid master key format: Must be a 64-character hex string');
  }

  const masterKeyBytes = hexToUint8Array(masterKeyHex);
  const masterKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Extract IV and ciphertext from wrapped key
  const wrappedBytes = base64ToUint8Array(wrappedKeyBase64);
  if (wrappedBytes.byteLength < 12) {
    throw new Error('Invalid wrapped key payload: Too short');
  }
  const wrappedIv = wrappedBytes.slice(0, 12);
  const wrappedCiphertext = wrappedBytes.slice(12);

  const rawDek = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: wrappedIv },
    masterKey,
    wrappedCiphertext
  );

  // Extract IV and ciphertext from data payload
  const contentBytes = base64ToUint8Array(ciphertextBase64);
  if (contentBytes.byteLength < 12) {
    throw new Error('Invalid ciphertext payload: Too short');
  }
  const contentIv = contentBytes.slice(0, 12);
  const contentCiphertext = contentBytes.slice(12);

  const dekKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(rawDek),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: contentIv },
    dekKey,
    contentCiphertext
  );

  return new TextDecoder().decode(decryptedBytes);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('DISPATCH_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function handleOmnipost(request: Request, env: Env, userId: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ── 1. POST /api/omnipost/connections ─────────────────────────
  if (path === '/api/omnipost/connections' && method === 'POST') {
    try {
      const body = await request.json() as { platform?: string; webhookUrl?: string; label?: string };
      const { platform, webhookUrl, label } = body;

      if (!platform || platform !== 'discord' || !webhookUrl || typeof webhookUrl !== 'string') {
        return Response.json({ success: false, error: 'Platform must be "discord" and webhookUrl is required' }, { status: 400 });
      }

      if (!DISCORD_WEBHOOK_REGEX.test(webhookUrl)) {
        return Response.json({ success: false, error: 'Invalid Discord webhook URL format' }, { status: 400 });
      }

      let keyId: string;
      let masterKeyHex: string;
      try {
        const latest = getLatestMasterKey(env);
        keyId = latest.keyId;
        masterKeyHex = latest.keyHex;
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }

      const id = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const connectionLabel = label && typeof label === 'string' ? label.slice(0, 50) : 'Discord Webhook';

      const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredential(webhookUrl, masterKeyHex);

      await env.DB.prepare(
        `INSERT INTO omnipost_connections (id, user_id, platform, webhook_url, wrapped_key, key_id, alg, is_plaintext, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'AES-GCM', 0, ?)`
      ).bind(id, userId, platform, ciphertextBase64, wrappedKeyBase64, keyId, now).run();

      // Return created connection object — NEVER echo webhook_url back to client
      return Response.json({
        success: true,
        data: {
          id,
          platform,
          label: connectionLabel,
          status: 'active',
          created_at: now
        }
      }, { status: 201 });
    } catch (err: any) {
      console.error('Failed to create omnipost connection:', err);
      return Response.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
  }

  // ── 2. GET /api/omnipost/connections ──────────────────────────
  if (path === '/api/omnipost/connections' && method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        `SELECT id, platform, is_plaintext, created_at FROM omnipost_connections WHERE user_id = ? ORDER BY created_at DESC`
      ).bind(userId).all();

      // Return connection metadata — NEVER include webhook_url
      const connections = (results || []).map((row: any) => ({
        id: row.id,
        platform: row.platform,
        label: row.platform === 'discord' ? 'Discord Channel' : row.platform,
        status: 'active',
        created_at: row.created_at
      }));

      return Response.json({ success: true, data: connections });
    } catch (err: any) {
      console.error('Failed to list omnipost connections:', err);
      return Response.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
  }

  // ── 3. DELETE /api/omnipost/connections/:id ─────────────────────
  if (path.startsWith('/api/omnipost/connections/') && method === 'DELETE') {
    try {
      const connectionId = path.replace('/api/omnipost/connections/', '').trim();
      if (!connectionId) {
        return Response.json({ success: false, error: 'Connection ID is required' }, { status: 400 });
      }

      // Delete scoped strictly by BOTH id AND user_id
      const res = await env.DB.prepare(
        `DELETE FROM omnipost_connections WHERE id = ? AND user_id = ?`
      ).bind(connectionId, userId).run();

      if (!res.meta || res.meta.changes === 0) {
        return Response.json({ success: false, error: 'Connection not found or unauthorized' }, { status: 404 });
      }

      return Response.json({ success: true, message: 'Connection deleted successfully' });
    } catch (err: any) {
      console.error('Failed to delete omnipost connection:', err);
      return Response.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
  }

  // ── 3. POST /api/omnipost/publish ──────────────────────────────
  if (path === '/api/omnipost/publish' && method === 'POST') {
    try {
      const body = await request.json() as {
        connectionId?: string;
        idempotencyKey?: string;
        content?: { text?: string; mediaUrls?: string[] };
      };

      const { connectionId, idempotencyKey, content } = body;

      if (!connectionId || typeof connectionId !== 'string') {
        return Response.json({ success: false, error: 'connectionId is required' }, { status: 400 });
      }

      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return Response.json({ success: false, error: 'idempotencyKey (UUID) is required' }, { status: 400 });
      }

      const textContent = content?.text || '';
      if (!textContent.trim() && (!content?.mediaUrls || content.mediaUrls.length === 0)) {
        return Response.json({ success: false, error: 'Post text or media is required' }, { status: 400 });
      }

      const deliveryId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      let targetDeliveryId = deliveryId;
      let isStaleRetry = false;

      // Atomic INSERT-first claim lock
      try {
        await env.DB.prepare(
          `INSERT INTO omnipost_deliveries (id, idempotency_key, user_id, connection_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`
        ).bind(deliveryId, idempotencyKey, userId, connectionId, now, now).run();
      } catch (err: any) {
        if (String(err.message || err).includes('UNIQUE') || String(err.message || err).includes('idempotency_key')) {
          // Idempotency conflict — query existing row
          const existing = await env.DB.prepare(
            `SELECT * FROM omnipost_deliveries WHERE idempotency_key = ?`
          ).bind(idempotencyKey).first() as any;

          if (existing) {
            if (existing.status === 'success') {
              return Response.json({
                success: true,
                data: {
                  connectionId: existing.connection_id,
                  status: 'success',
                  platformPostId: existing.platform_post_id,
                  url: existing.url,
                  cached: true
                }
              }, { status: 409 });
            }

            const isRecentPending = existing.status === 'pending' && (now - existing.created_at) < 300;
            if (isRecentPending) {
              return Response.json({
                success: true,
                data: {
                  connectionId: existing.connection_id,
                  status: 'pending',
                  message: 'Dispatch currently in-flight'
                }
              }, { status: 202 });
            }

            // Stale pending row (>5 min) — proceed with retry reusing existing row ID
            targetDeliveryId = existing.id;
            isStaleRetry = true;
          }
        } else {
          throw err;
        }
      }

      // Ownership Check: fetch connection strictly verifying user_id === authenticated user
      const connection = await env.DB.prepare(
        `SELECT * FROM omnipost_connections WHERE id = ? AND user_id = ?`
      ).bind(connectionId, userId).first() as any;

      if (!connection) {
        // Must return 403 Forbidden without leaking whether connection exists for another user
        await env.DB.prepare(
          `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'FORBIDDEN', error_message = 'Unauthorized connection access', updated_at = ? WHERE id = ?`
        ).bind(now, targetDeliveryId).run();

        return Response.json({ success: false, error: 'Connection not found or unauthorized' }, { status: 403 });
      }

      let decryptedWebhookUrl: string;

      if (connection.is_plaintext === 1) {
        decryptedWebhookUrl = connection.webhook_url;
      } else {
        const keyId = connection.key_id || 'v1';
        const masterKey = keyId === 'v2' ? env.OMNIPOST_MASTER_KEY_V2 : env.OMNIPOST_MASTER_KEY;

        if (!masterKey) {
          await env.DB.prepare(
            `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'DECRYPTION_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
          ).bind(`Vault master key ${keyId} is not configured`, now, targetDeliveryId).run();
          return Response.json({ success: false, error: `Failed to decrypt connection credentials: master key ${keyId} missing`, code: 'DECRYPTION_ERROR' }, { status: 500 });
        }
        if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
          await env.DB.prepare(
            `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'DECRYPTION_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
          ).bind(`Vault master key ${keyId} must be a 64-character hex string`, now, targetDeliveryId).run();
          return Response.json({ success: false, error: `Failed to decrypt connection credentials: master key ${keyId} invalid`, code: 'DECRYPTION_ERROR' }, { status: 500 });
        }

        try {
          decryptedWebhookUrl = await decryptCredential(connection.webhook_url, connection.wrapped_key, masterKey);
        } catch (decryptionErr: any) {
          console.error('Decryption failed for connection:', connectionId, decryptionErr);
          await env.DB.prepare(
            `UPDATE omnipost_deliveries SET status = 'failed', error_code = 'DECRYPTION_ERROR', error_message = ?, updated_at = ? WHERE id = ?`
          ).bind(`Decryption failed: ${decryptionErr.message || decryptionErr}`, now, targetDeliveryId).run();
          return Response.json({ success: false, error: 'Failed to decrypt connection credentials', code: 'DECRYPTION_ERROR' }, { status: 500 });
        }
      }

      // Execute Discord HTTP Dispatch
      const targetUrl = decryptedWebhookUrl.includes('?') 
        ? `${decryptedWebhookUrl}&wait=true` 
        : `${decryptedWebhookUrl}?wait=true`;

      // Build Discord payload
      const discordPayload: Record<string, any> = {
        content: textContent
      };

      if (content?.mediaUrls && content.mediaUrls.length > 0) {
        discordPayload.embeds = content.mediaUrls.slice(0, 4).map(mediaUrl => ({
          image: { url: mediaUrl }
        }));
      }

      try {
        const res = await fetchWithTimeout(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload)
        }, 15000);

        const updateTime = Math.floor(Date.now() / 1000);

        if (res.ok) {
          let platformPostId: string | undefined;
          let messageUrl: string | undefined;

          if (res.status === 200) {
            try {
              const resData = await res.json() as { id?: string; channel_id?: string };
              if (resData.id) {
                platformPostId = resData.id;
                messageUrl = resData.channel_id 
                  ? `https://discord.com/channels/@me/${resData.channel_id}/${resData.id}` 
                  : undefined;
              }
            } catch (_) {}
          }

          await env.DB.prepare(
            `UPDATE omnipost_deliveries SET status = 'success', platform_post_id = ?, url = ?, updated_at = ? WHERE id = ?`
          ).bind(platformPostId || null, messageUrl || null, updateTime, targetDeliveryId).run();

          return Response.json({
            success: true,
            data: {
              connectionId,
              status: 'success',
              platformPostId,
              url: messageUrl
            }
          });
        } else {
          const errText = await res.text();
          const errorCode = res.status === 429 ? 'RATE_LIMITED' : `HTTP_${res.status}`;

          await env.DB.prepare(
            `UPDATE omnipost_deliveries SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`
          ).bind(errorCode, errText.slice(0, 500), updateTime, targetDeliveryId).run();

          return Response.json({
            success: false,
            error: `Discord returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
            code: errorCode
          }, { status: 502 });
        }
      } catch (dispatchErr: any) {
        const updateTime = Math.floor(Date.now() / 1000);
        const isTimeout = dispatchErr.message === 'DISPATCH_TIMEOUT';
        const errorCode = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
        const errorMessage = isTimeout ? 'Discord dispatch timed out after 15 seconds' : (dispatchErr.message || 'Dispatch failed');

        await env.DB.prepare(
          `UPDATE omnipost_deliveries SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`
        ).bind(errorCode, errorMessage, updateTime, targetDeliveryId).run();

        return Response.json({
          success: false,
          error: errorMessage,
          code: errorCode
        }, { status: isTimeout ? 504 : 500 });
      }

    } catch (err: any) {
      console.error('Unhandled publish error:', err);
      return Response.json({ success: false, error: err.message || 'Internal publish error' }, { status: 500 });
    }
  }

  // ── 4. POST /api/omnipost/test-delay?seconds=N (Internal test-only) ──
  if (path === '/api/omnipost/test-delay' && method === 'POST') {
    // Gate to staging/development only
    if (env.ENVIRONMENT === 'production') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const seconds = Math.min(Math.max(parseInt(url.searchParams.get('seconds') || '5', 10), 1), 30);
    const delayStart = Date.now();

    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    const elapsed = Date.now() - delayStart;

    return Response.json({
      success: true,
      message: `Test delay completed`,
      requestedSeconds: seconds,
      elapsedMs: elapsed
    });
  }

  // ── 5. POST /api/omnipost/test-perf (Internal performance test-only) ──
  if (path === '/api/omnipost/test-perf' && method === 'POST') {
    if (env.ENVIRONMENT === 'production') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const testWebhook = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz';
    const latestKey = getLatestMasterKey(env);

    const start = performance.now();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const { ciphertextBase64, wrappedKeyBase64 } = await encryptCredential(testWebhook, latestKey.keyHex);
      const decrypted = await decryptCredential(ciphertextBase64, wrappedKeyBase64, latestKey.keyHex);
      if (decrypted !== testWebhook) {
        throw new Error('Performance check decryption validation failed');
      }
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    return Response.json({
      success: true,
      iterations,
      totalMs: elapsed,
      avgMsPerCycle: avgMs,
      message: `Performance check complete. Avg encrypt+decrypt cycle: ${avgMs.toFixed(3)} ms`
    });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

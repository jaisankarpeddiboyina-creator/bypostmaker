import type { Env } from '../../../config/ai'

const DISCORD_WEBHOOK_REGEX = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

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

      const id = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const connectionLabel = label && typeof label === 'string' ? label.slice(0, 50) : 'Discord Webhook';

      await env.DB.prepare(
        `INSERT INTO omnipost_connections (id, user_id, platform, webhook_url, is_plaintext, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`
      ).bind(id, userId, platform, webhookUrl, now).run();

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

      // Execute Discord HTTP Dispatch
      const targetUrl = connection.webhook_url.includes('?') 
        ? `${connection.webhook_url}&wait=true` 
        : `${connection.webhook_url}?wait=true`;

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

  return Response.json({ error: 'Not found' }, { status: 404 });
}

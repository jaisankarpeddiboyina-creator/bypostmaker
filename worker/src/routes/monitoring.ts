import type { Env } from '../../../config/ai'

export async function handleMonitoringBatch(request: Request, env: Env): Promise<Response> {
  const bodyText = await request.text()

  // Enforce overall payload size check (50 KB)
  if (bodyText.length > 50000) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let logs: any[] = []
  try {
    logs = JSON.parse(bodyText)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!Array.isArray(logs)) {
    return new Response(JSON.stringify({ error: 'Batch must be an array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Enforce batch size limit (20 logs)
  if (logs.length > 20) {
    return new Response(JSON.stringify({ error: 'Batch size exceeds limit of 20 logs' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const statements = []
  for (const log of logs) {
    if (!log.message || typeof log.message !== 'string') {
      return new Response(JSON.stringify({ error: 'Log message is required and must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Enforce individual message size limit (500 chars)
    if (log.message.length > 500) {
      return new Response(JSON.stringify({ error: 'Log message exceeds limit of 500 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let type = log.type || 'info'
    if (!['error', 'event', 'info'].includes(type)) {
      type = 'info'
    }

    let level = log.level || 'info'
    if (!['debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
      level = 'info'
    }

    let contextStr = ''
    if (log.context !== undefined && log.context !== null) {
      contextStr = typeof log.context === 'string' ? log.context : JSON.stringify(log.context)
      // Enforce individual context size limit (4 KB)
      if (contextStr.length > 4096) {
        return new Response(JSON.stringify({ error: 'Log context exceeds limit of 4 KB' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    const userId = log.userId || null
    const createdAt = typeof log.timestamp === 'number' ? Math.floor(log.timestamp / 1000) : Math.floor(Date.now() / 1000)

    statements.push(
      env.DB.prepare(
        `INSERT INTO system_logs (id, type, level, user_id, message, context, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        type,
        level,
        userId,
        log.message,
        contextStr || null,
        createdAt
      )
    )
  }

  try {
    if (statements.length > 0) {
      await env.DB.batch(statements)
    }
  } catch (dbErr: any) {
    console.error('[Monitoring] Database batch insert failed:', dbErr)
    return new Response(JSON.stringify({ error: 'Database write failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ success: true, count: statements.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

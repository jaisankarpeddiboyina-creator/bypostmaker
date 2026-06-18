import type { Env } from '../../../config/ai'

export async function handleHealth(env: Env): Promise<Response> {
  try {
    await env.DB.prepare('SELECT 1').first()
    return new Response(JSON.stringify({
      status: 'ok',
      db: 'ok',
      environment: env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ status: 'error', db: 'unreachable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

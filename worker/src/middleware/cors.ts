import type { Env } from '../../../config/ai'

export function withCors(response: Response, env: Env): Response {
  const origin = env.ENVIRONMENT === 'development'
    ? 'http://localhost:5173'
    : `https://${env.DOMAIN}`

  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Max-Age', '86400')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

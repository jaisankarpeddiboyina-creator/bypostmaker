import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'

interface AuthSuccess {
  ok: true
  userId: string
  userPlan: PlatformTier
  userRole: string
}
interface AuthFailure { ok: false }
type AuthResult = AuthSuccess | AuthFailure

export async function withAuth(request: Request, env: Env): Promise<AuthResult> {
  try {
    const cookieHeader = request.headers.get('Cookie') ?? ''
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=')
        return [k.trim(), v.join('=')]
      })
    )
    const token = cookies['pm_session']
    if (!token) return { ok: false }

    const payload = await verifyJWT(token, getJwtSecret(env))
    if (!payload) return { ok: false }
    if (payload.exp && (payload.exp as number) < Math.floor(Date.now() / 1000)) {
      return { ok: false }
    }

    // Check if user is disabled
    const user = await env.DB.prepare(
      'SELECT disabled, role FROM users WHERE id = ?'
    ).bind(payload.sub).first<{ disabled: number; role: string }>()

    if (!user || user.disabled === 1) return { ok: false }

    return {
      ok: true,
      userId: payload.sub as string,
      userPlan: (payload.plan as PlatformTier) ?? 'free',
      userRole: user.role ?? 'user',
    }
  } catch {
    return { ok: false }
  }
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !signatureB64) return null

    const encoder = new TextEncoder()
    const cryptoKey = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const data = encoder.encode(`${headerB64}.${payloadB64}`)
    const signature = base64UrlDecode(signatureB64)
    const valid = await crypto.subtle.verify('HMAC', cryptoKey, signature, data)
    if (!valid) return null

    return JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

function base64UrlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 60 * 60 * 24 * 30
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const full = { ...payload, iat: now, exp: now + expiresInSeconds }
  const encode = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const h = encode(header)
  const p = encode(full)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${h}.${p}`))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${h}.${p}.${sigB64}`
}

export function getJwtSecret(env: Env): string {
  if (env.JWT_SECRET) return env.JWT_SECRET
  if (env.ENVIRONMENT === 'development') return 'local-development-jwt-secret-change-before-production'
  return ''
}

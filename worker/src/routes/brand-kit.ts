import type { Env } from '../../../config/ai'
import { generateId } from '../utils/id'

export interface BrandKitData {
  id?: string
  name: string
  is_default: number
  logo_object_key: string | null
  logo_dark_key: string | null
  logo_icon_key: string | null
  colors: {
    primary: string
    secondary: string
    accent: string
    dark: string
    gray: string
    light: string
  }
  fonts: {
    heading: { family: string; weight: string }
    body: { family: string; weight: string }
    accent: { family: string; weight: string }
  }
  voice: {
    tone: string
    language: string
    dos: string
    donts: string
  }
  social_links: {
    instagram?: string
    facebook?: string
    twitter?: string
    linkedin?: string
    website?: string
  }
}

const DEFAULT_BRAND_KIT: BrandKitData = {
  name: 'Your Brand',
  is_default: 1,
  logo_object_key: null,
  logo_dark_key: null,
  logo_icon_key: null,
  colors: {
    primary: '#F72585',
    secondary: '#9333EA',
    accent: '#00E5A3',
    dark: '#0F172A',
    gray: '#64748B',
    light: '#F8FAFC',
  },
  fonts: {
    heading: { family: 'Plus Jakarta Sans', weight: '700' },
    body: { family: 'Plus Jakarta Sans', weight: '400' },
    accent: { family: 'Great Vibes', weight: '400' },
  },
  voice: {
    tone: 'Friendly, Confident',
    language: 'English (US)',
    dos: 'Use positive words, short sentences, emojis',
    donts: 'Avoid complex jargon, negative words',
  },
  social_links: {
    instagram: '',
    facebook: '',
    twitter: '',
    linkedin: '',
    website: '',
  },
}

export async function handleBrandKit(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const method = request.method

  if (method === 'GET') {
    try {
      const row = await env.DB.prepare(
        `SELECT id, name, is_default, logo_object_key, logo_dark_key, logo_icon_key,
                colors, fonts, voice, social_links, updated_at
         FROM brand_kits WHERE user_id = ?`
      ).bind(userId).first<any>()

      if (!row) {
        return new Response(JSON.stringify({ brandKit: DEFAULT_BRAND_KIT }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const brandKit: BrandKitData = {
        id: row.id,
        name: row.name ?? 'Your Brand',
        is_default: row.is_default ?? 1,
        logo_object_key: row.logo_object_key,
        logo_dark_key: row.logo_dark_key,
        logo_icon_key: row.logo_icon_key,
        colors: typeof row.colors === 'string' ? JSON.parse(row.colors) : row.colors ?? DEFAULT_BRAND_KIT.colors,
        fonts: typeof row.fonts === 'string' ? JSON.parse(row.fonts) : row.fonts ?? DEFAULT_BRAND_KIT.fonts,
        voice: typeof row.voice === 'string' ? JSON.parse(row.voice) : row.voice ?? DEFAULT_BRAND_KIT.voice,
        social_links: typeof row.social_links === 'string' ? JSON.parse(row.social_links) : row.social_links ?? DEFAULT_BRAND_KIT.social_links,
      }

      return new Response(JSON.stringify({ brandKit }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err: any) {
      console.error('Failed to get brand kit:', err)
      return new Response(JSON.stringify({ error: 'Failed to retrieve brand kit' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (method === 'PUT') {
    try {
      const body = (await request.json()) as Partial<BrandKitData>
      const name = body.name ?? 'Your Brand'
      const logo_object_key = body.logo_object_key ?? null
      const logo_dark_key = body.logo_dark_key ?? null
      const logo_icon_key = body.logo_icon_key ?? null
      const colorsJson = JSON.stringify(body.colors ?? DEFAULT_BRAND_KIT.colors)
      const fontsJson = JSON.stringify(body.fonts ?? DEFAULT_BRAND_KIT.fonts)
      const voiceJson = JSON.stringify(body.voice ?? DEFAULT_BRAND_KIT.voice)
      const socialJson = JSON.stringify(body.social_links ?? DEFAULT_BRAND_KIT.social_links)

      const id = generateId()

      await env.DB.prepare(
        `INSERT INTO brand_kits (
          id, user_id, name, is_default, logo_object_key, logo_dark_key, logo_icon_key,
          colors, fonts, voice, social_links, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          logo_object_key = excluded.logo_object_key,
          logo_dark_key = excluded.logo_dark_key,
          logo_icon_key = excluded.logo_icon_key,
          colors = excluded.colors,
          fonts = excluded.fonts,
          voice = excluded.voice,
          social_links = excluded.social_links,
          updated_at = unixepoch()`
      ).bind(
        id,
        userId,
        name,
        logo_object_key,
        logo_dark_key,
        logo_icon_key,
        colorsJson,
        fontsJson,
        voiceJson,
        socialJson
      ).run()

      return new Response(JSON.stringify({ ok: true, message: 'Brand kit saved successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err: any) {
      console.error('Failed to save brand kit:', err)
      return new Response(JSON.stringify({ error: 'Failed to save brand kit' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  })
}

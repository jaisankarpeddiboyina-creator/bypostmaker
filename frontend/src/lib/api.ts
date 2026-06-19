// ============================================================
// API Client — typed fetch wrapper for all Worker endpoints
// ============================================================

const BASE = '/api'

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((err as { error: string }).error ?? 'Request failed')
  }

  return res.json() as Promise<T>
}

// ── Auth ───────────────────────────────────────────────────────
export const api = {
  auth: {
    googleUrl: () => `${BASE}/auth/google`,

    logout: () => request('/auth/logout', { method: 'POST' }),
  },

  // ── User ────────────────────────────────────────────────────
  user: {
    me: () => request<{ user: import('../store/app').User & { role: string }; usage: any }>('/user/me'),

    setCurrency: (currency: 'usd' | 'inr') =>
      request('/user/currency', { method: 'PUT', body: JSON.stringify({ currency }) }),

    deleteAccount: (confirmation: string) =>
      request('/user/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
      }),
  },

  // ── Generate (SSE) ──────────────────────────────────────────
  generate: {
    stream: (
      prompt: string,
      platformIds: string[],
      imageFiles: File[],
      videoFile: File | null,
      onEvent: (event: string, data: unknown) => void
    ): AbortController => {
      const ctrl = new AbortController()

      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('platforms', JSON.stringify(platformIds))
      imageFiles.forEach(f => formData.append('image', f))
      if (videoFile) formData.append('video', videoFile)

      ;(async () => {
        try {
          const res = await fetch(`${BASE}/generate`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
            signal: ctrl.signal,
          })

          if (!res.ok || !res.body) {
            const err = await res.json().catch(() => ({ error: 'Generation failed' }))
            onEvent('fatal', err)
            return
          }

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split('\n\n')
            buffer = parts.pop() ?? ''

            for (const part of parts) {
              const lines = part.trim().split('\n')
              let event = 'message'
              let data = ''

              for (const line of lines) {
                if (line.startsWith('event: ')) event = line.slice(7)
                if (line.startsWith('data: ')) data = line.slice(6)
              }

              if (data) {
                try {
                  onEvent(event, JSON.parse(data))
                } catch {
                  onEvent(event, data)
                }
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            onEvent('fatal', { message: 'Connection lost. Please try again.' })
          }
        }
      })()

      return ctrl
    },
  },

  // ── Refinement ──────────────────────────────────────────────
  refine: (
    campaignId: string,
    platformId: string,
    message: string,
    currentContent: string
  ) =>
    request<{ content: string; platformId: string }>('/refine', {
      method: 'POST',
      body: JSON.stringify({ campaignId, platformId, message, currentContent }),
    }),

  // ── Download ────────────────────────────────────────────────
  download: {
    kit: async (
      campaignId: string,
      imageFiles: File[],
      videoFile: File | null,
      platformId?: string
    ): Promise<void> => {
      const params = new URLSearchParams({ campaign: campaignId })
      if (platformId) params.set('platform', platformId)

      const formData = new FormData()
      imageFiles.forEach(f => formData.append('image', f))
      if (videoFile) formData.append('video', videoFile)

      const hasMedia = imageFiles.length > 0 || videoFile
      const res = await fetch(`${BASE}/download?${params}`, {
        method: hasMedia ? 'POST' : 'GET',
        credentials: 'include',
        body: hasMedia ? formData : undefined,
      })

      if (!res.ok) throw new Error('Download failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = res.headers.get('Content-Disposition')
        ?.match(/filename="(.+)"/)?.[1] ?? 'postmaker_kit.zip'
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
  },

  // ── History ─────────────────────────────────────────────────
  history: {
    list: (page = 1) =>
      request<{ campaigns: any[]; pagination: any }>(`/history?page=${page}`),
  },

  // ── Payments ────────────────────────────────────────────────
  payments: {
    currency: () => request<{ currency: 'usd' | 'inr'; country: string }>('/payments/currency'),

    status: () => request<{ user: any; subscription: any }>('/payments/status'),

    subscribe: (plan: string, currency: string, promoCode?: string) =>
      request<{ subscriptionId: string; keyId: string; plan: string; currency: string }>(
        '/payments/subscribe',
        { method: 'POST', body: JSON.stringify({ plan, currency, promoCode }) }
      ),

    cancel: () => request('/payments/cancel', { method: 'POST' }),
  },
}

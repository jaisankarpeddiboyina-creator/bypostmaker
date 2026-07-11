// frontend/src/lib/seo.ts
import { useEffect } from 'react'

/**
 * React hook to dynamically update document title, description, canonical link,
 * and Open Graph / Twitter meta tags during client-side SPA navigation.
 */
export function useDocumentMetadata(title: string, description: string) {
  useEffect(() => {
    // 1. Update tab title
    document.title = title

    // 2. Update meta tags defensively
    const metaUpdates: Record<string, string> = {
      'meta[name="description"]': description,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': description,
      'meta[property="og:url"]': window.location.href,
      'meta[name="twitter:title"]': title,
      'meta[name="twitter:description"]': description,
    }

    for (const [selector, value] of Object.entries(metaUpdates)) {
      try {
        let el = document.querySelector(selector)
        if (!el) {
          // If the meta tag is missing, create it dynamically
          const isOg = selector.startsWith('meta[property=')
          el = document.createElement('meta')
          if (isOg) {
            const prop = selector.match(/property="([^"]+)"/)?.[1]
            if (prop) el.setAttribute('property', prop)
          } else {
            const name = selector.match(/name="([^"]+)"/)?.[1]
            if (name) el.setAttribute('name', name)
          }
          document.head.appendChild(el)
        }
        el.setAttribute('content', value)
      } catch (err) {
        console.error(`Failed to update metadata selector ${selector}:`, err)
      }
    }

    // 3. Update canonical URL link
    try {
      let canonicalEl = document.querySelector('link[rel="canonical"]')
      if (!canonicalEl) {
        canonicalEl = document.createElement('link')
        canonicalEl.setAttribute('rel', 'canonical')
        document.head.appendChild(canonicalEl)
      }
      canonicalEl.setAttribute('href', window.location.href)
    } catch (err) {
      console.error('Failed to update canonical link:', err)
    }
  }, [title, description])
}

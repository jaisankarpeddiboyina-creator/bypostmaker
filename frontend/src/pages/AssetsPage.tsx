import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Loader2, Video, Sparkles, ChevronLeft, ChevronRight,
  Copy, Info, X, AlertCircle, RefreshCw, Image as ImageIcon,
  Music, Type, Grid3X3, Shield
} from 'lucide-react'
import { useAppStore } from '../store/app'

// ── Types ──────────────────────────────────────────────────────
interface MediaItem {
  id: string
  type: 'image' | 'video' | 'icon' | 'font'
  title: string
  previewUrl: string
  downloadUrl: string
  width?: number
  height?: number
  attribution: {
    authorName: string
    authorUrl: string
    sourceUrl: string
    providerName: string
    // License type — displayed as a badge on each card
    license: string
    // true = Unsplash/CC licenses that legally require crediting the author
    attributionRequired: boolean
  } | null
}

interface ApiResponse {
  results: MediaItem[]
  total: number
  providerError: boolean
}

type MediaType = 'image' | 'video' | 'icon' | 'font'
type Orientation = 'all' | 'landscape' | 'portrait' | 'square'

// ── Client-side query cache (10 min TTL) ──────────────────────
const CACHE_TTL = 10 * 60 * 1000
interface CacheEntry { data: ApiResponse; timestamp: number }
const queryCache = new Map<string, CacheEntry>()

function getCached(key: string): ApiResponse | null {
  const entry = queryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    queryCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: ApiResponse): void {
  // Limit cache to 50 entries to avoid unbounded memory growth
  if (queryCache.size >= 50) {
    const oldestKey = queryCache.keys().next().value
    if (oldestKey) queryCache.delete(oldestKey)
  }
  queryCache.set(key, { data, timestamp: Date.now() })
}

// ── Component ─────────────────────────────────────────────────
export default function AssetsPage() {
  const { addToast } = useAppStore()

  // Search state
  const [inputValue, setInputValue] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('image')
  const [orientation, setOrientation] = useState<Orientation>('all')
  const [page, setPage] = useState(1)

  // Result state
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [isProviderError, setIsProviderError] = useState(false)

  // Preview modal
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch ──────────────────────────────────────────────────
  const fetchMedia = useCallback(async (
    query: string,
    type: MediaType,
    pg: number,
    ori: Orientation
  ) => {
    const q = query.trim() || 'trending'
    const cacheKey = `${type}|${q}|${pg}|${ori}`
    const cached = getCached(cacheKey)
    if (cached) {
      setResults(cached.results)
      setIsProviderError(cached.providerError)
      setHasSearched(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const oriParam = ori !== 'all' ? `&orientation=${ori}` : ''
      const res = await fetch(
        `/api/assets/free-media?q=${encodeURIComponent(q)}&type=${type}&page=${pg}${oriParam}`,
        { credentials: 'include' }
      )

      if (res.status === 429) {
        setErrorMsg('Search rate limit reached. Please wait a moment.')
        setResults([])
        setIsProviderError(false)
        return
      }
      if (!res.ok) {
        throw new Error(`Server error ${res.status}`)
      }

      const data = await res.json() as ApiResponse
      const normalized: ApiResponse = {
        results: Array.isArray(data.results) ? data.results : [],
        total: data.total ?? 0,
        providerError: data.providerError ?? false,
      }
      setCache(cacheKey, normalized)
      setResults(normalized.results)
      setIsProviderError(normalized.providerError)
      setHasSearched(true)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to search stock media')
      setResults([])
      setIsProviderError(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Effect: fetch on committed query / type / page / orientation change ──
  useEffect(() => {
    fetchMedia(committedQuery, mediaType, page, orientation)
  }, [committedQuery, mediaType, page, orientation, fetchMedia])

  // ── Handlers ───────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    // Debounce 350ms — auto-search as user types
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      setCommittedQuery(val)
    }, 350)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setPage(1)
    setCommittedQuery(inputValue)
  }

  const handleTypeChange = (t: MediaType) => {
    setMediaType(t)
    setPage(1)
  }

  const handleOrientationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOrientation(e.target.value as Orientation)
    setPage(1)
  }

  const handleRetry = () => {
    const q = committedQuery.trim() || 'trending'
    const cacheKey = `${mediaType}|${q}|${page}|${orientation}`
    queryCache.delete(cacheKey) // clear stale cache entry before retry
    fetchMedia(committedQuery, mediaType, page, orientation)
  }

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    addToast('Media link copied to clipboard!', 'success')
  }

  const handleCopyAttribution = (attr: MediaItem['attribution']) => {
    if (!attr) return
    const text = `Photo by ${attr.authorName} on ${attr.providerName} — ${attr.sourceUrl}`
    navigator.clipboard.writeText(text)
    addToast('Attribution text copied!', 'success')
  }

  // ── Type tab config ────────────────────────────────────────
  const typeTabs: { id: MediaType; label: string; icon: React.ReactNode }[] = [
    { id: 'image', label: 'Image', icon: <ImageIcon size={13} /> },
    { id: 'video', label: 'Video', icon: <Video size={13} /> },
    { id: 'icon', label: 'Icon', icon: <Grid3X3 size={13} /> },
    { id: 'font', label: 'Font', icon: <Type size={13} /> },
  ]

  // ── Skeleton cards ─────────────────────────────────────────
  const SkeletonGrid = () => (
    <div className="media-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="media-card glass-card media-card-skeleton">
          <div className="media-card-preview skeleton-preview shimmer" />
          <div className="media-card-details">
            <div className="skeleton-line shimmer" style={{ width: '80%', height: 13, borderRadius: 6 }} />
            <div className="skeleton-line shimmer" style={{ width: '55%', height: 11, borderRadius: 6, marginTop: 6 }} />
            <div className="skeleton-line shimmer" style={{ width: '100%', height: 28, borderRadius: 8, marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="stock-media-page">
      <div className="stock-media-wrapper animate-fade-in">

        {/* Header */}
        <div className="stock-header glass-card">
          <div className="stock-header-inner">
            <div>
              <h1>Stock Media Explorer</h1>
              <p>Discover and copy high-quality, professional assets from multiple free providers.</p>
            </div>
            <div className="stock-safesearch-badge">
              <Shield size={13} />
              <span>SafeSearch Active</span>
            </div>
          </div>
        </div>

        {/* Search toolbar */}
        <div className="stock-toolbar-section">
          <div className="assets-toolbar glass-card">
            <form onSubmit={handleSearchSubmit} className="stock-search-form">
              <Search size={15} className="search-icon" />
              <input
                id="stock-search-input"
                type="text"
                placeholder="Search photos, videos, icons… (e.g. flowers, landscape, minimal)"
                value={inputValue}
                onChange={handleInputChange}
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary btn-sm" id="stock-search-btn">
                Search
              </button>
            </form>

            <div className="type-pills">
              {typeTabs.map(t => (
                <button
                  key={t.id}
                  id={`type-pill-${t.id}`}
                  className={`type-pill ${mediaType === t.id ? 'active' : ''}`}
                  onClick={() => handleTypeChange(t.id)}
                  type="button"
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filters row */}
          <div className="filters-row glass-card">
            <div className="filter-group">
              <span className="info-chip">
                <Shield size={12} />
                SafeSearch On — adult content filtered at source
              </span>
            </div>
            {/* Orientation only makes sense for images/videos */}
            {(mediaType === 'image' || mediaType === 'video') && (
              <div className="filter-group">
                <label htmlFor="orientation-select" className="filter-label">Orientation:</label>
                <select
                  id="orientation-select"
                  value={orientation}
                  onChange={handleOrientationChange}
                  className="filter-select"
                >
                  <option value="all">Any Orientation</option>
                  <option value="landscape">Landscape (16:9)</option>
                  <option value="portrait">Portrait (9:16)</option>
                  <option value="square">Square (1:1)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Results area */}
        <div className="media-results-section">
          {loading ? (
            <SkeletonGrid />
          ) : errorMsg ? (
            /* Error state — distinct from empty */
            <div className="results-error glass-card">
              <AlertCircle size={32} className="error-icon" />
              <h3>Something went wrong</h3>
              <p>{errorMsg}</p>
              <button className="btn btn-ghost btn-sm" onClick={handleRetry} id="error-retry-btn">
                <RefreshCw size={14} />
                <span>Try again</span>
              </button>
            </div>
          ) : isProviderError && results.length === 0 ? (
            /* Provider upstream failure — not a genuine zero */
            <div className="results-error glass-card">
              <AlertCircle size={32} className="error-icon" />
              <h3>Provider unavailable</h3>
              <p>The stock media provider returned an error. This is a temporary issue — try again in a moment.</p>
              <button className="btn btn-ghost btn-sm" onClick={handleRetry} id="provider-error-retry-btn">
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : hasSearched && results.length === 0 ? (
            /* Genuine zero results */
            <div className="results-empty glass-card">
              <Sparkles size={32} />
              <h3>No results found</h3>
              <p>
                No {mediaType}s matched <strong>"{committedQuery.trim() || 'trending'}"</strong>.
                Try a shorter or more general keyword.
              </p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="media-grid">
                {results.map(item => (
                  <div key={item.id} className="media-card glass-card" id={`media-card-${item.id}`}>
                    <div
                      className="media-card-preview"
                      onClick={() => setPreviewItem(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setPreviewItem(item)}
                      aria-label={`Preview ${item.title}`}
                    >
                      {item.type === 'video' ? (
                        <div className="video-card-preview">
                          <img src={item.previewUrl} alt={item.title} loading="lazy" decoding="async" />
                          <div className="video-play-overlay" aria-hidden="true">
                            <Video size={20} />
                          </div>
                        </div>
                      ) : item.type === 'font' ? (
                        <div className="font-card-preview" style={{ fontFamily: `'${item.title}', sans-serif` }}>
                          Aa
                        </div>
                      ) : item.type === 'icon' ? (
                        <div className="icon-card-preview">
                          <img src={item.previewUrl} alt={item.title} loading="lazy" decoding="async" width={48} height={48} />
                        </div>
                      ) : (
                        <img src={item.previewUrl} alt={item.title} loading="lazy" decoding="async" />
                      )}
                    </div>
                    <div className="media-card-details">
                      <div className="media-card-top-row">
                        <span
                          className="media-card-name truncate"
                          onClick={() => setPreviewItem(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && setPreviewItem(item)}
                        >
                          {item.title}
                        </span>
                        {item.attribution?.license && (
                          <span
                            className={`license-badge ${item.attribution.attributionRequired ? 'license-badge--required' : 'license-badge--free'}`}
                            title={item.attribution.attributionRequired ? 'Attribution required by license' : 'Free to use — no attribution required'}
                          >
                            {item.attribution.attributionRequired ? '⚠ ' : '✓ '}{item.attribution.license}
                          </span>
                        )}
                      </div>
                      {item.attribution ? (
                        <a
                          href={item.attribution.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="media-att-link truncate"
                        >
                          © {item.attribution.authorName} ({item.attribution.providerName})
                        </a>
                      ) : (
                        <span className="media-att-link">Free Stock Media</span>
                      )}
                      <div className="media-card-actions">
                        <button
                          className="btn btn-ghost btn-xs w-full action-btn"
                          onClick={() => handleCopyLink(item.downloadUrl)}
                          id={`copy-url-${item.id}`}
                        >
                          <Copy size={12} />
                          <span>Copy URL</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="pagination-bar glass-card">
                <button
                  id="pagination-prev"
                  className="btn btn-ghost btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span className="page-indicator">Page {page}</span>
                <button
                  id="pagination-next"
                  className="btn btn-ghost btn-sm"
                  disabled={results.length < 20}
                  onClick={() => setPage(p => p + 1)}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </>
          ) : (
            /* Initial idle state — no search yet */
            <div className="results-idle glass-card">
              <Search size={32} className="idle-icon" />
              <h3>Search for media</h3>
              <p>Type a keyword above to discover free stock photos, videos, icons, and fonts.</p>
            </div>
          )}
        </div>
      </div>

      {/* HD Lightbox Preview Modal */}
      {previewItem && (
        <div
          className="lightbox-overlay"
          onClick={() => setPreviewItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview: ${previewItem.title}`}
        >
          <div className="lightbox-container glass-card" onClick={e => e.stopPropagation()}>
            <div className="lightbox-header">
              <span className="lightbox-title truncate">{previewItem.title}</span>
              <button
                id="lightbox-close"
                className="lightbox-close"
                onClick={() => setPreviewItem(null)}
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="lightbox-body">
              {previewItem.type === 'video' ? (
                <video
                  src={previewItem.downloadUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  className="lightbox-video"
                />
              ) : previewItem.type === 'font' ? (
                <div className="lightbox-font-demo">
                  <link rel="stylesheet" href={previewItem.downloadUrl} />
                  <div
                    style={{ fontFamily: `'${previewItem.title}', sans-serif` }}
                    className="lightbox-font-preview-text"
                  >
                    The quick brown fox jumps over the lazy dog.
                    <br />
                    1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz
                  </div>
                </div>
              ) : previewItem.type === 'icon' ? (
                <div className="lightbox-icon-demo">
                  <img src={previewItem.downloadUrl} alt={previewItem.title} className="lightbox-icon-img" />
                </div>
              ) : (
                <img
                  src={previewItem.downloadUrl}
                  alt={previewItem.title}
                  className="lightbox-image"
                  loading="lazy"
                />
              )}
            </div>
            <div className="lightbox-footer">
              <div className="lightbox-attribution">
                {previewItem.attribution ? (
                  <>
                    {previewItem.attribution.attributionRequired && (
                      <span className="lightbox-attr-required-badge">Attribution Required</span>
                    )}
                    <span>By </span>
                    <a
                      href={previewItem.attribution.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lightbox-credit-link"
                    >
                      {previewItem.attribution.authorName}
                    </a>
                    <span> on {previewItem.attribution.providerName}</span>
                    {previewItem.attribution.license && (
                      <span className={`lightbox-license-chip ${previewItem.attribution.attributionRequired ? 'lightbox-license-chip--required' : 'lightbox-license-chip--free'}`}>
                        {previewItem.attribution.license}
                      </span>
                    )}
                  </>
                ) : (
                  <span>Free Stock Media</span>
                )}
              </div>
              <div className="lightbox-actions">
                <button
                  id="lightbox-copy-url"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleCopyLink(previewItem.downloadUrl)}
                >
                  <Copy size={14} />
                  <span>Copy URL</span>
                </button>
                {previewItem.attribution && (
                  <button
                    id="lightbox-copy-credit"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleCopyAttribution(previewItem.attribution)}
                  >
                    <Info size={14} />
                    <span>Copy Credit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .stock-media-page {
          width: 100%;
          min-height: 100%;
          background: transparent;
        }

        .stock-media-wrapper {
          padding: 24px 32px;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Header ── */
        .stock-header {
          padding: 20px 28px;
        }

        .stock-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .stock-header h1 {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
          margin: 0 0 3px 0;
        }

        .stock-header p {
          font-size: 13.5px;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .stock-safesearch-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--color-success);
          background: var(--color-success-bg);
          border: 1px solid var(--color-success-border);
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Toolbar ── */
        .stock-toolbar-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .assets-toolbar {
          display: flex;
          align-items: center;
          padding: 14px 18px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .stock-search-form {
          flex: 1;
          min-width: 200px;
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
        }

        .stock-search-form .search-icon {
          position: absolute;
          left: 13px;
          color: var(--color-text-muted);
          pointer-events: none;
        }

        .stock-search-form input {
          flex: 1;
          padding: 9px 14px 9px 38px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.55);
          font-size: 13.5px;
          font-family: var(--font-body);
          color: var(--color-text-primary);
          transition: border-color var(--transition);
          min-width: 0;
        }

        .stock-search-form input:focus {
          outline: none;
          border-color: var(--color-primary-start);
          background: rgba(255, 255, 255, 0.75);
        }

        .type-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .type-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 13px;
          font-size: 12.5px;
          font-weight: 600;
          font-family: var(--font-body);
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.40);
          cursor: pointer;
          transition: all 150ms ease;
          color: var(--color-text-secondary);
        }

        .type-pill:hover {
          background: rgba(255, 255, 255, 0.65);
          color: var(--color-primary-start);
          border-color: var(--color-primary-start);
        }

        .type-pill.active {
          background: var(--gradient-primary);
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.30);
        }

        /* ── Filters Row ── */
        .filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .info-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: var(--color-success);
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .filter-select {
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(255, 255, 255, 0.55);
          font-size: 12.5px;
          font-weight: 600;
          font-family: var(--font-body);
          color: var(--color-text-primary);
          cursor: pointer;
        }

        /* ── Results Area ── */
        .media-results-section {
          min-height: 380px;
        }

        /* Skeleton loading */
        .media-card-skeleton .media-card-preview {
          cursor: default;
        }

        .skeleton-preview {
          width: 100%;
          aspect-ratio: 4/3;
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.04);
        }

        .skeleton-line {
          display: block;
        }

        /* Idle / empty / error states */
        .results-idle,
        .results-empty,
        .results-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 350px;
          gap: 12px;
          text-align: center;
          padding: 40px 32px;
        }

        .results-idle h3,
        .results-empty h3,
        .results-error h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .results-idle p,
        .results-empty p,
        .results-error p {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-secondary);
          max-width: 360px;
          line-height: 1.5;
        }

        .idle-icon {
          color: var(--color-text-muted);
          opacity: 0.5;
        }

        .error-icon {
          color: var(--color-error);
        }

        /* Grid */
        .media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 16px;
        }

        .media-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 10px;
          transition: transform 160ms ease;
        }

        .media-card:hover {
          transform: translateY(-2px);
        }

        .media-card-preview {
          aspect-ratio: 4/3;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: rgba(0, 0, 0, 0.03);
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .media-card-preview:focus-visible {
          outline: 2px solid var(--color-primary-start);
          outline-offset: 2px;
        }

        .media-card-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 200ms ease;
        }

        .media-card:hover .media-card-preview img {
          transform: scale(1.03);
        }

        .video-card-preview {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .video-card-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-play-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .font-card-preview {
          font-size: 36px;
          font-weight: 700;
          color: var(--color-text-primary);
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-card-preview {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .icon-card-preview img {
          width: 48px;
          height: 48px;
          object-fit: contain;
        }

        .media-card-details {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .media-card-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .media-card-name:focus-visible {
          outline: 2px solid var(--color-primary-start);
          border-radius: 4px;
        }

        .media-card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .license-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: -0.01em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .license-badge--free {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .license-badge--required {
          background: rgba(245, 158, 11, 0.12);
          color: #d97706;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .media-att-link {
          font-size: 11px;
          color: var(--color-text-muted);
          text-decoration: none;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-att-link:hover {
          color: var(--color-primary-start);
        }

        .media-card-actions {
          margin-top: 6px;
        }

        .action-btn {
          width: 100%;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
          gap: 6px;
          height: 30px;
        }

        /* Pagination */
        .pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          margin-top: 24px;
        }

        .page-indicator {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        /* ── Lightbox ── */
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.70);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeInScale 160ms ease forwards;
        }

        .lightbox-container {
          width: 100%;
          max-width: 820px;
          background: white !important;
          border-radius: var(--radius-card);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
          max-height: 90vh;
        }

        .lightbox-header {
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          gap: 12px;
        }

        .lightbox-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--color-text-primary);
          flex: 1;
        }

        .lightbox-close {
          background: transparent;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition);
          flex-shrink: 0;
        }

        .lightbox-close:hover {
          background: rgba(0, 0, 0, 0.06);
          color: var(--color-text-primary);
        }

        .lightbox-body {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.02);
          min-height: 300px;
          max-height: 62vh;
          overflow: hidden;
        }

        .lightbox-image, .lightbox-video {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .lightbox-font-demo {
          width: 100%;
          padding: 40px;
          background: white;
          text-align: center;
        }

        .lightbox-font-preview-text {
          font-size: 22px;
          line-height: 1.65;
          color: var(--color-text-primary);
        }

        .lightbox-icon-demo {
          padding: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lightbox-icon-img {
          width: 120px;
          height: 120px;
          object-fit: contain;
        }

        .lightbox-footer {
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          gap: 12px;
          flex-wrap: wrap;
        }

        .lightbox-attribution {
          font-size: 12px;
          color: var(--color-text-secondary);
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .lightbox-attr-required-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(239, 68, 68, 0.12);
          color: #dc2626;
          border: 1px solid rgba(239, 68, 68, 0.25);
          letter-spacing: -0.01em;
        }

        .lightbox-license-chip {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .lightbox-license-chip--free {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
        }

        .lightbox-license-chip--required {
          background: rgba(245, 158, 11, 0.12);
          color: #d97706;
        }

        .lightbox-credit-link {
          color: var(--color-primary-start);
          font-weight: 700;
          text-decoration: underline;
        }

        .lightbox-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        /* ── Mobile-first responsive (375px target) ── */
        @media (max-width: 640px) {
          .stock-media-wrapper {
            padding: 16px;
            gap: 12px;
          }

          .stock-header {
            padding: 16px;
          }

          .stock-header-inner {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .stock-header h1 {
            font-size: 19px;
          }

          .stock-header p {
            font-size: 12.5px;
          }

          .assets-toolbar {
            flex-direction: column;
            align-items: stretch;
            padding: 12px 14px;
            gap: 12px;
          }

          .stock-search-form {
            min-width: 0;
          }

          .type-pills {
            justify-content: stretch;
          }

          .type-pill {
            flex: 1;
            justify-content: center;
            padding: 8px 8px;
            font-size: 11.5px;
          }

          .filters-row {
            flex-direction: column;
            align-items: flex-start;
            padding: 10px 14px;
            gap: 10px;
          }

          .media-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .media-card {
            padding: 8px;
          }

          .media-card-name {
            font-size: 11.5px;
          }

          .media-att-link {
            font-size: 10px;
          }

          .lightbox-container {
            max-height: 95vh;
            border-radius: var(--radius);
          }

          .lightbox-font-preview-text {
            font-size: 18px;
          }

          .lightbox-footer {
            flex-direction: column;
            align-items: stretch;
          }

          .lightbox-actions {
            justify-content: stretch;
          }

          .lightbox-actions .btn {
            flex: 1;
            justify-content: center;
          }

          .pagination-bar {
            margin-top: 16px;
            padding: 10px 14px;
          }
        }

        @media (max-width: 400px) {
          .media-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

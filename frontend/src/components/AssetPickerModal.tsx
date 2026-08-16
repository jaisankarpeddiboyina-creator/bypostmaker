import React, { useState, useEffect } from 'react'
import { X, Search, Loader2, Video, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/app'

export function AssetPickerModal() {
  const {
    showAssetPicker,
    assetPickerContext,
    closeAssetPicker,
    addToast
  } = useAppStore()

  if (!showAssetPicker || !assetPickerContext) return null

  // Search and results states
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [freeMediaQuery, setFreeMediaQuery] = useState('')
  const [freeMediaType, setFreeMediaType] = useState<'image' | 'video' | 'icon' | 'font'>('image')
  const [freeMediaResults, setFreeMediaResults] = useState<any[]>([])
  const [freeMediaPage, setFreeMediaPage] = useState(1)
  const [selectedFreeItem, setSelectedFreeItem] = useState<any | null>(null)

  // Autodetect preferred search type from target context input filters
  useEffect(() => {
    if (assetPickerContext?.accept) {
      if (assetPickerContext.accept.includes('video')) {
        setFreeMediaType('video')
      } else if (assetPickerContext.accept.includes('icon')) {
        setFreeMediaType('icon')
      } else if (assetPickerContext.accept.includes('font')) {
        setFreeMediaType('font')
      } else {
        setFreeMediaType('image')
      }
    }
  }, [assetPickerContext])

  const handleFreeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = freeMediaQuery.trim() || 'trending'
    setLoading(true)
    setSelectedFreeItem(null)

    try {
      // Query with no_faces=1 ALWAYS to return pure high-res, clean backgrounds without people
      const res = await fetch(
        `/api/assets/free-media?q=${encodeURIComponent(query)}&type=${freeMediaType}&page=${freeMediaPage}&no_faces=1`,
        { credentials: 'include' }
      )
      if (res.status === 429) {
        addToast('Search rate limit reached. Please wait a moment.', 'error')
        setFreeMediaResults([])
        return
      }
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json() as any[]
      setFreeMediaResults(data || [])
    } catch (err: any) {
      addToast(err.message || 'Media search failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Load results on query state changes
  useEffect(() => {
    handleFreeSearch()
  }, [freeMediaPage, freeMediaType])

  const handleSelectFreeItem = async (item: any) => {
    setSubmitting(true)
    try {
      // Fetch binary image safely via proxy endpoint to avoid CORS limitations
      let res: Response
      try {
        const proxyUrl = `/api/assets/proxy?url=${encodeURIComponent(item.downloadUrl)}`
        res = await fetch(proxyUrl)
        if (!res.ok) throw new Error('Proxy status error')
      } catch {
        res = await fetch(item.downloadUrl)
      }

      if (!res.ok) throw new Error('Failed to download media binary')
      const blob = await res.blob()

      const ext = item.type === 'icon' ? 'svg' : 'jpg'
      const cleanTitle = (item.title || 'media_asset').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const filename = `${cleanTitle}.${ext}`
      const file = new File([blob], filename, { type: blob.type })

      assetPickerContext.onSelect(file)
      closeAssetPicker()
    } catch (err: any) {
      addToast(err.message || 'Failed to select media item', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="picker-modal-overlay">
      <div className="picker-modal-container glass-card animate-fade-in">
        {/* Header */}
        <div className="picker-header">
          <div className="picker-title-group">
            <h2>{assetPickerContext.title || 'Explore Stock Media'}</h2>
            <p>Search and select premium stock assets directly into your post</p>
          </div>
          <button className="picker-close-btn" onClick={closeAssetPicker}>
            <X size={18} />
          </button>
        </div>

        <div className="picker-body">
          {submitting && (
            <div className="picker-overlay-loading">
              <Loader2 className="spin animate-spin" size={32} />
              <span>Importing premium media to post editor...</span>
            </div>
          )}

          <div className="free-media-layout">
            <form onSubmit={handleFreeSearch} className="free-media-search-bar">
              <div className="search-wrapper">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search stock photos, icons, backdrops..."
                  value={freeMediaQuery}
                  onChange={(e) => setFreeMediaQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Search</button>
            </form>

            <div className="free-media-toolbar">
              <div className="type-pills">
                {['image', 'video', 'icon', 'font'].map(t => (
                  <button
                    key={t}
                    className={`type-pill ${freeMediaType === t ? 'active' : ''}`}
                    onClick={() => {
                      setFreeMediaType(t as any)
                      setFreeMediaPage(1)
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {selectedFreeItem && (
              <div className="free-media-selection-banner glass-card animate-fade-in">
                <div className="selection-info">
                  <span className="selection-title">Selected: {selectedFreeItem.title}</span>
                  {selectedFreeItem.attribution && (
                    <span className="attribution-text">
                      Photo by{' '}
                      <a
                        href={selectedFreeItem.attribution.authorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="credit-link"
                      >
                        {selectedFreeItem.attribution.authorName}
                      </a>{' '}
                      ({selectedFreeItem.attribution.providerName})
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSelectFreeItem(selectedFreeItem)}
                >
                  Use This Media
                </button>
              </div>
            )}

            <div className="assets-grid-container">
              {loading ? (
                <div className="picker-loading">
                  <Loader2 className="spin animate-spin" size={24} />
                  <span>Searching premium stock library...</span>
                </div>
              ) : freeMediaResults.length === 0 ? (
                <div className="picker-empty">
                  <p>No results found. Try a different search query like 'landscape' or 'texture'.</p>
                </div>
              ) : (
                <>
                  <div className="assets-picker-grid">
                    {freeMediaResults.map(item => {
                      const isSelected = selectedFreeItem?.id === item.id
                      return (
                        <div
                          key={item.id}
                          className={`picker-asset-card free-item glass-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedFreeItem(item)}
                        >
                          <div className="asset-card-preview">
                            {item.type === 'video' ? (
                              <div className="video-preview-wrapper">
                                <img src={item.previewUrl} alt={item.title} loading="lazy" />
                                <div className="video-overlay">
                                  <Video size={16} />
                                </div>
                              </div>
                            ) : item.type === 'font' ? (
                              <div className="font-preview-wrapper" style={{ fontFamily: item.title }}>
                                Aa
                              </div>
                            ) : (
                              <img src={item.previewUrl} alt={item.title} loading="lazy" />
                            )}
                          </div>
                          <div className="asset-card-info">
                            <span className="asset-name truncate" title={item.title}>{item.title}</span>
                            {item.attribution && (
                              <span className="attribution-author truncate">
                                © {item.attribution.authorName}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="pagination-bar glass-card">
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={freeMediaPage === 1}
                      onClick={() => setFreeMediaPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} />
                      <span>Prev</span>
                    </button>
                    <span className="page-indicator">Page {freeMediaPage}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setFreeMediaPage(p => p + 1)}
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .picker-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .picker-modal-container {
          width: 100%;
          max-width: 900px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.5);
          overflow: hidden;
          padding: 0;
        }

        .picker-header {
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .picker-title-group h2 {
          font-size: 18px;
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
        }

        .picker-title-group p {
          font-size: 12.5px;
          color: var(--color-text-secondary);
          margin: 4px 0 0 0;
        }

        .picker-close-btn {
          background: transparent;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          transition: all 150ms ease;
        }

        .picker-close-btn:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--color-text-primary);
        }

        .picker-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          position: relative;
        }

        .picker-overlay-loading {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(4px);
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .free-media-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .free-media-search-bar {
          display: flex;
          gap: 12px;
        }

        .search-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-wrapper .search-icon {
          position: absolute;
          left: 14px;
          color: var(--color-text-muted);
        }

        .search-wrapper input {
          width: 100%;
          padding: 10px 16px 10px 38px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .free-media-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .type-pills {
          display: flex;
          gap: 8px;
        }

        .type-pill {
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 600;
          border: 1px solid rgba(0, 0, 0, 0.05);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 150ms ease;
        }

        .type-pill.active {
          background: #38BDF8;
          color: white;
          border-color: #38BDF8;
        }

        .free-media-selection-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.2);
        }

        .selection-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .selection-title {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .attribution-text {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .credit-link {
          color: #38BDF8;
          text-decoration: underline;
        }

        .assets-grid-container {
          min-height: 200px;
        }

        .assets-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }

        .picker-asset-card {
          cursor: pointer;
          padding: 10px;
          transition: all 160ms ease;
        }

        .picker-asset-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .picker-asset-card.selected {
          border-color: #38BDF8;
          background: rgba(56, 189, 248, 0.05);
        }

        .asset-card-preview {
          aspect-ratio: 4/3;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .asset-card-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-preview-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .video-overlay {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 4px;
          border-radius: var(--radius-sm);
          display: flex;
        }

        .font-preview-wrapper {
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .asset-card-info {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .asset-name {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .attribution-author {
          font-size: 11px;
          color: var(--color-text-muted);
        }

        .pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          margin-top: 24px;
        }

        .page-indicator {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .picker-loading, .picker-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: var(--color-text-muted);
          font-size: 13.5px;
          gap: 12px;
        }
      `}</style>
    </div>
  )
}

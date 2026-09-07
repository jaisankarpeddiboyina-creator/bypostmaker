import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, Loader2, Globe, Clock, AlertCircle } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { PLATFORM_MAP } from '@@config/platforms'
import { PlatformIcon } from './PlatformIcon'

export function ShareModal() {
  const { sharePayload, closeShare, addToast } = useAppStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sharePayload) return

    let active = true
    setLoading(true)
    setError(null)
    setCopied(false)
    setShareUrl('')

    api.share.create(sharePayload.campaignId, sharePayload.posts)
      .then(res => {
        if (active) {
          setShareUrl(res.shareUrl)
          setLoading(false)
        }
      })
      .catch(err => {
        if (active) {
          setError(err?.message || 'Failed to create share link.')
          setLoading(false)
        }
      })

    return () => { active = false }
  }, [sharePayload])

  if (!sharePayload) return null

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      addToast('Share link copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      if (inputRef.current) {
        inputRef.current.select()
        document.execCommand('copy')
        setCopied(true)
        addToast('Share link copied to clipboard!', 'success')
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeShare()
    }
  }

  return (
    <div className="modal-overlay" onClick={closeShare}>
      <div className="modal share-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-header-title-block">
            <div className="share-title-row">
              <Globe size={18} className="share-globe-icon" />
              <h2 className="share-modal-title">Share Content Kit</h2>
            </div>
            <p className="share-modal-subtitle">Generate a public, read-only preview of your generated posts</p>
          </div>
          <button 
            type="button" 
            className="btn-icon close-share-btn" 
            onClick={closeShare} 
            aria-label="Close share dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="share-modal-body">
          {loading ? (
            <div className="share-loading-state">
              <Loader2 size={24} className="spin" />
              <p>Generating share link...</p>
            </div>
          ) : error ? (
            <div className="share-error-state">
              <AlertCircle size={20} color="#EF4444" />
              <p className="share-error-text">{error}</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (sharePayload) {
                    setLoading(true)
                    setError(null)
                    api.share.create(sharePayload.campaignId, sharePayload.posts)
                      .then(res => { setShareUrl(res.shareUrl); setLoading(false) })
                      .catch(err => { setError(err?.message || 'Failed to create share link.'); setLoading(false) })
                  }
                }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Share Link Box */}
              <div className="share-link-group">
                <label className="share-field-label" htmlFor="share-link-input">Public Share Link</label>
                <div className="share-input-row">
                  <input
                    id="share-link-input"
                    ref={inputRef}
                    type="text"
                    readOnly
                    className="share-text-input"
                    value={shareUrl}
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    className={`btn btn-primary share-copy-btn ${copied ? 'copied' : ''}`}
                    onClick={handleCopy}
                  >
                    {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Expiry Banner */}
              <div className="share-expiry-banner">
                <Clock size={14} className="share-clock-icon" />
                <span>⏱️ This public link expires automatically in 48 hours.</span>
              </div>

              {/* Platforms Included Preview */}
              <div className="share-platforms-preview">
                <span className="share-platforms-label">Included Platforms ({sharePayload.posts.length}):</span>
                <div className="share-platforms-chips">
                  {sharePayload.posts.map(post => {
                    const p = PLATFORM_MAP[post.platformId]
                    return (
                      <span key={post.platformId} className="share-platform-chip">
                        <PlatformIcon id={post.platformId} size={12} color={p?.brandColor || 'currentColor'} />
                        <span>{p?.name || post.platformId}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="share-modal-footer">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={closeShare}
          >
            Done
          </button>
        </div>

      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }

        .share-modal {
          width: 100%;
          max-width: 520px;
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-card, 16px);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.16);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: share-modal-in 180ms ease-out;
        }

        @keyframes share-modal-in {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }

        .share-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          gap: 12px;
        }

        .share-header-title-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .share-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .share-globe-icon {
          color: var(--color-primary-start, #38BDF8);
        }

        .share-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary, #0F172A);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .share-modal-subtitle {
          font-size: 12.5px;
          color: var(--color-text-secondary, #64748B);
          margin: 0;
        }

        .close-share-btn {
          color: var(--color-text-secondary, #64748B);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .close-share-btn:hover {
          background: var(--color-nav-active-bg, rgba(56, 189, 248, 0.12));
          color: var(--color-primary-end, #0284C7);
        }

        .share-modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .share-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 0;
          gap: 12px;
          color: var(--color-text-secondary, #64748B);
          font-size: 13px;
        }

        .share-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 0;
          gap: 12px;
        }
        .share-error-text {
          font-size: 13px;
          color: #EF4444;
          text-align: center;
          margin: 0;
        }

        .share-link-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .share-field-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-primary, #0F172A);
        }

        .share-input-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .share-text-input {
          flex: 1;
          height: 40px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1.5px solid var(--color-border, #CBD5E1);
          background: var(--color-bg, #F8FAFC);
          font-size: 13px;
          color: var(--color-text-primary, #0F172A);
          font-family: var(--font-mono, monospace);
          outline: none;
        }
        .share-text-input:focus {
          border-color: var(--color-primary-start, #38BDF8);
          background: #FFFFFF;
        }

        .share-copy-btn {
          height: 40px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .share-copy-btn.copied {
          background: #ECFDF5 !important;
          color: #065F46 !important;
          border: 1px solid #A7F3D0 !important;
        }

        .share-expiry-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 10px;
          font-size: 12px;
          color: var(--color-text-secondary, #334155);
          font-weight: 500;
        }
        .share-clock-icon {
          color: var(--color-primary-end, #0284C7);
          flex-shrink: 0;
        }

        .share-platforms-preview {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .share-platforms-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-secondary, #64748b);
        }

        .share-platforms-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .share-platform-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 99px;
          background: var(--color-bg, #f1f5f9);
          border: 1px solid var(--color-border, #e2e8f0);
          font-size: 11.5px;
          font-weight: 500;
          color: var(--color-text-primary, #334155);
        }

        .share-modal-footer {
          padding: 14px 24px;
          border-top: 1px solid var(--color-border, #e2e8f0);
          display: flex;
          justify-content: flex-end;
          background: var(--color-bg, #fafafa);
        }
      `}</style>
    </div>
  )
}

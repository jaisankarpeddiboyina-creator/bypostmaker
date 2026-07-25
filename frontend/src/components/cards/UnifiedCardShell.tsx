import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Copy, Check, Download, MoreHorizontal, ExternalLink } from 'lucide-react'
import { PlatformIcon } from '../PlatformIcon'

export interface UnifiedCardShellProps {
  platformId: string
  platformName: string
  brandColor?: string
  status?: string
  edited?: boolean
  charCount: number
  charLimit?: number | null
  shareUrl?: string
  copied?: boolean
  downloading?: boolean
  isEditing?: boolean
  onRefine?: () => void
  onCopy?: () => void
  onDownload?: () => void
  children: React.ReactNode
}

export function UnifiedCardShell({
  platformId,
  platformName,
  brandColor = '#1DA1F2',
  status = 'Ready',
  edited = false,
  charCount,
  charLimit,
  shareUrl,
  copied = false,
  downloading = false,
  isEditing = false,
  onRefine,
  onCopy,
  onDownload,
  children
}: UnifiedCardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isOverLimit = charLimit ? charCount > charLimit : false

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="uc-card-shell">
      {/* 1. Integrated Header Bar */}
      <div className="uc-header">
        <div className="uc-header-brand">
          <PlatformIcon id={platformId} size={15} color={brandColor} />
          <span className="uc-brand-title">{platformName}</span>
          <span className="uc-status-badge">• {status}</span>
          {edited && <span className="uc-edited-tag">edited</span>}
        </div>

        <div className="uc-header-actions">
          {onRefine && (
            <button
              type="button"
              className="uc-btn uc-btn-refine"
              onClick={onRefine}
              title="Refine with AI"
            >
              <Sparkles size={12} color={brandColor} />
              <span>Refine</span>
            </button>
          )}

          {onCopy && (
            <button
              type="button"
              className={`uc-btn ${copied ? 'copied' : ''}`}
              onClick={onCopy}
              title="Copy Content"
            >
              {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}

          {/* More Options Dropdown Menu */}
          <div className="uc-dropdown-wrapper" ref={menuRef}>
            <button
              type="button"
              className="uc-btn-icon"
              onClick={() => setMenuOpen(prev => !prev)}
              title="More Actions"
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen && (
              <div className="uc-dropdown-menu">
                {onRefine && (
                  <button
                    type="button"
                    className="uc-menu-item"
                    onClick={() => { setMenuOpen(false); onRefine(); }}
                  >
                    <Sparkles size={13} color={brandColor} />
                    <span>Refine with AI</span>
                  </button>
                )}
                {onCopy && (
                  <button
                    type="button"
                    className="uc-menu-item"
                    onClick={() => { setMenuOpen(false); onCopy(); }}
                  >
                    <Copy size={13} />
                    <span>Copy Content</span>
                  </button>
                )}
                {onDownload && (
                  <button
                    type="button"
                    className="uc-menu-item"
                    onClick={() => { setMenuOpen(false); onDownload(); }}
                    disabled={downloading}
                  >
                    <Download size={13} />
                    <span>Download Kit</span>
                  </button>
                )}
                {shareUrl && (
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="uc-menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    <ExternalLink size={13} />
                    <span>Share Post</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Authentic 1:1 Social Card Body */}
      <div className="uc-body">
        {children}
      </div>

      {/* 3. Integrated Footer Bar */}
      <div className="uc-footer">
        <span className={`uc-char-count ${isOverLimit ? 'over' : ''}`}>
          {charLimit ? `${charCount}/${charLimit}` : charCount} chars
        </span>
        {isEditing && <span className="uc-edit-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="uc-share-link"
            style={{ color: brandColor }}
          >
            Share to {platformName.replace(/\s*\(.*?\)\s*/g, '')} →
          </a>
        )}
      </div>

      <style>{`
        .uc-card-shell {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 470px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .uc-card-shell:hover {
          border-color: #CBD5E1;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
        }

        /* Integrated Header Bar */
        .uc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
          gap: 8px;
        }

        .uc-header-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .uc-brand-title {
          font-size: 12px;
          font-weight: 700;
          color: #0F172A;
          white-space: nowrap;
        }

        .uc-status-badge {
          font-size: 11px;
          font-weight: 600;
          color: #10B981;
          white-space: nowrap;
        }

        .uc-edited-tag {
          font-size: 10px;
          font-weight: 500;
          color: #64748B;
          background: #E2E8F0;
          padding: 1px 5px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .uc-header-actions {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }

        .uc-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: #ffffff;
          border: 1px solid #CBD5E1;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          white-space: nowrap;
          transition: all 120ms ease;
        }

        .uc-btn:hover {
          background: #F1F5F9;
          border-color: #94A3B8;
          color: #0F172A;
        }

        .uc-btn.copied {
          color: #10B981;
          border-color: #A7F3D0;
          background: #ECFDF5;
        }

        .uc-btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #ffffff;
          border: 1px solid #CBD5E1;
          border-radius: 6px;
          color: #475569;
          cursor: pointer;
          transition: all 120ms ease;
        }

        .uc-btn-icon:hover {
          background: #F1F5F9;
          color: #0F172A;
          border-color: #94A3B8;
        }

        /* Dropdown Menu */
        .uc-dropdown-wrapper {
          position: relative;
        }

        .uc-dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          width: 160px;
          background: #ffffff;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          padding: 4px;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .uc-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 10px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #334155;
          text-decoration: none;
          cursor: pointer;
          transition: background 120ms ease;
          text-align: left;
        }

        .uc-menu-item:hover {
          background: #F1F5F9;
          color: #0F172A;
        }

        /* Card Body */
        .uc-body {
          width: 100%;
          background: #ffffff;
        }

        /* Integrated Footer Bar */
        .uc-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #F8FAFC;
          border-top: 1px solid #E2E8F0;
        }

        .uc-char-count {
          font-size: 11px;
          color: #64748B;
          font-family: var(--font-mono, monospace);
          font-weight: 500;
        }

        .uc-char-count.over {
          color: #EF4444;
          font-weight: 700;
        }

        .uc-edit-hint {
          font-size: 11px;
          color: #64748B;
        }

        .uc-share-link {
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: opacity 120ms ease;
        }

        .uc-share-link:hover {
          opacity: 0.8;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

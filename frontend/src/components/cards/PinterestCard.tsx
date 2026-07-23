import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Share2, MoreHorizontal, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#BD081C'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="pin-hashtag-text"
            style={{ color, fontWeight: 700, cursor: 'pointer' }}
          >
            {part}
          </span>
        )
      }
      if (part.match(/^https?:\/\/[^\s]+/)) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color, textDecoration: 'none', fontWeight: 700 }}
          >
            {part}
          </a>
        )
      }
      return part
    })
  }, [content, color])

  return <>{elements}</>
}

export function PinterestCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  const [saved, setSaved] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Board'

  // Extract title and description
  const lines = post.content.split('\n')
  const titleText = lines[0] || 'Pin Title'
  const descText = lines.slice(1).join('\n').trim()

  useEffect(() => {
    if (!platform || platform.maxImages === 0 || platform.imagePosition === 'none' || imageFiles.length === 0) {
      setImageUrls([])
      return
    }
    const urls = imageFiles.slice(0, platform.maxImages).map((f: File) => URL.createObjectURL(f))
    setImageUrls(urls)
    return () => { urls.forEach((url: string) => URL.revokeObjectURL(url)) }
  }, [imageFiles, platform])

  useEffect(() => { if (!isEditing) setEditValue(post.content) }, [post.content, isEditing])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [editValue, isEditing])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(post.content)
    setCopied(true)
    addToast('Pinterest pin text copied', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    if (!campaignId || downloading) return
    setDownloading(true)
    try {
      const prompt = useAppStore.getState().campaign?.prompt || ''
      const zipBlob = await generateClientZip(
        campaignId, prompt, [post], imageFiles, videoFile, () => {}
      )
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitize(platform?.name || 'Pinterest')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Pinterest kit downloaded', 'success')
    } catch (err) {
      console.error('Download failed:', err)
      addToast('Download failed. Try again.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleEditSave = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== post.content) {
      updatePost(platformId, { content: trimmed, edited: true })
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setEditValue(post.content); setIsEditing(false) }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEditSave()
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 500
  const charCount = post.content.length

  return (
    <div className="pin-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="pin-control-bar">
        <div className="pin-control-platform">
          <PlatformIcon id="pinterest" size={15} color="#BD081C" />
          <span className="pin-control-title">Pinterest</span>
          <span className="pin-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="pin-control-actions">
          <button className="pin-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#BD081C" />
            <span>Refine</span>
          </button>
          <button className={`pin-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy pin text">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="pin-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Pinterest Vertical Pin Container */}
      <div className={`pin-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Media Frame with Overlay Pin Action */}
        <div className="pin-media-viewport">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Pin Media" className="pin-img" />
          ) : (
            <div className="pin-placeholder">
              <PlatformIcon id="pinterest" size={42} color="#cccccc" />
            </div>
          )}

          {/* Hover Save Overlay */}
          <div className="pin-overlay">
            <button
              className={`pin-save-btn ${saved ? 'saved' : ''}`}
              type="button"
              onClick={() => setSaved(p => !p)}
            >
              {saved ? 'Saved' : 'Save'}
            </button>
            <div className="pin-overlay-actions">
              <button className="pin-icon-circle" type="button">
                <Share2 size={16} color="#111111" />
              </button>
              <button className="pin-icon-circle" type="button">
                <MoreHorizontal size={16} color="#111111" />
              </button>
            </div>
          </div>
        </div>

        {/* Pin Text Info & Profile Below Media */}
        <div className="pin-info-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="pin-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <>
              <h4 className="pin-title">{titleText}</h4>
              {descText && (
                <p className="pin-desc">
                  <FormattedContent content={descText} linkColor="#BD081C" />
                </p>
              )}
            </>
          )}

          <div className="pin-user-row">
            <div className="pin-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="pin-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <span className="pin-user-name">{userName}</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="pin-footer-bar">
        <span className="pin-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="pin-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="pin-footer-share">
            Pin to Pinterest →
          </a>
        )}
      </div>

      <style>{`
        .pin-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 320px; margin: 0 auto; gap: 8px;
        }
        .pin-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .pin-control-platform { display: flex; align-items: center; gap: 6px; }
        .pin-control-title { font-size: 12px; font-weight: 800; color: #BD081C; text-transform: uppercase; letter-spacing: 0.04em; }
        .pin-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .pin-control-actions { display: flex; align-items: center; gap: 6px; }
        .pin-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .pin-tool-btn:hover { background: #E9ECEF; color: #212529; }
        
        .pin-post-box {
          background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #E9E9E9;
          display: flex; flex-direction: column; box-shadow: 0 4px 16px rgba(0,0,0,0.06); transition: border-color 150ms ease;
        }
        .pin-post-box.editing { border-color: #BD081C; box-shadow: 0 0 0 2px rgba(189, 8, 28, 0.2); }

        .pin-media-viewport { position: relative; width: 100%; aspect-ratio: 2 / 3; background: #f0f0f0; overflow: hidden; }
        .pin-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pin-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f5f5f5; }

        .pin-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.25); opacity: 0; display: flex;
          flex-direction: column; justify-content: space-between; padding: 12px; transition: opacity 150ms ease;
        }
        .pin-media-viewport:hover .pin-overlay { opacity: 1; }

        .pin-save-btn {
          align-self: flex-end; background: #BD081C; color: #ffffff; border: none; font-weight: 700;
          font-size: 14px; padding: 10px 18px; border-radius: 24px; cursor: pointer; transition: background 150ms ease;
        }
        .pin-save-btn:hover { background: #ad0719; }
        .pin-save-btn.saved { background: #111111; }

        .pin-overlay-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
        .pin-icon-circle {
          width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.9); border: none;
          display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 120ms ease;
        }
        .pin-icon-circle:hover { background: #ffffff; }

        .pin-info-body { padding: 14px 16px; cursor: text; }
        .pin-title { font-size: 15px; font-weight: 700; color: #111111; line-height: 1.3; margin: 0 0 6px; }
        .pin-desc { font-size: 12.5px; line-height: 1.45; color: #555555; margin-bottom: 12px; white-space: pre-wrap; word-break: break-word; }
        .pin-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px; line-height: 1.45; color: #111111; background: #ffffff; border: 1.5px solid #BD081C;
          border-radius: 12px; padding: 10px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .pin-user-row { display: flex; align-items: center; gap: 8px; }
        .pin-avatar {
          width: 24px; height: 24px; border-radius: 50%; background: #BD081C; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 11px; flex-shrink: 0; overflow: hidden;
        }
        .pin-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .pin-user-name { font-size: 12px; font-weight: 600; color: #111111; }

        .pin-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .pin-footer-chars { font-size: 11.5px; color: #666666; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .pin-footer-hint { font-size: 11px; color: #666666; white-space: nowrap; }
        .pin-footer-share { font-size: 12.5px; font-weight: 700; color: #BD081C; text-decoration: none; }
        .pin-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

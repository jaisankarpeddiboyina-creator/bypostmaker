import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, Eye, Share2
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#2481CC'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="tg-hashtag-text"
            style={{ color, fontWeight: 600, cursor: 'pointer' }}
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
            style={{ color, textDecoration: 'none', fontWeight: 600 }}
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

export function TelegramCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Channel'

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
    addToast('Telegram message copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Telegram')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Telegram kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 4096
  const charCount = post.content.length

  return (
    <div className="tg-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="tg-control-bar">
        <div className="tg-control-platform">
          <PlatformIcon id="telegram" size={15} color="#26A5E4" />
          <span className="tg-control-title">Telegram</span>
          <span className="tg-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="tg-control-actions">
          <button className="tg-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#26A5E4" />
            <span>Refine</span>
          </button>
          <button className={`tg-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy post">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="tg-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Telegram Post Bubble */}
      <div className={`tg-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Channel Name Line */}
        <div className="tg-channel-header">
          <span className="tg-channel-name">{userName}</span>
          <span className="tg-verified-check">✔</span>
        </div>

        {/* Media Frame Grid */}
        {imageUrls.length > 0 && (
          <div className="tg-media-container">
            <div className={`tg-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
              {imageUrls.slice(0, 4).map((url, idx) => (
                <div key={idx} className="tg-img-wrapper">
                  <img src={url} alt={`Media ${idx + 1}`} className="tg-img" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="tg-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="tg-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="tg-text">
              <FormattedContent content={post.content} linkColor="#2481CC" />
            </p>
          )}

          {/* Telegram Floating Timestamp & View Counter inside Bubble */}
          <div className="tg-bubble-meta">
            <Eye size={12} color="#707579" />
            <span className="tg-views-count">1</span>
            <span className="tg-time">15:42</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="tg-footer-bar">
        <span className="tg-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="tg-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="tg-footer-share">
            Broadcast on Telegram →
          </a>
        )}
      </div>

      <style>{`
        .tg-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 440px; margin: 0 auto; gap: 8px;
        }
        .tg-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .tg-control-platform { display: flex; align-items: center; gap: 6px; }
        .tg-control-title { font-size: 12px; font-weight: 800; color: #26A5E4; text-transform: uppercase; letter-spacing: 0.04em; }
        .tg-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .tg-control-actions { display: flex; align-items: center; gap: 6px; }
        .tg-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .tg-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .tg-post-box {
          background: #ffffff; border: 1px solid #e0e0e0; border-radius: 14px; padding: 12px 14px;
          display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .tg-post-box.editing { border-color: #26A5E4; box-shadow: 0 0 0 2px rgba(38, 165, 228, 0.2); }

        .tg-channel-header { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
        .tg-channel-name { font-weight: 700; font-size: 14px; color: #2481CC; }
        .tg-verified-check { font-size: 11px; color: #2481CC; }

        .tg-media-container { width: 100%; border-radius: 8px; overflow: hidden; margin: 4px 0; border: 1px solid #f0f0f0; }
        .tg-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
        .tg-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .tg-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .tg-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .tg-image-grid.grid-3 .tg-img-wrapper:nth-child(1) { grid-row: span 2; }
        .tg-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .tg-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .tg-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .tg-body { position: relative; cursor: text; padding-bottom: 16px; }
        .tg-text {
          font-size: 14.5px; line-height: 1.45; color: #000000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .tg-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14.5px; line-height: 1.45; color: #000000; background: #ffffff; border: 1.5px solid #26A5E4;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .tg-bubble-meta {
          position: absolute; bottom: 0; right: 0; display: flex; align-items: center; gap: 4px; font-size: 11px; color: #707579;
        }
        .tg-views-count { font-weight: 500; }
        .tg-time { font-size: 11px; }

        .tg-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .tg-footer-chars { font-size: 11.5px; color: #707579; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .tg-footer-hint { font-size: 11px; color: #707579; white-space: nowrap; }
        .tg-footer-share { font-size: 12.5px; font-weight: 700; color: #26A5E4; text-decoration: none; }
        .tg-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

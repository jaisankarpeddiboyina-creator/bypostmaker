import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, Mic, Volume2
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#2B4A2F'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="ch-tag-text"
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

export function ClubhouseCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Audio Host'

  // Extract Room Title & Details
  const lines = post.content.split('\n').filter(Boolean)
  const roomTitle = lines[0] || 'The Future of AI Social Tools 🎙️'
  const detailsText = lines.slice(1).join('\n\n').trim()

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
    addToast('Clubhouse room info copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Clubhouse')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Clubhouse kit downloaded', 'success')
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
  const charCount = post.content.length

  return (
    <div className="ch-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="ch-control-bar">
        <div className="ch-control-platform">
          <PlatformIcon id="clubhouse" size={15} color="#F1EFE0" />
          <span className="ch-control-title">Clubhouse</span>
          <span className="ch-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="ch-control-actions">
          <button className="ch-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#5B532C" />
            <span>Refine</span>
          </button>
          <button className={`ch-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy info">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="ch-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Clubhouse Audio Room Card (#f7f4ea) */}
      <div className={`ch-post-box ${isEditing ? 'editing' : ''}`}>
        <div className="ch-room-header">
          <span className="ch-club-name">BUILDERS CLUB 🏰</span>
        </div>

        {/* Room Title */}
        <div className="ch-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="ch-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <>
              <h2 className="ch-room-title">{roomTitle}</h2>
              {detailsText && (
                <p className="ch-details">
                  <FormattedContent content={detailsText} linkColor="#2B4A2F" />
                </p>
              )}
            </>
          )}
        </div>

        {/* Speakers Grid */}
        <div className="ch-speakers-grid">
          <div className="ch-speaker">
            <div className="ch-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="ch-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
              <div className="ch-mic-badge"><Mic size={10} color="#ffffff" /></div>
            </div>
            <span className="ch-speaker-name">{userName}</span>
          </div>

          <div className="ch-speaker">
            <div className="ch-avatar guest">
              <span>G</span>
            </div>
            <span className="ch-speaker-name">Guest Speaker</span>
          </div>
        </div>

        {/* Join Audio Room Button */}
        <div className="ch-cta-row">
          <button className="ch-join-btn">
            <Volume2 size={15} color="#2B4A2F" />
            <span>Join Room</span>
          </button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="ch-footer-bar">
        <span className="ch-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="ch-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="ch-footer-share">
            Schedule Room →
          </a>
        )}
      </div>

      <style>{`
        .ch-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 440px; margin: 0 auto; gap: 8px;
        }
        .ch-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .ch-control-platform { display: flex; align-items: center; gap: 6px; }
        .ch-control-title { font-size: 12px; font-weight: 800; color: #5B532C; text-transform: uppercase; letter-spacing: 0.04em; }
        .ch-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .ch-control-actions { display: flex; align-items: center; gap: 6px; }
        .ch-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .ch-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .ch-post-box {
          background: #f7f4ea; border: 1px solid #e3dec9; border-radius: 16px; padding: 18px;
          display: flex; flex-direction: column; gap: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .ch-post-box.editing { border-color: #2B4A2F; box-shadow: 0 0 0 2px rgba(43, 74, 47, 0.25); }

        .ch-club-name { font-size: 11px; font-weight: 800; color: #5B532C; letter-spacing: 0.05em; }

        .ch-body { cursor: text; }
        .ch-room-title { font-size: 17px; font-weight: 800; color: #332d19; line-height: 1.35; margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .ch-details { font-size: 13.5px; line-height: 1.45; color: #554d33; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; white-space: pre-wrap; word-break: break-word; }
        .ch-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13.5px; line-height: 1.45; color: #332d19; background: #ffffff; border: 1.5px solid #2B4A2F;
          border-radius: 8px; padding: 8px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .ch-speakers-grid { display: flex; gap: 16px; padding: 6px 0; }
        .ch-speaker { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .ch-avatar {
          position: relative; width: 44px; height: 44px; border-radius: 18px; background: #2B4A2F; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 800; font-size: 16px; flex-shrink: 0; overflow: hidden;
        }
        .ch-avatar.guest { background: #dcd6be; color: #554d33; }
        .ch-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .ch-mic-badge { position: absolute; bottom: 2px; right: 2px; background: #25D366; padding: 2px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .ch-speaker-name { font-size: 11.5px; font-weight: 600; color: #332d19; }

        .ch-cta-row { display: flex; justify-content: flex-end; }
        .ch-join-btn {
          display: flex; align-items: center; gap: 6px; background: #e8e3d0; border: 1px solid #d3ccb0;
          color: #2B4A2F; font-weight: 800; font-size: 12px; padding: 6px 14px; border-radius: 99px; cursor: pointer;
        }
        .ch-join-btn:hover { background: #dcd6bf; }

        .ch-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .ch-footer-chars { font-size: 11.5px; color: #554d33; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .ch-footer-hint { font-size: 11px; color: #554d33; white-space: nowrap; }
        .ch-footer-share { font-size: 12.5px; font-weight: 700; color: #2B4A2F; text-decoration: none; }
        .ch-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

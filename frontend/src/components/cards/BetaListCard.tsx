import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, Rocket
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FF5A5F'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="bl-tag-text"
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

export function BetaListCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Startup Name'

  // Extract Startup Name & Tagline
  const lines = post.content.split('\n').filter(Boolean)
  const startupTitle = lines[0] || userName
  const taglineText = lines.slice(1).join('\n\n').trim()

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
    addToast('BetaList startup text copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'BetaList')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('BetaList kit downloaded', 'success')
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
    <div className="bl-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="bl-control-bar">
        <div className="bl-control-platform">
          <PlatformIcon id="betalist" size={15} color="#FF5A5F" />
          <span className="bl-control-title">BetaList</span>
          <span className="bl-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="bl-control-actions">
          <button className="bl-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#FF5A5F" />
            <span>Refine</span>
          </button>
          <button className={`bl-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy pitch">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="bl-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 BetaList Startup Launch Card */}
      <div className={`bl-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Startup Screenshot Frame */}
        <div className="bl-media-frame">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Startup preview" className="bl-startup-img" />
          ) : (
            <div className="bl-placeholder-canvas">
              <Rocket size={36} color="#FF5A5F" />
              <span>Upload Startup Landing Page Screenshot</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="bl-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="bl-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <>
              <h2 className="bl-startup-title">{startupTitle}</h2>
              {taglineText && (
                <p className="bl-tagline">
                  <FormattedContent content={taglineText} linkColor="#FF5A5F" />
                </p>
              )}
            </>
          )}
        </div>

        {/* Access CTA Bar */}
        <div className="bl-cta-bar">
          <button className="bl-access-btn">Get Early Access</button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="bl-footer-bar">
        <span className="bl-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="bl-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="bl-footer-share">
            Submit Startup →
          </a>
        )}
      </div>

      <style>{`
        .bl-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 480px; margin: 0 auto; gap: 8px;
        }
        .bl-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .bl-control-platform { display: flex; align-items: center; gap: 6px; }
        .bl-control-title { font-size: 12px; font-weight: 800; color: #FF5A5F; text-transform: uppercase; letter-spacing: 0.04em; }
        .bl-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .bl-control-actions { display: flex; align-items: center; gap: 6px; }
        .bl-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .bl-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .bl-post-box {
          background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .bl-post-box.editing { border-color: #FF5A5F; box-shadow: 0 0 0 2px rgba(255, 90, 95, 0.25); }

        .bl-media-frame { width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #fafafa; border: 1px solid #f0f0f0; }
        .bl-startup-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .bl-placeholder-canvas {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: #94a3b8; font-size: 12px; font-weight: 600;
        }

        .bl-body { cursor: text; }
        .bl-startup-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .bl-tagline { font-size: 14px; line-height: 1.45; color: #475569; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; white-space: pre-wrap; word-break: break-word; }
        .bl-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.45; color: #0f172a; background: #ffffff; border: 1.5px solid #FF5A5F;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .bl-cta-bar { display: flex; justify-content: flex-end; padding-top: 4px; }
        .bl-access-btn {
          background: #FF5A5F; color: #ffffff; border: none; font-weight: 700; font-size: 12.5px;
          padding: 8px 18px; border-radius: 8px; cursor: pointer; transition: background 120ms ease;
        }
        .bl-access-btn:hover { background: #e04b50; }

        .bl-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .bl-footer-chars { font-size: 11.5px; color: #64748b; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .bl-footer-hint { font-size: 11px; color: #64748b; white-space: nowrap; }
        .bl-footer-share { font-size: 12.5px; font-weight: 700; color: #FF5A5F; text-decoration: none; }
        .bl-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

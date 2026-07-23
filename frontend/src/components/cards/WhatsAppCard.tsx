import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, CheckCheck
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#075E54'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="wa-hashtag-text"
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

export function WhatsAppCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'

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
    addToast('WhatsApp message copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'WhatsApp')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('WhatsApp kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 65536
  const charCount = post.content.length

  return (
    <div className="wa-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="wa-control-bar">
        <div className="wa-control-platform">
          <PlatformIcon id="whatsapp" size={15} color="#25D366" />
          <span className="wa-control-title">WhatsApp</span>
          <span className="wa-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="wa-control-actions">
          <button className="wa-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#25D366" />
            <span>Refine</span>
          </button>
          <button className={`wa-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy message">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="wa-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 WhatsApp Chat Bubble (#DCF8C6) */}
      <div className={`wa-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Contact Header */}
        <div className="wa-header-row">
          <div className="wa-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="wa-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="wa-user-details">
            <span className="wa-user-name">{userName}</span>
            <span className="wa-status">online</span>
          </div>
        </div>

        {/* Message Bubble Frame */}
        <div className="wa-bubble-wrapper">
          <div className="wa-bubble" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
            {imageUrls.length > 0 && (
              <div className="wa-media-container">
                <img src={imageUrls[0]} alt="Attachment" className="wa-img" />
              </div>
            )}

            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="wa-edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                autoFocus
                spellCheck
              />
            ) : (
              <p className="wa-text">
                <FormattedContent content={post.content} linkColor="#075E54" />
              </p>
            )}

            <div className="wa-bubble-meta">
              <span className="wa-time">15:42</span>
              <CheckCheck size={14} color="#53bdeb" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="wa-footer-bar">
        <span className="wa-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="wa-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="wa-footer-share">
            Send on WhatsApp →
          </a>
        )}
      </div>

      <style>{`
        .wa-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 440px; margin: 0 auto; gap: 8px;
        }
        .wa-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .wa-control-platform { display: flex; align-items: center; gap: 6px; }
        .wa-control-title { font-size: 12px; font-weight: 800; color: #25D366; text-transform: uppercase; letter-spacing: 0.04em; }
        .wa-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .wa-control-actions { display: flex; align-items: center; gap: 6px; }
        .wa-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .wa-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .wa-post-box {
          background: #e5ddd5; border: 1px solid #d1c7bd; border-radius: 14px; padding: 14px;
          display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .wa-post-box.editing { border-color: #25D366; box-shadow: 0 0 0 2px rgba(37, 211, 102, 0.25); }

        .wa-header-row { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .wa-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #075E54; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .wa-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .wa-user-details { display: flex; flex-direction: column; }
        .wa-user-name { font-weight: 700; font-size: 14px; color: #111111; }
        .wa-status { font-size: 11px; color: #075E54; font-weight: 500; }

        .wa-bubble-wrapper { display: flex; justify-content: flex-end; }
        .wa-bubble {
          position: relative; background: #e7ffdb; border-radius: 10px 0 10px 10px; padding: 10px 12px 18px;
          max-width: 88%; box-shadow: 0 1px 2px rgba(0,0,0,0.12); cursor: text;
        }

        .wa-media-container { width: 100%; border-radius: 6px; overflow: hidden; margin-bottom: 6px; }
        .wa-img { width: 100%; height: auto; max-height: 260px; object-fit: cover; display: block; }

        .wa-text {
          font-size: 14px; line-height: 1.45; color: #111111;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .wa-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.45; color: #111111; background: #ffffff; border: 1.5px solid #25D366;
          border-radius: 6px; padding: 8px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .wa-bubble-meta {
          position: absolute; bottom: 3px; right: 8px; display: flex; align-items: center; gap: 3px; font-size: 10.5px; color: #667781;
        }
        .wa-time { font-size: 10.5px; }

        .wa-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .wa-footer-chars { font-size: 11.5px; color: #667781; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .wa-footer-hint { font-size: 11px; color: #667781; white-space: nowrap; }
        .wa-footer-share { font-size: 12.5px; font-weight: 700; color: #25D366; text-decoration: none; }
        .wa-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

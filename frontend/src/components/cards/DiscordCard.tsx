import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, Smile, CornerUpLeft, MoreHorizontal
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0067D5'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="dis-mention-tag"
            style={{ color: '#5865F2', background: 'rgba(88, 101, 242, 0.12)', padding: '1px 4px', borderRadius: 3, fontWeight: 600, cursor: 'pointer' }}
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

export function DiscordCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Reaction Pills
  const [reactedRocket, setReactedRocket] = useState(false)
  const [rocketCount, setRocketCount] = useState(1)
  const [reactedHeart, setReactedHeart] = useState(false)
  const [heartCount, setHeartCount] = useState(0)

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
    addToast('Discord message copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Discord')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Discord kit downloaded', 'success')
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

  const toggleRocket = () => {
    setReactedRocket(prev => !prev)
    setRocketCount(prev => (reactedRocket ? prev - 1 : prev + 1))
  }

  const toggleHeart = () => {
    setReactedHeart(prev => !prev)
    setHeartCount(prev => (reactedHeart ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 2000
  const charCount = post.content.length

  return (
    <div className="dis-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="dis-control-bar">
        <div className="dis-control-platform">
          <PlatformIcon id="discord" size={15} color="#5865F2" />
          <span className="dis-control-title">Discord</span>
          <span className="dis-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="dis-control-actions">
          <button className="dis-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#5865F2" />
            <span>Refine</span>
          </button>
          <button className={`dis-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy message">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="dis-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Discord Light Message Container (#ffffff) */}
      <div className={`dis-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Floating Action Toolbar on Hover */}
        <div className="dis-hover-bar">
          <button className="dis-hover-btn" title="Add Reaction"><Smile size={14} color="#4e5058" /></button>
          <button className="dis-hover-btn" title="Reply"><CornerUpLeft size={14} color="#4e5058" /></button>
          <button className="dis-hover-btn" title="More"><MoreHorizontal size={14} color="#4e5058" /></button>
        </div>

        <div className="dis-message-row">
          {/* Avatar Column */}
          <div className="dis-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="dis-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>

          {/* Content Column */}
          <div className="dis-main-col">
            {/* User Header Line */}
            <div className="dis-header-line">
              <span className="dis-user-name">{userName}</span>
              <span className="dis-bot-badge">APP</span>
              <span className="dis-timestamp">Today at 3:42 PM</span>
            </div>

            {/* Message Body */}
            <div className="dis-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="dis-edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  spellCheck
                />
              ) : (
                <p className="dis-text">
                  <FormattedContent content={post.content} linkColor="#0067D5" />
                </p>
              )}
            </div>

            {/* Media Attachment Grid */}
            {imageUrls.length > 0 && (
              <div className="dis-media-container">
                <div className={`dis-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
                  {imageUrls.slice(0, 4).map((url, idx) => (
                    <div key={idx} className="dis-img-wrapper">
                      <img src={url} alt={`Attachment ${idx + 1}`} className="dis-img" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reaction Pills Row */}
            <div className="dis-reactions-row">
              <button className={`dis-reaction-pill ${reactedRocket ? 'active' : ''}`} onClick={toggleRocket}>
                <span>🚀</span>
                <span className="dis-pill-count">{rocketCount}</span>
              </button>

              <button className={`dis-reaction-pill ${reactedHeart ? 'active' : ''}`} onClick={toggleHeart}>
                <span>❤️</span>
                {heartCount > 0 && <span className="dis-pill-count">{heartCount}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="dis-footer-bar">
        <span className="dis-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="dis-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="dis-footer-share">
            Send to Discord →
          </a>
        )}
      </div>

      <style>{`
        .dis-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 520px; margin: 0 auto; gap: 8px;
        }
        .dis-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .dis-control-platform { display: flex; align-items: center; gap: 6px; }
        .dis-control-title { font-size: 12px; font-weight: 800; color: #5865F2; text-transform: uppercase; letter-spacing: 0.04em; }
        .dis-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .dis-control-actions { display: flex; align-items: center; gap: 6px; }
        .dis-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .dis-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .dis-post-box {
          position: relative; background: #ffffff; border: 1px solid #e3e5e8; border-radius: 12px; padding: 14px;
          display: flex; flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .dis-post-box.editing { border-color: #5865F2; box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2); }

        .dis-hover-bar {
          position: absolute; top: -12px; right: 14px; background: #ffffff; border: 1px solid #e3e5e8;
          border-radius: 6px; display: flex; align-items: center; padding: 2px; z-index: 10; opacity: 0; transition: opacity 120ms ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .dis-post-box:hover .dis-hover-bar { opacity: 1; }
        .dis-hover-btn { background: transparent; border: none; padding: 4px 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; }
        .dis-hover-btn:hover { background: #f2f3f5; }

        .dis-message-row { display: flex; gap: 14px; }
        .dis-avatar {
          width: 40px; height: 40px; border-radius: 50%; background: #5865F2; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden;
        }
        .dis-avatar-img { width: 100%; height: 100%; object-fit: cover; }

        .dis-main-col { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .dis-header-line { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .dis-user-name { font-weight: 600; font-size: 14.5px; color: #060607; font-family: "gg sans", -apple-system, BlinkMacSystemFont, sans-serif; }
        .dis-bot-badge {
          font-size: 9.5px; font-weight: 800; color: #ffffff; background: #5865F2; padding: 1px 4px; border-radius: 3px;
        }
        .dis-timestamp { font-size: 11.5px; color: #5c5e66; font-family: "gg sans", -apple-system, BlinkMacSystemFont, sans-serif; }

        .dis-body { cursor: text; margin-bottom: 8px; }
        .dis-text {
          font-size: 14.5px; line-height: 1.45; color: #313338;
          font-family: "gg sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .dis-edit-textarea {
          width: 100%; font-family: "gg sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14.5px; line-height: 1.45; color: #060607; background: #ffffff; border: 1.5px solid #5865F2;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .dis-media-container { width: 100%; border-radius: 8px; overflow: hidden; margin-bottom: 8px; border: 1px solid #e3e5e8; }
        .dis-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
        .dis-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .dis-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .dis-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .dis-image-grid.grid-3 .dis-img-wrapper:nth-child(1) { grid-row: span 2; }
        .dis-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .dis-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .dis-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .dis-reactions-row { display: flex; align-items: center; gap: 6px; }
        .dis-reaction-pill {
          display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px;
          background: #f2f3f5; border: 1px solid #e3e5e8; font-size: 12px; color: #4e5058; cursor: pointer; transition: all 120ms ease;
        }
        .dis-reaction-pill:hover { background: #e3e5e8; border-color: #c4c9ce; }
        .dis-reaction-pill.active { background: rgba(88, 101, 242, 0.12); border-color: #5865F2; color: #5865F2; }
        .dis-pill-count { font-weight: 600; }

        .dis-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .dis-footer-chars { font-size: 11.5px; color: #666666; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .dis-footer-hint { font-size: 11px; color: #666666; white-space: nowrap; }
        .dis-footer-share { font-size: 12.5px; font-weight: 700; color: #5865F2; text-decoration: none; }
        .dis-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

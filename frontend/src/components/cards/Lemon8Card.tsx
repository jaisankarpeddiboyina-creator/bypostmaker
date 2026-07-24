import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Heart, Bookmark, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FFCE00'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="l8-tag-text"
            style={{ color: '#111111', background: '#FFF000', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}
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

export function Lemon8Card({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Reaction Counters
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [saved, setSaved] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Creator'

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
    addToast('Lemon8 post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Lemon8')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Lemon8 kit downloaded', 'success')
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

  const toggleLike = () => {
    setLiked(prev => !prev)
    setLikeCount(prev => (liked ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charCount = post.content.length

  return (
    <div className="l8-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="l8-control-bar">
        <div className="l8-control-platform">
          <PlatformIcon id="lemon8" size={15} color="#FFCE00" />
          <span className="l8-control-title">Lemon8</span>
          <span className="l8-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="l8-control-actions">
          <button className="l8-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#FFCE00" />
            <span>Refine</span>
          </button>
          <button className={`l8-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy post">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="l8-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Lemon8 Lifestyle Post Card */}
      <div className={`l8-post-box ${isEditing ? 'editing' : ''}`}>
        {/* 3:4 Vertical Image Frame */}
        <div className="l8-media-frame">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Post image" className="l8-post-img" />
          ) : (
            <div className="l8-placeholder-canvas">
              <PlatformIcon id="lemon8" size={48} color="#FFCE00" />
              <span>Upload 3:4 Lifestyle Cover</span>
            </div>
          )}
        </div>

        {/* Post Text Body */}
        <div className="l8-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="l8-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="l8-text">
              <FormattedContent content={post.content} linkColor="#FFCE00" />
            </p>
          )}
        </div>

        {/* Creator Footer Row */}
        <div className="l8-footer-row">
          <div className="l8-author">
            <div className="l8-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="l8-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <span className="l8-user-name">{userName}</span>
          </div>

          <div className="l8-actions">
            <button className={`l8-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
              <Heart size={16} fill={liked ? '#FF0050' : 'none'} color={liked ? '#FF0050' : '#222222'} />
              {likeCount > 0 && <span className="l8-count">{likeCount}</span>}
            </button>
            <button className={`l8-action-btn ${saved ? 'saved' : ''}`} onClick={() => setSaved(p => !p)}>
              <Bookmark size={16} fill={saved ? '#FFCE00' : 'none'} color={saved ? '#FFCE00' : '#222222'} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="l8-footer-bar">
        <span className="l8-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="l8-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="l8-footer-share">
            Post on Lemon8 →
          </a>
        )}
      </div>

      <style>{`
        .l8-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 440px; margin: 0 auto; gap: 8px;
        }
        .l8-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .l8-control-platform { display: flex; align-items: center; gap: 6px; }
        .l8-control-title { font-size: 12px; font-weight: 800; color: #111111; text-transform: uppercase; letter-spacing: 0.04em; }
        .l8-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .l8-control-actions { display: flex; align-items: center; gap: 6px; }
        .l8-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .l8-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .l8-post-box {
          background: #ffffff; border: 1px solid #eeeeee; border-radius: 16px; padding: 14px;
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .l8-post-box.editing { border-color: #FFCE00; box-shadow: 0 0 0 2px rgba(255, 206, 0, 0.4); }

        .l8-media-frame { width: 100%; aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden; background: #fdfbef; }
        .l8-post-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .l8-placeholder-canvas {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #888888; font-size: 12px; font-weight: 700;
        }

        .l8-body { cursor: text; }
        .l8-text {
          font-size: 14px; line-height: 1.45; color: #222222; font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .l8-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.45; color: #222222; background: #ffffff; border: 1.5px solid #FFCE00;
          border-radius: 8px; padding: 8px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .l8-footer-row { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
        .l8-author { display: flex; align-items: center; gap: 8px; }
        .l8-avatar {
          width: 28px; height: 28px; border-radius: 50%; background: #FFCE00; display: flex; align-items: center;
          justify-content: center; color: #111111; font-weight: 800; font-size: 12px; flex-shrink: 0; overflow: hidden;
        }
        .l8-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .l8-user-name { font-weight: 700; font-size: 13px; color: #111111; }

        .l8-actions { display: flex; align-items: center; gap: 10px; }
        .l8-action-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; padding: 2px; }
        .l8-count { font-size: 12px; font-weight: 700; color: #FF0050; }

        .l8-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .l8-footer-chars { font-size: 11.5px; color: #777777; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .l8-footer-hint { font-size: 11px; color: #777777; white-space: nowrap; }
        .l8-footer-share { font-size: 12.5px; font-weight: 700; color: #111111; text-decoration: none; }
        .l8-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

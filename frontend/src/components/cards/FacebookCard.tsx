import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, ThumbsUp, Share2, Sparkles, MoreHorizontal, Globe, X
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#1877F2'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="fb-hashtag-text"
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

export function FacebookCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Live Card States
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

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
    addToast('Facebook post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Facebook')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Facebook kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 63206
  const charCount = post.content.length

  return (
    <div className="fb-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="fb-control-bar">
        <div className="fb-control-platform">
          <PlatformIcon id="facebook" size={15} color="#1877F2" />
          <span className="fb-control-title">Facebook</span>
          <span className="fb-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="fb-control-actions">
          <button className="fb-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#1877F2" />
            <span>Refine</span>
          </button>
          <button className={`fb-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy post">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="fb-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Facebook Post Container */}
      <div className={`fb-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Profile Header */}
        <div className="fb-profile-header">
          <div className="fb-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="fb-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="fb-user-details">
            <span className="fb-user-name">{userName}</span>
            <div className="fb-time-line">
              <span className="fb-time">Just now</span>
              <span className="fb-dot">•</span>
              <Globe size={12} color="#65676B" />
            </div>
          </div>
          <div className="fb-header-actions">
            <MoreHorizontal size={20} className="fb-icon-btn" />
            <X size={20} className="fb-icon-btn" />
          </div>
        </div>

        {/* Post Text Body */}
        <div className="fb-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="fb-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="fb-text">
              <FormattedContent content={post.content} linkColor="#1877F2" />
            </p>
          )}
        </div>

        {/* Media Frame Grid */}
        {imageUrls.length > 0 && (
          <div className="fb-media-container">
            <div className={`fb-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
              {imageUrls.slice(0, 4).map((url, idx) => (
                <div key={idx} className="fb-img-wrapper">
                  <img src={url} alt={`Media ${idx + 1}`} className="fb-img" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reaction Stats Row */}
        {likeCount > 0 && (
          <div className="fb-stats-row">
            <div className="fb-reaction-pill">
              <span className="fb-like-circle">👍</span>
              <span className="fb-count">{likeCount}</span>
            </div>
          </div>
        )}

        {/* Action Buttons (Like, Comment, Share) */}
        <div className="fb-actions-bar">
          <button className={`fb-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
            <ThumbsUp size={18} fill={liked ? '#1877F2' : 'none'} color={liked ? '#1877F2' : '#65676B'} />
            <span>Like</span>
          </button>
          <button className="fb-action-btn">
            <MessageSquare size={18} color="#65676B" />
            <span>Comment</span>
          </button>
          <button className="fb-action-btn">
            <Share2 size={18} color="#65676B" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="fb-footer-bar">
        <span className="fb-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="fb-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="fb-footer-share">
            Share to Facebook →
          </a>
        )}
      </div>

      <style>{`
        .fb-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 500px; margin: 0 auto; gap: 8px;
        }
        .fb-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .fb-control-platform { display: flex; align-items: center; gap: 6px; }
        .fb-control-title { font-size: 12px; font-weight: 800; color: #1877F2; text-transform: uppercase; letter-spacing: 0.04em; }
        .fb-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .fb-control-actions { display: flex; align-items: center; gap: 6px; }
        .fb-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .fb-tool-btn:hover { background: #E9ECEF; color: #212529; }
        
        .fb-post-box {
          background: #ffffff; border: 1px solid #ced0d4; border-radius: 10px; overflow: hidden;
          display: flex; flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .fb-post-box.editing { border-color: #1877F2; box-shadow: 0 0 0 2px rgba(24, 119, 242, 0.15); }
        
        .fb-profile-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px 8px; }
        .fb-avatar {
          width: 40px; height: 40px; border-radius: 50%; background: #1877F2; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden;
        }
        .fb-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .fb-user-details { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .fb-user-name { font-weight: 700; font-size: 15px; color: #050505; }
        .fb-time-line { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #65676B; margin-top: 1px; }
        .fb-header-actions { display: flex; gap: 8px; color: #65676B; }
        .fb-icon-btn { cursor: pointer; transition: color 120ms ease; }
        .fb-icon-btn:hover { color: #050505; }

        .fb-body { padding: 4px 16px 12px; cursor: text; }
        .fb-text {
          font-size: 15px; line-height: 1.45; color: #050505;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .fb-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 15px; line-height: 1.45; color: #050505; background: #ffffff; border: 1.5px solid #1877F2; border-radius: 8px;
          padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .fb-media-container { width: 100%; overflow: hidden; background: #000000; }
        .fb-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
        .fb-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .fb-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .fb-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .fb-image-grid.grid-3 .fb-img-wrapper:nth-child(1) { grid-row: span 2; }
        .fb-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .fb-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .fb-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .fb-stats-row { padding: 8px 16px 4px; border-bottom: 1px solid #e5e5e5; font-size: 13px; color: #65676B; }
        .fb-reaction-pill { display: flex; align-items: center; gap: 4px; }
        .fb-like-circle { font-size: 13px; }
        .fb-count { font-weight: 600; color: #65676B; }

        .fb-actions-bar { display: grid; grid-template-columns: repeat(3, 1fr); padding: 4px 8px; border-top: 1px solid #f0f2f5; }
        .fb-action-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 0;
          background: transparent; border: none; border-radius: 6px; font-size: 14px; font-weight: 600;
          color: #65676B; cursor: pointer; transition: background 120ms ease;
        }
        .fb-action-btn:hover { background: #f0f2f5; }
        .fb-action-btn.liked { color: #1877F2; }

        .fb-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .fb-footer-chars { font-size: 11.5px; color: #65676B; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .fb-footer-hint { font-size: 11px; color: #65676B; white-space: nowrap; }
        .fb-footer-share { font-size: 12.5px; font-weight: 700; color: #1877F2; text-decoration: none; }
        .fb-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

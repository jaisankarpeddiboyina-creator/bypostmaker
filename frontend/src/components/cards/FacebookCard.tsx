import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, ThumbsUp, Share2, MoreHorizontal, Globe, X
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

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
    <UnifiedCardShell
      platformId="facebook"
      platformName="Facebook"
      brandColor="#1877F2"
      status="Ready"
      edited={post.edited}
      charCount={charCount}
      charLimit={charLimit}
      shareUrl={shareUrl}
      copied={copied}
      downloading={downloading}
      isEditing={isEditing}
      onRefine={onOpenRefinement}
      onCopy={handleCopy}
      onDownload={handleDownload}
    >
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

      <style>{`
        .fb-post-box {
          background: #ffffff; display: flex; flex-direction: column; transition: background 150ms ease;
        }
        .fb-post-box.editing { background: #F8FAFC; }
        
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
      `}</style>
    </UnifiedCardShell>
  )
}

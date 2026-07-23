import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Heart, Repeat, Bookmark, Send, Sparkles, MoreHorizontal
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0095F6'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span
            key={idx}
            className="ig-hashtag-text"
            style={{ color, fontWeight: 500, cursor: 'pointer' }}
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
            style={{ color, textDecoration: 'none', fontWeight: 500 }}
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

export function InstagramCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [activeImgIdx, setActiveImgIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Live Card States (Clean 0 Baseline)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [reposted, setReposted] = useState(false)
  const [repostCount, setRepostCount] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)
  const [following, setFollowing] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'
  const handleName = user?.name ? user.name.toLowerCase().replace(/\s+/g, '.') : 'your.brand'

  useEffect(() => {
    if (!platform || platform.maxImages === 0 || platform.imagePosition === 'none' || imageFiles.length === 0) {
      setImageUrls([])
      return
    }
    const urls = imageFiles.slice(0, platform.maxImages).map((f: File) => URL.createObjectURL(f))
    setImageUrls(urls)
    setActiveImgIdx(0)
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
    addToast('Instagram post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Instagram')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Instagram kit downloaded', 'success')
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

  const toggleRepost = () => {
    setReposted(prev => !prev)
    setRepostCount(prev => (reposted ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 2200
  const charCount = post.content.length
  const isOverLimit = charCount > charLimit

  return (
    <div className="ig-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="ig-control-bar">
        <div className="ig-control-platform">
          <PlatformIcon id="instagram" size={15} color="#E1306C" />
          <span className="ig-control-title">Instagram</span>
          <span className="ig-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="ig-control-actions">
          <button className="ig-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#E1306C" />
            <span>Refine</span>
          </button>
          <button className={`ig-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy caption">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="ig-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Instagram Post Box */}
      <div className={`ig-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Profile Header */}
        <div className="ig-profile-header">
          <div className="ig-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="ig-avatar-img" />
            ) : (
              handleName[0].toUpperCase()
            )}
          </div>
          <div className="ig-header-info">
            <span className="ig-username">{handleName}</span>
            <span className="ig-dot">•</span>
            <span className="ig-time">Just now</span>
          </div>
          <button
            className={`ig-follow-btn ${following ? 'following' : ''}`}
            type="button"
            onClick={() => setFollowing(p => !p)}
          >
            {following ? 'Following' : 'Follow'}
          </button>
          <MoreHorizontal size={18} className="ig-more" />
        </div>

        {/* Media Frame (Dedicated Instagram Arrow & Dots Carousel) */}
        {imageUrls.length > 0 && (
          <div className="ig-media-wrapper">
            <img src={imageUrls[activeImgIdx]} alt={`Media ${activeImgIdx + 1}`} className="ig-media-img" />
            {imageUrls.length > 1 && (
              <>
                {activeImgIdx > 0 && (
                  <button
                    className="ig-carousel-arrow prev"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i - 1); }}
                    title="Previous image"
                  >
                    ‹
                  </button>
                )}
                {activeImgIdx < imageUrls.length - 1 && (
                  <button
                    className="ig-carousel-arrow next"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i + 1); }}
                    title="Next image"
                  >
                    ›
                  </button>
                )}
                <div className="ig-carousel-dots">
                  {imageUrls.map((_, idx) => (
                    <span
                      key={idx}
                      className={`ig-dot-item ${idx === activeImgIdx ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActiveImgIdx(idx); }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Action Row */}
        <div className="ig-actions-row">
          <div className="ig-action-item" onClick={toggleLike}>
            <Heart size={22} className={`ig-action-icon ${liked ? 'liked' : ''}`} fill={liked ? '#ed4956' : 'none'} color={liked ? '#ed4956' : '#262626'} />
            <span className="ig-action-count">{likeCount}</span>
          </div>
          <div className="ig-action-item">
            <MessageSquare size={22} className="ig-action-icon" />
          </div>
          <div className="ig-action-item" onClick={toggleRepost}>
            <Repeat size={22} className={`ig-action-icon ${reposted ? 'reposted' : ''}`} color={reposted ? '#0095F6' : '#262626'} />
            {repostCount > 0 && <span className="ig-action-count">{repostCount}</span>}
          </div>
          <div className="ig-action-item">
            <Send size={22} className="ig-action-icon" />
          </div>
          <div className="ig-action-item ml-auto" onClick={() => setBookmarked(p => !p)}>
            <Bookmark size={22} className="ig-action-icon" fill={bookmarked ? '#262626' : 'none'} color="#262626" />
          </div>
        </div>

        {/* Caption Body */}
        <div className="ig-caption-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit caption">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="ig-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="ig-caption-text">
              <span className="ig-caption-username">{handleName} </span>
              <FormattedContent content={post.content} linkColor="#0095F6" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="ig-footer-bar">
        <span className={`ig-footer-chars ${isOverLimit ? 'over' : ''}`}>
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="ig-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="ig-footer-share">
            Share to Instagram →
          </a>
        )}
      </div>

      <style>{`
        .ig-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 470px; margin: 0 auto; gap: 8px;
        }
        .ig-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .ig-control-platform { display: flex; align-items: center; gap: 6px; }
        .ig-control-title { font-size: 12px; font-weight: 800; color: #E1306C; text-transform: uppercase; letter-spacing: 0.04em; }
        .ig-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .ig-control-actions { display: flex; align-items: center; gap: 6px; }
        .ig-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .ig-tool-btn:hover { background: #E9ECEF; color: #212529; }
        .ig-post-box {
          background: #ffffff; border: 1px solid #dbdbdb; border-radius: 12px; overflow: hidden; display: flex;
          flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .ig-post-box.editing { border-color: #0095F6; box-shadow: 0 0 0 2px rgba(0, 149, 246, 0.15); }
        .ig-profile-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #ffffff; }
        .ig-avatar {
          width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
          display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 700; font-size: 13px; flex-shrink: 0; padding: 2px;
        }
        .ig-avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .ig-header-info { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
        .ig-username { font-weight: 700; font-size: 14px; color: #262626; }
        .ig-dot { color: #8e8e8e; font-size: 11px; }
        .ig-time { color: #8e8e8e; font-size: 13px; font-weight: 400; }
        .ig-follow-btn {
          background: #EFEFEF; border: none; color: #000000; font-weight: 600; font-size: 13px; padding: 6px 16px;
          border-radius: 8px; cursor: pointer; transition: background 150ms ease;
        }
        .ig-follow-btn:hover { background: #dbdbdb; }
        .ig-follow-btn.following { background: #EFEFEF; color: #262626; }
        .ig-more { color: #262626; margin-left: 4px; cursor: pointer; }
        .ig-media-wrapper {
          position: relative; width: 100%; max-height: 480px; background: #fafafa; overflow: hidden; display: flex; align-items: center; justify-content: center;
        }
        .ig-media-img { width: 100%; height: auto; max-height: 480px; object-fit: contain; display: block; }
        .ig-carousel-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255, 255, 255, 0.9); box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: none; display: flex; align-items: center;
          justify-content: center; cursor: pointer; z-index: 10; font-size: 18px; font-weight: bold; color: #262626; transition: all 150ms ease;
        }
        .ig-carousel-arrow:hover { background: #ffffff; transform: translateY(-50%) scale(1.1); }
        .ig-carousel-arrow.prev { left: 12px; }
        .ig-carousel-arrow.next { right: 12px; }
        .ig-carousel-dots {
          position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; z-index: 10;
          padding: 4px 8px; border-radius: 12px; background: rgba(0, 0, 0, 0.35); backdrop-filter: blur(4px);
        }
        .ig-dot-item { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, 0.5); cursor: pointer; transition: all 150ms ease; }
        .ig-dot-item.active { background: #0095F6; width: 8px; height: 8px; }
        .ig-actions-row { display: flex; align-items: center; gap: 18px; padding: 12px 16px 8px; background: #ffffff; }
        .ig-action-item { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
        .ig-action-icon { color: #262626; transition: transform 120ms ease; }
        .ig-action-icon.liked { color: #ed4956; transform: scale(1.1); }
        .ig-action-icon.reposted { color: #0095F6; }
        .ig-action-icon:hover { transform: scale(1.1); }
        .ig-action-count { font-size: 14px; font-weight: 700; color: #262626; }
        .ig-caption-body { padding: 6px 16px 14px; background: #ffffff; cursor: text; }
        .ig-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px; line-height: 1.55; color: #262626; background: #ffffff; border: 1.5px solid #0095F6; border-radius: 8px;
          padding: 10px 12px; outline: none; resize: vertical; min-height: 100px; box-sizing: border-box; margin-bottom: 6px;
        }
        .ig-caption-text { font-size: 14px; line-height: 1.55; color: #262626; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; white-space: pre-wrap; word-break: break-word; }
        .ig-caption-username { font-weight: 700; color: #262626; margin-right: 6px; }
        .ig-hashtag-text { color: #0095F6 !important; font-weight: 500 !important; background: transparent !important; padding: 0 !important; border-radius: 0 !important; }
        .ig-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .ig-footer-chars { font-size: 11.5px; color: #8e8e8e; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .ig-footer-chars.over { color: var(--color-error); font-weight: 700; }
        .ig-footer-hint { font-size: 11px; color: #8e8e8e; white-space: nowrap; }
        .ig-footer-share { font-size: 12.5px; font-weight: 700; color: #E1306C; text-decoration: none; }
        .ig-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Heart, Repeat, Share2, Bookmark, Sparkles, MoreHorizontal
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#1D9BF0'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="tw-hashtag-text"
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

export function TwitterCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
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
  const [retweeted, setRetweeted] = useState(false)
  const [retweetCount, setRetweetCount] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'
  const handleName = user?.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'yourbrand'

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
    addToast('X (Twitter) post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Twitter')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('X (Twitter) kit downloaded', 'success')
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

  const toggleRetweet = () => {
    setRetweeted(prev => !prev)
    setRetweetCount(prev => (retweeted ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 280
  const charCount = post.content.length
  const isOverLimit = charCount > charLimit

  return (
    <div className="tw-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="tw-control-bar">
        <div className="tw-control-platform">
          <PlatformIcon id="twitter" size={15} color="#1DA1F2" />
          <span className="tw-control-title">X (Twitter)</span>
          <span className="tw-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="tw-control-actions">
          <button className="tw-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#1DA1F2" />
            <span>Refine</span>
          </button>
          <button className={`tw-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy tweet">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="tw-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 X (Twitter) Post Box */}
      <div className={`tw-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Profile Header Row */}
        <div className="tw-profile-header">
          <div className="tw-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="tw-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="tw-user-details">
            <div className="tw-name-line">
              <span className="tw-display-name">{userName}</span>
              <span className="tw-verified-badge" title="Verified">✓</span>
              <span className="tw-handle">@{handleName}</span>
              <span className="tw-dot">·</span>
              <span className="tw-time">Just now</span>
            </div>
          </div>
          <MoreHorizontal size={18} className="tw-more" />
        </div>

        {/* Tweet Body Content */}
        <div className="tw-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="tw-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="tw-text">
              <FormattedContent content={post.content} linkColor="#1D9BF0" />
            </p>
          )}
        </div>

        {/* Media Frame (16:9 Rounded Container) */}
        {imageUrls.length > 0 && (
          <div className="tw-media-frame">
            <div className="tw-single-media">
              <img src={imageUrls[activeImgIdx]} alt={`Media ${activeImgIdx + 1}`} className="tw-media-img" />
              {imageUrls.length > 1 && (
                <>
                  {activeImgIdx > 0 && (
                    <button
                      className="tw-carousel-btn prev"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i - 1); }}
                    >
                      ‹
                    </button>
                  )}
                  {activeImgIdx < imageUrls.length - 1 && (
                    <button
                      className="tw-carousel-btn next"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i + 1); }}
                    >
                      ›
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Row */}
        <div className="tw-actions-row">
          <div className="tw-action-item reply">
            <MessageSquare size={17} />
          </div>
          <div className={`tw-action-item retweet ${retweeted ? 'active' : ''}`} onClick={toggleRetweet}>
            <Repeat size={17} />
            {retweetCount > 0 && <span>{retweetCount}</span>}
          </div>
          <div className={`tw-action-item like ${liked ? 'active' : ''}`} onClick={toggleLike}>
            <Heart size={17} fill={liked ? '#f91880' : 'none'} color={liked ? '#f91880' : 'currentColor'} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </div>
          <div className={`tw-action-item bookmark ${bookmarked ? 'active' : ''}`} onClick={() => setBookmarked(p => !p)}>
            <Bookmark size={17} fill={bookmarked ? '#1d9bf0' : 'none'} color={bookmarked ? '#1d9bf0' : 'currentColor'} />
          </div>
          <div className="tw-action-item share">
            <Share2 size={17} />
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="tw-footer-bar">
        <span className={`tw-footer-chars ${isOverLimit ? 'over' : ''}`}>
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="tw-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="tw-footer-share">
            Share to X →
          </a>
        )}
      </div>

      <style>{`
        .tw-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 470px; margin: 0 auto; gap: 8px;
        }
        .tw-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .tw-control-platform { display: flex; align-items: center; gap: 6px; }
        .tw-control-title { font-size: 12px; font-weight: 800; color: #1DA1F2; text-transform: uppercase; letter-spacing: 0.04em; }
        .tw-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .tw-control-actions { display: flex; align-items: center; gap: 6px; }
        .tw-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .tw-tool-btn:hover { background: #E9ECEF; color: #212529; }
        .tw-post-box {
          background: #ffffff; border: 1px solid #cfd9de; border-radius: 16px; padding: 14px; overflow: hidden; display: flex;
          flex-direction: column; gap: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .tw-post-box.editing { border-color: #1d9bf0; box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.15); }
        .tw-profile-header { display: flex; align-items: center; gap: 10px; }
        .tw-avatar {
          width: 40px; height: 40px; border-radius: 50%; background: #1DA1F2; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .tw-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .tw-user-details { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .tw-name-line { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .tw-display-name { font-weight: 700; font-size: 15px; color: #0f1419; }
        .tw-verified-badge {
          background: #1d9bf0; color: #ffffff; font-size: 9px; font-weight: bold; width: 14px; height: 14px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .tw-handle, .tw-dot, .tw-time { color: #536471; font-size: 14px; font-weight: 400; }
        .tw-more { color: #536471; margin-left: auto; cursor: pointer; }
        .tw-body { cursor: text; }
        .tw-text {
          font-size: 15px; line-height: 1.45; color: #0f1419;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .tw-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 15px; line-height: 1.45; color: #0f1419; background: #ffffff; border: 1.5px solid #1d9bf0; border-radius: 8px;
          padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }
        .tw-media-frame {
          border-radius: 14px; border: 1px solid #cfd9de; overflow: hidden; margin-top: 4px; max-height: 420px; position: relative;
        }
        .tw-single-media { position: relative; width: 100%; height: 100%; max-height: 420px; }
        .tw-media-img { width: 100%; height: auto; max-height: 420px; object-fit: contain; display: block; }
        .tw-carousel-btn {
          position: absolute; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border-radius: 50%;
          background: rgba(255, 255, 255, 0.9); box-shadow: 0 2px 6px rgba(0,0,0,0.2); border: none; display: flex;
          align-items: center; justify-content: center; cursor: pointer; z-index: 10; font-size: 16px; color: #0f1419;
        }
        .tw-carousel-btn.prev { left: 8px; }
        .tw-carousel-btn.next { right: 8px; }
        .tw-actions-row {
          display: flex; align-items: center; justify-content: space-between; padding: 6px 4px 0; color: #536471;
        }
        .tw-action-item {
          display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 120ms ease; user-select: none;
        }
        .tw-action-item.reply:hover { color: #1d9bf0; }
        .tw-action-item.retweet:hover, .tw-action-item.retweet.active { color: #00ba7c; }
        .tw-action-item.like:hover, .tw-action-item.like.active { color: #f91880; }
        .tw-action-item.bookmark:hover, .tw-action-item.bookmark.active { color: #1d9bf0; }
        .tw-action-item.share:hover { color: #1d9bf0; }
        .tw-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .tw-footer-chars { font-size: 11.5px; color: #536471; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .tw-footer-chars.over { color: var(--color-error); font-weight: 700; }
        .tw-footer-hint { font-size: 11px; color: #536471; white-space: nowrap; }
        .tw-footer-share { font-size: 12.5px; font-weight: 700; color: #1DA1F2; text-decoration: none; }
        .tw-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

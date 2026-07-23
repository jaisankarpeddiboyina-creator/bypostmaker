import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, MoreHorizontal, X, Globe,
  ThumbsUp, MessageSquare, Repeat, Send, ChevronLeft, ChevronRight, Maximize2
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0a66c2'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="li-hashtag-text"
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

export function LinkedInCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
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
  const [following, setFollowing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

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
    addToast('LinkedIn post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'LinkedIn')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('LinkedIn kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 3000
  const charCount = post.content.length
  const isOverLimit = charCount > charLimit

  return (
    <div className="li-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="li-control-bar">
        <div className="li-control-platform">
          <PlatformIcon id="linkedin" size={15} color="#0A66C2" />
          <span className="li-control-title">LinkedIn</span>
          <span className="li-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="li-control-actions">
          <button className="li-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#0A66C2" />
            <span>Refine</span>
          </button>
          <button className={`li-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy post">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="li-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 LinkedIn Post Box */}
      <div className={`li-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Activity Top Bar */}
        <div className="li-activity-bar">
          <span className="li-activity-text">From your activity</span>
          <div className="li-activity-actions">
            <MoreHorizontal size={16} className="li-icon-btn" />
            <X size={16} className="li-icon-btn" />
          </div>
        </div>

        {/* Profile Header Row */}
        <div className="li-profile-header">
          <div className="li-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="li-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="li-user-info">
            <div className="li-name-line">
              <span className="li-user-name">{userName}</span>
              <span className="li-badge" title="Verified">✔</span>
            </div>
            <p className="li-headline truncate">Creator & Brand Builder</p>
            <div className="li-time-line">
              <span className="li-time">Just now</span>
              <span className="li-dot">•</span>
              <Globe size={12} className="li-globe" />
            </div>
          </div>
          <button
            className={`li-follow-btn ${following ? 'following' : ''}`}
            type="button"
            onClick={() => setFollowing(p => !p)}
          >
            {following ? 'Following' : '+ Follow'}
          </button>
        </div>

        {/* Post Caption Body */}
        <div className="li-caption-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="li-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="li-caption-text">
              <FormattedContent content={post.content} linkColor="#0a66c2" />
              {post.content.length > 180 && !isExpanded && (
                <span className="li-more-btn" onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}> ...more</span>
              )}
            </div>
          )}
        </div>

        {/* LinkedIn Document / Multi-Image Carousel Frame */}
        {imageUrls.length > 0 && (
          <div className="li-media-frame">
            {imageUrls.length > 1 && (
              <div className="li-doc-tag">
                <span>{platform?.name || 'Document'} · {imageUrls.length} pages</span>
              </div>
            )}

            <div className="li-media-viewport">
              <img src={imageUrls[activeImgIdx]} alt={`Media ${activeImgIdx + 1}`} className="li-media-img" />

              {imageUrls.length > 1 && (
                <>
                  {activeImgIdx > 0 && (
                    <button
                      className="li-arrow-btn prev"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i - 1); }}
                    >
                      <ChevronLeft size={18} color="#ffffff" />
                    </button>
                  )}
                  {activeImgIdx < imageUrls.length - 1 && (
                    <button
                      className="li-arrow-btn next"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i + 1); }}
                    >
                      <ChevronRight size={18} color="#ffffff" />
                    </button>
                  )}
                  <button className="li-fullscreen-btn" type="button" title="Full screen">
                    <Maximize2 size={14} color="#ffffff" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Reaction Counters Row */}
        {(likeCount > 0 || repostCount > 0) && (
          <div className="li-reactions-row">
            <div className="li-reaction-badges">
              <span className="li-reaction-icon like">👍</span>
              <span className="li-reaction-count">{likeCount}</span>
            </div>
            {repostCount > 0 && (
              <div className="li-comments-count">
                <span>{repostCount} repost{repostCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons Bar (Like, Comment, Repost, Send) */}
        <div className="li-action-buttons-bar">
          <button className={`li-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
            <ThumbsUp size={16} fill={liked ? '#0a66c2' : 'none'} color={liked ? '#0a66c2' : '#666666'} />
            <span>Like</span>
          </button>
          <button className="li-action-btn">
            <MessageSquare size={16} color="#666666" />
            <span>Comment</span>
          </button>
          <button className={`li-action-btn ${reposted ? 'reposted' : ''}`} onClick={toggleRepost}>
            <Repeat size={16} color={reposted ? '#0a66c2' : '#666666'} />
            <span>Repost</span>
          </button>
          <button className="li-action-btn">
            <Send size={16} color="#666666" />
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="li-footer-bar">
        <span className={`li-footer-chars ${isOverLimit ? 'over' : ''}`}>
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="li-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="li-footer-share">
            Share to LinkedIn →
          </a>
        )}
      </div>

      <style>{`
        .li-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 540px; margin: 0 auto; gap: 8px;
        }
        .li-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .li-control-platform { display: flex; align-items: center; gap: 6px; }
        .li-control-title { font-size: 12px; font-weight: 800; color: #0A66C2; text-transform: uppercase; letter-spacing: 0.04em; }
        .li-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .li-control-actions { display: flex; align-items: center; gap: 6px; }
        .li-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .li-tool-btn:hover { background: #E9ECEF; color: #212529; }
        .li-post-box {
          background: #ffffff; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; display: flex;
          flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .li-post-box.editing { border-color: #0a66c2; box-shadow: 0 0 0 2px rgba(10, 102, 194, 0.15); }
        
        .li-activity-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 4px;
          border-bottom: 1px solid #f3f3f3; font-size: 12px; color: #666666; font-weight: 500;
        }
        .li-activity-actions { display: flex; gap: 10px; color: #666666; }
        .li-icon-btn { cursor: pointer; transition: color 120ms ease; }
        .li-icon-btn:hover { color: #000000; }

        .li-profile-header { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px 8px; }
        .li-avatar {
          width: 48px; height: 48px; border-radius: 50%; background: #0A66C2; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 18px; flex-shrink: 0; overflow: hidden;
        }
        .li-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .li-user-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .li-name-line { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .li-user-name { font-weight: 700; font-size: 14px; color: rgba(0,0,0,0.9); }
        .li-badge { font-size: 11px; color: #666666; }
        .li-headline { font-size: 12px; color: rgba(0,0,0,0.6); margin-top: 1px; }
        .li-time-line { display: flex; align-items: center; gap: 4px; font-size: 12px; color: rgba(0,0,0,0.6); margin-top: 2px; }
        .li-globe { color: rgba(0,0,0,0.6); }

        .li-follow-btn {
          background: transparent; border: none; color: #0a66c2; font-weight: 700; font-size: 14px;
          padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: background 150ms ease;
        }
        .li-follow-btn:hover { background: rgba(10, 102, 194, 0.08); }
        .li-follow-btn.following { color: #666666; }

        .li-caption-body { padding: 4px 16px 12px; cursor: text; }
        .li-caption-text {
          font-size: 14px; line-height: 1.5; color: rgba(0,0,0,0.9);
          font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .li-more-btn { color: #666666; font-weight: 600; cursor: pointer; }
        .li-more-btn:hover { color: #0a66c2; text-decoration: underline; }
        .li-edit-textarea {
          width: 100%; font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.5; color: rgba(0,0,0,0.9); background: #ffffff; border: 1.5px solid #0a66c2; border-radius: 6px;
          padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .li-media-frame { position: relative; width: 100%; background: #000000; overflow: hidden; }
        .li-doc-tag {
          position: absolute; top: 12px; left: 12px; z-index: 10; padding: 4px 10px; border-radius: 6px;
          background: rgba(0, 0, 0, 0.75); color: #ffffff; font-size: 12px; font-weight: 600; backdrop-filter: blur(4px);
        }
        .li-media-viewport { position: relative; width: 100%; max-height: 480px; display: flex; align-items: center; justify-content: center; }
        .li-media-img { width: 100%; height: auto; max-height: 480px; object-fit: contain; display: block; }
        
        .li-arrow-btn {
          position: absolute; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%;
          background: rgba(0, 0, 0, 0.6); border: none; display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 10; transition: background 150ms ease;
        }
        .li-arrow-btn:hover { background: rgba(0, 0, 0, 0.85); }
        .li-arrow-btn.prev { left: 12px; }
        .li-arrow-btn.next { right: 12px; }
        .li-fullscreen-btn {
          position: absolute; bottom: 12px; right: 12px; width: 32px; height: 32px; border-radius: 50%;
          background: rgba(0, 0, 0, 0.6); border: none; display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 10; transition: background 150ms ease;
        }
        .li-fullscreen-btn:hover { background: rgba(0, 0, 0, 0.85); }

        .li-reactions-row {
          display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 8px;
          font-size: 12px; color: #666666; border-bottom: 1px solid #f3f3f3;
        }
        .li-reaction-badges { display: flex; align-items: center; gap: 2px; }
        .li-reaction-icon { font-size: 12px; margin-right: 2px; }
        .li-reaction-count { font-weight: 500; margin-left: 4px; }
        .li-comments-count { display: flex; align-items: center; gap: 4px; }

        .li-action-buttons-bar {
          display: grid; grid-template-columns: repeat(4, 1fr); padding: 4px 8px; background: #ffffff;
        }
        .li-action-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 0;
          background: transparent; border: none; border-radius: 4px; font-size: 13px; font-weight: 600;
          color: #666666; cursor: pointer; transition: background 120ms ease;
        }
        .li-action-btn:hover { background: #f3f3f3; }
        .li-action-btn.liked { color: #0a66c2; }
        .li-action-btn.reposted { color: #0a66c2; }

        .li-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .li-footer-chars { font-size: 11.5px; color: #666666; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .li-footer-chars.over { color: var(--color-error); font-weight: 700; }
        .li-footer-hint { font-size: 11px; color: #666666; white-space: nowrap; }
        .li-footer-share { font-size: 12.5px; font-weight: 700; color: #0A66C2; text-decoration: none; }
        .li-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

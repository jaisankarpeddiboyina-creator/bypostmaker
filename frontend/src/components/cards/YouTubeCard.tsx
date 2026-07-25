import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, ThumbsUp, ThumbsDown, Share2, MoreVertical
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#3EA6FF'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="yt-hashtag-text"
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

export function YouTubeCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Live Card States (Clean Baseline)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [disliked, setDisliked] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Channel'
  const channelHandle = user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '')}` : '@yourchannel'

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
    addToast('YouTube post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'YouTube')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('YouTube kit downloaded', 'success')
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
    if (disliked) setDisliked(false)
    setLiked(prev => !prev)
    setLikeCount(prev => (liked ? prev - 1 : prev + 1))
  }

  const toggleDislike = () => {
    if (liked) {
      setLiked(false)
      setLikeCount(prev => prev - 1)
    }
    setDisliked(prev => !prev)
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 5000
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="youtube"
      platformName="YouTube"
      brandColor="#FF0000"
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
      {/* Authentic 1:1 YouTube Community Post Card */}
      <div className={`yt-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Creator Header */}
        <div className="yt-profile-header">
          <div className="yt-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="yt-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="yt-user-info">
            <div className="yt-name-line">
              <span className="yt-user-name">{userName}</span>
              <span className="yt-handle">{channelHandle}</span>
            </div>
            <span className="yt-time">Just now</span>
          </div>
          <MoreVertical size={18} className="yt-more" />
        </div>

        {/* Text Content */}
        <div className="yt-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="yt-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="yt-text">
              <FormattedContent content={post.content} linkColor="#065fd4" />
            </p>
          )}
        </div>

        {/* Media Frame Grid */}
        {imageUrls.length > 0 && (
          <div className="yt-media-container">
            <div className={`yt-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
              {imageUrls.slice(0, 4).map((url, idx) => (
                <div key={idx} className="yt-img-wrapper">
                  <img src={url} alt={`Media ${idx + 1}`} className="yt-img" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Engagement Bar (Like, Dislike, Comment, Share) */}
        <div className="yt-actions-bar">
          <div className="yt-vote-pill">
            <button className={`yt-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike} title="Like">
              <ThumbsUp size={16} fill={liked ? '#0f0f0f' : 'none'} color={liked ? '#0f0f0f' : '#606060'} />
              {likeCount > 0 && <span className="yt-count">{likeCount}</span>}
            </button>
            <div className="yt-divider" />
            <button className={`yt-action-btn ${disliked ? 'disliked' : ''}`} onClick={toggleDislike} title="Dislike">
              <ThumbsDown size={16} fill={disliked ? '#0f0f0f' : 'none'} color={disliked ? '#0f0f0f' : '#606060'} />
            </button>
          </div>

          <button className="yt-action-btn">
            <MessageSquare size={16} color="#606060" />
            <span className="yt-action-text">Comment</span>
          </button>

          <button className="yt-action-btn">
            <Share2 size={16} color="#606060" />
            <span className="yt-action-text">Share</span>
          </button>
        </div>
      </div>

      <style>{`
        .yt-post-box {
          background: #ffffff; display: flex; flex-direction: column; transition: background 150ms ease;
        }
        .yt-post-box.editing { background: #F8FAFC; }
        
        .yt-profile-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px 8px; }
        .yt-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #FF0000; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .yt-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .yt-user-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .yt-name-line { display: flex; align-items: center; gap: 6px; }
        .yt-user-name { font-weight: 600; font-size: 13.5px; color: #0f0f0f; }
        .yt-handle { font-size: 12px; color: #606060; }
        .yt-time { font-size: 12px; color: #606060; margin-top: 1px; }
        .yt-more { color: #606060; cursor: pointer; }

        .yt-body { padding: 4px 16px 12px; cursor: text; }
        .yt-text {
          font-size: 14px; line-height: 1.5; color: #0f0f0f;
          font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .yt-edit-textarea {
          width: 100%; font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px; line-height: 1.5; color: #0f0f0f; background: #ffffff; border: 1.5px solid #FF0000; border-radius: 6px;
          padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .yt-media-container { width: 100%; overflow: hidden; background: #f9f9f9; border-top: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0; }
        .yt-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
        .yt-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .yt-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .yt-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .yt-image-grid.grid-3 .yt-img-wrapper:nth-child(1) { grid-row: span 2; }
        .yt-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .yt-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .yt-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .yt-actions-bar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; }
        .yt-vote-pill {
          display: flex; align-items: center; background: #f2f2f2; border-radius: 18px; padding: 2px 6px;
        }
        .yt-divider { width: 1px; height: 16px; background: #d9d9d9; margin: 0 4px; }
        .yt-action-btn {
          display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: transparent;
          border: none; border-radius: 18px; font-size: 13px; font-weight: 500; color: #0f0f0f; cursor: pointer; transition: background 120ms ease;
        }
        .yt-action-btn:hover { background: #e5e5e5; }
        .yt-count { font-weight: 600; font-size: 12px; color: #0f0f0f; }
        .yt-action-text { font-size: 13px; font-weight: 500; color: #0f0f0f; }
      `}</style>
    </UnifiedCardShell>
  )
}

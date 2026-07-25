import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, Repeat, Heart, MoreHorizontal
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0085FF'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="bsky-hashtag-text"
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

export function BlueskyCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
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
  const [reposted, setReposted] = useState(false)
  const [repostCount, setRepostCount] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'
  const handleName = user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '')}.bsky.social` : '@yourbrand.bsky.social'

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
    addToast('Bluesky post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Bluesky')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Bluesky kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 300
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="bluesky"
      platformName="Bluesky"
      brandColor="#0085FF"
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
      {/* Authentic 1:1 Bluesky Post Card */}
      <div className={`bsky-post-box ${isEditing ? 'editing' : ''}`}>
        <div className="bsky-layout-row">
          {/* Avatar Column */}
          <div className="bsky-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="bsky-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>

          {/* Content Column */}
          <div className="bsky-main-col">
            {/* Header Line */}
            <div className="bsky-header-line">
              <div className="bsky-author-info">
                <span className="bsky-user-name">{userName}</span>
                <span className="bsky-handle">{handleName}</span>
                <span className="bsky-dot">•</span>
                <span className="bsky-time">Just now</span>
              </div>
              <MoreHorizontal size={16} className="bsky-more" />
            </div>

            {/* Post Text Body */}
            <div className="bsky-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="bsky-edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  spellCheck
                />
              ) : (
                <p className="bsky-text">
                  <FormattedContent content={post.content} linkColor="#0085FF" />
                </p>
              )}
            </div>

            {/* Media Grid */}
            {imageUrls.length > 0 && (
              <div className="bsky-media-container">
                <div className={`bsky-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
                  {imageUrls.slice(0, 4).map((url, idx) => (
                    <div key={idx} className="bsky-img-wrapper">
                      <img src={url} alt={`Media ${idx + 1}`} className="bsky-img" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bluesky Action Icons Bar (Reply, Repost, Heart, More) */}
            <div className="bsky-actions-bar">
              <button className="bsky-action-btn">
                <MessageSquare size={16} color="#667b99" />
              </button>
              <button className={`bsky-action-btn ${reposted ? 'reposted' : ''}`} onClick={toggleRepost}>
                <Repeat size={16} color={reposted ? '#10b981' : '#667b99'} />
                {repostCount > 0 && <span className="bsky-count green">{repostCount}</span>}
              </button>
              <button className={`bsky-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
                <Heart size={16} fill={liked ? '#ec4899' : 'none'} color={liked ? '#ec4899' : '#667b99'} />
                {likeCount > 0 && <span className="bsky-count pink">{likeCount}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bsky-post-box {
          background: #ffffff; padding: 14px; display: flex; flex-direction: column; transition: background 150ms ease;
        }
        .bsky-post-box.editing { background: #F8FAFC; }

        .bsky-layout-row { display: flex; gap: 12px; }
        .bsky-avatar {
          width: 42px; height: 42px; border-radius: 50%; background: #0085FF; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden;
        }
        .bsky-avatar-img { width: 100%; height: 100%; object-fit: cover; }

        .bsky-main-col { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .bsky-header-line { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .bsky-author-info { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .bsky-user-name { font-weight: 700; font-size: 14.5px; color: #0f172a; }
        .bsky-handle { font-size: 13px; color: #64748b; }
        .bsky-dot { color: #94a3b8; font-size: 10px; }
        .bsky-time { font-size: 13px; color: #64748b; }
        .bsky-more { color: #64748b; cursor: pointer; }

        .bsky-body { cursor: text; margin-bottom: 10px; }
        .bsky-text {
          font-size: 14.5px; line-height: 1.45; color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .bsky-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14.5px; line-height: 1.45; color: #0f172a; background: #ffffff; border: 1.5px solid #0085FF;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .bsky-media-container { width: 100%; border-radius: 10px; overflow: hidden; margin-bottom: 10px; border: 1px solid #e2e8f0; }
        .bsky-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
        .bsky-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .bsky-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .bsky-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .bsky-image-grid.grid-3 .bsky-img-wrapper:nth-child(1) { grid-row: span 2; }
        .bsky-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .bsky-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .bsky-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .bsky-actions-bar { display: flex; align-items: center; justify-content: space-between; max-width: 320px; }
        .bsky-action-btn {
          display: flex; align-items: center; gap: 5px; background: transparent; border: none; cursor: pointer; padding: 4px;
        }
        .bsky-count { font-size: 12px; font-weight: 600; }
        .bsky-count.green { color: #10b981; }
        .bsky-count.pink { color: #ec4899; }
      `}</style>
    </UnifiedCardShell>
  )
}

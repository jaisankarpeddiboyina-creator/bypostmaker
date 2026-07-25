import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, Heart, Repeat, Send, MoreHorizontal
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0095F6'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="th-hashtag-text"
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

export function ThreadsCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
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

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleName = user?.name ? user.name.toLowerCase().replace(/\s+/g, '.') : 'your.brand'

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
    addToast('Threads post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Threads')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Threads kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 500
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="threads"
      platformName="Threads"
      brandColor="#000000"
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
      {/* Authentic 1:1 Threads Post Container */}
      <div className={`th-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Profile Header Row */}
        <div className="th-profile-header">
          <div className="th-avatar-wrapper">
            <div className="th-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="th-avatar-img" />
              ) : (
                handleName[0].toUpperCase()
              )}
            </div>
            <button
              className={`th-plus-badge ${following ? 'following' : ''}`}
              type="button"
              onClick={() => setFollowing(p => !p)}
              title="Follow"
            >
              {following ? '✓' : '+'}
            </button>
          </div>

          <div className="th-header-info">
            <span className="th-username">{handleName}</span>
            <span className="th-chevron">&gt;</span>
            <span className="th-topic-tag">🌀 AI Threads</span>
            <span className="th-time">Just now</span>
          </div>
          
          <MoreHorizontal size={18} className="th-more" />
        </div>

        {/* Threads Caption Body */}
        <div className="th-caption-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="th-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="th-caption-text">
              <FormattedContent content={post.content} linkColor="#0095F6" />
              {imageUrls.length > 1 && <span className="th-count-pill"> 1/{imageUrls.length}</span>}
            </div>
          )}
        </div>

        {/* Threads Media Swipe Horizontal Carousel (Peeking Cards) */}
        {imageUrls.length > 0 && (
          <div className="th-media-section">
            {imageUrls.length === 1 ? (
              <div className="th-single-media-frame">
                <img src={imageUrls[0]} alt="Media" className="th-media-img" />
              </div>
            ) : (
              <div className="th-carousel-scroll-frame">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="th-carousel-item">
                    <img src={url} alt={`Media ${idx + 1}`} className="th-media-img" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Threads Action Icons Row */}
        <div className="th-actions-row">
          <div className="th-action-item" onClick={toggleLike}>
            <Heart size={20} className={`th-action-icon ${liked ? 'liked' : ''}`} fill={liked ? '#ed4956' : 'none'} color={liked ? '#ed4956' : '#262626'} />
            {likeCount > 0 && <span className="th-action-count">{likeCount}</span>}
          </div>
          <div className="th-action-item">
            <MessageSquare size={20} className="th-action-icon" />
          </div>
          <div className={`th-action-item ${reposted ? 'active' : ''}`} onClick={toggleRepost}>
            <Repeat size={20} className="th-action-icon" />
            {repostCount > 0 && <span className="th-action-count">{repostCount}</span>}
          </div>
          <div className="th-action-item">
            <Send size={20} className="th-action-icon" />
          </div>
        </div>
      </div>

      <style>{`
        .th-post-box {
          background: #ffffff; padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: background 150ms ease;
        }
        .th-post-box.editing { background: #F8FAFC; }
        
        .th-profile-header { display: flex; align-items: center; gap: 10px; }
        .th-avatar-wrapper { position: relative; width: 36px; height: 36px; }
        .th-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #000000; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 14px; overflow: hidden;
        }
        .th-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .th-plus-badge {
          position: absolute; bottom: -2px; right: -2px; width: 15px; height: 15px; border-radius: 50%;
          background: #000000; color: #ffffff; border: 2px solid #ffffff; font-size: 10px; font-weight: bold;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .th-header-info { display: flex; align-items: center; gap: 5px; flex: 1; min-width: 0; font-size: 14px; }
        .th-username { font-weight: 700; color: #262626; }
        .th-chevron { color: #8e8e8e; font-size: 12px; }
        .th-topic-tag { color: #0095F6; font-weight: 600; }
        .th-time { color: #8e8e8e; font-size: 13px; font-weight: 400; margin-left: 2px; }
        .th-more { color: #262626; margin-left: auto; cursor: pointer; }

        .th-caption-body { cursor: text; }
        .th-caption-text {
          font-size: 14px; line-height: 1.55; color: #262626;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .th-count-pill { font-size: 12px; color: #8e8e8e; background: #efefef; padding: 1px 6px; border-radius: 99px; }
        .th-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px; line-height: 1.55; color: #262626; background: #ffffff; border: 1.5px solid #000000; border-radius: 8px;
          padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .th-media-section { width: 100%; overflow: hidden; margin-top: 2px; }
        .th-single-media-frame {
          width: 100%; border-radius: 12px; overflow: hidden; max-height: 440px; background: #fafafa;
        }
        .th-carousel-scroll-frame {
          display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .th-carousel-scroll-frame::-webkit-scrollbar { height: 4px; }
        .th-carousel-scroll-frame::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.15); border-radius: 4px; }
        .th-carousel-item {
          flex: 0 0 78%; scroll-snap-align: start; border-radius: 12px; overflow: hidden; max-height: 420px; background: #fafafa;
        }
        .th-media-img { width: 100%; height: 100%; max-height: 440px; object-fit: cover; display: block; }

        .th-actions-row { display: flex; align-items: center; gap: 20px; padding-top: 4px; color: #262626; }
        .th-action-item { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
        .th-action-icon { color: #262626; transition: transform 120ms ease; }
        .th-action-icon.liked { color: #ed4956; transform: scale(1.1); }
        .th-action-icon:hover { transform: scale(1.1); }
        .th-action-count { font-size: 13px; font-weight: 600; color: #262626; }
      `}</style>
    </UnifiedCardShell>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, Heart, Bookmark
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#2962FF'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="hn-tag-text"
            style={{ color, background: '#e8f0fe', padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}
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

export function HashnodeCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
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

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Developer Blog'
  const handleName = user?.name ? `${user.name.toLowerCase().replace(/\s+/g, '')}.hashnode.dev` : 'blog.hashnode.dev'

  // Extract Article Title & Subtitle
  const lines = post.content.split('\n').filter(Boolean)
  const articleTitle = lines[0] || 'Building a High Performance SDK Architecture'
  const bodyText = lines.slice(1).join('\n\n').trim()

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
    addToast('Hashnode article copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Hashnode')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Hashnode kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 100000
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="hashnode"
      platformName="Hashnode"
      brandColor="#2962FF"
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
      {/* Authentic 1:1 Hashnode Article Post Container */}
      <div className={`hn-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Author Domain Header */}
        <div className="hn-author-header">
          <div className="hn-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="hn-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="hn-author-info">
            <span className="hn-user-name">{userName}</span>
            <span className="hn-handle">{handleName} · 3 min read</span>
          </div>
        </div>

        {/* Cover Image Frame */}
        {imageUrls.length > 0 && (
          <div className="hn-cover-frame">
            <img src={imageUrls[0]} alt="Cover" className="hn-cover-img" />
          </div>
        )}

        {/* Article Body */}
        <div className="hn-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="hn-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="hn-article-layout">
              <h1 className="hn-title">{articleTitle}</h1>
              {bodyText && (
                <p className="hn-text">
                  <FormattedContent content={bodyText} linkColor="#2962FF" />
                </p>
              )}
            </div>
          )}
        </div>

        {/* Hashnode Reactions Footer */}
        <div className="hn-actions-bar">
          <div className="hn-left-actions">
            <button className={`hn-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
              <Heart size={16} fill={liked ? '#2962FF' : 'none'} color={liked ? '#2962FF' : '#5c6c75'} />
              {likeCount > 0 && <span className="hn-count">{likeCount}</span>}
            </button>
            <button className="hn-action-btn">
              <MessageSquare size={16} color="#5c6c75" />
            </button>
          </div>

          <button className="hn-action-btn">
            <Bookmark size={16} color="#5c6c75" />
          </button>
        </div>
      </div>

      <style>{`
        .hn-post-box {
          background: #ffffff; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: background 150ms ease;
        }
        .hn-post-box.editing { background: #F8FAFC; }

        .hn-author-header { display: flex; align-items: center; gap: 10px; }
        .hn-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #2962FF; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .hn-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .hn-author-info { display: flex; flex-direction: column; }
        .hn-user-name { font-weight: 700; font-size: 14px; color: #0f172a; }
        .hn-handle { font-size: 11.5px; color: #64748b; }

        .hn-cover-frame { width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #f8fafc; }
        .hn-cover-img { width: 100%; height: 100%; object-fit: cover; }

        .hn-body { cursor: text; }
        .hn-article-layout { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .hn-title { font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1.35; margin: 0 0 6px; }
        .hn-text { font-size: 14px; line-height: 1.5; color: #334155; white-space: pre-wrap; word-break: break-word; }
        .hn-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.5; color: #0f172a; background: #ffffff; border: 1.5px solid #2962FF;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .hn-actions-bar { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #f1f5f9; }
        .hn-left-actions { display: flex; align-items: center; gap: 12px; }
        .hn-action-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; padding: 4px; }
        .hn-count { font-size: 12px; font-weight: 600; color: #2962FF; }
      `}</style>
    </UnifiedCardShell>
  )
}

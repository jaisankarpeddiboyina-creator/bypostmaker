import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Heart, Bookmark, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#3B82F6'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="dev-hashtag-text"
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

export function DevToCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Reaction States
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [unicorn, setUnicorn] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'

  // Extract title, tags, and body
  const lines = post.content.split('\n').filter(Boolean)
  const titleText = lines[0] || 'How we built a high performance app'
  const bodyText = lines.slice(1).join('\n\n').trim()

  // Calculate reading time
  const wordCount = post.content.split(/\s+/).length
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 220))

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
    addToast('dev.to post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'DevTo')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('dev.to kit downloaded', 'success')
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
    <div className="dev-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="dev-control-bar">
        <div className="dev-control-platform">
          <PlatformIcon id="devto" size={15} color="#0A0A0A" />
          <span className="dev-control-title">dev.to</span>
          <span className="dev-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="dev-control-actions">
          <button className="dev-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#0A0A0A" />
            <span>Refine</span>
          </button>
          <button className={`dev-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy article">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="dev-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 dev.to Article Card Box */}
      <div className={`dev-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Cover Image Frame */}
        {imageUrls.length > 0 && (
          <div className="dev-cover-frame">
            <img src={imageUrls[0]} alt="Cover" className="dev-cover-img" />
          </div>
        )}

        <div className="dev-inner-padding">
          {/* Author Header */}
          <div className="dev-author-header">
            <div className="dev-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="dev-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <div className="dev-author-info">
              <span className="dev-user-name">{userName}</span>
              <span className="dev-time">Posted on Just now</span>
            </div>
          </div>

          {/* Article Title & Body */}
          <div className="dev-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="dev-edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                autoFocus
                spellCheck
              />
            ) : (
              <>
                <h2 className="dev-title">{titleText}</h2>
                <div className="dev-tags-row">
                  <span className="dev-tag">#webdev</span>
                  <span className="dev-tag">#javascript</span>
                  <span className="dev-tag">#ai</span>
                  <span className="dev-tag">#showdev</span>
                </div>
                {bodyText && (
                  <p className="dev-text">
                    <FormattedContent content={bodyText} linkColor="#3B82F6" />
                  </p>
                )}
              </>
            )}
          </div>

          {/* dev.to Reaction Bar (Heart, Unicorn, Comment, Bookmark, Read time) */}
          <div className="dev-footer-actions">
            <div className="dev-left-reactions">
              <button className={`dev-reaction-pill ${liked ? 'active' : ''}`} onClick={toggleLike}>
                <Heart size={16} fill={liked ? '#EF4444' : 'none'} color={liked ? '#EF4444' : '#3d3d3d'} />
                {likeCount > 0 && <span className="dev-count">{likeCount}</span>}
              </button>

              <button className={`dev-reaction-pill ${unicorn ? 'active' : ''}`} onClick={() => setUnicorn(p => !p)}>
                <span className="dev-unicorn-emoji">🦄</span>
              </button>

              <button className="dev-reaction-pill">
                <MessageSquare size={16} color="#3d3d3d" />
                <span className="dev-count">Add comment</span>
              </button>
            </div>

            <div className="dev-right-reactions">
              <span className="dev-read-time">{readTimeMin} min read</span>
              <button className={`dev-bookmark-btn ${bookmarked ? 'active' : ''}`} onClick={() => setBookmarked(p => !p)}>
                <Bookmark size={16} fill={bookmarked ? '#3B82F6' : 'none'} color={bookmarked ? '#3B82F6' : '#3d3d3d'} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="dev-footer-bar">
        <span className="dev-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="dev-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="dev-footer-share">
            Publish on dev.to →
          </a>
        )}
      </div>

      <style>{`
        .dev-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 540px; margin: 0 auto; gap: 8px;
        }
        .dev-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .dev-control-platform { display: flex; align-items: center; gap: 6px; }
        .dev-control-title { font-size: 12px; font-weight: 800; color: #0A0A0A; text-transform: uppercase; letter-spacing: 0.04em; }
        .dev-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .dev-control-actions { display: flex; align-items: center; gap: 6px; }
        .dev-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .dev-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .dev-post-box {
          background: #ffffff; border: 1px solid #d6d6d7; border-radius: 12px; overflow: hidden;
          display: flex; flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .dev-post-box.editing { border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }

        .dev-cover-frame { width: 100%; aspect-ratio: 100 / 42; max-height: 220px; overflow: hidden; background: #f5f5f5; }
        .dev-cover-img { width: 100%; height: 100%; object-fit: cover; }

        .dev-inner-padding { padding: 18px; display: flex; flex-direction: column; gap: 14px; }

        .dev-author-header { display: flex; align-items: center; gap: 10px; }
        .dev-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #0A0A0A; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 14px; flex-shrink: 0; overflow: hidden;
        }
        .dev-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .dev-author-info { display: flex; flex-direction: column; }
        .dev-user-name { font-weight: 600; font-size: 13.5px; color: #0d0d0d; }
        .dev-time { font-size: 12px; color: #717171; }

        .dev-body { cursor: text; }
        .dev-title {
          font-size: 20px; font-weight: 800; color: #0d0d0d; line-height: 1.3; margin: 0 0 6px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .dev-tags-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .dev-tag { font-size: 12px; color: #525252; background: #f5f5f5; padding: 2px 8px; border-radius: 6px; font-family: monospace; }
        .dev-text {
          font-size: 14px; line-height: 1.5; color: #171717; white-space: pre-wrap; word-break: break-word;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .dev-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.5; color: #0d0d0d; background: #ffffff; border: 1.5px solid #3B82F6;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 100px; box-sizing: border-box;
        }

        .dev-footer-actions { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; }
        .dev-left-reactions { display: flex; align-items: center; gap: 8px; }
        .dev-reaction-pill {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px;
          background: transparent; border: none; font-size: 13px; color: #3d3d3d; cursor: pointer; transition: background 120ms ease;
        }
        .dev-reaction-pill:hover { background: #f5f5f5; }
        .dev-unicorn-emoji { font-size: 14px; }
        .dev-count { font-size: 12.5px; font-weight: 500; }

        .dev-right-reactions { display: flex; align-items: center; gap: 10px; }
        .dev-read-time { font-size: 12px; color: #717171; }
        .dev-bookmark-btn { background: transparent; border: none; cursor: pointer; padding: 4px; border-radius: 4px; }
        .dev-bookmark-btn:hover { background: #f5f5f5; }

        .dev-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .dev-footer-chars { font-size: 11.5px; color: #717171; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .dev-footer-hint { font-size: 11px; color: #717171; white-space: nowrap; }
        .dev-footer-share { font-size: 12.5px; font-weight: 700; color: #0A0A0A; text-decoration: none; }
        .dev-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

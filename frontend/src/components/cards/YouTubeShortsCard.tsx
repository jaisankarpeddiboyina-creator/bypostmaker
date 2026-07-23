import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, ThumbsUp, ThumbsDown, MessageSquare, Share2, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FF0000'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="yts-hashtag-text"
            style={{ color, fontWeight: 700, cursor: 'pointer' }}
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

export function YouTubeShortsCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Like Counter
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(1)
  const [subscribed, setSubscribed] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Channel'

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
    addToast('YouTube Shorts description copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'YouTubeShorts')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('YouTube Shorts kit downloaded', 'success')
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
    <div className="yts-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="yts-control-bar">
        <div className="yts-control-platform">
          <PlatformIcon id="youtubeshorts" size={15} color="#FF0000" />
          <span className="yts-control-title">YouTube Shorts</span>
          <span className="yts-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="yts-control-actions">
          <button className="yts-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#FF0000" />
            <span>Refine</span>
          </button>
          <button className={`yts-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy description">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="yts-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 YouTube Shorts Vertical 9:16 Frame */}
      <div className={`yts-post-box ${isEditing ? 'editing' : ''}`}>
        <div className="yts-phone-screen">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Short preview" className="yts-short-media" />
          ) : (
            <div className="yts-placeholder-bg">
              <PlatformIcon id="youtubeshorts" size={48} color="#FF0000" />
              <span>Upload 9:16 Short Video</span>
            </div>
          )}

          {/* Right Action Rail Overlay */}
          <div className="yts-action-rail">
            <button className={`yts-rail-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
              <ThumbsUp size={22} fill={liked ? '#ffffff' : 'none'} color="#ffffff" />
              <span className="yts-rail-count">{likeCount}</span>
            </button>

            <button className="yts-rail-btn">
              <ThumbsDown size={22} color="#ffffff" />
              <span className="yts-rail-count">Dislike</span>
            </button>

            <button className="yts-rail-btn">
              <MessageSquare size={22} color="#ffffff" />
              <span className="yts-rail-count">0</span>
            </button>

            <button className="yts-rail-btn">
              <Share2 size={22} color="#ffffff" />
              <span className="yts-rail-count">Share</span>
            </button>
          </div>

          {/* Bottom Channel & Description Overlay */}
          <div className="yts-bottom-overlay">
            <div className="yts-channel-row">
              <div className="yts-avatar">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="yts-avatar-img" />
                ) : (
                  userName[0].toUpperCase()
                )}
              </div>
              <span className="yts-user-name">@{userName.toLowerCase().replace(/\s+/g, '')}</span>
              <button
                className={`yts-sub-btn ${subscribed ? 'subscribed' : ''}`}
                onClick={() => setSubscribed(p => !p)}
              >
                {subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </div>

            <div className="yts-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="yts-edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  spellCheck
                />
              ) : (
                <p className="yts-text">
                  <FormattedContent content={post.content} linkColor="#ffffff" />
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="yts-footer-bar">
        <span className="yts-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="yts-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="yts-footer-share">
            Upload Short →
          </a>
        )}
      </div>

      <style>{`
        .yts-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 360px; margin: 0 auto; gap: 8px;
        }
        .yts-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .yts-control-platform { display: flex; align-items: center; gap: 6px; }
        .yts-control-title { font-size: 12px; font-weight: 800; color: #FF0000; text-transform: uppercase; letter-spacing: 0.04em; }
        .yts-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .yts-control-actions { display: flex; align-items: center; gap: 6px; }
        .yts-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .yts-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .yts-post-box {
          background: #000000; border: 1px solid #222222; border-radius: 20px; padding: 6px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: border-color 150ms ease;
        }
        .yts-post-box.editing { border-color: #FF0000; box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.3); }

        .yts-phone-screen {
          position: relative; width: 100%; aspect-ratio: 9 / 16; border-radius: 16px; overflow: hidden; background: #111111;
        }
        .yts-short-media { width: 100%; height: 100%; object-fit: cover; display: block; }
        .yts-placeholder-bg {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #888888; font-size: 12px; font-weight: 600; background: linear-gradient(180deg, #1f1f1f 0%, #0d0d0d 100%);
        }

        .yts-action-rail {
          position: absolute; right: 10px; bottom: 80px; display: flex; flex-direction: column; gap: 16px; align-items: center; z-index: 10;
        }
        .yts-rail-btn { background: transparent; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .yts-rail-count { font-size: 11px; font-weight: 700; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

        .yts-bottom-overlay {
          position: absolute; left: 0; right: 60px; bottom: 12px; padding: 0 12px; display: flex; flex-direction: column; gap: 8px; z-index: 10;
          background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
        }
        .yts-channel-row { display: flex; align-items: center; gap: 8px; }
        .yts-avatar {
          width: 32px; height: 32px; border-radius: 50%; background: #FF0000; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 13px; flex-shrink: 0; overflow: hidden;
        }
        .yts-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .yts-user-name { font-weight: 700; font-size: 13px; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
        .yts-sub-btn {
          background: #CC0000; color: #ffffff; border: none; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 99px; cursor: pointer;
        }
        .yts-sub-btn.subscribed { background: rgba(255,255,255,0.2); }

        .yts-body { cursor: text; }
        .yts-text {
          font-size: 13px; line-height: 1.4; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .yts-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px; line-height: 1.4; color: #ffffff; background: rgba(0,0,0,0.7); border: 1.5px solid #FF0000;
          border-radius: 6px; padding: 6px; outline: none; resize: vertical; min-height: 70px; box-sizing: border-box;
        }

        .yts-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .yts-footer-chars { font-size: 11.5px; color: #777777; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .yts-footer-hint { font-size: 11px; color: #777777; white-space: nowrap; }
        .yts-footer-share { font-size: 12.5px; font-weight: 700; color: #FF0000; text-decoration: none; }
        .yts-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

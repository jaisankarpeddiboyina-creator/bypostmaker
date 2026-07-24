import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Heart, Share2, Bookmark, Sparkles, Disc
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#25F4EE'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="tt-hashtag-text"
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
            style={{ color, textDecoration: 'none', fontWeight: 700 }}
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

export function TikTokCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
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
  const [bookmarked, setBookmarked] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'
  const handleName = user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '')}` : '@yourbrand'

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
    addToast('TikTok caption copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'TikTok')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('TikTok kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 2200
  const charCount = post.content.length

  return (
    <div className="tt-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="tt-control-bar">
        <div className="tt-control-platform">
          <PlatformIcon id="tiktok" size={15} color="#000000" />
          <span className="tt-control-title">TikTok</span>
          <span className="tt-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="tt-control-actions">
          <button className="tt-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#FE2C55" />
            <span>Refine</span>
          </button>
          <button className={`tt-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy caption">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="tt-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 TikTok 9:16 Mobile View Box */}
      <div className={`tt-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Background Media Container */}
        <div className="tt-media-viewport">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Media" className="tt-media-img" />
          ) : (
            <div className="tt-media-placeholder">
              <PlatformIcon id="tiktok" size={48} color="rgba(255,255,255,0.3)" />
            </div>
          )}
          <div className="tt-dark-overlay" />
        </div>

        {/* Right Floating Action Sidebar */}
        <div className="tt-sidebar">
          {/* Avatar with Plus Badge */}
          <div className="tt-avatar-box">
            <div className="tt-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="tt-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <span className="tt-plus-badge">+</span>
          </div>

          {/* Like Heart */}
          <div className="tt-sidebar-action" onClick={toggleLike}>
            <div className={`tt-icon-circle ${liked ? 'liked' : ''}`}>
              <Heart size={24} fill={liked ? '#FE2C55' : 'rgba(255,255,255,0.9)'} color={liked ? '#FE2C55' : '#ffffff'} />
            </div>
            <span className="tt-action-label">{likeCount > 0 ? likeCount : 'Like'}</span>
          </div>

          {/* Comment Bubble */}
          <div className="tt-sidebar-action">
            <div className="tt-icon-circle">
              <MessageSquare size={24} fill="#ffffff" color="#ffffff" />
            </div>
            <span className="tt-action-label">Reply</span>
          </div>

          {/* Bookmark */}
          <div className="tt-sidebar-action" onClick={() => setBookmarked(p => !p)}>
            <div className="tt-icon-circle">
              <Bookmark size={24} fill={bookmarked ? '#FACC15' : 'rgba(255,255,255,0.9)'} color={bookmarked ? '#FACC15' : '#ffffff'} />
            </div>
            <span className="tt-action-label">Save</span>
          </div>

          {/* Share */}
          <div className="tt-sidebar-action">
            <div className="tt-icon-circle">
              <Share2 size={24} fill="#ffffff" color="#ffffff" />
            </div>
            <span className="tt-action-label">Share</span>
          </div>

          {/* Spinning Disc Audio */}
          <div className="tt-disc-box">
            <Disc size={26} className="spin" color="#ffffff" />
          </div>
        </div>

        {/* Bottom Overlay Info & Caption Body */}
        <div className="tt-bottom-info" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          <p className="tt-username">{handleName}</p>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="tt-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="tt-caption">
              <FormattedContent content={post.content} linkColor="#25F4EE" />
            </p>
          )}
          <div className="tt-audio-line">
            <span>🎵 Original Sound - {userName}</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="tt-footer-bar">
        <span className="tt-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="tt-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="tt-footer-share">
            Share to TikTok →
          </a>
        )}
      </div>

      <style>{`
        .tt-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 380px; margin: 0 auto; gap: 8px;
        }
        .tt-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .tt-control-platform { display: flex; align-items: center; gap: 6px; }
        .tt-control-title { font-size: 12px; font-weight: 800; color: #FE2C55; text-transform: uppercase; letter-spacing: 0.04em; }
        .tt-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .tt-control-actions { display: flex; align-items: center; gap: 6px; }
        .tt-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .tt-tool-btn:hover { background: #E9ECEF; color: #212529; }
        
        .tt-post-box {
          position: relative; width: 100%; aspect-ratio: 9 / 14; background: #000000; border-radius: 20px;
          overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;
          box-shadow: 0 8px 32px rgba(0,0,0,0.25); border: 1px solid #222222; transition: border-color 150ms ease;
        }
        .tt-post-box.editing { border-color: #FE2C55; box-shadow: 0 0 0 2px rgba(254, 44, 85, 0.3); }

        .tt-media-viewport { position: absolute; inset: 0; z-index: 1; }
        .tt-media-img { width: 100%; height: 100%; object-fit: cover; }
        .tt-media-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #121212; }
        .tt-dark-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.4) 100%); }

        .tt-sidebar {
          position: absolute; right: 12px; bottom: 64px; z-index: 10; display: flex; flex-direction: column;
          align-items: center; gap: 16px; color: #ffffff;
        }
        .tt-avatar-box { position: relative; margin-bottom: 4px; }
        .tt-avatar {
          width: 44px; height: 44px; border-radius: 50%; border: 2px solid #ffffff; background: #FE2C55;
          display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; overflow: hidden;
        }
        .tt-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .tt-plus-badge {
          position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); width: 18px; height: 18px;
          border-radius: 50%; background: #FE2C55; color: #ffffff; font-size: 12px; font-weight: bold;
          display: flex; align-items: center; justify-content: center; border: 1.5px solid #ffffff;
        }
        .tt-sidebar-action { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; user-select: none; }
        .tt-icon-circle { display: flex; align-items: center; justify-content: center; transition: transform 120ms ease; }
        .tt-icon-circle:hover { transform: scale(1.15); }
        .tt-action-label { font-size: 11px; font-weight: 600; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

        .tt-disc-box { margin-top: 6px; }

        .tt-bottom-info {
          position: relative; z-index: 10; padding: 16px; margin-right: 64px; color: #ffffff; cursor: text;
        }
        .tt-username { font-weight: 700; font-size: 15px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); margin-bottom: 4px; }
        .tt-caption {
          font-size: 13.5px; line-height: 1.45; color: #ffffff; text-shadow: 0 1px 4px rgba(0,0,0,0.8);
          white-space: pre-wrap; word-break: break-word; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .tt-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13.5px; line-height: 1.45; color: #ffffff; background: rgba(0,0,0,0.7); border: 1.5px solid #FE2C55;
          border-radius: 8px; padding: 8px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }
        .tt-audio-line { font-size: 12px; font-weight: 500; color: #ffffff; opacity: 0.9; margin-top: 8px; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

        .tt-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .tt-footer-chars { font-size: 11.5px; color: #666666; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .tt-footer-hint { font-size: 11px; color: #666666; white-space: nowrap; }
        .tt-footer-share { font-size: 12.5px; font-weight: 700; color: #FE2C55; text-decoration: none; }
        .tt-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

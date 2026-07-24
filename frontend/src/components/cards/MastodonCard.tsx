import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Repeat, Star, Bookmark, Share2, Sparkles, Globe
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#6364FF'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="mas-hashtag-text"
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

export function MastodonCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Live Toot States
  const [boosted, setBoosted] = useState(false)
  const [boostCount, setBoostCount] = useState(0)
  const [favourited, setFavourited] = useState(false)
  const [favCount, setFavCount] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'
  const federatedHandle = user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '')}@mastodon.social` : '@yourbrand@mastodon.social'

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
    addToast('Mastodon toot copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Mastodon')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Mastodon kit downloaded', 'success')
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

  const toggleBoost = () => {
    setBoosted(prev => !prev)
    setBoostCount(prev => (boosted ? prev - 1 : prev + 1))
  }

  const toggleFavourite = () => {
    setFavourited(prev => !prev)
    setFavCount(prev => (favourited ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 500
  const charCount = post.content.length

  return (
    <div className="mas-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="mas-control-bar">
        <div className="mas-control-platform">
          <PlatformIcon id="mastodon" size={15} color="#6364FF" />
          <span className="mas-control-title">Mastodon</span>
          <span className="mas-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="mas-control-actions">
          <button className="mas-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#6364FF" />
            <span>Refine</span>
          </button>
          <button className={`mas-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy toot">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="mas-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Mastodon Light Container */}
      <div className={`mas-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Profile Header */}
        <div className="mas-profile-header">
          <div className="mas-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="mas-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="mas-user-details">
            <div className="mas-name-line">
              <span className="mas-user-name">{userName}</span>
              <span className="mas-handle">{federatedHandle}</span>
            </div>
            <div className="mas-meta-line">
              <span className="mas-time">Just now</span>
              <span className="mas-dot">•</span>
              <Globe size={11} className="mas-globe" color="#606984" />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="mas-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="mas-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="mas-text">
              <FormattedContent content={post.content} linkColor="#6364FF" />
            </p>
          )}
        </div>

        {/* Media Frame Grid */}
        {imageUrls.length > 0 && (
          <div className="mas-media-container">
            <div className={`mas-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
              {imageUrls.slice(0, 4).map((url, idx) => (
                <div key={idx} className="mas-img-wrapper">
                  <img src={url} alt={`Media ${idx + 1}`} className="mas-img" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mastodon Footer Actions (Reply, Boost, Favorite, Bookmark, Share) */}
        <div className="mas-actions-bar">
          <button className="mas-action-btn" title="Reply">
            <MessageSquare size={16} color="#606984" />
          </button>

          <button className={`mas-action-btn ${boosted ? 'boosted' : ''}`} onClick={toggleBoost} title="Boost (Repost)">
            <Repeat size={16} color={boosted ? '#6364FF' : '#606984'} />
            {boostCount > 0 && <span className="mas-count blue">{boostCount}</span>}
          </button>

          <button className={`mas-action-btn ${favourited ? 'favourited' : ''}`} onClick={toggleFavourite} title="Favourite">
            <Star size={16} fill={favourited ? '#ca8a04' : 'none'} color={favourited ? '#ca8a04' : '#606984'} />
            {favCount > 0 && <span className="mas-count yellow">{favCount}</span>}
          </button>

          <button className={`mas-action-btn ${bookmarked ? 'bookmarked' : ''}`} onClick={() => setBookmarked(p => !p)} title="Bookmark">
            <Bookmark size={16} fill={bookmarked ? '#606984' : 'none'} color="#606984" />
          </button>

          <button className="mas-action-btn" title="Share">
            <Share2 size={16} color="#606984" />
          </button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="mas-footer-bar">
        <span className="mas-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="mas-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="mas-footer-share">
            Toot to Mastodon →
          </a>
        )}
      </div>

      <style>{`
        .mas-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 500px; margin: 0 auto; gap: 8px;
        }
        .mas-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .mas-control-platform { display: flex; align-items: center; gap: 6px; }
        .mas-control-title { font-size: 12px; font-weight: 800; color: #6364FF; text-transform: uppercase; letter-spacing: 0.04em; }
        .mas-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .mas-control-actions { display: flex; align-items: center; gap: 6px; }
        .mas-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .mas-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .mas-post-box {
          background: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 14px;
          display: flex; flex-direction: column; gap: 10px; color: #282c37; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .mas-post-box.editing { border-color: #6364FF; box-shadow: 0 0 0 2px rgba(99, 100, 255, 0.25); }

        .mas-profile-header { display: flex; align-items: center; gap: 10px; }
        .mas-avatar {
          width: 42px; height: 42px; border-radius: 6px; background: #6364FF; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden;
        }
        .mas-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .mas-user-details { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .mas-name-line { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .mas-user-name { font-weight: 700; font-size: 14px; color: #282c37; }
        .mas-handle { font-size: 12px; color: #606984; }
        .mas-meta-line { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #606984; margin-top: 1px; }

        .mas-body { cursor: text; }
        .mas-text {
          font-size: 14.5px; line-height: 1.5; color: #282c37;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .mas-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14.5px; line-height: 1.5; color: #282c37; background: #ffffff; border: 1.5px solid #6364FF;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .mas-media-container { width: 100%; border-radius: 8px; overflow: hidden; background: #f8f9fa; border: 1px solid #e0e0e0; }
        .mas-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
        .mas-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .mas-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .mas-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .mas-image-grid.grid-3 .mas-img-wrapper:nth-child(1) { grid-row: span 2; }
        .mas-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .mas-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .mas-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .mas-actions-bar { display: flex; align-items: center; justify-content: space-between; max-width: 340px; padding-top: 4px; }
        .mas-action-btn {
          display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; padding: 4px;
        }
        .mas-count { font-size: 12px; font-weight: 600; }
        .mas-count.blue { color: #6364FF; }
        .mas-count.yellow { color: #ca8a04; }

        .mas-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .mas-footer-chars { font-size: 11.5px; color: #606984; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .mas-footer-hint { font-size: 11px; color: #606984; white-space: nowrap; }
        .mas-footer-share { font-size: 12.5px; font-weight: 700; color: #6364FF; text-decoration: none; }
        .mas-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

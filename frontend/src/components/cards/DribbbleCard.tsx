import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Heart, Eye, Bookmark, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#EA4C89'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="dr-hashtag-text"
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

export function DribbbleCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Like Counter
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand Studio'

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
    addToast('Dribbble shot description copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Dribbble')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Dribbble kit downloaded', 'success')
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
    <div className="dr-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="dr-control-bar">
        <div className="dr-control-platform">
          <PlatformIcon id="dribbble" size={15} color="#EA4C89" />
          <span className="dr-control-title">Dribbble</span>
          <span className="dr-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="dr-control-actions">
          <button className="dr-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#EA4C89" />
            <span>Refine</span>
          </button>
          <button className={`dr-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy shot text">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="dr-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Dribbble 4:3 Shot Card */}
      <div className={`dr-post-box ${isEditing ? 'editing' : ''}`}>
        {/* 4:3 Media Frame */}
        <div className="dr-media-frame">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Shot preview" className="dr-shot-img" />
          ) : (
            <div className="dr-placeholder-canvas">
              <PlatformIcon id="dribbble" size={48} color="#EA4C89" />
              <span>Upload 4:3 design shot image</span>
            </div>
          )}
        </div>

        {/* Designer Profile Footer */}
        <div className="dr-shot-footer">
          <div className="dr-designer-row">
            <div className="dr-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="dr-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <span className="dr-user-name">{userName}</span>
            <span className="dr-pro-badge">PRO</span>
          </div>

          <div className="dr-stats-row">
            <button className={`dr-stat-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
              <Heart size={14} fill={liked ? '#EA4C89' : 'none'} color={liked ? '#EA4C89' : '#9e9ea7'} />
              {likeCount > 0 && <span className="dr-count">{likeCount}</span>}
            </button>
            <div className="dr-stat-pill">
              <Eye size={14} color="#9e9ea7" />
              <span className="dr-count">0</span>
            </div>
          </div>
        </div>

        {/* Description Body */}
        <div className="dr-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="dr-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="dr-text">
              <FormattedContent content={post.content} linkColor="#EA4C89" />
            </p>
          )}
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="dr-footer-bar">
        <span className="dr-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="dr-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="dr-footer-share">
            Post to Dribbble →
          </a>
        )}
      </div>

      <style>{`
        .dr-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 500px; margin: 0 auto; gap: 8px;
        }
        .dr-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .dr-control-platform { display: flex; align-items: center; gap: 6px; }
        .dr-control-title { font-size: 12px; font-weight: 800; color: #EA4C89; text-transform: uppercase; letter-spacing: 0.04em; }
        .dr-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .dr-control-actions { display: flex; align-items: center; gap: 6px; }
        .dr-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .dr-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .dr-post-box {
          background: #ffffff; border: 1px solid #e7e7e9; border-radius: 12px; padding: 14px;
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .dr-post-box.editing { border-color: #EA4C89; box-shadow: 0 0 0 2px rgba(234, 76, 137, 0.25); }

        .dr-media-frame { width: 100%; aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden; background: #f8f8f8; border: 1px solid #eeeeee; }
        .dr-shot-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .dr-placeholder-canvas {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 8px; color: #9e9ea7; font-size: 12px; font-weight: 600;
        }

        .dr-shot-footer { display: flex; align-items: center; justify-content: space-between; }
        .dr-designer-row { display: flex; align-items: center; gap: 8px; }
        .dr-avatar {
          width: 24px; height: 24px; border-radius: 50%; background: #EA4C89; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 11px; flex-shrink: 0; overflow: hidden;
        }
        .dr-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .dr-user-name { font-weight: 700; font-size: 13px; color: #0d0c22; }
        .dr-pro-badge { font-size: 9.5px; font-weight: 800; color: #ffffff; background: #ccc; padding: 1px 4px; border-radius: 3px; }

        .dr-stats-row { display: flex; align-items: center; gap: 10px; }
        .dr-stat-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; padding: 2px; }
        .dr-stat-pill { display: flex; align-items: center; gap: 4px; }
        .dr-count { font-size: 12px; font-weight: 600; color: #9e9ea7; }

        .dr-body { cursor: text; }
        .dr-text {
          font-size: 13.5px; line-height: 1.45; color: #3d3d4e;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .dr-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13.5px; line-height: 1.45; color: #0d0c22; background: #ffffff; border: 1.5px solid #EA4C89;
          border-radius: 8px; padding: 8px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .dr-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .dr-footer-chars { font-size: 11.5px; color: #9e9ea7; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .dr-footer-hint { font-size: 11px; color: #9e9ea7; white-space: nowrap; }
        .dr-footer-share { font-size: 12.5px; font-weight: 700; color: #EA4C89; text-decoration: none; }
        .dr-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

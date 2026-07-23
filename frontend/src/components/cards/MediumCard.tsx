import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Bookmark, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#1A8917'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="med-hashtag-text"
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

export function MediumCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Clap & Bookmark States
  const [clapped, setClapped] = useState(false)
  const [clapCount, setClapCount] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'

  // Extract title, subtitle, and body
  const lines = post.content.split('\n').filter(Boolean)
  const titleText = lines[0] || 'Medium Story Title'
  const subtitleText = lines[1] || 'An insightful subtitle for your publication.'
  const bodyText = lines.slice(2).join('\n\n').trim()

  // Calculate reading time
  const wordCount = post.content.split(/\s+/).length
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200))

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
    addToast('Medium story text copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Medium')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Medium kit downloaded', 'success')
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

  const toggleClap = () => {
    setClapped(prev => !prev)
    setClapCount(prev => (clapped ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charCount = post.content.length

  return (
    <div className="med-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="med-control-bar">
        <div className="med-control-platform">
          <PlatformIcon id="medium" size={15} color="#000000" />
          <span className="med-control-title">Medium</span>
          <span className="med-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="med-control-actions">
          <button className="med-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#1A8917" />
            <span>Refine</span>
          </button>
          <button className={`med-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy story">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="med-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Medium Story Box */}
      <div className={`med-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Author Header */}
        <div className="med-author-header">
          <div className="med-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="med-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="med-author-info">
            <span className="med-user-name">{userName}</span>
            <div className="med-subtext">
              <span>Just now</span>
              <span className="med-dot">•</span>
              <span>{readTimeMin} min read</span>
            </div>
          </div>
        </div>

        {/* Story Body */}
        <div className="med-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="med-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="med-content-grid">
              <div className="med-text-col">
                <h2 className="med-title">{titleText}</h2>
                <h4 className="med-subtitle">{subtitleText}</h4>
                {bodyText && (
                  <p className="med-text">
                    <FormattedContent content={bodyText} linkColor="#1A8917" />
                  </p>
                )}
              </div>

              {imageUrls.length > 0 && (
                <div className="med-image-col">
                  <img src={imageUrls[0]} alt="Feature" className="med-feature-img" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Medium Action Footer Bar (Clap, Comment, Bookmark) */}
        <div className="med-footer-actions">
          <div className="med-left-actions">
            <button className={`med-action-btn ${clapped ? 'clapped' : ''}`} onClick={toggleClap}>
              <span className="med-clap-emoji">👏</span>
              {clapCount > 0 && <span className="med-count">{clapCount}</span>}
            </button>

            <button className="med-action-btn">
              <MessageSquare size={16} color="#6b6b6b" />
            </button>
          </div>

          <button className="med-action-btn" onClick={() => setBookmarked(p => !p)}>
            <Bookmark size={16} fill={bookmarked ? '#242424' : 'none'} color={bookmarked ? '#242424' : '#6b6b6b'} />
          </button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="med-footer-bar">
        <span className="med-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="med-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="med-footer-share">
            Publish on Medium →
          </a>
        )}
      </div>

      <style>{`
        .med-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 540px; margin: 0 auto; gap: 8px;
        }
        .med-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .med-control-platform { display: flex; align-items: center; gap: 6px; }
        .med-control-title { font-size: 12px; font-weight: 800; color: #1A8917; text-transform: uppercase; letter-spacing: 0.04em; }
        .med-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .med-control-actions { display: flex; align-items: center; gap: 6px; }
        .med-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .med-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .med-post-box {
          background: #ffffff; border: 1px solid #f2f2f2; border-radius: 12px; padding: 18px;
          display: flex; flex-direction: column; gap: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .med-post-box.editing { border-color: #1A8917; box-shadow: 0 0 0 2px rgba(26, 137, 23, 0.15); }

        .med-author-header { display: flex; align-items: center; gap: 10px; }
        .med-avatar {
          width: 32px; height: 32px; border-radius: 50%; background: #1A8917; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 14px; flex-shrink: 0; overflow: hidden;
        }
        .med-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .med-author-info { display: flex; flex-direction: column; }
        .med-user-name { font-weight: 600; font-size: 13.5px; color: #242424; }
        .med-subtext { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b6b6b; }
        .med-dot { font-size: 10px; color: #6b6b6b; }

        .med-body { cursor: text; }
        .med-content-grid { display: flex; gap: 16px; align-items: flex-start; }
        .med-text-col { flex: 1; min-width: 0; }
        .med-title {
          font-size: 18px; font-weight: 700; color: #242424; line-height: 1.3; margin: 0 0 4px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
        }
        .med-subtitle {
          font-size: 14px; font-weight: 400; color: #6b6b6b; line-height: 1.4; margin: 0 0 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
        }
        .med-text {
          font-size: 13.5px; line-height: 1.5; color: #242424; white-space: pre-wrap; word-break: break-word;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
        }

        .med-image-col { width: 112px; height: 112px; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: #f2f2f2; }
        .med-feature-img { width: 100%; height: 100%; object-fit: cover; }

        .med-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
          font-size: 14px; line-height: 1.5; color: #242424; background: #ffffff; border: 1.5px solid #1A8917;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 100px; box-sizing: border-box;
        }

        .med-footer-actions {
          display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid #f2f2f2;
        }
        .med-left-actions { display: flex; align-items: center; gap: 16px; }
        .med-action-btn {
          display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; padding: 4px;
        }
        .med-clap-emoji { font-size: 15px; }
        .med-count { font-size: 12.5px; font-weight: 600; color: #6b6b6b; }

        .med-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .med-footer-chars { font-size: 11.5px; color: #6b6b6b; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .med-footer-hint { font-size: 11px; color: #6b6b6b; white-space: nowrap; }
        .med-footer-share { font-size: 12.5px; font-weight: 700; color: #1A8917; text-decoration: none; }
        .med-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

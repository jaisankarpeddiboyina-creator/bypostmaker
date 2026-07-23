import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Heart, Sparkles, Share2
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FF6719'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="sub-hashtag-text"
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

export function SubstackCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
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
  const [subscribed, setSubscribed] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Publication'

  // Extract Subject, Subtitle, and Body
  const lines = post.content.split('\n').filter(Boolean)
  const subjectText = lines[0] || 'Newsletter Issue #1: Launching Big'
  const subtitleText = lines[1] || 'A deep dive into our strategy, insights, and growth.'
  const bodyText = lines.slice(2).join('\n\n').trim()

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
    addToast('Substack newsletter text copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Substack')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Substack kit downloaded', 'success')
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
    <div className="sub-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="sub-control-bar">
        <div className="sub-control-platform">
          <PlatformIcon id="substack" size={15} color="#FF6719" />
          <span className="sub-control-title">Substack</span>
          <span className="sub-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="sub-control-actions">
          <button className="sub-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#FF6719" />
            <span>Refine</span>
          </button>
          <button className={`sub-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy issue">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="sub-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Substack Publication Post Container */}
      <div className={`sub-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Substack Brand Header */}
        <div className="sub-brand-header">
          <div className="sub-pub-row">
            <div className="sub-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="sub-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <div className="sub-pub-info">
              <span className="sub-pub-name">{userName}</span>
              <span className="sub-meta">Just now · 4 min read</span>
            </div>
            <button
              className={`sub-subscribe-btn ${subscribed ? 'subscribed' : ''}`}
              type="button"
              onClick={() => setSubscribed(p => !p)}
            >
              {subscribed ? 'Subscribed' : 'Subscribe'}
            </button>
          </div>
        </div>

        {/* Cover Image Frame */}
        {imageUrls.length > 0 && (
          <div className="sub-cover-frame">
            <img src={imageUrls[0]} alt="Cover" className="sub-cover-img" />
          </div>
        )}

        {/* Story Body */}
        <div className="sub-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="sub-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="sub-editorial-layout">
              <h1 className="sub-subject">{subjectText}</h1>
              <h3 className="sub-subtitle">{subtitleText}</h3>
              {bodyText && (
                <p className="sub-text">
                  <FormattedContent content={bodyText} linkColor="#FF6719" />
                </p>
              )}
            </div>
          )}
        </div>

        {/* Substack Action Bar (Heart, Comment, Share) */}
        <div className="sub-actions-bar">
          <div className="sub-left-actions">
            <button className={`sub-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
              <Heart size={16} fill={liked ? '#FF6719' : 'none'} color={liked ? '#FF6719' : '#555555'} />
              {likeCount > 0 && <span className="sub-count">{likeCount}</span>}
            </button>
            <button className="sub-action-btn">
              <MessageSquare size={16} color="#555555" />
            </button>
          </div>

          <button className="sub-action-btn">
            <Share2 size={16} color="#555555" />
          </button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="sub-footer-bar">
        <span className="sub-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="sub-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="sub-footer-share">
            Publish on Substack →
          </a>
        )}
      </div>

      <style>{`
        .sub-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 520px; margin: 0 auto; gap: 8px;
        }
        .sub-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .sub-control-platform { display: flex; align-items: center; gap: 6px; }
        .sub-control-title { font-size: 12px; font-weight: 800; color: #FF6719; text-transform: uppercase; letter-spacing: 0.04em; }
        .sub-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .sub-control-actions { display: flex; align-items: center; gap: 6px; }
        .sub-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .sub-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .sub-post-box {
          background: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 18px;
          display: flex; flex-direction: column; gap: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .sub-post-box.editing { border-color: #FF6719; box-shadow: 0 0 0 2px rgba(255, 103, 25, 0.2); }

        .sub-brand-header { padding-bottom: 12px; border-bottom: 1px solid #f0f0f0; }
        .sub-pub-row { display: flex; align-items: center; gap: 10px; }
        .sub-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #FF6719; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .sub-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .sub-pub-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .sub-pub-name { font-weight: 700; font-size: 14px; color: #111111; }
        .sub-meta { font-size: 12px; color: #777777; }

        .sub-subscribe-btn {
          background: #FF6719; color: #ffffff; border: none; font-weight: 700; font-size: 12px; padding: 6px 14px;
          border-radius: 99px; cursor: pointer; transition: background 150ms ease;
        }
        .sub-subscribe-btn:hover { background: #e5560c; }
        .sub-subscribe-btn.subscribed { background: #f0f0f0; color: #111111; }

        .sub-cover-frame { width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #f9f9f9; }
        .sub-cover-img { width: 100%; height: 100%; object-fit: cover; }

        .sub-body { cursor: text; }
        .sub-editorial-layout { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif; }
        .sub-subject { font-size: 20px; font-weight: 800; color: #111111; line-height: 1.3; margin: 0 0 6px; }
        .sub-subtitle { font-size: 14px; font-weight: 400; color: #555555; line-height: 1.4; margin: 0 0 10px; }
        .sub-text { font-size: 14px; line-height: 1.5; color: #222222; white-space: pre-wrap; word-break: break-word; }
        .sub-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
          font-size: 14px; line-height: 1.5; color: #111111; background: #ffffff; border: 1.5px solid #FF6719;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 100px; box-sizing: border-box;
        }

        .sub-actions-bar { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid #f0f0f0; }
        .sub-left-actions { display: flex; align-items: center; gap: 14px; }
        .sub-action-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; padding: 4px; }
        .sub-count { font-size: 12.5px; font-weight: 600; color: #FF6719; }

        .sub-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .sub-footer-chars { font-size: 11.5px; color: #777777; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .sub-footer-hint { font-size: 11px; color: #777777; white-space: nowrap; }
        .sub-footer-share { font-size: 12.5px; font-weight: 700; color: #FF6719; text-decoration: none; }
        .sub-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

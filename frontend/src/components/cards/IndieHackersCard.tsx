import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Triangle, Sparkles, TrendingUp
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0E2150'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="ih-hashtag-text"
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

export function IndieHackersCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Upvote Count
  const [upvoted, setUpvoted] = useState(false)
  const [points, setPoints] = useState(1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Startup'
  const handleName = user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '')}` : '@yourstartup'

  // Extract Title & Body
  const lines = post.content.split('\n').filter(Boolean)
  const titleText = lines[0] || 'How we grew to $2,500/mo ARR in 60 days'
  const bodyText = lines.slice(1).join('\n\n').trim()

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
    addToast('Indie Hackers post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'IndieHackers')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Indie Hackers kit downloaded', 'success')
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

  const toggleUpvote = () => {
    setUpvoted(prev => !prev)
    setPoints(prev => (upvoted ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charCount = post.content.length

  return (
    <div className="ih-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="ih-control-bar">
        <div className="ih-control-platform">
          <PlatformIcon id="indiehackers" size={15} color="#0E2150" />
          <span className="ih-control-title">Indie Hackers</span>
          <span className="ih-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="ih-control-actions">
          <button className="ih-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#0E2150" />
            <span>Refine</span>
          </button>
          <button className={`ih-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy post">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="ih-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Indie Hackers Builder Post Card */}
      <div className={`ih-post-box ${isEditing ? 'editing' : ''}`}>
        <div className="ih-card-header">
          <div className="ih-author-row">
            <div className="ih-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="ih-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <div className="ih-author-info">
              <span className="ih-user-name">{userName}</span>
              <span className="ih-meta">{handleName} · Just now</span>
            </div>

            {/* Revenue Metric Tag */}
            <div className="ih-revenue-pill">
              <TrendingUp size={12} color="#10B981" />
              <span>Building</span>
            </div>
          </div>
        </div>

        {/* Post Text Body */}
        <div className="ih-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="ih-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <>
              <h2 className="ih-title">{titleText}</h2>
              {bodyText && (
                <p className="ih-text">
                  <FormattedContent content={bodyText} linkColor="#0E2150" />
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer Upvote & Comment Actions Bar */}
        <div className="ih-footer-actions">
          <button className={`ih-vote-btn ${upvoted ? 'upvoted' : ''}`} onClick={toggleUpvote}>
            <Triangle size={12} fill={upvoted ? '#ffffff' : '#0E2150'} color="transparent" />
            <span>{points}</span>
          </button>

          <div className="ih-comment-link">
            <MessageSquare size={14} color="#64748b" />
            <span>0 comments</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="ih-footer-bar">
        <span className="ih-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="ih-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="ih-footer-share">
            Post on Indie Hackers →
          </a>
        )}
      </div>

      <style>{`
        .ih-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 520px; margin: 0 auto; gap: 8px;
        }
        .ih-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .ih-control-platform { display: flex; align-items: center; gap: 6px; }
        .ih-control-title { font-size: 12px; font-weight: 800; color: #0E2150; text-transform: uppercase; letter-spacing: 0.04em; }
        .ih-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .ih-control-actions { display: flex; align-items: center; gap: 6px; }
        .ih-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .ih-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .ih-post-box {
          background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .ih-post-box.editing { border-color: #0E2150; box-shadow: 0 0 0 2px rgba(14, 33, 80, 0.2); }

        .ih-author-row { display: flex; align-items: center; gap: 10px; }
        .ih-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #0E2150; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .ih-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .ih-author-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .ih-user-name { font-weight: 700; font-size: 14px; color: #0f172a; }
        .ih-meta { font-size: 12px; color: #64748b; }

        .ih-revenue-pill {
          display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #10B981;
          background: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 99px;
        }

        .ih-body { cursor: text; }
        .ih-title {
          font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.35; margin: 0 0 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .ih-text {
          font-size: 14px; line-height: 1.5; color: #334155; white-space: pre-wrap; word-break: break-word;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .ih-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.5; color: #0f172a; background: #ffffff; border: 1.5px solid #0E2150;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .ih-footer-actions { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #f1f5f9; }
        .ih-vote-btn {
          display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 6px;
          background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; color: #0E2150; cursor: pointer; transition: all 120ms ease;
        }
        .ih-vote-btn:hover { background: #e2e8f0; }
        .ih-vote-btn.upvoted { background: #0E2150; color: #ffffff; border-color: #0E2150; }

        .ih-comment-link { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #64748b; }

        .ih-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .ih-footer-chars { font-size: 11.5px; color: #64748b; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .ih-footer-hint { font-size: 11px; color: #64748b; white-space: nowrap; }
        .ih-footer-share { font-size: 12.5px; font-weight: 700; color: #0E2150; text-decoration: none; }
        .ih-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, ArrowBigUp, ArrowBigDown, Share2, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#2B6CB0'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="quo-tag-text"
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

export function QuoraCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Upvote Counter
  const [upvoted, setUpvoted] = useState(false)
  const [upvoteCount, setUpvoteCount] = useState(1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Expert Contributor'

  // Extract Question Title & Answer Text
  const lines = post.content.split('\n').filter(Boolean)
  const questionTitle = lines[0] || 'What are the best strategies for scaling a social media SaaS?'
  const answerBody = lines.slice(1).join('\n\n').trim()

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
    addToast('Quora answer copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Quora')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Quora kit downloaded', 'success')
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
    setUpvoteCount(prev => (upvoted ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charCount = post.content.length

  return (
    <div className="quo-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="quo-control-bar">
        <div className="quo-control-platform">
          <PlatformIcon id="quora" size={15} color="#B92B27" />
          <span className="quo-control-title">Quora</span>
          <span className="quo-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="quo-control-actions">
          <button className="quo-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#B92B27" />
            <span>Refine</span>
          </button>
          <button className={`quo-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy answer">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="quo-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Quora Answer Card */}
      <div className={`quo-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Question Header */}
        <h2 className="quo-question-title">{questionTitle}</h2>

        {/* Answer Author Header */}
        <div className="quo-author-row">
          <div className="quo-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="quo-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>
          <div className="quo-author-info">
            <span className="quo-user-name">{userName}</span>
            <span className="quo-cred">Answered just now</span>
          </div>
        </div>

        {/* Answer Text Body */}
        <div className="quo-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="quo-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="quo-text">
              <FormattedContent content={answerBody || post.content} linkColor="#2B6CB0" />
            </p>
          )}
        </div>

        {/* Quora Action Bar (Upvote Pill & Share) */}
        <div className="quo-actions-bar">
          <div className="quo-vote-pill">
            <button className={`quo-upvote-btn ${upvoted ? 'active' : ''}`} onClick={toggleUpvote}>
              <ArrowBigUp size={18} fill={upvoted ? '#2B6CB0' : 'none'} color={upvoted ? '#2B6CB0' : '#636466'} />
              <span>Upvote</span>
              <span className="quo-count">• {upvoteCount}</span>
            </button>
            <button className="quo-downvote-btn">
              <ArrowBigDown size={18} color="#636466" />
            </button>
          </div>

          <button className="quo-share-btn">
            <Share2 size={16} color="#636466" />
          </button>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="quo-footer-bar">
        <span className="quo-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="quo-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="quo-footer-share">
            Answer on Quora →
          </a>
        )}
      </div>

      <style>{`
        .quo-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 520px; margin: 0 auto; gap: 8px;
        }
        .quo-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .quo-control-platform { display: flex; align-items: center; gap: 6px; }
        .quo-control-title { font-size: 12px; font-weight: 800; color: #B92B27; text-transform: uppercase; letter-spacing: 0.04em; }
        .quo-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .quo-control-actions { display: flex; align-items: center; gap: 6px; }
        .quo-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .quo-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .quo-post-box {
          background: #ffffff; border: 1px solid #dee2e6; border-radius: 12px; padding: 16px;
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .quo-post-box.editing { border-color: #B92B27; box-shadow: 0 0 0 2px rgba(185, 43, 39, 0.2); }

        .quo-question-title { font-size: 17px; font-weight: 800; color: #282829; line-height: 1.35; margin: 0; font-family: q_serif, Georgia, Times, serif; }

        .quo-author-row { display: flex; align-items: center; gap: 10px; }
        .quo-avatar {
          width: 34px; height: 34px; border-radius: 50%; background: #B92B27; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 14px; flex-shrink: 0; overflow: hidden;
        }
        .quo-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .quo-author-info { display: flex; flex-direction: column; }
        .quo-user-name { font-weight: 700; font-size: 13.5px; color: #282829; }
        .quo-cred { font-size: 11.5px; color: #636466; }

        .quo-body { cursor: text; }
        .quo-text { font-size: 14px; line-height: 1.5; color: #282829; white-space: pre-wrap; word-break: break-word; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .quo-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.5; color: #282829; background: #ffffff; border: 1.5px solid #B92B27;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .quo-actions-bar { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #f1f2f4; }
        .quo-vote-pill { display: flex; align-items: center; background: #f7f7f8; border: 1px solid #e2e3e5; border-radius: 99px; overflow: hidden; }
        .quo-upvote-btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; background: transparent; border: none; font-size: 13px; font-weight: 600; color: #636466; cursor: pointer; }
        .quo-upvote-btn.active { color: #2B6CB0; }
        .quo-downvote-btn { padding: 5px 10px; background: transparent; border: none; border-left: 1px solid #e2e3e5; cursor: pointer; }
        .quo-share-btn { background: transparent; border: none; cursor: pointer; padding: 6px; }

        .quo-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .quo-footer-chars { font-size: 11.5px; color: #636466; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .quo-footer-hint { font-size: 11px; color: #636466; white-space: nowrap; }
        .quo-footer-share { font-size: 12.5px; font-weight: 700; color: #B92B27; text-decoration: none; }
        .quo-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, ChevronUp, ChevronDown, Bookmark, Sparkles
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0074CC'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="so-tag-text"
            style={{ color, background: '#E1ECF4', padding: '1px 5px', borderRadius: 3, fontWeight: 500, fontSize: 12 }}
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

export function StackOverflowCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Votes & Accepted Answer
  const [voteCount, setVoteCount] = useState(1)
  const [userVoted, setUserVoted] = useState<'up' | 'down' | null>(null)
  const [accepted, setAccepted] = useState(true)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Developer'

  // Extract Question Title & Answer Code
  const lines = post.content.split('\n').filter(Boolean)
  const questionTitle = lines[0] || 'How to implement production post generator SDK?'
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
    addToast('Stack Overflow answer copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'StackOverflow')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Stack Overflow kit downloaded', 'success')
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

  const handleUpvote = () => {
    if (userVoted === 'up') {
      setUserVoted(null)
      setVoteCount(prev => prev - 1)
    } else {
      setVoteCount(prev => (userVoted === 'down' ? prev + 2 : prev + 1))
      setUserVoted('up')
    }
  }

  const handleDownvote = () => {
    if (userVoted === 'down') {
      setUserVoted(null)
      setVoteCount(prev => prev + 1)
    } else {
      setVoteCount(prev => (userVoted === 'up' ? prev - 2 : prev - 1))
      setUserVoted('down')
    }
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charCount = post.content.length

  return (
    <div className="so-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="so-control-bar">
        <div className="so-control-platform">
          <PlatformIcon id="stackoverflow" size={15} color="#F48024" />
          <span className="so-control-title">Stack Overflow</span>
          <span className="so-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="so-control-actions">
          <button className="so-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#F48024" />
            <span>Refine</span>
          </button>
          <button className={`so-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy answer">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="so-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Stack Overflow Answer Layout */}
      <div className={`so-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Question Heading Title */}
        <div className="so-question-header">
          <h2 className="so-question-title">{questionTitle}</h2>
        </div>

        {/* 2-Column Stacks Layout */}
        <div className="so-main-grid">
          {/* Left Column: Upvote/Downvote & Acceptance Mark */}
          <div className="so-vote-col">
            <button className={`so-vote-btn ${userVoted === 'up' ? 'active' : ''}`} onClick={handleUpvote} title="Upvote">
              <ChevronUp size={28} color={userVoted === 'up' ? '#F48024' : '#babfc4'} />
            </button>
            <span className="so-vote-score">{voteCount}</span>
            <button className={`so-vote-btn ${userVoted === 'down' ? 'active' : ''}`} onClick={handleDownvote} title="Downvote">
              <ChevronDown size={28} color={userVoted === 'down' ? '#F48024' : '#babfc4'} />
            </button>
            <button
              className={`so-accept-btn ${accepted ? 'accepted' : ''}`}
              onClick={() => setAccepted(p => !p)}
              title="Accepted Answer"
            >
              <Check size={26} color={accepted ? '#2e7d32' : '#babfc4'} />
            </button>
            <button className="so-bookmark-btn" title="Bookmark">
              <Bookmark size={16} color="#babfc4" />
            </button>
          </div>

          {/* Right Column: Answer Body & Code Formatting */}
          <div className="so-content-col">
            <div className="so-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="so-edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  spellCheck
                />
              ) : (
                <div className="so-text-wrapper">
                  <p className="so-text">
                    <FormattedContent content={answerBody || post.content} linkColor="#0074CC" />
                  </p>
                </div>
              )}
            </div>

            {/* Answer Author Signature Box */}
            <div className="so-signature-row">
              <div className="so-author-card">
                <span className="so-answered-time">answered 3 mins ago</span>
                <div className="so-user-row">
                  <div className="so-avatar">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="so-avatar-img" />
                    ) : (
                      userName[0].toUpperCase()
                    )}
                  </div>
                  <div className="so-user-info">
                    <span className="so-user-name">{userName}</span>
                    <span className="so-rep-badge">1,420 rep</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="so-footer-bar">
        <span className="so-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="so-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="so-footer-share">
            Answer on Stack Overflow →
          </a>
        )}
      </div>

      <style>{`
        .so-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 540px; margin: 0 auto; gap: 8px;
        }
        .so-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .so-control-platform { display: flex; align-items: center; gap: 6px; }
        .so-control-title { font-size: 12px; font-weight: 800; color: #F48024; text-transform: uppercase; letter-spacing: 0.04em; }
        .so-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .so-control-actions { display: flex; align-items: center; gap: 6px; }
        .so-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .so-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .so-post-box {
          background: #ffffff; border: 1px solid #d6d9dc; border-radius: 10px; padding: 16px;
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .so-post-box.editing { border-color: #F48024; box-shadow: 0 0 0 2px rgba(244, 128, 36, 0.2); }

        .so-question-header { border-bottom: 1px solid #e3e6e8; padding-bottom: 10px; }
        .so-question-title { font-size: 17px; font-weight: 700; color: #0c0d0e; line-height: 1.35; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

        .so-main-grid { display: flex; gap: 14px; }
        .so-vote-col { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 36px; flex-shrink: 0; }
        .so-vote-btn { background: transparent; border: none; cursor: pointer; padding: 2px; border-radius: 50%; }
        .so-vote-btn:hover { background: #f8f9f9; }
        .so-vote-score { font-size: 18px; font-weight: 700; color: #232629; margin: 2px 0; }
        .so-accept-btn { background: transparent; border: none; cursor: pointer; padding: 2px; }
        .so-bookmark-btn { background: transparent; border: none; cursor: pointer; padding: 4px; margin-top: 4px; }

        .so-content-col { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .so-body { cursor: text; margin-bottom: 12px; }
        .so-text-wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .so-text { font-size: 14px; line-height: 1.5; color: #232629; white-space: pre-wrap; word-break: break-word; }
        .so-edit-textarea {
          width: 100%; font-family: monospace; font-size: 13.5px; line-height: 1.45;
          color: #232629; background: #ffffff; border: 1.5px solid #F48024; border-radius: 6px; padding: 10px;
          outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .so-signature-row { display: flex; justify-content: flex-end; }
        .so-author-card {
          background: #d9eaf7; border-radius: 4px; padding: 8px; display: flex; flex-direction: column; gap: 4px; width: 170px;
        }
        .so-answered-time { font-size: 11px; color: #6a737c; }
        .so-user-row { display: flex; align-items: center; gap: 6px; }
        .so-avatar {
          width: 24px; height: 24px; border-radius: 3px; background: #0074CC; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 11px; flex-shrink: 0; overflow: hidden;
        }
        .so-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .so-user-info { display: flex; flex-direction: column; }
        .so-user-name { font-size: 12px; font-weight: 600; color: #0074CC; }
        .so-rep-badge { font-size: 10px; font-weight: 700; color: #6a737c; }

        .so-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .so-footer-chars { font-size: 11.5px; color: #6a737c; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .so-footer-hint { font-size: 11px; color: #6a737c; white-space: nowrap; }
        .so-footer-share { font-size: 12.5px; font-weight: 700; color: #F48024; text-decoration: none; }
        .so-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

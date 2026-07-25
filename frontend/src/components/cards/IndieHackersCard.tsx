import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, Triangle, TrendingUp
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

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
  const charLimit = platform?.charLimit || 20000
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="indiehackers"
      platformName="Indie Hackers"
      brandColor="#0E2150"
      status="Ready"
      edited={post.edited}
      charCount={charCount}
      charLimit={charLimit}
      shareUrl={shareUrl}
      copied={copied}
      downloading={downloading}
      isEditing={isEditing}
      onRefine={onOpenRefinement}
      onCopy={handleCopy}
      onDownload={handleDownload}
    >
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

      <style>{`
        .ih-post-box {
          background: #ffffff; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: background 150ms ease;
        }
        .ih-post-box.editing { background: #F8FAFC; }

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
      `}</style>
    </UnifiedCardShell>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, MessageSquare, Check, Sparkles, Smile, CornerUpLeft, MoreHorizontal
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#1264A3'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="slk-mention-text"
            style={{ color, background: 'rgba(29, 155, 209, 0.1)', padding: '1px 4px', borderRadius: 3, fontWeight: 600, cursor: 'pointer' }}
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

export function SlackCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Reaction State
  const [reacted, setReacted] = useState(false)
  const [reactCount, setReactCount] = useState(1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Brand'

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
    addToast('Slack message copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Slack')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Slack kit downloaded', 'success')
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

  const toggleReact = () => {
    setReacted(prev => !prev)
    setReactCount(prev => (reacted ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 40000
  const charCount = post.content.length

  return (
    <div className="slk-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="slk-control-bar">
        <div className="slk-control-platform">
          <PlatformIcon id="slack" size={15} color="#4A154B" />
          <span className="slk-control-title">Slack</span>
          <span className="slk-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="slk-control-actions">
          <button className="slk-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#4A154B" />
            <span>Refine</span>
          </button>
          <button className={`slk-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy message">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="slk-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Slack Message Container */}
      <div className={`slk-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Floating Action Toolbar on Hover */}
        <div className="slk-hover-bar">
          <button className="slk-hover-btn" title="Completed"><Check size={14} color="#616061" /></button>
          <button className="slk-hover-btn" title="Add reaction"><Smile size={14} color="#616061" /></button>
          <button className="slk-hover-btn" title="Reply in thread"><MessageSquare size={14} color="#616061" /></button>
          <button className="slk-hover-btn" title="Share message"><CornerUpLeft size={14} color="#616061" /></button>
          <button className="slk-hover-btn" title="More options"><MoreHorizontal size={14} color="#616061" /></button>
        </div>

        <div className="slk-message-row">
          {/* Avatar Column */}
          <div className="slk-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="slk-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>

          {/* Content Column */}
          <div className="slk-main-col">
            {/* User Header Line */}
            <div className="slk-header-line">
              <span className="slk-user-name">{userName}</span>
              <span className="slk-app-badge">APP</span>
              <span className="slk-timestamp">3:42 PM</span>
            </div>

            {/* Message Body */}
            <div className="slk-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="slk-edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  spellCheck
                />
              ) : (
                <p className="slk-text">
                  <FormattedContent content={post.content} linkColor="#1264A3" />
                </p>
              )}
            </div>

            {/* Reaction Pill Row */}
            <div className="slk-reactions-row">
              <button className={`slk-reaction-pill ${reacted ? 'active' : ''}`} onClick={toggleReact}>
                <span>👍</span>
                <span className="slk-pill-count">{reactCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="slk-footer-bar">
        <span className="slk-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="slk-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="slk-footer-share">
            Send to Slack →
          </a>
        )}
      </div>

      <style>{`
        .slk-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 520px; margin: 0 auto; gap: 8px;
        }
        .slk-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .slk-control-platform { display: flex; align-items: center; gap: 6px; }
        .slk-control-title { font-size: 12px; font-weight: 800; color: #4A154B; text-transform: uppercase; letter-spacing: 0.04em; }
        .slk-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .slk-control-actions { display: flex; align-items: center; gap: 6px; }
        .slk-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .slk-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .slk-post-box {
          position: relative; background: #ffffff; border: 1px solid #dddddd; border-radius: 10px; padding: 14px;
          display: flex; flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .slk-post-box.editing { border-color: #4A154B; box-shadow: 0 0 0 2px rgba(74, 21, 75, 0.2); }

        .slk-hover-bar {
          position: absolute; top: -12px; right: 14px; background: #ffffff; border: 1px solid #e0e0e0;
          border-radius: 6px; display: flex; align-items: center; padding: 2px; z-index: 10; opacity: 0; transition: opacity 120ms ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .slk-post-box:hover .slk-hover-bar { opacity: 1; }
        .slk-hover-btn { background: transparent; border: none; padding: 4px 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; }
        .slk-hover-btn:hover { background: #f8f8f8; }

        .slk-message-row { display: flex; gap: 12px; }
        .slk-avatar {
          width: 36px; height: 36px; border-radius: 8px; background: #4A154B; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .slk-avatar-img { width: 100%; height: 100%; object-fit: cover; }

        .slk-main-col { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .slk-header-line { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .slk-user-name { font-weight: 800; font-size: 15px; color: #1d1c1d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .slk-app-badge {
          font-size: 9px; font-weight: 800; color: #616061; background: #f2f2f2; padding: 1px 4px; border-radius: 3px;
        }
        .slk-timestamp { font-size: 12px; color: #616061; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

        .slk-body { cursor: text; margin-bottom: 8px; }
        .slk-text {
          font-size: 15px; line-height: 1.46; color: #1d1c1d;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .slk-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 15px; line-height: 1.46; color: #1d1c1d; background: #ffffff; border: 1.5px solid #4A154B;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .slk-reactions-row { display: flex; align-items: center; gap: 6px; }
        .slk-reaction-pill {
          display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px;
          background: #f8f8f8; border: 1px solid #e0e0e0; font-size: 12px; color: #1d1c1d; cursor: pointer; transition: all 120ms ease;
        }
        .slk-reaction-pill:hover { background: #ffffff; border-color: #1264A3; }
        .slk-reaction-pill.active { background: #e8f5fa; border-color: #1264A3; color: #1264A3; }
        .slk-pill-count { font-weight: 700; }

        .slk-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .slk-footer-chars { font-size: 11.5px; color: #616061; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .slk-footer-hint { font-size: 11px; color: #616061; white-space: nowrap; }
        .slk-footer-share { font-size: 12.5px; font-weight: 700; color: #4A154B; text-decoration: none; }
        .slk-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

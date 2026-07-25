import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, Check, Smile, CornerUpLeft, MoreHorizontal
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

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
    <UnifiedCardShell
      platformId="slack"
      platformName="Slack"
      brandColor="#4A154B"
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

      <style>{`
        .slk-post-box {
          position: relative; background: #ffffff; padding: 14px; display: flex; flex-direction: column; transition: background 150ms ease;
        }
        .slk-post-box.editing { background: #F8FAFC; }

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
      `}</style>
    </UnifiedCardShell>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, Send
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FFFC00'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="sc-hashtag-text"
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

export function SnapchatCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Snap Story'

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
    addToast('Snapchat caption copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Snapchat')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Snapchat kit downloaded', 'success')
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

  const shareUrl = platform?.shareUrl(post.content, {})
  const charCount = post.content.length

  return (
    <div className="sc-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="sc-control-bar">
        <div className="sc-control-platform">
          <PlatformIcon id="snapchat" size={15} color="#000000" />
          <span className="sc-control-title">Snapchat</span>
          <span className="sc-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="sc-control-actions">
          <button className="sc-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#000000" />
            <span>Refine</span>
          </button>
          <button className={`sc-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy caption">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="sc-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Snapchat 9:16 Story Frame */}
      <div className={`sc-post-box ${isEditing ? 'editing' : ''}`}>
        <div className="sc-story-frame">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Snap preview" className="sc-story-media" />
          ) : (
            <div className="sc-placeholder-bg">
              <PlatformIcon id="snapchat" size={48} color="#000000" />
              <span>Upload 9:16 Snap Media</span>
            </div>
          )}

          {/* Top Profile Bar */}
          <div className="sc-top-profile">
            <div className="sc-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="sc-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <div className="sc-name-col">
              <span className="sc-user-name">{userName}</span>
              <span className="sc-time">Just now</span>
            </div>
          </div>

          {/* Snapchat Signature Black Banner Caption */}
          <div className="sc-banner-caption" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="sc-edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                autoFocus
                spellCheck
              />
            ) : (
              <p className="sc-text">
                <FormattedContent content={post.content} linkColor="#FFFC00" />
              </p>
            )}
          </div>

          {/* Bottom Chat Pill */}
          <div className="sc-bottom-bar">
            <div className="sc-chat-pill">
              <span>Send a Chat</span>
              <Send size={14} color="#ffffff" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="sc-footer-bar">
        <span className="sc-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="sc-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="sc-footer-share">
            Send Snap →
          </a>
        )}
      </div>

      <style>{`
        .sc-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 340px; margin: 0 auto; gap: 8px;
        }
        .sc-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .sc-control-platform { display: flex; align-items: center; gap: 6px; }
        .sc-control-title { font-size: 12px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.04em; }
        .sc-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .sc-control-actions { display: flex; align-items: center; gap: 6px; }
        .sc-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .sc-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .sc-post-box {
          background: #000000; border: 1px solid #222222; border-radius: 20px; padding: 6px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: border-color 150ms ease;
        }
        .sc-post-box.editing { border-color: #FFFC00; box-shadow: 0 0 0 2px rgba(255, 252, 0, 0.4); }

        .sc-story-frame {
          position: relative; width: 100%; aspect-ratio: 9 / 16; border-radius: 16px; overflow: hidden; background: #111111;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .sc-story-media { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
        .sc-placeholder-bg {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #000000; font-size: 12px; font-weight: 700; background: #FFFC00; position: absolute; inset: 0;
        }

        .sc-top-profile {
          position: relative; z-index: 10; display: flex; align-items: center; gap: 8px; padding: 12px;
          background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
        }
        .sc-avatar {
          width: 32px; height: 32px; border-radius: 50%; background: #FFFC00; display: flex; align-items: center;
          justify-content: center; color: #000000; font-weight: 800; font-size: 14px; flex-shrink: 0; overflow: hidden;
        }
        .sc-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .sc-name-col { display: flex; flex-direction: column; }
        .sc-user-name { font-weight: 700; font-size: 13px; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
        .sc-time { font-size: 11px; color: rgba(255,255,255,0.8); }

        .sc-banner-caption {
          position: relative; z-index: 10; width: 100%; background: rgba(0,0,0,0.75); padding: 8px 12px; cursor: text;
          text-align: center; backdrop-filter: blur(4px);
        }
        .sc-text {
          font-size: 13.5px; font-weight: 600; color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word; margin: 0;
        }
        .sc-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13.5px; font-weight: 600; color: #ffffff; background: transparent; border: 1.5px solid #FFFC00;
          border-radius: 4px; padding: 6px; outline: none; resize: vertical; min-height: 60px; box-sizing: border-box; text-align: center;
        }

        .sc-bottom-bar {
          position: relative; z-index: 10; padding: 12px; display: flex; justify-content: center;
          background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
        }
        .sc-chat-pill {
          display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
          background: rgba(255,255,255,0.25); border-radius: 99px; padding: 8px 16px; color: #ffffff; font-size: 12px; font-weight: 600;
          backdrop-filter: blur(8px);
        }

        .sc-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .sc-footer-chars { font-size: 11.5px; color: #777777; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .sc-footer-hint { font-size: 11px; color: #777777; white-space: nowrap; }
        .sc-footer-share { font-size: 12.5px; font-weight: 700; color: #000000; text-decoration: none; }
        .sc-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

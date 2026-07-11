import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Copy, Download, MessageSquare, Check, AlertCircle, Heart, Repeat, Share2, ThumbsUp, ChevronUp, ChevronDown, BookOpen, PlayCircle, Mic, Bookmark, Send } from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore, type PlatformPost } from '../store/app'
import { api } from '../lib/api'
import { PlatformIcon } from './PlatformIcon'
import { generateClientZip, sanitize } from '../lib/downloadKit'

interface ExtraField {
  key: string
  placeholder: string
  label: string
}

const PLATFORM_EXTRA_FIELDS: Record<string, ExtraField[]> = {
  reddit:      [{ key: 'subreddit', placeholder: 'r/subreddit', label: 'Subreddit' }],
  hackernews:  [{ key: 'url', placeholder: 'https://your-launch-url.com', label: 'Launch URL' }],
  stackoverflow:[{ key: 'url', placeholder: 'https://stackoverflow.com/...', label: 'Question URL' }],
}

import type { Platform } from '@@config/platforms'

function getProfileSub(platform: Platform | undefined): string {
  if (!platform) return ''
  switch (platform.group) {
    case 'shortform':    return '@yourhandle · just now'
    case 'professional': return 'Your Title · 1st · just now'
    case 'community':    return 'u/yourhandle · just now'
    case 'longform':     return 'yourhandle · just now · 1 min read'
    case 'video':        return '@yourchannel · just now'
    case 'audio':        return '@yourhandle · just now'
    case 'design':       return '@yourhandle · just now'
    case 'messaging':    return '@yourhandle'
    default:             return '@yourhandle · just now'
  }
}

interface PostCardProps {
  platformId: string
  post: PlatformPost
  campaignId: string
  imageFiles: File[]
  videoFile: File | null
  onOpenRefinement: () => void
}

export function PostCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: PostCardProps) {
  const { updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]
  const extraFieldDefs = PLATFORM_EXTRA_FIELDS[platformId] ?? []

  const [imageUrls, setImageUrls] = useState<string[]>([])

  useEffect(() => {
    if (!platform || platform.maxImages === 0 || platform.imagePosition === 'none' || imageFiles.length === 0) {
      setImageUrls([])
      return
    }
    const urls = imageFiles.slice(0, platform.maxImages).map(f => URL.createObjectURL(f))
    setImageUrls(urls)
    return () => { urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [imageFiles, platform])

  const renderImageGrid = () => {
    if (!platform || platform.maxImages === 0 || platform.imagePosition === 'none') return null
    if (imageFiles.length === 0 || imageUrls.length === 0) return null

    const count = imageUrls.length
    const showOverlay = imageFiles.length > 4 && platform.maxImages > 4
    const overlayText = `+${imageFiles.length - 4} more`
    const gridClass = `pc-image-grid grid-${Math.min(count, 4)}`
    const itemsToRender = imageUrls.slice(0, 4)

    return (
      <div className="pc-image-container">
        <div className={gridClass}>
          {itemsToRender.map((url, index) => {
            const isFourth = index === 3
            return (
              <div key={index} className="pc-img-wrapper">
                <img src={url} alt={`Upload ${index + 1}`} className="pc-img" />
                {isFourth && showOverlay && (
                  <div className="pc-img-overlay">
                    {overlayText}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderChromeActions = () => {
    if (!platform) return null
    const iconProps = { size: 14 }
    
    switch (platform.group) {
      case 'shortform':
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><Heart {...iconProps} /> 0</span>
            <span className="action-item"><Repeat {...iconProps} /></span>
            <span className="action-item"><Share2 {...iconProps} /></span>
          </div>
        )
      case 'professional':
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><ThumbsUp {...iconProps} /> Like</span>
            <span className="action-item"><MessageSquare {...iconProps} /> Comment</span>
            <span className="action-item"><Share2 {...iconProps} /> Share</span>
          </div>
        )
      case 'community':
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><ChevronUp {...iconProps} /></span>
            <span className="action-separator">·</span>
            <span className="action-item"><ChevronDown {...iconProps} /></span>
            <span className="action-item"><MessageSquare {...iconProps} /> Comments</span>
          </div>
        )
      case 'longform': {
        const readingTime = Math.ceil(post.content.split(' ').length / 200)
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><BookOpen {...iconProps} /> {readingTime} min read</span>
          </div>
        )
      }
      case 'video':
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><PlayCircle {...iconProps} /> Preview</span>
          </div>
        )
      case 'audio':
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><Mic {...iconProps} /> Listen</span>
          </div>
        )
      case 'design':
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><Heart {...iconProps} /> Appreciate</span>
            <span className="action-item"><Bookmark {...iconProps} /> Save</span>
          </div>
        )
      case 'messaging':
        return (
          <div className="pc-chrome-actions">
            <span className="action-item"><Send {...iconProps} /> Send</span>
          </div>
        )
      default:
        return null
    }
  }

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (!isEditing) setEditValue(post.content) }, [post.content, isEditing])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editValue, isEditing])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(post.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    if (!campaignId || downloading) return
    setDownloading(true)
    try {
      const prompt = useAppStore.getState().campaign?.prompt || ''
      const zipBlob = await generateClientZip(
        campaignId,
        prompt,
        [post],
        imageFiles,
        videoFile,
        () => {}
      )

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitize(platform?.name || platformId)}_kit.zip`
      a.click()

      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)

      addToast(`${platform?.name || platformId} kit downloaded`, 'success')
    } catch (err) {
      console.error('Individual ZIP generation failed:', err)
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

  const handleExtraFieldChange = (key: string, value: string) => {
    setExtraFields(prev => ({ ...prev, [key]: value }))
    // Save extra fields to DB via updatePost metadata
    updatePost(platformId, { extraFields: { ...extraFields, [key]: value } })
  }

  const handleRetry = useCallback(async () => {
    updatePost(platformId, { status: 'generating', content: '', errorMessage: undefined })
    try {
      const result = await api.generate.retry(campaignId, platformId)
      updatePost(platformId, { content: result.content, status: 'done' })
      if (result.imageDropped) {
        // The original image was cleaned up by retention — retry succeeded text-only.
        // Show a non-blocking notice so the user knows the result may differ.
        addToast('Image expired — regenerated from text only', 'info')
      }
    } catch (err: any) {
      updatePost(platformId, {
        status: 'error',
        errorMessage: err.message ?? 'Could not generate — try again!',
      })
    }
  }, [platformId, campaignId, updatePost, addToast])


  const shareUrl = platform?.shareUrl(post.content, extraFields)
  const charLimit = platform?.charLimit
  const charCount = post.content.length
  const isOverLimit = charLimit ? charCount > charLimit : false

  if (post.status === 'pending') return <CardSkeleton />
  if (post.status === 'generating') return <CardGenerating name={platform?.name ?? platformId} />
  if (post.status === 'error') return <CardError name={platform?.name ?? platformId} message={post.errorMessage ?? 'Generation failed'} brandColor={platform?.brandColor} onRetry={handleRetry} />

  return (
    <div
      className={`post-card ${isEditing ? 'editing' : ''}`}
      style={{ borderTop: platform?.brandColor ? `3px solid ${platform.brandColor}` : undefined }}
    >
      {/* Header */}
      <div className="pc-header">
        <div className="pc-platform">
          {platform?.brandColor && (
            <span
              className="pc-brand-dot"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: platform.brandColor,
                display: 'inline-block',
                marginRight: '6px',
                flexShrink: 0
              }}
            />
          )}
          <span className="pc-name" style={{ color: platform?.brandColor }}>
            {platform?.name ?? platformId}
          </span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="pc-actions">
          <button className="btn-icon" onClick={onOpenRefinement} title="Refine with AI"><MessageSquare size={13} /></button>
          <button className={`btn-icon ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy text">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button className="btn-icon" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={13} />
          </button>
        </div>
      </div>

      {platform && (
        <div className="pc-profile-row">
          <div className="pc-avatar" style={{ background: platform.brandColor }}>
            <PlatformIcon id={platformId} size={16} color="#ffffff" />
          </div>
          <div className="pc-profile-info">
            <span className="pc-profile-name">Your Name</span>
            <span className="pc-profile-sub">{getProfileSub(platform)}</span>
          </div>
        </div>
      )}

      {/* Extra fields — inside the card, belongs to this platform */}
      {extraFieldDefs.length > 0 && (
        <div className="pc-extra-fields">
          {extraFieldDefs.map(field => (
            <div key={field.key} className="pc-extra-field">
              <label className="pc-extra-label">{field.label}</label>
              <input
                className="pc-extra-input"
                placeholder={field.placeholder}
                value={extraFields[field.key] ?? ''}
                onChange={e => handleExtraFieldChange(field.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Image above content */}
      {platform?.imagePosition === 'above' && renderImageGrid()}

      {/* Content — click to edit */}
      <div className="pc-content" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="pc-textarea"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleEditSave}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck
          />
        ) : (
          <p className="pc-text">{post.content}</p>
        )}
      </div>

      {/* Image below content */}
      {platform?.imagePosition === 'below' && renderImageGrid()}

      {/* Chrome actions row */}
      {renderChromeActions()}

      {/* Footer */}
      <div className="pc-footer">
        {charLimit && (
          <span className={`pc-chars ${isOverLimit ? 'over' : ''}`}>
            {charCount}/{charLimit}
          </span>
        )}
        {isEditing && <span className="pc-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="pc-share">
            Share →
          </a>
        )}
      </div>

      <style>{`
        .post-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          width: 100%;
          min-width: 0;
          transition: border-color var(--transition);
          overflow: hidden;
        }
        .post-card:hover { border-color: var(--border-light); }
        .post-card.editing { border-color: var(--accent); }

        .pc-profile-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px 0;
        }
        .pc-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .pc-profile-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .pc-profile-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-1);
        }
        .pc-profile-sub {
          font-size: 10px;
          color: var(--text-3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pc-brand-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
          flex-shrink: 0;
        }
        .pc-image-container {
          width: 100%;
          overflow: hidden;
          position: relative;
        }
        .pc-image-grid {
          display: grid;
          gap: 2px;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: var(--border);
          overflow: hidden;
        }
        .pc-image-grid.grid-1 {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr;
        }
        .pc-image-grid.grid-2 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr;
        }
        .pc-image-grid.grid-3 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
        }
        .pc-image-grid.grid-3 .pc-img-wrapper:nth-child(1) {
          grid-row: span 2;
        }
        .pc-image-grid.grid-4 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
        }
        .pc-img-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .pc-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pc-img-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          backdrop-filter: blur(2px);
        }
        .pc-chrome-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 8px 14px;
          border-top: 1px solid var(--border);
          opacity: 0.5;
          pointer-events: none;
          font-size: 11px;
          color: var(--text-2);
          user-select: none;
        }
        .pc-chrome-actions .action-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pc-chrome-actions .action-separator {
          color: var(--text-4);
        }

        .pc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
        }
        .pc-platform { display: flex; align-items: center; gap: 6px; }
        .pc-name { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .pc-edited { font-size: 10px; color: var(--accent); background: var(--accent-subtle); padding: 1px 6px; border-radius: 99px; }
        .pc-actions { display: flex; gap: 2px; opacity: 0; transition: opacity var(--transition); }
        .post-card:hover .pc-actions, .post-card.editing .pc-actions { opacity: 1; }
        .btn-icon.copied { color: var(--success); }

        .pc-extra-fields {
          padding: 10px 14px 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pc-extra-field { display: flex; flex-direction: column; gap: 3px; }
        .pc-extra-label { font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .pc-extra-input {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 5px 8px;
          font-size: 12px;
          color: var(--text-1);
          font-family: var(--font-body);
          outline: none;
          transition: border-color var(--transition);
        }
        .pc-extra-input:focus { border-color: var(--accent); }
        .pc-extra-input::placeholder { color: var(--text-4); }

        .pc-content {
          padding: 12px 14px;
          flex: 1;
          cursor: text;
          min-height: 90px;
        }
        .pc-text {
          font-family: var(--font-mono);
          font-size: 12.5px;
          line-height: 1.75;
          color: var(--text-1);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .pc-textarea {
          width: 100%;
          font-family: var(--font-mono);
          font-size: 12.5px;
          line-height: 1.75;
          color: var(--text-1);
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          min-height: 90px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .pc-footer {
          display: flex;
          align-items: center;
          padding: 6px 14px;
          border-top: 1px solid var(--border);
          gap: 8px;
          min-height: 32px;
        }
        .pc-chars { font-size: 10px; color: var(--text-3); font-family: var(--font-mono); }
        .pc-chars.over { color: var(--error); }
        .pc-hint { font-size: 10px; color: var(--text-3); }
        .pc-share { font-size: 11px; color: var(--accent); font-weight: 600; margin-left: auto; }
        .pc-share:hover { text-decoration: underline; }

        /* Skeleton */
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        .shimmer {
          background: linear-gradient(90deg, var(--border) 25%, var(--border-light) 50%, var(--border) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        /* Generating pulse */
        @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        .gen-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent);
          animation: pulse 1s infinite;
        }
        .gen-dot:nth-child(2) { animation-delay: 0.2s; }
        .gen-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, minWidth: 280, maxWidth: 340, flexShrink: 0 }}>
      <div className="shimmer" style={{ height: 11, width: '40%', marginBottom: 14 }} />
      <div className="shimmer" style={{ height: 10, width: '100%', marginBottom: 6 }} />
      <div className="shimmer" style={{ height: 10, width: '88%', marginBottom: 6 }} />
      <div className="shimmer" style={{ height: 10, width: '72%' }} />
    </div>
  )
}

function CardGenerating({ name }: { name: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: 14, minWidth: 280, maxWidth: 340, flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{name}</div>
      <div style={{ display: 'flex', gap: 5, padding: '6px 0 10px' }}>
        <div className="gen-dot" /><div className="gen-dot" /><div className="gen-dot" />
      </div>
      <div className="shimmer" style={{ height: 10, width: '90%', marginBottom: 6 }} />
      <div className="shimmer" style={{ height: 10, width: '75%' }} />
    </div>
  )
}

function CardError({ name, message, brandColor, onRetry }: {
  name: string
  message: string
  brandColor?: string
  onRetry?: () => void
}) {
  const [retrying, setRetrying] = useState(false)

  const handleClick = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    await onRetry()
  }

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderTop: `3px solid ${brandColor ?? 'var(--error)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 14,
      minWidth: 280,
      maxWidth: 340,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: brandColor ?? 'var(--text-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {name}
      </div>
      <div style={{
        display: 'flex',
        gap: 6,
        alignItems: 'flex-start',
        color: 'var(--text-2)',
        fontSize: 12,
        lineHeight: 1.5,
      }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--error)' }} />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={handleClick}
          disabled={retrying}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 14px',
            borderRadius: 'var(--radius)',
            border: `1px solid ${brandColor ?? 'var(--accent)'}`,
            background: 'transparent',
            color: brandColor ?? 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: retrying ? 'not-allowed' : 'pointer',
            opacity: retrying ? 0.5 : 1,
            fontFamily: 'var(--font-body)',
            transition: 'opacity 150ms ease',
          }}
        >
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  )
}

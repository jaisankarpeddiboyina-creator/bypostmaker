import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Copy, Download, Check, AlertCircle, Sparkles } from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { api } from '../../lib/api'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

interface ExtraField {
  key: string
  placeholder: string
  label: string
}

const PLATFORM_EXTRA_FIELDS: Record<string, ExtraField[]> = {
  reddit:       [{ key: 'subreddit', placeholder: 'r/subreddit', label: 'Subreddit' }],
  hackernews:   [{ key: 'url', placeholder: 'https://your-launch-url.com', label: 'Launch URL' }],
  stackoverflow:[{ key: 'url', placeholder: 'https://stackoverflow.com/...', label: 'Question URL' }],
}

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || 'var(--color-primary-start)'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span key={idx} style={{ color, fontWeight: 600 }}>
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

export function StandardCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]
  const extraFieldDefs = PLATFORM_EXTRA_FIELDS[platformId] ?? []

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userName = user?.name || 'Your Brand'
  const handleName = user?.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'yourbrand'
  const brandColor = platform?.brandColor || 'var(--color-primary-start)'

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

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
    addToast(`${platform?.name ?? platformId} post copied`, 'success')
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
      a.download = `${sanitize(platform?.name || platformId)}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast(`${platform?.name || platformId} kit downloaded`, 'success')
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

  const handleExtraFieldChange = (key: string, value: string) => {
    setExtraFields(prev => ({ ...prev, [key]: value }))
    updatePost(platformId, { extraFields: { ...extraFields, [key]: value } })
  }

  const handleRetry = useCallback(async () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    updatePost(platformId, { status: 'generating', content: '', errorMessage: undefined, statusText: 'Retrying...' })

    let active = true
    retryTimeoutRef.current = setTimeout(() => {
      if (active) {
        active = false
        updatePost(platformId, { status: 'error', errorMessage: 'Retry timed out.' })
        addToast('Retry taking longer than expected', 'error')
      }
    }, 45000)

    try {
      const result = await api.generate.retry(campaignId, platformId)
      if (active) {
        active = false
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
        updatePost(platformId, { content: result.content, status: 'done', statusText: undefined })
      }
    } catch (err: any) {
      if (active) {
        active = false
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
        updatePost(platformId, { status: 'error', errorMessage: err.message ?? 'Generation failed' })
      }
    }
  }, [platformId, campaignId, updatePost, addToast])

  const shareUrl = platform?.shareUrl(post.content, extraFields)
  const charLimit = platform?.charLimit
  const charCount = post.content.length
  const isOverLimit = charLimit ? charCount > charLimit : false

  if (post.status === 'pending') return <CardSkeleton statusText={post.statusText} />
  if (post.status === 'generating') return <CardGenerating name={platform?.name ?? platformId} statusText={post.statusText} />
  if (post.status === 'error') return <CardError name={platform?.name ?? platformId} message={post.errorMessage ?? 'Generation failed'} brandColor={brandColor} onRetry={handleRetry} />

  return (
    <div
      className={`post-card glow-card ${isEditing ? 'editing' : ''}`}
      style={{ borderTop: `3px solid ${brandColor}` }}
    >
      <div className="pc-header">
        <div className="pc-platform">
          <PlatformIcon id={platformId} size={15} color={brandColor} />
          <span className="pc-name" style={{ color: brandColor }}>{platform?.name ?? platformId}</span>
          <span className="pc-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="pc-actions">
          <button className="btn-icon" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={13} style={{ color: brandColor }} />
          </button>
          <button className={`btn-icon ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy caption">
            {copied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
          </button>
          <button className="btn-icon" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="pc-profile-row">
        <div className="pc-avatar" style={{ background: brandColor }}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="pc-avatar-img" />
          ) : (
            userName[0].toUpperCase()
          )}
        </div>
        <div className="pc-profile-info">
          <span className="pc-profile-name">{userName}</span>
          <span className="pc-profile-sub">@{handleName} · just now</span>
        </div>
      </div>

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

      {imageUrls.length > 0 && (
        <div className="pc-image-container">
          <div className={`pc-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
            {imageUrls.slice(0, 4).map((url, idx) => (
              <div key={idx} className="pc-img-wrapper">
                <img src={url} alt={`Media ${idx + 1}`} className="pc-img" />
              </div>
            ))}
          </div>
        </div>
      )}

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
          <p className="pc-text">
            <FormattedContent content={post.content} linkColor={brandColor} />
          </p>
        )}
      </div>

      <div className="pc-footer">
        {charLimit && (
          <span className={`pc-chars ${isOverLimit ? 'over' : ''}`}>
            {charCount}/{charLimit} chars
          </span>
        )}
        {isEditing && <span className="pc-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="pc-share" style={{ color: brandColor }}>
            Share to {platform?.name || 'Platform'} →
          </a>
        )}
      </div>

      <style>{`
        .post-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          display: flex; flex-direction: column; width: 100%; min-width: 0;
          transition: all var(--transition); overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .post-card.editing { border-color: var(--color-primary-start); box-shadow: 0 0 0 2px rgba(247, 37, 133, 0.2); }
        .pc-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--color-border); background: rgba(248, 245, 253, 0.3); }
        .pc-platform { display: flex; align-items: center; gap: 6px; }
        .pc-name { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
        .pc-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .pc-edited { font-size: 10px; color: var(--color-primary-start); background: rgba(247,37,133,0.08); padding: 1px 6px; border-radius: 99px; }
        .pc-actions { display: flex; gap: 4px; }
        .pc-profile-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px 4px; }
        .pc-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; font-size: 13px; flex-shrink: 0; overflow: hidden; }
        .pc-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .pc-profile-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .pc-profile-name { font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
        .pc-profile-sub { font-size: 11px; color: var(--color-text-secondary); }
        .pc-extra-fields { padding: 8px 14px 0; display: flex; flex-direction: column; gap: 6px; }
        .pc-extra-field { display: flex; flex-direction: column; gap: 3px; }
        .pc-extra-label { font-size: 10px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; }
        .pc-extra-input { background: var(--color-surface); border: 1px solid var(--color-border-input); border-radius: var(--radius-sm); padding: 5px 8px; font-size: 12px; color: var(--color-text-primary); outline: none; }
        .pc-image-container { width: 100%; overflow: hidden; }
        .pc-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; background: var(--color-border); overflow: hidden; }
        .pc-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .pc-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .pc-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .pc-image-grid.grid-3 .pc-img-wrapper:nth-child(1) { grid-row: span 2; }
        .pc-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .pc-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .pc-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pc-content { padding: 12px 14px; flex: 1; cursor: text; min-height: 80px; }
        .pc-text { font-family: var(--font-body); font-size: 13px; line-height: 1.6; color: var(--color-text-primary); white-space: pre-wrap; word-break: break-word; }
        .pc-textarea { width: 100%; font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; color: var(--color-text-primary); background: #ffffff; border: 1px solid var(--color-primary-start); border-radius: 6px; padding: 8px 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box; white-space: pre-wrap; word-break: break-word; }
        .pc-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-top: 1px solid var(--color-border); margin-top: auto; min-height: 40px; background: #ffffff; gap: 12px; }
        .pc-chars { font-size: 11px; color: #8e8e8e; font-family: var(--font-mono); white-space: nowrap; flex-shrink: 0; }
        .pc-chars.over { color: var(--color-error); font-weight: 700; }
        .pc-hint { font-size: 11px; color: #8e8e8e; white-space: nowrap; }
        .pc-share { font-size: 12px; font-weight: 700; white-space: nowrap; margin-left: auto; flex-shrink: 0; }
        .pc-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

function CardSkeleton({ statusText }: { statusText?: string }) {
  return (
    <div className="glass-panel" style={{ borderRadius: 'var(--radius-card)', padding: 14, minWidth: 280, maxWidth: 340, flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="shimmer" style={{ height: 12, width: '45%' }} />
        {statusText && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{statusText}</span>}
      </div>
      <div className="shimmer" style={{ height: 10, width: '100%', marginBottom: 6 }} />
      <div className="shimmer" style={{ height: 10, width: '85%', marginBottom: 6 }} />
      <div className="shimmer" style={{ height: 10, width: '65%' }} />
    </div>
  )
}

function CardGenerating({ name, statusText }: { name: string; statusText?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-primary-start)', borderRadius: 'var(--radius-card)', padding: 14, minWidth: 280, maxWidth: 340, flexShrink: 0, boxShadow: '0 4px 16px rgba(247,37,133,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary-start)', textTransform: 'uppercase' }}>{name}</div>
        {statusText && <span style={{ fontSize: 11, color: 'var(--color-primary-end)', fontWeight: 600 }}>{statusText}</span>}
      </div>
      <div style={{ display: 'flex', gap: 5, padding: '4px 0 10px' }}>
        <div className="gen-dot" style={{ background: 'var(--color-primary-start)', width: 5, height: 5, borderRadius: '50%' }} />
        <div className="gen-dot" style={{ background: 'var(--color-primary-end)', width: 5, height: 5, borderRadius: '50%' }} />
        <div className="gen-dot" style={{ background: 'var(--color-primary-start)', width: 5, height: 5, borderRadius: '50%' }} />
      </div>
      <div className="shimmer" style={{ height: 10, width: '90%', marginBottom: 6 }} />
      <div className="shimmer" style={{ height: 10, width: '70%' }} />
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
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderTop: `3px solid ${brandColor ?? 'var(--color-error)'}`, borderRadius: 'var(--radius-card)',
      padding: 14, minWidth: 280, maxWidth: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: brandColor ?? 'var(--color-text-primary)', textTransform: 'uppercase' }}>{name}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-error)' }} />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button onClick={handleClick} disabled={retrying} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', borderColor: brandColor ?? 'var(--color-primary-start)', color: brandColor ?? 'var(--color-primary-start)' }}>
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

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
  const brandColor = platform?.brandColor || '#F72585'

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

  const shareUrl = platform?.shareUrl(post.content, extraFields)
  const charLimit = platform?.charLimit
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId={platformId}
      platformName={platform?.name || platformId}
      brandColor={brandColor}
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
      <div className={`std-post-box ${isEditing ? 'editing' : ''}`}>
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
      </div>

      <style>{`
        .std-post-box {
          background: #ffffff; padding: 12px; display: flex; flex-direction: column; gap: 8px; transition: background 150ms ease;
        }
        .std-post-box.editing { background: #F8FAFC; }

        .pc-profile-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
        .pc-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; font-size: 13px; flex-shrink: 0; overflow: hidden; }
        .pc-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .pc-profile-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .pc-profile-name { font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
        .pc-profile-sub { font-size: 11px; color: var(--color-text-secondary); }
        .pc-extra-fields { padding: 4px 0; display: flex; flex-direction: column; gap: 6px; }
        .pc-extra-field { display: flex; flex-direction: column; gap: 3px; }
        .pc-extra-label { font-size: 10px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; }
        .pc-extra-input { background: var(--color-surface); border: 1px solid var(--color-border-input); border-radius: var(--radius-sm); padding: 5px 8px; font-size: 12px; color: var(--color-text-primary); outline: none; }
        .pc-image-container { width: 100%; overflow: hidden; border-radius: 8px; }
        .pc-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; background: var(--color-border); overflow: hidden; }
        .pc-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .pc-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .pc-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .pc-image-grid.grid-3 .pc-img-wrapper:nth-child(1) { grid-row: span 2; }
        .pc-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .pc-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .pc-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pc-content { padding: 4px 0; flex: 1; cursor: text; min-height: 60px; }
        .pc-text { font-family: var(--font-body); font-size: 13px; line-height: 1.6; color: var(--color-text-primary); white-space: pre-wrap; word-break: break-word; margin: 0; }
        .pc-textarea { width: 100%; font-family: var(--font-body); font-size: 13.5px; line-height: 1.55; color: var(--color-text-primary); background: #ffffff; border: 1px solid var(--color-primary-start); border-radius: 6px; padding: 8px 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box; white-space: pre-wrap; word-break: break-word; }
      `}</style>
    </UnifiedCardShell>
  )
}

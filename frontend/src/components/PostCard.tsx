import { useState, useRef, useEffect } from 'react'
import { Copy, Download, MessageSquare, Check, AlertCircle } from 'lucide-react'
import { PLATFORM_MAP } from '../config/platforms'
import { useAppStore, type PlatformPost } from '../store/app'
import { api } from '../lib/api'

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

interface PostCardProps {
  platformId: string
  post: PlatformPost
  campaignId: string
  imageFile: File | null
  videoFile: File | null
  onOpenRefinement: () => void
}

export function PostCard({ platformId, post, campaignId, imageFile, videoFile, onOpenRefinement }: PostCardProps) {
  const { updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]
  const extraFieldDefs = PLATFORM_EXTRA_FIELDS[platformId] ?? []

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
      await api.download.kit(campaignId, imageFile, videoFile, platformId)
    } catch {
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

  const shareUrl = platform?.shareUrl(post.content, extraFields)
  const charLimit = platform?.charLimit
  const charCount = post.content.length
  const isOverLimit = charLimit ? charCount > charLimit : false

  if (post.status === 'pending') return <CardSkeleton />
  if (post.status === 'generating') return <CardGenerating name={platform?.name ?? platformId} />
  if (post.status === 'error') return <CardError name={platform?.name ?? platformId} message={post.errorMessage ?? 'Generation failed'} />

  return (
    <div className={`post-card ${isEditing ? 'editing' : ''}`}>
      {/* Header */}
      <div className="pc-header">
        <div className="pc-platform">
          <span className="pc-name">{platform?.name ?? platformId}</span>
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

function CardError({ name, message }: { name: string; message: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--error)', borderRadius: 'var(--radius-lg)', padding: 14, minWidth: 280, maxWidth: 340, flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{name}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--error)', fontSize: 12 }}>
        <AlertCircle size={13} /><span>{message}</span>
      </div>
    </div>
  )
}

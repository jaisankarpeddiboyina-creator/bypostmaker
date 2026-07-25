import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Rocket
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FF5A5F'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="bl-tag-text"
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

export function BetaListCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Startup Name'

  // Extract Startup Name & Tagline
  const lines = post.content.split('\n').filter(Boolean)
  const startupTitle = lines[0] || userName
  const taglineText = lines.slice(1).join('\n\n').trim()

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
    addToast('BetaList startup text copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'BetaList')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('BetaList kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 140
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="betalist"
      platformName="BetaList"
      brandColor="#FF5A5F"
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
      {/* Authentic 1:1 BetaList Startup Launch Card */}
      <div className={`bl-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Startup Screenshot Frame */}
        <div className="bl-media-frame">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Startup preview" className="bl-startup-img" />
          ) : (
            <div className="bl-placeholder-canvas">
              <Rocket size={36} color="#FF5A5F" />
              <span>Upload Startup Landing Page Screenshot</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="bl-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="bl-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <>
              <h2 className="bl-startup-title">{startupTitle}</h2>
              {taglineText && (
                <p className="bl-tagline">
                  <FormattedContent content={taglineText} linkColor="#FF5A5F" />
                </p>
              )}
            </>
          )}
        </div>

        {/* Access CTA Bar */}
        <div className="bl-cta-bar">
          <button className="bl-access-btn">Get Early Access</button>
        </div>
      </div>

      <style>{`
        .bl-post-box {
          background: #ffffff; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: background 150ms ease;
        }
        .bl-post-box.editing { background: #F8FAFC; }

        .bl-media-frame { width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #fafafa; border: 1px solid #f0f0f0; }
        .bl-startup-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .bl-placeholder-canvas {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: #94a3b8; font-size: 12px; font-weight: 600;
        }

        .bl-body { cursor: text; }
        .bl-startup-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .bl-tagline { font-size: 14px; line-height: 1.45; color: #475569; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; white-space: pre-wrap; word-break: break-word; }
        .bl-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.45; color: #0f172a; background: #ffffff; border: 1.5px solid #FF5A5F;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .bl-cta-bar { display: flex; justify-content: flex-end; padding-top: 4px; }
        .bl-access-btn {
          background: #FF5A5F; color: #ffffff; border: none; font-weight: 700; font-size: 12.5px;
          padding: 8px 18px; border-radius: 8px; cursor: pointer; transition: background 120ms ease;
        }
        .bl-access-btn:hover { background: #e04b50; }
      `}</style>
    </UnifiedCardShell>
  )
}

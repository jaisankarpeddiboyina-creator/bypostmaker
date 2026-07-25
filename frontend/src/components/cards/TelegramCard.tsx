import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Eye
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#2481CC'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="tg-hashtag-text"
            style={{ color, fontWeight: 600, cursor: 'pointer' }}
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

export function TelegramCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Channel'

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
    addToast('Telegram message copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Telegram')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Telegram kit downloaded', 'success')
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
  const charLimit = platform?.charLimit || 4096
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="telegram"
      platformName="Telegram"
      brandColor="#26A5E4"
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
      {/* Authentic 1:1 Telegram Post Bubble */}
      <div className={`tg-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Channel Name Line */}
        <div className="tg-channel-header">
          <span className="tg-channel-name">{userName}</span>
          <span className="tg-verified-check">✔</span>
        </div>

        {/* Media Frame Grid */}
        {imageUrls.length > 0 && (
          <div className="tg-media-container">
            <div className={`tg-image-grid grid-${Math.min(imageUrls.length, 4)}`}>
              {imageUrls.slice(0, 4).map((url, idx) => (
                <div key={idx} className="tg-img-wrapper">
                  <img src={url} alt={`Media ${idx + 1}`} className="tg-img" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="tg-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="tg-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="tg-text">
              <FormattedContent content={post.content} linkColor="#2481CC" />
            </p>
          )}

          {/* Telegram Floating Timestamp & View Counter inside Bubble */}
          <div className="tg-bubble-meta">
            <Eye size={12} color="#707579" />
            <span className="tg-views-count">1</span>
            <span className="tg-time">15:42</span>
          </div>
        </div>
      </div>

      <style>{`
        .tg-post-box {
          background: #ffffff; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; transition: background 150ms ease;
        }
        .tg-post-box.editing { background: #F8FAFC; }

        .tg-channel-header { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
        .tg-channel-name { font-weight: 700; font-size: 14px; color: #2481CC; }
        .tg-verified-check { font-size: 11px; color: #2481CC; }

        .tg-media-container { width: 100%; border-radius: 8px; overflow: hidden; margin: 4px 0; border: 1px solid #f0f0f0; }
        .tg-image-grid { display: grid; gap: 2px; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
        .tg-image-grid.grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
        .tg-image-grid.grid-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
        .tg-image-grid.grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .tg-image-grid.grid-3 .tg-img-wrapper:nth-child(1) { grid-row: span 2; }
        .tg-image-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .tg-img-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .tg-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .tg-body { position: relative; cursor: text; padding-bottom: 16px; }
        .tg-text {
          font-size: 14.5px; line-height: 1.45; color: #000000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .tg-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14.5px; line-height: 1.45; color: #000000; background: #ffffff; border: 1.5px solid #26A5E4;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .tg-bubble-meta {
          position: absolute; bottom: 0; right: 0; display: flex; align-items: center; gap: 4px; font-size: 11px; color: #707579;
        }
        .tg-views-count { font-weight: 500; }
        .tg-time { font-size: 11px; }
      `}</style>
    </UnifiedCardShell>
  )
}

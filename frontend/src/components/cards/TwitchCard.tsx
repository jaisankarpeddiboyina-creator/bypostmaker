import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Users, Radio
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#9146FF'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="tw-tag-text"
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

export function TwitchCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Twitch Streamer'

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
    addToast('Twitch stream title copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Twitch')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Twitch kit downloaded', 'success')
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
      platformId="twitch"
      platformName="Twitch"
      brandColor="#9146FF"
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
      {/* Authentic 1:1 Twitch Stream Card */}
      <div className={`tw-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Stream Preview Thumbnail */}
        <div className="tw-thumbnail-frame">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Stream preview" className="tw-stream-img" />
          ) : (
            <div className="tw-placeholder-stream">
              <Radio size={36} color="#9146FF" />
              <span>Offline Stream Preview</span>
            </div>
          )}

          <div className="tw-live-badge">
            <span className="tw-live-dot"></span>
            <span>LIVE</span>
          </div>

          <div className="tw-viewers-pill">
            <Users size={12} color="#ffffff" />
            <span>1.2K</span>
          </div>
        </div>

        {/* Stream Metadata Info */}
        <div className="tw-stream-meta">
          <div className="tw-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="tw-avatar-img" />
            ) : (
              userName[0].toUpperCase()
            )}
          </div>

          <div className="tw-info-col">
            <span className="tw-user-name">{userName}</span>

            {/* Stream Title Text Body */}
            <div className="tw-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="tw-edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  spellCheck
                />
              ) : (
                <p className="tw-text">
                  <FormattedContent content={post.content} linkColor="#9146FF" />
                </p>
              )}
            </div>

            <div className="tw-category-row">
              <span className="tw-category-tag">Software & Tech</span>
              <span className="tw-tag-pill">English</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tw-post-box {
          background: #ffffff; padding: 14px; display: flex; flex-direction: column; gap: 12px; transition: background 150ms ease;
        }
        .tw-post-box.editing { background: #F8FAFC; }

        .tw-thumbnail-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #18181b; }
        .tw-stream-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tw-placeholder-stream {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: #adadb8; font-size: 12px; font-weight: 600;
        }

        .tw-live-badge {
          position: absolute; top: 10px; left: 10px; background: #eb0400; color: #ffffff;
          font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px;
        }
        .tw-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #ffffff; }

        .tw-viewers-pill {
          position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.75); color: #ffffff;
          font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px;
        }

        .tw-stream-meta { display: flex; gap: 10px; }
        .tw-avatar {
          width: 38px; height: 38px; border-radius: 50%; background: #9146FF; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
        }
        .tw-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .tw-info-col { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 2px; }
        .tw-user-name { font-weight: 700; font-size: 14px; color: #0e0e10; }

        .tw-body { cursor: text; margin: 2px 0; }
        .tw-text {
          font-size: 13.5px; font-weight: 600; line-height: 1.4; color: #0e0e10;
          font-family: Roobert, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .tw-edit-textarea {
          width: 100%; font-family: Roobert, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13.5px; font-weight: 600; line-height: 1.4; color: #0e0e10; background: #ffffff; border: 1.5px solid #9146FF;
          border-radius: 6px; padding: 6px; outline: none; resize: vertical; min-height: 70px; box-sizing: border-box;
        }

        .tw-category-row { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
        .tw-category-tag { font-size: 12px; font-weight: 600; color: #53535f; }
        .tw-tag-pill { font-size: 11px; font-weight: 600; color: #53535f; background: #f2f2f5; padding: 1px 6px; border-radius: 99px; }
      `}</style>
    </UnifiedCardShell>
  )
}

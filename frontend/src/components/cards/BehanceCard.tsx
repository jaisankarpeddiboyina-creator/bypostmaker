import { useState, useRef, useEffect, useMemo } from 'react'
import {
  ThumbsUp, Eye
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0057FF'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="be-tag-text"
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

export function BehanceCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Appreciation Counter
  const [appreciated, setAppreciated] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Creative Director'

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
    addToast('Behance project text copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Behance')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Behance kit downloaded', 'success')
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

  const toggleAppreciate = () => {
    setAppreciated(prev => !prev)
    setLikeCount(prev => (appreciated ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 10000
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="behance"
      platformName="Behance"
      brandColor="#0057FF"
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
      {/* Authentic 1:1 Behance Portfolio Project Card */}
      <div className={`be-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Cover Canvas Frame */}
        <div className="be-media-frame">
          {imageUrls.length > 0 ? (
            <img src={imageUrls[0]} alt="Project preview" className="be-project-img" />
          ) : (
            <div className="be-placeholder-canvas">
              <PlatformIcon id="behance" size={48} color="#0057FF" />
              <span>Upload Portfolio Case Study Cover</span>
            </div>
          )}
        </div>

        {/* Project Meta Info */}
        <div className="be-project-meta">
          <div className="be-author-row">
            <div className="be-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="be-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <div className="be-author-details">
              <span className="be-user-name">{userName}</span>
              <span className="be-role">Multiple Owners</span>
            </div>
          </div>

          <div className="be-stats-row">
            <button className={`be-stat-btn ${appreciated ? 'liked' : ''}`} onClick={toggleAppreciate}>
              <ThumbsUp size={14} fill={appreciated ? '#0057FF' : 'none'} color={appreciated ? '#0057FF' : '#696969'} />
              {likeCount > 0 && <span className="be-count">{likeCount}</span>}
            </button>
            <div className="be-stat-pill">
              <Eye size={14} color="#696969" />
              <span className="be-count">0</span>
            </div>
          </div>
        </div>

        {/* Description Body */}
        <div className="be-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="be-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <p className="be-text">
              <FormattedContent content={post.content} linkColor="#0057FF" />
            </p>
          )}
        </div>
      </div>

      <style>{`
        .be-post-box {
          background: #ffffff; padding: 14px; display: flex; flex-direction: column; gap: 12px; transition: background 150ms ease;
        }
        .be-post-box.editing { background: #F8FAFC; }

        .be-media-frame { width: 100%; aspect-ratio: 16 / 10; border-radius: 8px; overflow: hidden; background: #f4f4f4; border: 1px solid #eeeeee; }
        .be-project-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .be-placeholder-canvas {
          width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: #696969; font-size: 12px; font-weight: 600;
        }

        .be-project-meta { display: flex; align-items: center; justify-content: space-between; }
        .be-author-row { display: flex; align-items: center; gap: 8px; }
        .be-avatar {
          width: 28px; height: 28px; border-radius: 50%; background: #0057FF; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 12px; flex-shrink: 0; overflow: hidden;
        }
        .be-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .be-author-details { display: flex; flex-direction: column; }
        .be-user-name { font-weight: 700; font-size: 13px; color: #191919; }
        .be-role { font-size: 11px; color: #696969; }

        .be-stats-row { display: flex; align-items: center; gap: 10px; }
        .be-stat-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; padding: 2px; }
        .be-stat-pill { display: flex; align-items: center; gap: 4px; }
        .be-count { font-size: 12px; font-weight: 600; color: #696969; }

        .be-body { cursor: text; }
        .be-text {
          font-size: 13.5px; line-height: 1.45; color: #191919;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: pre-wrap; word-break: break-word;
        }
        .be-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13.5px; line-height: 1.45; color: #191919; background: #ffffff; border: 1.5px solid #0057FF;
          border-radius: 8px; padding: 8px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }
      `}</style>
    </UnifiedCardShell>
  )
}

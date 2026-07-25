import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, Triangle
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#DA552F'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="ph-hashtag-text"
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

export function ProductHuntCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Upvote State
  const [upvoted, setUpvoted] = useState(false)
  const [upvoteCount, setUpvoteCount] = useState(1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name || 'Your Launch'

  // Extract title and tagline
  const lines = post.content.split('\n')
  const titleText = lines[0] || 'Product Name'
  const taglineText = lines.slice(1).join(' ').trim() || 'The best way to build social posts.'

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
    addToast('Product Hunt post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Product Hunt')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Product Hunt kit downloaded', 'success')
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

  const toggleUpvote = () => {
    setUpvoted(prev => !prev)
    setUpvoteCount(prev => (upvoted ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charLimit = platform?.charLimit || 1000
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="producthunt"
      platformName="Product Hunt"
      brandColor="#DA552F"
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
      {/* Authentic 1:1 Product Hunt Post Box */}
      <div className={`ph-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Top Product Hero Row */}
        <div className="ph-product-row">
          {/* Logo / Thumbnail */}
          <div className="ph-logo-box">
            {imageUrls.length > 0 ? (
              <img src={imageUrls[0]} alt="Product Logo" className="ph-logo-img" />
            ) : (
              <PlatformIcon id="producthunt" size={28} color="#DA552F" />
            )}
          </div>

          {/* Details Body */}
          <div className="ph-details" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="ph-edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                autoFocus
                spellCheck
              />
            ) : (
              <>
                <div className="ph-title-line">
                  <h3 className="ph-title">{titleText}</h3>
                  <span className="ph-maker-badge">MAKER</span>
                </div>
                <p className="ph-tagline">
                  <FormattedContent content={taglineText} linkColor="#DA552F" />
                </p>
                <div className="ph-tags-row">
                  <span className="ph-tag">PROMOTED</span>
                  <span className="ph-tag">AI</span>
                  <span className="ph-tag">DESIGN</span>
                </div>
              </>
            )}
          </div>

          {/* Vertical Upvote Button */}
          <button
            className={`ph-upvote-btn ${upvoted ? 'upvoted' : ''}`}
            type="button"
            onClick={toggleUpvote}
          >
            <Triangle size={14} className="ph-triangle" fill={upvoted ? '#ffffff' : '#4b587c'} />
            <span className="ph-vote-count">{upvoteCount}</span>
          </button>
        </div>

        {/* Comment Action Bar */}
        <div className="ph-footer-actions">
          <div className="ph-maker-profile">
            <div className="ph-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="ph-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <span className="ph-user-name">Posted by {userName}</span>
          </div>

          <div className="ph-comment-pill">
            <MessageSquare size={14} color="#4b587c" />
            <span>Discuss</span>
          </div>
        </div>
      </div>

      <style>{`
        .ph-post-box {
          background: #ffffff; padding: 16px; display: flex; flex-direction: column; gap: 14px; transition: background 150ms ease;
        }
        .ph-post-box.editing { background: #F8FAFC; }

        .ph-product-row { display: flex; align-items: flex-start; gap: 14px; }
        .ph-logo-box {
          width: 52px; height: 52px; border-radius: 10px; border: 1px solid #e8e8e8; background: #fff5f2;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
        }
        .ph-logo-img { width: 100%; height: 100%; object-fit: cover; }

        .ph-details { display: flex; flex-direction: column; flex: 1; min-width: 0; cursor: text; }
        .ph-title-line { display: flex; align-items: center; gap: 6px; }
        .ph-title { font-size: 16px; font-weight: 700; color: #2b2d42; margin: 0; }
        .ph-maker-badge {
          font-size: 9px; font-weight: 800; color: #DA552F; background: #fff0ec; padding: 2px 6px; border-radius: 4px;
        }
        .ph-tagline { font-size: 13.5px; color: #4b587c; line-height: 1.4; margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
        .ph-tags-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
        .ph-tag { font-size: 10px; font-weight: 600; color: #4b587c; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }

        .ph-upvote-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
          min-width: 52px; height: 54px; border-radius: 10px; border: 1px solid #e8e8e8; background: #ffffff;
          cursor: pointer; transition: all 150ms ease; flex-shrink: 0;
        }
        .ph-upvote-btn:hover { border-color: #DA552F; background: #fff5f2; }
        .ph-upvote-btn.upvoted { background: #DA552F; border-color: #DA552F; color: #ffffff; }
        .ph-upvote-btn.upvoted .ph-triangle { fill: #ffffff; }
        .ph-vote-count { font-size: 13px; font-weight: 700; color: inherit; }

        .ph-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px; line-height: 1.45; color: #2b2d42; background: #ffffff; border: 1.5px solid #DA552F;
          border-radius: 8px; padding: 10px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box;
        }

        .ph-footer-actions {
          display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #f1f5f9;
        }
        .ph-maker-profile { display: flex; align-items: center; gap: 6px; }
        .ph-avatar {
          width: 20px; height: 20px; border-radius: 50%; background: #DA552F; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 10px; flex-shrink: 0; overflow: hidden;
        }
        .ph-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .ph-user-name { font-size: 12px; color: #4b587c; font-weight: 500; }
        .ph-comment-pill { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #4b587c; cursor: pointer; }
      `}</style>
    </UnifiedCardShell>
  )
}

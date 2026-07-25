import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Triangle
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'
import { UnifiedCardShell } from './UnifiedCardShell'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FF6600'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
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

export function HackerNewsCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Live Upvote State
  const [voted, setVoted] = useState(false)
  const [points, setPoints] = useState(1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'yourbrand'
  const launchUrl = post.extraFields?.url || 'https://yourproduct.com'
  
  // Extract title and text
  const lines = post.content.split('\n')
  const titleText = lines[0] || 'Show HN: Brand - Your product launch title'
  const bodyText = lines.slice(1).join('\n').trim()

  // Clean domain extraction
  let domain = 'yourproduct.com'
  try {
    const parsed = new URL(launchUrl)
    domain = parsed.hostname.replace(/^www\./, '')
  } catch {
    domain = 'yourproduct.com'
  }

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
    addToast('Hacker News post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'HackerNews')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Hacker News kit downloaded', 'success')
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

  const toggleVote = () => {
    setVoted(prev => !prev)
    setPoints(prev => (voted ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, post.extraFields)
  const charLimit = platform?.charLimit || 2000
  const charCount = post.content.length

  return (
    <UnifiedCardShell
      platformId="hackernews"
      platformName="Hacker News"
      brandColor="#FF6600"
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
      {/* Authentic 1:1 Hacker News Retro Orange Container */}
      <div className={`hn-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Hacker News Header Banner */}
        <div className="hn-banner">
          <div className="hn-logo-badge">Y</div>
          <span className="hn-banner-title">Hacker News</span>
          <div className="hn-banner-links">
            <span>new</span> | <span>past</span> | <span>comments</span> | <span>ask</span> | <span>show</span> | <span>jobs</span> | <span>submit</span>
          </div>
        </div>

        {/* Story Row */}
        <div className="hn-story-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="hn-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="hn-row">
              <span className="hn-rank">1.</span>
              <button
                className={`hn-vote-triangle ${voted ? 'voted' : ''}`}
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleVote(); }}
                title="Upvote"
              >
                <Triangle size={10} fill={voted ? '#FF6600' : '#828282'} color="transparent" />
              </button>
              
              <div className="hn-story-content">
                <div className="hn-title-line">
                  <span className="hn-title">{titleText}</span>
                  <span className="hn-domain">({domain})</span>
                </div>
                
                <div className="hn-subtext">
                  <span>{points} point{points !== 1 ? 's' : ''} by {userName} just now</span>
                  <span className="hn-sep">|</span>
                  <span>hide</span>
                  <span className="hn-sep">|</span>
                  <span className="hn-discuss">discuss</span>
                </div>

                {bodyText && (
                  <div className="hn-text-comment">
                    <FormattedContent content={bodyText} linkColor="#FF6600" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .hn-post-box {
          background: #f6f6ef; overflow: hidden; display: flex; flex-direction: column; transition: background 150ms ease;
        }
        .hn-post-box.editing { background: #ffffff; }

        .hn-banner {
          background: #ff6600; padding: 6px 10px; display: flex; align-items: center; gap: 8px; color: #222222; font-family: Verdana, Geneva, sans-serif;
        }
        .hn-logo-badge {
          width: 18px; height: 18px; border: 1px solid #ffffff; color: #ffffff; font-weight: bold;
          font-size: 13px; display: flex; align-items: center; justify-content: center; line-height: 1;
        }
        .hn-banner-title { font-weight: bold; font-size: 13px; color: #222222; }
        .hn-banner-links { font-size: 11px; color: #222222; margin-left: auto; }

        .hn-story-body { padding: 12px 14px; cursor: text; font-family: Verdana, Geneva, sans-serif; }
        .hn-row { display: flex; align-items: flex-start; gap: 6px; }
        .hn-rank { font-size: 13px; color: #828282; }
        .hn-vote-triangle {
          background: transparent; border: none; padding: 2px 0 0; cursor: pointer; margin-top: 3px;
        }

        .hn-story-content { display: flex; flex-direction: column; gap: 3px; flex: 1; }
        .hn-title-line { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .hn-title { font-size: 14px; color: #000000; line-height: 1.3; }
        .hn-domain { font-size: 11px; color: #828282; }
        
        .hn-subtext { font-size: 10px; color: #828282; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .hn-sep { color: #828282; }
        .hn-discuss { color: #828282; cursor: pointer; }
        .hn-discuss:hover { text-decoration: underline; }

        .hn-text-comment {
          margin-top: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid #e0e0d5; border-radius: 4px;
          font-size: 12.5px; line-height: 1.45; color: #222222; white-space: pre-wrap; word-break: break-word;
        }
        .hn-edit-textarea {
          width: 100%; font-family: Verdana, Geneva, sans-serif; font-size: 13px; line-height: 1.45;
          color: #222222; background: #ffffff; border: 1.5px solid #FF6600; border-radius: 6px; padding: 10px;
          outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }
      `}</style>
    </UnifiedCardShell>
  )
}

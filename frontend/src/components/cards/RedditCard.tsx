import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, MoreHorizontal, ArrowUp, ArrowDown,
  MessageSquare, Share2, ChevronLeft, ChevronRight
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#FF4500'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('r/') || part.startsWith('u/') || part.startsWith('#')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="rd-hashtag-text"
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

export function RedditCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [activeImgIdx, setActiveImgIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Live Card States (Clean 1 Score Baseline for Reddit initial self-upvote)
  const [voteState, setVoteState] = useState<'up' | 'down' | 'none'>('up')
  const [scoreCount, setScoreCount] = useState(1)
  const [joined, setJoined] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const subreddit = post.extraFields?.subreddit || 'r/socialmedia'
  const authorName = user?.name ? `u/${user.name.toLowerCase().replace(/\s+/g, '')}` : 'u/yourbrand'

  // Extract title and body
  const lines = post.content.split('\n')
  const titleText = lines[0] || 'Share your post title here...'
  const bodyText = lines.slice(1).join('\n').trim()

  useEffect(() => {
    if (!platform || platform.maxImages === 0 || platform.imagePosition === 'none' || imageFiles.length === 0) {
      setImageUrls([])
      return
    }
    const urls = imageFiles.slice(0, platform.maxImages).map((f: File) => URL.createObjectURL(f))
    setImageUrls(urls)
    setActiveImgIdx(0)
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
    addToast('Reddit post copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'Reddit')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('Reddit kit downloaded', 'success')
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
    if (voteState === 'up') {
      setVoteState('none')
      setScoreCount(prev => prev - 1)
    } else {
      setScoreCount(prev => (voteState === 'down' ? prev + 2 : prev + 1))
      setVoteState('up')
    }
  }

  const toggleDownvote = () => {
    if (voteState === 'down') {
      setVoteState('none')
      setScoreCount(prev => prev + 1)
    } else {
      setScoreCount(prev => (voteState === 'up' ? prev - 2 : prev - 1))
      setVoteState('down')
    }
  }

  const shareUrl = platform?.shareUrl(post.content, post.extraFields)
  const charLimit = platform?.charLimit || 40000
  const charCount = post.content.length

  return (
    <div className="rd-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="rd-control-bar">
        <div className="rd-control-platform">
          <PlatformIcon id="reddit" size={15} color="#FF4500" />
          <span className="rd-control-title">Reddit</span>
          <span className="rd-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="rd-control-actions">
          <button className="rd-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#FF4500" />
            <span>Refine</span>
          </button>
          <button className={`rd-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy post">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="rd-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 Reddit Light Post Container */}
      <div className={`rd-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Subreddit & User Header */}
        <div className="rd-header">
          <div className="rd-sub-icon">
            <PlatformIcon id="reddit" size={18} color="#ffffff" />
          </div>
          <div className="rd-header-details">
            <div className="rd-sub-line">
              <span className="rd-sub-name">{subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`}</span>
              <span className="rd-dot">•</span>
              <span className="rd-time">Just now</span>
            </div>
            <div className="rd-author-line">
              <span className="rd-author">{authorName}</span>
            </div>
          </div>
          <button
            className={`rd-join-btn ${joined ? 'joined' : ''}`}
            type="button"
            onClick={() => setJoined(p => !p)}
          >
            {joined ? 'Joined' : 'Join'}
          </button>
          <MoreHorizontal size={18} className="rd-more" />
        </div>

        {/* Title Line & Text Content Area */}
        <div className="rd-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="rd-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <>
              <h3 className="rd-title">{titleText}</h3>
              {bodyText && (
                <div className="rd-text">
                  <FormattedContent content={bodyText} linkColor="#FF4500" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Reddit Image Carousel Frame */}
        {imageUrls.length > 0 && (
          <div className="rd-media-frame">
            <img src={imageUrls[activeImgIdx]} alt={`Media ${activeImgIdx + 1}`} className="rd-media-img" />

            {imageUrls.length > 1 && (
              <>
                {activeImgIdx > 0 && (
                  <button
                    className="rd-carousel-btn prev"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i - 1); }}
                  >
                    <ChevronLeft size={18} color="#ffffff" />
                  </button>
                )}
                {activeImgIdx < imageUrls.length - 1 && (
                  <button
                    className="rd-carousel-btn next"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveImgIdx(i => i + 1); }}
                  >
                    <ChevronRight size={18} color="#ffffff" />
                  </button>
                )}
                <div className="rd-carousel-dots">
                  {imageUrls.map((_, idx) => (
                    <span
                      key={idx}
                      className={`rd-dot-item ${idx === activeImgIdx ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActiveImgIdx(idx); }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Reddit Pill Action Bar (Upvote/Downvote, Comment, Crosspost, Share) */}
        <div className="rd-pill-actions-bar">
          {/* Vote Pill */}
          <div className={`rd-action-pill vote-pill ${voteState}`}>
            <button className={`rd-vote-btn up ${voteState === 'up' ? 'active' : ''}`} onClick={toggleUpvote} title="Upvote">
              <ArrowUp size={16} />
            </button>
            <span className="rd-score">{scoreCount}</span>
            <button className={`rd-vote-btn down ${voteState === 'down' ? 'active' : ''}`} onClick={toggleDownvote} title="Downvote">
              <ArrowDown size={16} />
            </button>
          </div>

          {/* Comment Pill */}
          <div className="rd-action-pill">
            <MessageSquare size={15} />
            <span>Comment</span>
          </div>

          {/* Share Pill */}
          <div className="rd-action-pill">
            <Share2 size={15} />
            <span>Share</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="rd-footer-bar">
        <span className="rd-footer-chars">
          {charCount}/{charLimit} chars
        </span>
        {isEditing && <span className="rd-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="rd-footer-share">
            Post to Reddit →
          </a>
        )}
      </div>

      <style>{`
        .rd-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 520px; margin: 0 auto; gap: 8px;
        }
        .rd-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .rd-control-platform { display: flex; align-items: center; gap: 6px; }
        .rd-control-title { font-size: 12px; font-weight: 800; color: #FF4500; text-transform: uppercase; letter-spacing: 0.04em; }
        .rd-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .rd-control-actions { display: flex; align-items: center; gap: 6px; }
        .rd-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .rd-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .rd-post-box {
          background: #ffffff; border: 1px solid #ccc; border-radius: 16px; padding: 14px; overflow: hidden;
          display: flex; flex-direction: column; gap: 10px; color: #1c1c1c; box-shadow: 0 2px 10px rgba(0,0,0,0.04); transition: border-color 150ms ease;
        }
        .rd-post-box.editing { border-color: #FF4500; box-shadow: 0 0 0 2px rgba(255, 69, 0, 0.25); }

        .rd-header { display: flex; align-items: center; gap: 10px; }
        .rd-sub-icon {
          width: 32px; height: 32px; border-radius: 50%; background: #FF4500; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
        }
        .rd-header-details { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .rd-sub-line { display: flex; align-items: center; gap: 4px; font-size: 13px; }
        .rd-sub-name { font-weight: 700; color: #1c1c1c; }
        .rd-dot { color: #787c7e; font-size: 11px; }
        .rd-time { color: #787c7e; font-size: 12px; }
        .rd-author-line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #787c7e; }
        .rd-author { color: #787c7e; }

        .rd-join-btn {
          background: #0079d3; color: #ffffff; border: none; font-weight: 700; font-size: 12px; padding: 5px 14px;
          border-radius: 99px; cursor: pointer; transition: background 150ms ease;
        }
        .rd-join-btn:hover { background: #005fa3; }
        .rd-join-btn.joined { background: #eaedef; color: #1c1c1c; }
        .rd-more { color: #787c7e; cursor: pointer; }

        .rd-body { cursor: text; }
        .rd-title {
          font-size: 17px; font-weight: 700; color: #1c1c1c; line-height: 1.35; margin: 0 0 6px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .rd-text {
          font-size: 14px; line-height: 1.5; color: #222222; white-space: pre-wrap; word-break: break-word;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .rd-edit-textarea {
          width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px; line-height: 1.5; color: #1c1c1c; background: #ffffff; border: 1.5px solid #FF4500; border-radius: 8px;
          padding: 10px; outline: none; resize: vertical; min-height: 100px; box-sizing: border-box;
        }

        .rd-media-frame {
          position: relative; width: 100%; border-radius: 14px; overflow: hidden; background: #f6f7f8;
          display: flex; align-items: center; justify-content: center; max-height: 480px; border: 1px solid #edeff1;
        }
        .rd-media-img { width: 100%; height: auto; max-height: 480px; object-fit: contain; display: block; }
        .rd-carousel-btn {
          position: absolute; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border-radius: 50%;
          background: rgba(0, 0, 0, 0.65); border: none; display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 10; transition: background 150ms ease;
        }
        .rd-carousel-btn:hover { background: rgba(0, 0, 0, 0.9); }
        .rd-carousel-btn.prev { left: 10px; }
        .rd-carousel-btn.next { right: 10px; }
        .rd-carousel-dots {
          position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 5px;
          z-index: 10; padding: 4px 8px; border-radius: 12px; background: rgba(0, 0, 0, 0.6);
        }
        .rd-dot-item { width: 5px; height: 5px; border-radius: 50%; background: rgba(255, 255, 255, 0.4); cursor: pointer; }
        .rd-dot-item.active { background: #FF4500; width: 7px; height: 7px; }

        .rd-pill-actions-bar { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
        .rd-action-pill {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px;
          background: #eaedef; font-size: 12px; font-weight: 600; color: #1c1c1c; cursor: pointer; transition: background 120ms ease;
        }
        .rd-action-pill:hover { background: #d7dedf; }
        
        .vote-pill { padding: 4px 8px; gap: 4px; }
        .vote-pill.up { color: #ff4500; }
        .vote-pill.down { color: #7193ff; }
        .rd-vote-btn {
          background: transparent; border: none; color: #787c7e; cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 2px; border-radius: 50%; transition: color 120ms ease;
        }
        .rd-vote-btn.up:hover, .rd-vote-btn.up.active { color: #ff4500; }
        .rd-vote-btn.down:hover, .rd-vote-btn.down.active { color: #7193ff; }
        .rd-score { font-size: 12px; font-weight: 700; min-width: 18px; text-align: center; }

        .rd-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .rd-footer-chars { font-size: 11.5px; color: #666666; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .rd-footer-hint { font-size: 11px; color: #666666; white-space: nowrap; }
        .rd-footer-share { font-size: 12.5px; font-weight: 700; color: #FF4500; text-decoration: none; }
        .rd-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

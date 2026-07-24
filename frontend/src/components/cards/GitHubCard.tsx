import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Copy, Download, Check, Sparkles, Star, GitFork, Tag
} from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { generateClientZip, sanitize } from '../../lib/downloadKit'
import type { CardProps } from './types'

function FormattedContent({ content, linkColor }: { content: string; linkColor?: string }) {
  const color = linkColor || '#0969DA'
  const elements = useMemo(() => {
    const parts = content.split(/(\s+)/)
    return parts.map((part, idx) => {
      if ((part.startsWith('#') || part.startsWith('@')) && part.length > 1) {
        return (
          <span
            key={idx}
            className="gh-tag-text"
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

export function GitHubCard({ platformId, post, campaignId, imageFiles, videoFile, onOpenRefinement }: CardProps) {
  const { user, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(post.content)
  
  // Interactive Star & Fork Counts
  const [starred, setStarred] = useState(false)
  const [starCount, setStarCount] = useState(1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userName = user?.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'yourbrand'
  
  // Extract repo title and description
  const lines = post.content.split('\n').filter(Boolean)
  const repoTitle = lines[0] || `${userName}/awesome-project`
  const bodyText = lines.slice(1).join('\n\n').trim()

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
    addToast('GitHub release text copied', 'success')
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
      a.download = `${sanitize(platform?.name || 'GitHub')}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast('GitHub kit downloaded', 'success')
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

  const toggleStar = () => {
    setStarred(prev => !prev)
    setStarCount(prev => (starred ? prev - 1 : prev + 1))
  }

  const shareUrl = platform?.shareUrl(post.content, {})
  const charCount = post.content.length

  return (
    <div className="gh-card-wrapper">
      {/* Top Control Toolbar */}
      <div className="gh-control-bar">
        <div className="gh-control-platform">
          <PlatformIcon id="github" size={15} color="#24292E" />
          <span className="gh-control-title">GitHub</span>
          <span className="gh-ready-badge">• Ready</span>
          {post.edited && <span className="pc-edited">edited</span>}
        </div>
        <div className="gh-control-actions">
          <button className="gh-tool-btn" onClick={onOpenRefinement} title="Refine with AI">
            <Sparkles size={12} color="#24292E" />
            <span>Refine</span>
          </button>
          <button className={`gh-tool-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy release">
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="gh-tool-btn" onClick={handleDownload} disabled={downloading} title="Download kit">
            <Download size={12} />
            <span>Kit</span>
          </button>
        </div>
      </div>

      {/* Authentic 1:1 GitHub Light Release Card */}
      <div className={`gh-post-box ${isEditing ? 'editing' : ''}`}>
        {/* Repo Header */}
        <div className="gh-repo-header">
          <div className="gh-repo-path">
            <Tag size={16} color="#0969DA" />
            <span className="gh-repo-name">{repoTitle}</span>
            <span className="gh-tag-pill">v1.0.0</span>
            <span className="gh-latest-badge">Latest</span>
          </div>

          <div className="gh-header-actions">
            <button className={`gh-star-btn ${starred ? 'starred' : ''}`} onClick={toggleStar}>
              <Star size={14} fill={starred ? '#eac54f' : 'none'} color={starred ? '#ca8a04' : '#57606a'} />
              <span>{starred ? 'Starred' : 'Star'}</span>
              <span className="gh-count">{starCount}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="gh-body" onClick={() => !isEditing && setIsEditing(true)} title="Click to edit">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="gh-edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              autoFocus
              spellCheck
            />
          ) : (
            <div className="gh-markdown-box">
              <h3 className="gh-release-title">Release Notes & Overview</h3>
              <p className="gh-text">
                <FormattedContent content={bodyText || post.content} linkColor="#0969DA" />
              </p>
            </div>
          )}
        </div>

        {/* Footer Meta Row */}
        <div className="gh-footer-meta">
          <div className="gh-author-pill">
            <div className="gh-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="gh-avatar-img" />
              ) : (
                userName[0].toUpperCase()
              )}
            </div>
            <span>{userName} released this just now</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="gh-footer-bar">
        <span className="gh-footer-chars">
          {charCount} chars
        </span>
        {isEditing && <span className="gh-footer-hint">⌘↵ save · Esc cancel</span>}
        {!isEditing && shareUrl && post.content && (
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="gh-footer-share">
            View on GitHub →
          </a>
        )}
      </div>

      <style>{`
        .gh-card-wrapper {
          display: flex; flex-direction: column; width: 100%; max-width: 520px; margin: 0 auto; gap: 8px;
        }
        .gh-control-bar {
          display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
          background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .gh-control-platform { display: flex; align-items: center; gap: 6px; }
        .gh-control-title { font-size: 12px; font-weight: 800; color: #24292E; text-transform: uppercase; letter-spacing: 0.04em; }
        .gh-ready-badge { font-size: 11px; font-weight: 600; color: var(--color-success); }
        .gh-control-actions { display: flex; align-items: center; gap: 6px; }
        .gh-tool-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F8F9FA; border: 1px solid #E9ECEF;
          border-radius: 6px; font-size: 11px; font-weight: 600; color: #495057; cursor: pointer; transition: all 120ms ease;
        }
        .gh-tool-btn:hover { background: #E9ECEF; color: #212529; }

        .gh-post-box {
          background: #ffffff; border: 1px solid #d0d7de; border-radius: 10px; padding: 16px;
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: border-color 150ms ease;
        }
        .gh-post-box.editing { border-color: #0969DA; box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.2); }

        .gh-repo-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #d0d7de; }
        .gh-repo-path { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .gh-repo-name { font-size: 15px; font-weight: 700; color: #0969DA; }
        .gh-tag-pill { font-size: 11px; font-weight: 600; color: #57606a; background: #afb8c133; padding: 2px 6px; border-radius: 99px; }
        .gh-latest-badge { font-size: 10px; font-weight: 700; color: #1a7f37; background: #dafbe1; padding: 2px 6px; border-radius: 99px; border: 1px solid #4ac26b66; }

        .gh-star-btn {
          display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #f6f8fa; border: 1px solid #d0d7de;
          border-radius: 6px; font-size: 12px; font-weight: 600; color: #24292f; cursor: pointer; transition: background 120ms ease;
        }
        .gh-star-btn:hover { background: #f3f4f6; }
        .gh-count { font-size: 11px; color: #57606a; background: rgba(175, 184, 193, 0.2); padding: 1px 5px; border-radius: 99px; }

        .gh-body { cursor: text; }
        .gh-markdown-box { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .gh-release-title { font-size: 16px; font-weight: 600; color: #24292f; margin: 0 0 6px; }
        .gh-text {
          font-size: 13.5px; line-height: 1.5; color: #24292f; white-space: pre-wrap; word-break: break-word;
        }
        .gh-edit-textarea {
          width: 100%; font-family: monospace; font-size: 13px; line-height: 1.45;
          color: #24292f; background: #ffffff; border: 1.5px solid #0969DA; border-radius: 6px; padding: 10px;
          outline: none; resize: vertical; min-height: 90px; box-sizing: border-box;
        }

        .gh-footer-meta { padding-top: 10px; border-top: 1px solid #d0d7de; font-size: 12px; color: #57606a; }
        .gh-author-pill { display: flex; align-items: center; gap: 6px; }
        .gh-avatar {
          width: 20px; height: 20px; border-radius: 50%; background: #24292E; display: flex; align-items: center;
          justify-content: center; color: #ffffff; font-weight: 700; font-size: 10px; flex-shrink: 0; overflow: hidden;
        }
        .gh-avatar-img { width: 100%; height: 100%; object-fit: cover; }

        .gh-footer-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .gh-footer-chars { font-size: 11.5px; color: #57606a; font-family: var(--font-mono); font-weight: 500; white-space: nowrap; }
        .gh-footer-hint { font-size: 11px; color: #57606a; white-space: nowrap; }
        .gh-footer-share { font-size: 12.5px; font-weight: 700; color: #0969DA; text-decoration: none; }
        .gh-footer-share:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

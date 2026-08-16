import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Loader2, Sparkles } from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { PlatformIcon } from './PlatformIcon'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RefinementChatProps {
  platformId: string
  campaignId: string
  onClose: () => void
}

export function RefinementChat({ platformId, campaignId, onClose }: RefinementChatProps) {
  const { campaign, updatePost, addToast } = useAppStore()
  const platform = PLATFORM_MAP[platformId]
  const currentContent = campaign?.posts[platformId]?.content ?? ''
  const brandColor = platform?.brandColor || '#F72585'

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `I'm ready to refine your ${platform?.name ?? platformId} post. What changes would you like to make?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSend = async (textToSend?: string) => {
    const msg = (textToSend || input).trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const result = await api.refine(campaignId, platformId, msg, currentContent)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.content,
      }])

      updatePost(platformId, { content: result.content, edited: true })
      addToast(`${platform?.name ?? platformId} post updated!`, 'success')
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Refinement error: ${err.message}. Please try again.`,
      }])
      addToast('Refinement failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestions = [
    '⚡ Make it punchier',
    '💼 More professional',
    '🎯 Add strong CTA',
    '🔥 Add viral hooks',
    '✂️ Shorten text',
    '✨ Add engaging emojis',
  ]

  const drawerContent = (
    <div className="rf-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Refine ${platform?.name ?? platformId} post`}>
      <div className="rf-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="rf-header">
          <div className="rf-header-title-group">
            {/* Platform icon badge */}
            <div className="rf-brand-badge" style={{ background: `${brandColor}15`, color: brandColor }}>
              <PlatformIcon id={platformId} size={16} color={brandColor} />
            </div>
            <div>
              <h3 className="rf-title">Refine with AI</h3>
              <p className="rf-subtitle">AI Assistant · Isolated Platform Scope</p>
            </div>
          </div>

          {/* Platform pill — reuses existing platform-filter-tab.active styles from ResultsView */}
          <div className="rf-header-right">
            <span className="platform-filter-tab active rf-platform-pill">
              {platform?.name ?? platformId}
            </span>
            <button className="rf-close-btn" onClick={onClose} aria-label="Close refine panel">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Current Post Preview */}
        <div className="rf-preview-box">
          <div className="rf-preview-header">
            <span className="rf-preview-label">Live Post Content</span>
            <span className="rf-char-badge">{currentContent.length} chars</span>
          </div>
          <p className="rf-preview-text">{currentContent}</p>
        </div>

        {/* Chat Messages */}
        <div className="rf-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`rf-msg-row ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="rf-ai-avatar" style={{ background: brandColor }}>
                  <Sparkles size={13} color="#ffffff" />
                </div>
              )}
              <div className={`rf-msg-bubble ${msg.role}`}>
                <p className="rf-msg-text">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="rf-msg-row assistant">
              <div className="rf-ai-avatar" style={{ background: brandColor }}>
                <Sparkles size={13} color="#ffffff" />
              </div>
              <div className="rf-msg-bubble assistant loading">
                <Loader2 size={15} className="spin" color={brandColor} />
                <span>Crafting refinement...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="rf-suggestions-bar">
          <p className="rf-suggestions-title">Quick Adjustments</p>
          <div className="rf-chips-grid">
            {suggestions.map(s => (
              <button
                key={s}
                className="rf-chip"
                onClick={() => handleSend(s.replace(/^[^\w]+/, ''))}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="rf-input-bar">
          <textarea
            ref={inputRef}
            className="rf-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type custom instructions (e.g. 'Emphasize launch date')..."
            rows={2}
            disabled={loading}
          />
          <button
            className="rf-send-btn"
            style={{ background: brandColor }}
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      <style>{`
        /* ── Backdrop ─────────────────────────────────────────── */
        .rf-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1200;
          background: rgba(15, 20, 25, 0.40);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          justify-content: flex-end;
          animation: rf-fadeIn 180ms ease-out;
        }

        /* ── Drawer panel ─────────────────────────────────────── */
        .rf-drawer {
          width: 440px;
          max-width: 92vw;
          height: 100%;
          background: var(--color-surface, #ffffff);
          box-shadow: -8px 0 32px rgba(0, 0, 0, 0.18);
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--color-border, #e2e8f0);
          animation: rf-slideIn 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Respect prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .rf-backdrop { animation: none; }
          .rf-drawer { animation: none; }
        }

        /* ── Header ───────────────────────────────────────────── */
        .rf-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          background: var(--color-bg, #f8fafc);
          gap: 10px;
          flex-shrink: 0;
        }
        .rf-header-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .rf-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .rf-brand-badge {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rf-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text-primary, #111827);
          margin: 0;
        }
        .rf-subtitle {
          font-size: 11px;
          color: var(--color-text-secondary, #6b7280);
          margin-top: 1px;
        }

        /* Platform pill — inherits the existing active pill style from ResultsView */
        .rf-platform-pill {
          font-size: 11px !important;
          padding: 4px 10px !important;
          pointer-events: none;
          cursor: default !important;
        }

        .rf-close-btn {
          background: transparent;
          border: none;
          color: var(--color-text-secondary, #6b7280);
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          transition: background 120ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rf-close-btn:hover {
          background: var(--color-border, #e5e7eb);
          color: var(--color-text-primary, #111827);
        }

        /* ── Preview box ──────────────────────────────────────── */
        .rf-preview-box {
          margin: 12px 16px 6px;
          padding: 10px 14px;
          background: var(--color-bg, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex-shrink: 0;
        }
        .rf-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .rf-preview-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary, #64748b);
        }
        .rf-char-badge {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-secondary, #94a3b8);
          font-family: var(--font-mono, monospace);
        }
        .rf-preview-text {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--color-text-primary, #334155);
          max-height: 72px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--font-body);
          margin: 0;
        }

        /* ── Messages ─────────────────────────────────────────── */
        .rf-messages {
          flex: 1;
          overflow-y: auto;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .rf-msg-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .rf-msg-row.user {
          flex-direction: row-reverse;
        }
        .rf-ai-avatar {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .rf-msg-bubble {
          padding: 10px 14px;
          border-radius: 14px;
          max-width: 82%;
          font-size: 13px;
          line-height: 1.5;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .rf-msg-bubble.assistant {
          background: var(--color-bg, #f1f5f9);
          color: var(--color-text-primary, #0f172a);
          border-top-left-radius: 2px;
          border: 1px solid var(--color-border, #e2e8f0);
        }
        .rf-msg-bubble.user {
          background: #111827;
          color: #ffffff;
          border-top-right-radius: 2px;
        }
        .rf-msg-bubble.loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-text-secondary, #64748b);
          font-weight: 500;
        }
        .rf-msg-text {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* ── Quick Adjustments ────────────────────────────────── */
        .rf-suggestions-bar {
          padding: 10px 16px;
          border-top: 1px solid var(--color-border, #f1f5f9);
          background: var(--color-bg, #fafafa);
          flex-shrink: 0;
        }
        .rf-suggestions-title {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-text-secondary, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        .rf-chips-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .rf-chip {
          padding: 5px 11px;
          border-radius: 99px;
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #cbd5e1);
          font-size: 11.5px;
          font-weight: 500;
          color: var(--color-text-primary, #334155);
          cursor: pointer;
          transition: all 120ms ease;
        }
        .rf-chip:hover:not(:disabled) {
          background: var(--color-bg, #f8fafc);
          border-color: var(--color-text-secondary, #94a3b8);
          color: var(--color-text-primary, #0f172a);
          transform: translateY(-1px);
        }
        @media (prefers-reduced-motion: reduce) {
          .rf-chip:hover:not(:disabled) { transform: none; }
        }
        .rf-chip:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Input bar ────────────────────────────────────────── */
        .rf-input-bar {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          padding: 12px 16px;
          border-top: 1px solid var(--color-border, #e2e8f0);
          background: var(--color-surface, #ffffff);
          flex-shrink: 0;
        }
        .rf-input {
          flex: 1;
          border: 1.5px solid var(--color-border-input, #cbd5e1);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.45;
          color: var(--color-text-primary, #0f172a);
          background: var(--color-surface, #ffffff);
          outline: none;
          resize: none;
          min-height: 48px;
          max-height: 120px;
          font-family: var(--font-body);
          transition: border-color 150ms ease;
        }
        .rf-input:focus {
          border-color: var(--color-text-primary, #111827);
        }
        .rf-send-btn {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 120ms ease, opacity 120ms ease;
        }
        .rf-send-btn:hover:not(:disabled) {
          transform: scale(1.04);
        }
        @media (prefers-reduced-motion: reduce) {
          .rf-send-btn:hover:not(:disabled) { transform: none; }
        }
        .rf-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ── Animations ───────────────────────────────────────── */
        @keyframes rf-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes rf-slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }

        /* ── Mobile responsiveness ────────────────────────────── */
        @media (max-width: 480px) {
          .rf-drawer {
            width: 100vw;
            max-width: 100vw;
          }
          .rf-platform-pill {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )

  return createPortal(drawerContent, document.body)
}

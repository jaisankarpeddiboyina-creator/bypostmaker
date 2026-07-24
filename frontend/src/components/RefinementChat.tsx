import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, Sparkles, RefreshCw } from 'lucide-react'
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') onClose()
  }

  const suggestions = [
    '⚡ Make it punchier',
    '💼 More professional',
    '🎯 Add strong CTA',
    '🔥 Add viral hooks',
    '✂️ Shorten text',
    '✨ Add engaging emojis',
  ]

  return (
    <div className="rf-backdrop" onClick={onClose}>
      <div className="rf-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="rf-header">
          <div className="rf-header-title-group">
            <div className="rf-brand-badge" style={{ background: `${brandColor}15`, color: brandColor }}>
              <PlatformIcon id={platformId} size={16} color={brandColor} />
            </div>
            <div>
              <h3 className="rf-title">Refine for {platform?.name ?? platformId}</h3>
              <p className="rf-subtitle">AI Assistant · Isolated Platform Scope</p>
            </div>
          </div>
          <button className="rf-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
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
            onKeyDown={handleKeyDown}
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
        .rf-backdrop {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(15, 20, 25, 0.35); backdrop-filter: blur(6px);
          display: flex; justify-content: flex-end; animation: fadeIn 180ms ease-out;
        }
        .rf-drawer {
          width: 440px; max-width: 90vw; height: 100%; background: #ffffff;
          box-shadow: -8px 0 32px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column;
          animation: slideIn 220ms cubic-bezier(0.16, 1, 0.3, 1); border-left: 1px solid var(--color-border);
        }
        .rf-header {
          display: flex; align-items: center; justify-content: space-between; padding: 16px 20px;
          border-bottom: 1px solid var(--color-border); background: #fafafa;
        }
        .rf-header-title-group { display: flex; align-items: center; gap: 12px; }
        .rf-brand-badge {
          width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
        }
        .rf-title { font-size: 15px; font-weight: 700; color: #111827; margin: 0; }
        .rf-subtitle { font-size: 11px; color: #6b7280; margin-top: 1px; }
        .rf-close-btn {
          background: transparent; border: none; color: #6b7280; cursor: pointer; padding: 6px;
          border-radius: 8px; transition: background 120ms ease;
        }
        .rf-close-btn:hover { background: #e5e7eb; color: #111827; }
        .rf-preview-box {
          margin: 14px 20px 8px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 12px; display: flex; flex-direction: column; gap: 6px;
        }
        .rf-preview-header { display: flex; align-items: center; justify-content: space-between; }
        .rf-preview-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
        .rf-char-badge { font-size: 10px; font-weight: 600; color: #94a3b8; font-family: var(--font-mono); }
        .rf-preview-text {
          font-size: 12.5px; line-height: 1.5; color: #334155; max-height: 70px; overflow-y: auto;
          white-space: pre-wrap; word-break: break-word; font-family: var(--font-body); margin: 0;
        }
        .rf-messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
        .rf-msg-row { display: flex; gap: 10px; align-items: flex-start; }
        .rf-msg-row.user { flex-direction: row-reverse; }
        .rf-ai-avatar {
          width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .rf-msg-bubble {
          padding: 10px 14px; border-radius: 14px; max-width: 82%; font-size: 13px; line-height: 1.5;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .rf-msg-bubble.assistant { background: #f1f5f9; color: #0f172a; border-top-left-radius: 2px; border: 1px solid #e2e8f0; }
        .rf-msg-bubble.user { background: #111827; color: #ffffff; border-top-right-radius: 2px; }
        .rf-msg-bubble.loading { display: flex; align-items: center; gap: 8px; color: #64748b; font-weight: 500; }
        .rf-msg-text { margin: 0; white-space: pre-wrap; word-break: break-word; }
        .rf-suggestions-bar { padding: 12px 20px; border-top: 1px solid #f1f5f9; background: #fafafa; }
        .rf-suggestions-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .rf-chips-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .rf-chip {
          padding: 5px 11px; border-radius: 99px; background: #ffffff; border: 1px solid #cbd5e1;
          font-size: 11.5px; font-weight: 500; color: #334155; cursor: pointer; transition: all 120ms ease;
        }
        .rf-chip:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; color: #0f172a; transform: translateY(-1px); }
        .rf-chip:disabled { opacity: 0.5; cursor: not-allowed; }
        .rf-input-bar { display: flex; align-items: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--color-border); background: #ffffff; }
        .rf-input {
          flex: 1; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; font-size: 13px;
          line-height: 1.45; color: #0f172a; outline: none; resize: none; min-height: 48px; max-height: 120px;
          font-family: var(--font-body); transition: border-color 150ms ease;
        }
        .rf-input:focus { border-color: #111827; }
        .rf-send-btn {
          width: 42px; height: 42px; border-radius: 10px; border: none; color: #ffffff; display: flex;
          align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: transform 120ms ease, opacity 120ms ease;
        }
        .rf-send-btn:hover:not(:disabled) { transform: scale(1.04); }
        .rf-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  )
}

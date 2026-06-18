import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { PLATFORM_MAP } from '../config/platforms'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

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

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `I'm ready to refine your ${platform?.name ?? platformId} post. What would you like to change?`,
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

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      // CRITICAL: Only this platform's session is used — not all platforms
      const result = await api.refine(campaignId, platformId, msg, currentContent)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.content,
      }])

      // Update the post card with refined content
      updatePost(platformId, { content: result.content, edited: true })
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, refinement failed: ${err.message}. Try again?`,
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

  // Quick suggestions
  const suggestions = [
    'Make it shorter',
    'More engaging',
    'Add a call to action',
    'More professional',
    'Add emojis',
    'Remove hashtags',
  ]

  return (
    <div className="refinement-panel">
      {/* Header */}
      <div className="refinement-header">
        <div>
          <p className="refinement-title">Refine for {platform?.name ?? platformId}</p>
          <p className="refinement-subtitle">Only this platform · 1 AI call</p>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close refinement">
          <X size={16} />
        </button>
      </div>

      {/* Current content preview */}
      <div className="refinement-preview">
        <p className="refinement-preview-label">Current post</p>
        <p className="refinement-preview-text">{currentContent}</p>
      </div>

      {/* Messages */}
      <div className="refinement-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`refinement-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="refinement-message-avatar">AI</div>
            )}
            <div className="refinement-message-content">
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="refinement-message assistant">
            <div className="refinement-message-avatar">AI</div>
            <div className="refinement-message-content loading">
              <Loader2 size={14} className="spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="refinement-suggestions">
          {suggestions.map(s => (
            <button
              key={s}
              className="refinement-suggestion"
              onClick={() => { setInput(s); inputRef.current?.focus() }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="refinement-input-row">
        <textarea
          ref={inputRef}
          className="refinement-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Make it punchier, more formal, add CTA..."
          rows={2}
          disabled={loading}
        />
        <button
          className="refinement-send"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          aria-label="Send refinement"
        >
          {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
        </button>
      </div>

      <style>{`
        .refinement-panel {
          width: var(--sidebar-width);
          flex-shrink: 0;
          border-left: 1px solid var(--border);
          background: var(--surface);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .refinement-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .refinement-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-1);
        }

        .refinement-subtitle {
          font-size: 11px;
          color: var(--text-3);
          margin-top: 2px;
        }

        .refinement-preview {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          background: var(--card);
        }

        .refinement-preview-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-3);
          font-weight: 600;
          margin-bottom: 6px;
        }

        .refinement-preview-text {
          font-family: var(--font-mono);
          font-size: 11px;
          line-height: 1.6;
          color: var(--text-2);
          max-height: 80px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
        }

        .refinement-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .refinement-message {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .refinement-message.user {
          flex-direction: row-reverse;
        }

        .refinement-message-avatar {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: var(--accent-subtle);
          border: 1px solid rgba(124,58,237,0.2);
          color: var(--accent);
          font-size: 9px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          letter-spacing: 0;
        }

        .refinement-message-content {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 12px;
          max-width: 220px;
        }

        .refinement-message-content p {
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-1);
          white-space: pre-wrap;
        }

        .refinement-message.user .refinement-message-content {
          background: var(--accent-subtle);
          border-color: rgba(124,58,237,0.2);
        }

        .refinement-message-content.loading {
          display: flex;
          align-items: center;
          color: var(--text-3);
        }

        .refinement-suggestions {
          padding: 12px 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }

        .refinement-suggestion {
          padding: 4px 10px;
          border-radius: 99px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-2);
          font-size: 11px;
          cursor: pointer;
          font-family: var(--font-body);
          transition: all var(--transition);
        }

        .refinement-suggestion:hover {
          border-color: var(--border-light);
          color: var(--text-1);
          background: var(--card);
        }

        .refinement-input-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }

        .refinement-input {
          flex: 1;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 8px 12px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--text-1);
          resize: none;
          line-height: 1.5;
          transition: border-color var(--transition);
        }

        .refinement-input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .refinement-input::placeholder {
          color: var(--text-3);
        }

        .refinement-send {
          width: 34px;
          height: 34px;
          border-radius: var(--radius);
          background: var(--accent);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all var(--transition);
        }

        .refinement-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .refinement-send:not(:disabled):hover {
          background: var(--accent-dim);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}

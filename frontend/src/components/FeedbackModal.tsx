import { useState } from 'react'
import { X, Star, AlertCircle, CheckCircle } from 'lucide-react'
import { useAppStore } from '../store/app'

export function FeedbackModal() {
  const { showFeedbackModal, setShowFeedbackModal, user, addToast } = useAppStore()
  
  const [category, setCategory] = useState<'bug' | 'feature-request' | 'general'>('general')
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  if (!showFeedbackModal) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      setError('Message is required')
      return
    }
    if (message.length > 1000) {
      setError('Message cannot exceed 1000 characters')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          rating,
          message: message.trim(),
          email: !user && email.trim() ? email.trim() : null
        })
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        setError(err.error || 'Failed to submit feedback')
        setLoading(false)
        return
      }

      setSuccess(true)
      addToast('Feedback submitted successfully!', 'success')
      // Reset form
      setCategory('general')
      setRating(null)
      setMessage('')
      setEmail('')
    } catch {
      setError('Failed to submit feedback. Check your connection.')
    }
    setLoading(false)
  }

  const handleClose = () => {
    setShowFeedbackModal(false)
    setTimeout(() => {
      setSuccess(false)
      setError('')
    }, 300)
  }

  return (
    <div className="feedback-modal-overlay">
      <div className="feedback-modal-card glass-card">
        <button className="feedback-close-btn" onClick={handleClose}>
          <X size={18} />
        </button>

        {success ? (
          <div className="feedback-success-state">
            <CheckCircle size={48} className="feedback-success-icon" />
            <h2 className="feedback-success-title">Thank You!</h2>
            <p className="feedback-success-desc">
              Your feedback has been received. We review every submission to improve PostMaker.
            </p>
            <button className="feedback-submit-btn" style={{ width: '100%' }} onClick={handleClose}>
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 className="feedback-title">Give Feedback</h2>
              <p className="feedback-subtitle">
                Help us improve PostMaker. Share your suggestions, report issues, or rate your experience.
              </p>
            </div>

            {error && (
              <div className="feedback-error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Category selection */}
            <div className="feedback-field-group">
              <label className="feedback-field-label">Feedback Category</label>
              <div className="feedback-category-buttons">
                {([
                  { id: 'general', label: 'General' },
                  { id: 'feature-request', label: 'Feature Request' },
                  { id: 'bug', label: 'Bug Report' }
                ] as const).map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`feedback-category-btn ${category === cat.id ? 'active' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Selector */}
            <div className="feedback-field-group">
              <label className="feedback-field-label">
                How would you rate your experience? <span className="feedback-label-optional">(Optional)</span>
              </label>
              <div className="feedback-rating-stars">
                {[1, 2, 3, 4, 5].map(star => {
                  const isActive = (hoverRating !== null ? star <= hoverRating : (rating !== null && star <= rating))
                  return (
                    <button
                      key={star}
                      type="button"
                      className={`feedback-star-btn ${isActive ? 'active' : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(star)}
                    >
                      <Star size={24} fill={isActive ? 'currentColor' : 'none'} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Guest email input */}
            {!user && (
              <div className="feedback-field-group">
                <label className="feedback-field-label" htmlFor="feedback-email">
                  Your Email Address <span className="feedback-label-optional">(Optional)</span>
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  placeholder="name@example.com"
                  className="feedback-text-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            )}

            {/* Message textarea */}
            <div className="feedback-field-group">
              <div className="feedback-textarea-label-row">
                <label className="feedback-field-label" htmlFor="feedback-message">Your Message</label>
                <span className={`feedback-char-counter ${message.length > 950 ? 'limit-warning' : ''}`}>
                  {message.length} / 1000
                </span>
              </div>
              <textarea
                id="feedback-message"
                required
                maxLength={1000}
                placeholder={
                  category === 'bug'
                    ? 'What went wrong? Describe how to reproduce the issue...'
                    : category === 'feature-request'
                    ? 'What would you like to see? Describe the feature details...'
                    : 'Tell us what you think or share your ideas...'
                }
                className="feedback-textarea-input"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <button type="submit" className="feedback-submit-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .feedback-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 16px;
        }

        .feedback-modal-card {
          width: 100%;
          max-width: 480px;
          padding: 28px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          animation: feedbackModalFadeIn 0.25s ease-out;
        }

        @keyframes feedbackModalFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .feedback-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          color: var(--text-3);
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 99px;
          transition: background 0.2s, color 0.2s;
        }
        .feedback-close-btn:hover {
          background: var(--border);
          color: var(--text-1);
        }

        .feedback-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: var(--text-1);
          letter-spacing: -0.02em;
          margin: 0;
        }

        .feedback-subtitle {
          font-size: 13.5px;
          color: var(--text-3);
          line-height: 1.5;
          margin: 6px 0 0 0;
        }

        .feedback-error-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 13px;
        }

        .feedback-field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .feedback-field-label {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-2);
        }

        .feedback-label-optional {
          font-weight: 400;
          color: var(--text-3);
          font-size: 11px;
        }

        .feedback-category-buttons {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          border: 1px solid var(--border);
          padding: 4px;
          border-radius: var(--radius-md);
          background: rgba(15, 23, 42, 0.02);
        }

        .feedback-category-btn {
          border: none;
          background: none;
          padding: 8px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-3);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .feedback-category-btn:hover {
          color: var(--text-1);
        }
        .feedback-category-btn.active {
          background: var(--surface);
          color: var(--accent);
          box-shadow: var(--shadow-sm);
          font-weight: 600;
        }

        .feedback-rating-stars {
          display: flex;
          gap: 8px;
        }

        .feedback-star-btn {
          border: none;
          background: none;
          padding: 4px;
          cursor: pointer;
          color: var(--text-3);
          transition: transform 0.15s, color 0.15s;
        }
        .feedback-star-btn:hover {
          transform: scale(1.15);
        }
        .feedback-star-btn.active {
          color: #f59e0b; /* Amber 500 */
        }

        .feedback-text-input {
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--surface);
          color: var(--text-1);
          font-size: 13.5px;
          outline: none;
          transition: border-color 0.2s;
        }
        .feedback-text-input:focus {
          border-color: var(--accent);
        }

        .feedback-textarea-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .feedback-char-counter {
          font-size: 11px;
          color: var(--text-3);
        }
        .feedback-char-counter.limit-warning {
          color: #f59e0b;
        }

        .feedback-textarea-input {
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--surface);
          color: var(--text-1);
          font-size: 13.5px;
          min-height: 100px;
          resize: vertical;
          outline: none;
          font-family: inherit;
          line-height: 1.5;
          transition: border-color 0.2s;
        }
        .feedback-textarea-input:focus {
          border-color: var(--accent);
        }

        .feedback-submit-btn {
          background: var(--accent);
          color: #ffffff;
          padding: 12px;
          border: none;
          border-radius: var(--radius-md);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, background 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .feedback-submit-btn:hover {
          opacity: 0.9;
        }
        .feedback-submit-btn:disabled {
          background: var(--border);
          color: var(--text-3);
          cursor: not-allowed;
          opacity: 1;
        }

        .feedback-success-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 20px 0;
          gap: 16px;
        }

        .feedback-success-icon {
          color: var(--success);
          animation: feedbackPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes feedbackPopIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .feedback-success-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 700;
          color: var(--text-1);
          margin: 0;
        }

        .feedback-success-desc {
          font-size: 14px;
          color: var(--text-2);
          line-height: 1.6;
          max-width: 320px;
          margin: 0;
        }
      `}</style>
    </div>
  )
}

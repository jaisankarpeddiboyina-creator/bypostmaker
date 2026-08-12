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
                <div className="feedback-input-wrapper">
                  <input
                    id="feedback-email"
                    type="email"
                    placeholder="name@example.com"
                    className="feedback-text-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
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
              <div className="feedback-input-wrapper">
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
          inset: 0;
          background: rgba(15, 23, 42, 0.30);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          z-index: 9999;
          display: grid;
          place-items: center;
          padding: var(--space-4);
          animation: feedbackFadeIn 0.2s ease-out;
        }

        .feedback-modal-card {
          width: 100%;
          max-width: 460px;
          padding: 28px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 24px;
          background: var(--color-surface);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-modal);
          animation: feedbackModalFadeIn 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes feedbackFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes feedbackModalFadeIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .feedback-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition);
        }
        .feedback-close-btn:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.50);
          border-color: var(--color-border-hover);
        }

        .feedback-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          margin: 0;
        }

        .feedback-subtitle {
          font-size: 13px;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 6px 0 0 0;
        }

        .feedback-error-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--color-error-bg);
          border: 1px solid var(--color-error-border);
          color: var(--color-error);
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
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .feedback-label-optional {
          font-weight: 400;
          color: var(--color-text-muted);
          font-size: 11px;
          text-transform: none;
          letter-spacing: normal;
        }

        .feedback-category-buttons {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          border: 1px solid var(--color-border);
          padding: 4px;
          border-radius: var(--radius-input);
          background: var(--color-surface-inset);
        }

        .feedback-category-btn {
          border: none;
          background: none;
          padding: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          border-radius: var(--radius);
          cursor: pointer;
          transition: background var(--transition), color var(--transition);
        }
        .feedback-category-btn:hover {
          color: var(--color-text-primary);
        }
        .feedback-category-btn.active {
          background: var(--gradient-primary);
          color: var(--color-text-inverse);
          box-shadow: var(--shadow-btn);
          font-weight: 800;
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
          color: var(--color-text-placeholder);
          transition: transform var(--transition), color var(--transition);
        }
        .feedback-star-btn:hover {
          transform: scale(1.15);
        }
        .feedback-star-btn.active {
          color: var(--color-warning);
        }

        .feedback-input-wrapper {
          position: relative;
          background: var(--color-surface-inset);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-input);
          transition: border-color var(--transition);
        }
        .feedback-input-wrapper:focus-within {
          border-color: var(--color-border-hover);
          box-shadow: 0 0 0 1px var(--color-border-hover);
        }

        .feedback-text-input {
          width: 100%;
          padding: 10px 14px;
          background: transparent;
          border: none;
          outline: none;
          color: var(--color-text-primary);
          font-family: var(--font-body);
          font-size: 13.5px;
        }

        .feedback-textarea-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .feedback-char-counter {
          font-size: 11px;
          color: var(--color-text-muted);
        }
        .feedback-char-counter.limit-warning {
          color: var(--color-warning);
        }

        .feedback-textarea-input {
          width: 100%;
          padding: 12px 14px;
          background: transparent;
          border: none;
          outline: none;
          color: var(--color-text-primary);
          font-size: 13.5px;
          min-height: 100px;
          resize: vertical;
          font-family: inherit;
          line-height: 1.5;
        }

        .feedback-submit-btn {
          background: var(--gradient-primary);
          color: var(--color-text-inverse);
          padding: 12px;
          border: none;
          border-radius: var(--radius-md);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--shadow-btn);
          transition: all var(--transition);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .feedback-submit-btn:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }
        .feedback-submit-btn:disabled {
          background: var(--color-border) !important;
          color: var(--color-text-muted) !important;
          box-shadow: none !important;
          cursor: not-allowed;
          filter: none;
          transform: none;
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
          color: var(--color-success);
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
          color: var(--color-text-primary);
          margin: 0;
        }

        .feedback-success-desc {
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.6;
          max-width: 320px;
          margin: 0;
        }
      `}</style>
    </div>
  )
}

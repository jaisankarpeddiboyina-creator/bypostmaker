import { useState } from 'react'
import { X, Sparkles, Mail, Lock, User as UserIcon, Loader2, AlertCircle } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { trackSignUp, trackLogin } from '../lib/analytics'

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, addToast } = useAppStore()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  if (!showAuthModal) return null

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const rules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[\W_]/.test(password),
  }

  const isPasswordValid = Object.values(rules).every(Boolean)
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const errors = {
    name: mode === 'signup' && !name.trim() ? 'Name is required' : '',
    email: !email ? 'Email is required' : !isEmailValid ? 'Please enter a valid email address' : '',
    password: !password ? 'Password is required' : mode === 'signup' && !isPasswordValid ? 'Password does not meet requirements' : '',
  }

  const isFormValid = mode === 'signup'
    ? name.trim() && isEmailValid && isPasswordValid
    : isEmailValid && password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true })

    if (!isFormValid || loading) return

    setLoading(true)
    try {
      if (mode === 'signup') {
        await api.auth.emailSignup(name, email, password)
        trackSignUp('email')
        addToast('Verification email sent! Redirecting...', 'success')
        setShowAuthModal(false)
        setTimeout(() => {
          window.location.href = '/app/create'
        }, 1200)
      } else {
        await api.auth.emailLogin(email, password)
        trackLogin('email')
        addToast('Welcome back! Redirecting...', 'success')
        setShowAuthModal(false)
        setTimeout(() => {
          window.location.href = '/app/create'
        }, 1200)
      }
    } catch (err: any) {
      addToast(err.message ?? 'Authentication failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const authUrl = import.meta.env.DEV ? '/api/auth/dev' : '/api/auth/google'

  return (
    <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
      <div className="auth-modal-card glass-card" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="auth-modal-close-btn"
          onClick={() => setShowAuthModal(false)}
          aria-label="Close modal"
        >
          <X size={16} />
        </button>

        <div className="auth-modal-header">
          <div className="auth-modal-icon-badge">
            <Sparkles size={20} className="text-accent" />
          </div>
          <h2 className="auth-modal-title">Sign in to generate your content kit</h2>
          <p className="auth-modal-sub">Create an account or log in to continue generating multi-platform content.</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Create Account
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
        </div>

        {/* 1-Click Social Login */}
        <a href={authUrl} className="btn btn-ghost auth-modal-google-btn">
          <svg className="google-icon" viewBox="0 0 24 24" width="16" height="16">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {import.meta.env.DEV ? 'Continue locally' : 'Continue with Google'}
        </a>

        <div className="auth-modal-divider">
          <span>or email</span>
        </div>

        {/* Email Form */}
        <form className="auth-modal-form" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <div className="modal-form-group">
              <div className="input-wrapper">
                <UserIcon className="input-icon" size={15} />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={() => handleBlur('name')}
                  placeholder="Full Name"
                  autoComplete="name"
                  required
                  className={touched.name && errors.name ? 'invalid' : ''}
                />
              </div>
              {touched.name && errors.name && (
                <span className="modal-form-error"><AlertCircle size={12} /> {errors.name}</span>
              )}
            </div>
          )}

          <div className="modal-form-group">
            <div className="input-wrapper">
              <Mail className="input-icon" size={15} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="Work or personal email"
                autoComplete="email"
                required
                className={touched.email && errors.email ? 'invalid' : ''}
              />
            </div>
            {touched.email && errors.email && (
              <span className="modal-form-error"><AlertCircle size={12} /> {errors.email}</span>
            )}
          </div>

          <div className="modal-form-group">
            <div className="input-wrapper">
              <Lock className="input-icon" size={15} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={() => handleBlur('password')}
                placeholder="Password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                className={touched.password && errors.password ? 'invalid' : ''}
              />
            </div>
            {touched.password && errors.password && (
              <span className="modal-form-error"><AlertCircle size={12} /> {errors.password}</span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-modal-submit-btn"
            disabled={loading || (mode === 'signup' && touched.password && !isPasswordValid)}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Processing...
              </>
            ) : (
              mode === 'signup' ? 'Create Account & Generate' : 'Sign In & Generate'
            )}
          </button>
        </form>
      </div>

      <style>{`
        .auth-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.30);
          backdrop-filter: blur(8px);
          display: grid;
          place-items: center;
          padding: var(--space-4);
          animation: fadeIn 0.2s ease-out;
        }

        .auth-modal-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 28px;
          box-shadow: var(--shadow-modal);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-modal-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid var(--border);
          color: var(--text-3);
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition);
        }

        .auth-modal-close-btn:hover {
          color: var(--text-1);
          background: rgba(255, 255, 255, 0.50);
        }

        .auth-modal-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .auth-modal-icon-badge {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--color-success-bg);
          border: 1px solid var(--color-success-border);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .auth-modal-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--text-1);
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }

        .auth-modal-sub {
          font-size: 13px;
          color: var(--text-3);
          line-height: 1.5;
        }

        .auth-modal-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          background: rgba(255, 255, 255, 0.25);
          padding: 4px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
        }

        .auth-tab-btn {
          background: transparent;
          border: none;
          padding: 7px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-3);
          border-radius: calc(var(--radius) - 2px);
          cursor: pointer;
          transition: all var(--transition);
        }

        .auth-tab-btn.active {
          background: var(--surface);
          color: var(--text-1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .auth-modal-google-btn {
          width: 100%;
          height: 42px;
          justify-content: center;
          gap: 8px;
          border: 1px solid var(--border);
          font-size: 13.5px;
          font-weight: 600;
        }

        .auth-modal-divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: var(--text-4);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .auth-modal-divider::before, .auth-modal-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--border);
        }

        .auth-modal-divider span {
          padding: 0 10px;
        }

        .auth-modal-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .modal-form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          color: var(--text-3);
          pointer-events: none;
        }

        .input-wrapper input {
          width: 100%;
          height: 40px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0 var(--space-4) 0 38px;
          color: var(--text-1);
          font-size: 13.5px;
          transition: all var(--transition);
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent-subtle);
        }

        .input-wrapper input.invalid {
          border-color: var(--error);
          background: var(--error-bg);
        }

        .modal-form-error {
          font-size: 11.5px;
          color: var(--error);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .auth-modal-submit-btn {
          width: 100%;
          height: 42px;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          margin-top: 4px;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

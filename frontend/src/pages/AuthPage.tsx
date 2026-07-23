import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, Loader2, ArrowLeft, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { trackSignUp, trackLogin } from '../lib/analytics'

interface AuthPageProps {
  mode: 'login' | 'signup' | 'forgot'
}

export default function AuthPage({ mode }: AuthPageProps) {
  const { user, addToast } = useAppStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')

  // Redirect if already logged in and verified
  useEffect(() => {
    if (user && user.email_verified === 1) {
      navigate('/app', { replace: true })
    }
  }, [user, navigate])

  // Extract error params and trigger toasts
  useEffect(() => {
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        invalid_token: 'The email verification link is invalid or has expired.',
        oauth_failed: 'Google authentication failed. Please try again.',
        token_exchange_failed: 'Failed to exchange token with Google. Please try again.',
        server_error: 'An internal server error occurred. Please try again.',
      }
      addToast(errorMessages[errorParam] ?? 'An error occurred during authentication.', 'error')
      
      // Clean up URL parameter
      navigate(window.location.pathname, { replace: true })
    }
  }, [errorParam, navigate, addToast])

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  // Touched state
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  // Password rules validation
  const rules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[\W_]/.test(password),
  }

  const isPasswordValid = Object.values(rules).every(Boolean)
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // Validation errors
  const errors = {
    name: mode === 'signup' && !name.trim() ? 'Name is required' : '',
    email: !email ? 'Email is required' : !isEmailValid ? 'Please enter a valid email address' : '',
    password: mode !== 'forgot' && !password ? 'Password is required' : mode === 'signup' && !isPasswordValid ? 'Password does not meet requirements' : '',
  }

  const isFormValid = mode === 'forgot'
    ? isEmailValid
    : mode === 'signup'
      ? name.trim() && isEmailValid && isPasswordValid
      : isEmailValid && password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Mark all as touched
    setTouched({ name: true, email: true, password: true })
    
    if (!isFormValid || loading) return

    setLoading(true)
    try {
      if (mode === 'signup') {
        await api.auth.emailSignup(name, email, password)
        trackSignUp('email')
        addToast('Verification email sent! Redirecting...', 'success')
        // Force full page reload redirect to refresh session and trigger AuthGuard check
        setTimeout(() => {
          window.location.href = '/app'
        }, 1500)
      } else if (mode === 'login') {
        await api.auth.emailLogin(email, password)
        trackLogin('email')
        addToast('Welcome back! Redirecting...', 'success')
        setTimeout(() => {
          window.location.href = '/app'
        }, 1500)
      } else if (mode === 'forgot') {
        const res = await api.auth.forgotPassword(email)
        addToast(res.message, 'success')
        setForgotSuccess(true)
      }
    } catch (err: any) {
      addToast(err.message ?? 'An authentication error occurred.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const authUrl = import.meta.env.DEV ? '/api/auth/dev' : '/api/auth/google'

  return (
    <div className="auth-page">
      <div className="auth-card-wrapper">
        <Link to="/" className="auth-back-link">
          <ArrowLeft size={14} /> Back to home
        </Link>

        <div className="auth-card">
          <div className="auth-logo">Post<span>Maker</span></div>
          
          <h1 className="auth-title">
            {mode === 'login' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </h1>
          
          <p className="auth-subtitle">
            {mode === 'login' && 'Enter your credentials to access your dashboard.'}
            {mode === 'signup' && 'Get started with 5 free content kit generations.'}
            {mode === 'forgot' && 'We will send a password reset link to your email.'}
          </p>

          {mode === 'forgot' && forgotSuccess ? (
            <div className="auth-success-state">
              <Mail className="auth-success-icon" size={28} />
              <p className="auth-success-message">
                Please check your inbox at <strong>{email}</strong> for instructions on setting up a new password.
              </p>
              <Link to="/login" className="btn btn-primary auth-success-btn">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              
              {/* Name Field (Signup Only) */}
              {mode === 'signup' && (
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <div className="input-wrapper">
                    <UserIcon className="input-icon" size={16} />
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onBlur={() => handleBlur('name')}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      required
                      className={touched.name && errors.name ? 'invalid' : touched.name && !errors.name ? 'valid' : ''}
                    />
                  </div>
                  {touched.name && errors.name && (
                    <span className="form-error"><AlertCircle size={12} /> {errors.name}</span>
                  )}
                </div>
              )}

              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={16} />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => handleBlur('email')}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={touched.email && errors.email ? 'invalid' : touched.email && !errors.email ? 'valid' : ''}
                  />
                </div>
                {touched.email && errors.email && (
                  <span className="form-error"><AlertCircle size={12} /> {errors.email}</span>
                )}
              </div>

              {/* Password Field (Login/Signup Only) */}
              {mode !== 'forgot' && (
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="password">Password</label>
                    {mode === 'login' && (
                      <Link to="/forgot-password" className="forgot-link">
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  
                  {/* Password Rules Indicators (Signup Only) - Placed above input per Web Guidance */}
                  {mode === 'signup' && touched.password && (
                    <div className="password-rules-wrapper">
                      <span className="rules-heading">Password requirements:</span>
                      <ul className="rules-list">
                        <li className={rules.length ? 'met' : 'unmet'}>At least 8 characters</li>
                        <li className={rules.uppercase ? 'met' : 'unmet'}>One uppercase letter</li>
                        <li className={rules.number ? 'met' : 'unmet'}>One number</li>
                        <li className={rules.special ? 'met' : 'unmet'}>One special character</li>
                      </ul>
                    </div>
                  )}

                  <div className="input-wrapper">
                    <Lock className="input-icon" size={16} />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onBlur={() => handleBlur('password')}
                      placeholder="••••••••"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      className={touched.password && errors.password ? 'invalid' : touched.password && !errors.password ? 'valid' : ''}
                    />
                  </div>
                  {touched.password && errors.password && (
                    <span className="form-error"><AlertCircle size={12} /> {errors.password}</span>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary auth-submit-btn" 
                disabled={loading || (mode === 'signup' && touched.password && !isPasswordValid)}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Processing...
                  </>
                ) : (
                  <>
                    {mode === 'login' && 'Sign in'}
                    {mode === 'signup' && 'Sign up'}
                    {mode === 'forgot' && 'Send reset link'}
                  </>
                )}
              </button>
            </form>
          )}

          {/* Social Auth Divider */}
          {(!forgotSuccess || mode !== 'forgot') && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>

              <a href={authUrl} className="btn btn-ghost auth-social-btn">
                <svg className="google-icon" viewBox="0 0 24 24" width="16" height="16">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {import.meta.env.DEV ? 'Continue locally' : 'Continue with Google'}
              </a>
            </>
          )}

          <div className="auth-footer">
            {mode === 'login' && (
              <p>
                Don't have an account? <Link to="/signup">Sign up</Link>
              </p>
            )}
            {mode === 'signup' && (
              <p>
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Remembered your password? <Link to="/login">Log in</Link>
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          background: var(--bg);
          display: grid;
          place-items: center;
          padding: var(--space-6) var(--space-4);
          font-family: var(--font-body);
        }
        .auth-card-wrapper {
          max-width: 420px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .auth-back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-3);
          font-size: 13px;
          text-decoration: none;
          align-self: flex-start;
          transition: color var(--transition);
        }
        .auth-back-link:hover {
          color: var(--text-1);
          text-decoration: none;
        }
        .auth-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          box-shadow: var(--shadow-card);
        }
        .auth-logo {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 800;
          color: var(--text-1);
          letter-spacing: -0.04em;
          margin-bottom: var(--space-6);
        }
        .auth-logo span {
          color: var(--accent);
        }
        .auth-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 700;
          color: var(--text-1);
          margin-bottom: 8px;
        }
        .auth-subtitle {
          font-size: 14px;
          color: var(--text-3);
          line-height: 1.5;
          margin-bottom: var(--space-8);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-2);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .forgot-link {
          font-size: 12px;
          color: var(--accent);
          text-decoration: none;
        }
        .forgot-link:hover {
          text-decoration: underline;
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
          padding: 0 var(--space-4) 0 40px;
          color: var(--text-1);
          font-size: 14px;
          font-family: var(--font-body);
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
        .input-wrapper input.valid {
          border-color: var(--success);
        }
        .form-error {
          font-size: 12px;
          color: var(--error);
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
        }
        .password-rules-wrapper {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 10px 12px;
          margin-bottom: 4px;
        }
        .rules-heading {
          font-size: 11px;
          color: var(--text-3);
          font-weight: 600;
          display: block;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .rules-list {
          list-style: none;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .rules-list li {
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color var(--transition);
        }
        .rules-list li.unmet {
          color: var(--text-3);
        }
        .rules-list li.met {
          color: var(--success);
        }
        .rules-list li::before {
          content: '•';
          font-size: 14px;
        }
        .rules-list li.met::before {
          content: '✓';
          font-weight: bold;
        }
        .auth-submit-btn {
          width: 100%;
          height: 40px;
          justify-content: center;
          margin-top: var(--space-2);
        }
        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: var(--space-6) 0;
          color: var(--text-4);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .auth-divider::before, .auth-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--border);
        }
        .auth-divider span {
          padding: 0 var(--space-3);
        }
        .auth-social-btn {
          width: 100%;
          height: 40px;
          justify-content: center;
          gap: 8px;
          margin-bottom: var(--space-6);
        }
        .google-icon {
          flex-shrink: 0;
        }
        .auth-footer {
          text-align: center;
          font-size: 13px;
          color: var(--text-3);
        }
        .auth-footer Link, .auth-footer a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 500;
        }
        .auth-footer Link:hover, .auth-footer a:hover {
          text-decoration: underline;
        }
        .auth-success-state {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4) 0;
        }
        .auth-success-icon {
          color: var(--success);
          background: var(--success-bg);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          padding: 14px;
          margin-bottom: var(--space-2);
        }
        .auth-success-message {
          font-size: 14px;
          color: var(--text-2);
          line-height: 1.6;
        }
        .auth-success-btn {
          margin-top: var(--space-4);
          width: 100%;
          justify-content: center;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 480px) {
          .rules-list {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

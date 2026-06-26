import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, Loader2, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

export default function ResetPasswordPage() {
  const { addToast } = useAppStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  // Validation
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!token || !email) {
      addToast('Invalid password reset link. Missing parameters.', 'error')
      navigate('/login', { replace: true })
    }
  }, [token, email, navigate, addToast])

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
  const isMatch = password === confirmPassword

  const errors = {
    password: !password ? 'Password is required' : !isPasswordValid ? 'Password does not meet requirements' : '',
    confirmPassword: !confirmPassword ? 'Please confirm your password' : !isMatch ? 'Passwords do not match' : '',
  }

  const isFormValid = isPasswordValid && isMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ password: true, confirmPassword: true })

    if (!isFormValid || loading || !email || !token) return

    setLoading(true)
    try {
      await api.auth.resetPassword(email, token, password)
      addToast('Password reset successfully! Please sign in with your new password.', 'success')
      setSuccess(true)
    } catch (err: any) {
      addToast(err.message ?? 'Failed to reset password.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="reset-page">
      <div className="reset-card-wrapper">
        <Link to="/login" className="reset-back-link">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div className="reset-card">
          <div className="reset-logo">Post<span>Maker</span></div>

          <h1 className="reset-title">Set new password</h1>
          <p className="reset-subtitle">
            Please enter your new password below. Make sure it meets all security requirements.
          </p>

          {success ? (
            <div className="reset-success-state">
              <CheckCircle className="reset-success-icon" size={28} />
              <p className="reset-success-message">
                Your password has been updated. You can now log in using your new credentials.
              </p>
              <Link to="/login" className="btn btn-primary reset-success-btn">
                Go to sign in
              </Link>
            </div>
          ) : (
            <form className="reset-form" onSubmit={handleSubmit} noValidate>
              
              {/* Rules List - Placed above input per Web Guidance */}
              {touched.password && (
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

              {/* Password Input */}
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={16} />
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => handleBlur('password')}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className={touched.password && errors.password ? 'invalid' : touched.password && !errors.password ? 'valid' : ''}
                  />
                </div>
                {touched.password && errors.password && (
                  <span className="form-error"><AlertCircle size={12} /> {errors.password}</span>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={16} />
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className={touched.confirmPassword && errors.confirmPassword ? 'invalid' : touched.confirmPassword && !errors.confirmPassword ? 'valid' : ''}
                  />
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <span className="form-error"><AlertCircle size={12} /> {errors.confirmPassword}</span>
                )}
              </div>

              <button 
                type="submit" 
                className="btn btn-primary reset-submit-btn" 
                disabled={loading || (touched.password && !isPasswordValid)}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Updating password...
                  </>
                ) : (
                  'Reset password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .reset-page {
          min-height: 100vh;
          background: var(--bg);
          display: grid;
          place-items: center;
          padding: var(--space-6) var(--space-4);
          font-family: var(--font-body);
        }
        .reset-card-wrapper {
          max-width: 420px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .reset-back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-3);
          font-size: 13px;
          text-decoration: none;
          align-self: flex-start;
          transition: color var(--transition);
        }
        .reset-back-link:hover {
          color: var(--text-1);
          text-decoration: none;
        }
        .reset-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          box-shadow: var(--shadow-card);
        }
        .reset-logo {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 800;
          color: var(--text-1);
          letter-spacing: -0.04em;
          margin-bottom: var(--space-6);
        }
        .reset-logo span {
          color: var(--accent);
        }
        .reset-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 700;
          color: var(--text-1);
          margin-bottom: 8px;
        }
        .reset-subtitle {
          font-size: 14px;
          color: var(--text-3);
          line-height: 1.5;
          margin-bottom: var(--space-8);
        }
        .reset-form {
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
        .reset-submit-btn {
          width: 100%;
          height: 40px;
          justify-content: center;
          margin-top: var(--space-2);
        }
        .reset-success-state {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4) 0;
        }
        .reset-success-icon {
          color: var(--success);
          background: var(--success-bg);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          padding: 14px;
          margin-bottom: var(--space-2);
        }
        .reset-success-message {
          font-size: 14px;
          color: var(--text-2);
          line-height: 1.6;
        }
        .reset-success-btn {
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

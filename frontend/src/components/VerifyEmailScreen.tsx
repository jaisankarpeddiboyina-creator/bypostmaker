import { useState, useEffect } from 'react'
import { Mail, Check, LogOut, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

export function VerifyEmailScreen() {
  const { user, setUser, setUsage, addToast } = useAppStore()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleCheckStatus = async () => {
    if (checking) return
    setChecking(true)
    try {
      const { user: updatedUser, usage } = await api.user.me()
      setUser(updatedUser)
      if (usage) {
        const planLimits: Record<string, number> = { free: 5, starter: 50, pro: 200, business: -1 }
        const limit = planLimits[updatedUser.plan] ?? 5
        setUsage({
          generations: usage.generations ?? 0,
          periodStart: usage.period_start ?? 0,
          periodEnd: usage.period_end ?? 0,
          limit,
          remaining: limit === -1 ? -1 : Math.max(0, limit - (usage.generations ?? 0)),
        })
      }
      if (updatedUser.email_verified === 1) {
        addToast('Email verified successfully! Welcome to PostMaker.', 'success')
      } else {
        addToast('Email not verified yet. Please check your inbox.', 'error')
      }
    } catch (err: any) {
      addToast(err.message ?? 'Failed to check verification status.', 'error')
    } finally {
      setChecking(false)
    }
  }

  const handleResendEmail = async () => {
    if (resending || cooldown > 0) return
    setResending(true)
    try {
      await api.auth.resendVerification()
      addToast('Verification email sent! Please check your inbox.', 'success')
      setCooldown(60)
    } catch (err: any) {
      addToast(err.message ?? 'Failed to resend verification email.', 'error')
    } finally {
      setResending(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await api.auth.logout()
      setUser(null)
      navigate('/')
    } catch (err: any) {
      addToast('Failed to sign out.', 'error')
    }
  }

  return (
    <div className="verify-screen">
      <div className="verify-card">
        <div className="verify-icon-wrapper">
          <Mail className="verify-icon" size={32} />
        </div>
        
        <h2 className="verify-title">Verify your email</h2>
        
        <p className="verify-description">
          We sent a verification link to <span className="verify-email">{user?.email}</span>.
          Please check your inbox and click the link to activate your account.
        </p>

        <div className="verify-actions">
          <button 
            className="btn btn-primary verify-btn" 
            onClick={handleCheckStatus} 
            disabled={checking}
          >
            {checking ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Checking status...
              </>
            ) : (
              <>
                <Check size={14} />
                Check status
              </>
            )}
          </button>

          <button 
            className="btn btn-ghost verify-btn" 
            onClick={handleResendEmail} 
            disabled={resending || cooldown > 0}
          >
            {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
          </button>

          <button 
            className="btn btn-ghost verify-btn danger" 
            onClick={handleSignOut}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      <style>{`
        .verify-screen {
          position: fixed;
          inset: 0;
          background: var(--bg);
          display: grid;
          place-items: center;
          z-index: 1000;
          padding: var(--space-4);
          font-family: var(--font-body);
        }
        .verify-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: var(--shadow-card);
        }
        .verify-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--accent-subtle);
          border: 1px solid rgba(124,58,237,0.2);
          color: var(--accent);
          display: grid;
          place-items: center;
          margin: 0 auto var(--space-6);
        }
        .verify-title {
          font-family: var(--font-display);
          font-size: 24px;
          color: var(--text-1);
          margin-bottom: var(--space-3);
        }
        .verify-description {
          font-size: 14px;
          color: var(--text-2);
          line-height: 1.6;
          margin-bottom: var(--space-8);
        }
        .verify-email {
          color: var(--text-1);
          font-weight: 600;
          word-break: break-all;
        }
        .verify-actions {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .verify-btn {
          width: 100%;
          height: 40px;
          justify-content: center;
        }
        .verify-btn.danger:hover {
          background: var(--error-bg);
          color: var(--error);
          border-color: rgba(220,38,38,0.2);
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

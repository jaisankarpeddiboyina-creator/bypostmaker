import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Globe, Trash2, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

export default function SettingsPage() {
  const { user, usage, addToast, setUser, currency, setCurrency } = useAppStore()
  const navigate = useNavigate()

  const [subStatus, setSubStatus] = useState<any>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.payments.status()
      .then(res => setSubStatus(res))
      .catch(() => {})
      .finally(() => setLoadingSub(false))
  }, [])

  const handleCancelSubscription = async () => {
    if (!confirm('Cancel your subscription? You keep access until the end of this billing period.')) return
    setCancelling(true)
    try {
      await api.payments.cancel()
      addToast('Subscription cancelled. Access continues until period end.', 'success')
      window.location.reload()
    } catch (err: any) {
      addToast(err.message ?? 'Cancellation failed', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE MY ACCOUNT') {
      addToast('Type the confirmation text exactly', 'error')
      return
    }
    setDeleting(true)
    try {
      await api.user.deleteAccount(deleteInput)
      setUser(null)
      navigate('/')
      addToast('Account deleted', 'success')
    } catch (err: any) {
      addToast(err.message ?? 'Deletion failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleCurrencyToggle = async (c: 'usd' | 'inr') => {
    setCurrency(c)
    try {
      await api.user.setCurrency(c)
    } catch { /* not critical */ }
  }

  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end * 1000)
        .toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="settings-page">
      <div className="settings-inner">
        <h1 className="settings-title">Settings</h1>

        {/* Plan & Usage */}
        <div className="settings-section">
          <h2 className="settings-section-title">Plan & Usage</h2>

          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="settings-label">Current plan</div>
                <div className="settings-value">
                  <span className={`badge badge-${user?.plan}`}>{user?.plan}</span>
                </div>
              </div>
              {user?.plan !== 'business' && (
                <button
                  className="btn btn-primary settings-upgrade-btn"
                  onClick={() => { useAppStore.getState().setShowUpgradeModal(true) }}
                >
                  Upgrade plan
                </button>
              )}
            </div>

            {usage && user?.plan !== 'business' && (
              <div className="settings-row" style={{ marginTop: 16 }}>
                <div style={{ flex: 1 }}>
                  <div className="settings-label">Generations this month</div>
                  <div className="settings-value" style={{ marginTop: 8 }}>
                    <div className="usage-bar-wrapper">
                      <div
                        className="usage-bar-fill"
                        style={{
                          width: `${Math.min(100, (usage.generations / usage.limit) * 100)}%`,
                          background: usage.remaining === 0 ? 'var(--error)' : 'var(--accent)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span className="settings-label">{usage.generations} used</span>
                      <span className="settings-label">{usage.remaining} remaining</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {subStatus?.subscription && (
              <div className="settings-row" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div>
                  <div className="settings-label">Billing</div>
                  <div className="settings-value" style={{ marginTop: 4 }}>
                    Status: {subStatus.subscription.status}
                    {periodEnd && ` · Renews ${periodEnd}`}
                  </div>
                </div>
                {subStatus.subscription.status === 'active' && (
                  <button
                    className="btn btn-ghost"
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Currency */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            <Globe size={16} />
            Currency
          </h2>
          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="settings-label">Pricing currency</div>
                <div className="settings-value" style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                  Affects how prices are shown on upgrade screens
                </div>
              </div>
              <div className="currency-toggle">
                <button
                  className={`currency-btn ${currency === 'usd' ? 'active' : ''}`}
                  onClick={() => addToast('USD pricing is temporarily unavailable. Payments are processed in INR.', 'info')}
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  USD ($)
                </button>
                <button
                  className={`currency-btn ${currency === 'inr' ? 'active' : ''}`}
                  onClick={() => handleCurrencyToggle('inr')}
                >
                  INR (₹)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="settings-section">
          <h2 className="settings-section-title">Account</h2>
          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="settings-label">Name</div>
                <div className="settings-value">{user?.name}</div>
              </div>
            </div>
            <div className="settings-row" style={{ marginTop: 12 }}>
              <div>
                <div className="settings-label">Email</div>
                <div className="settings-value">{user?.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="settings-section danger-section">
          <h2 className="settings-section-title danger-title">
            <AlertTriangle size={16} />
            Danger zone
          </h2>
          <div className="settings-card danger-card">
            <div className="settings-row">
              <div>
                <div className="settings-label">Delete account</div>
                <div className="settings-value" style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                  Permanently deletes your account, all campaigns, posts, and data.
                  Active subscriptions are cancelled immediately. This cannot be undone.
                </div>
              </div>
              <button
                className="btn"
                style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)', flexShrink: 0 }}
                onClick={() => setDeleteModal(true)}
              >
                <Trash2 size={13} />
                Delete account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8, color: 'var(--error)' }}>
                Delete account
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                This will permanently delete your account, all content, and cancel any active subscription.
                There is no undo.
              </p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>
                Type <strong style={{ color: 'var(--text-1)' }}>DELETE MY ACCOUNT</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                style={{
                  width: '100%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  color: 'var(--text-1)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setDeleteModal(false); setDeleteInput('') }}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: 'var(--error)', color: 'white' }}
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE MY ACCOUNT' || deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .settings-page {
          height: 100%;
          overflow-y: auto;
          padding: 32px 24px;
        }
        .settings-inner {
          max-width: 680px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .settings-title {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 700;
          color: var(--text-1);
          letter-spacing: -0.03em;
        }
        .settings-section { display: flex; flex-direction: column; gap: 12px; }
        .settings-section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-2);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .settings-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
        }
        .settings-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .settings-label {
          font-size: 12px;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
        }
        .settings-value {
          font-size: 15px;
          color: var(--text-1);
          margin-top: 4px;
        }
        .settings-upgrade-btn { flex-shrink: 0; }

        .usage-bar-wrapper {
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          overflow: hidden;
        }
        .usage-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.6s ease;
        }

        .currency-toggle {
          display: flex;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .currency-btn {
          padding: 7px 16px;
          font-size: 13px;
          background: transparent;
          border: none;
          color: var(--text-3);
          cursor: pointer;
          font-family: var(--font-body);
          transition: all var(--transition);
        }
        .currency-btn.active {
          background: var(--accent);
          color: white;
        }
        .currency-btn:not(.active):hover {
          background: var(--surface);
          color: var(--text-1);
        }

        .danger-section .settings-section-title { color: var(--error); }
        .danger-card { border-color: rgba(220,38,38,0.2); background: var(--error-bg); }
      `}</style>
    </div>
  )
}

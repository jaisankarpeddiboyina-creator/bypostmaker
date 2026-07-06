import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Trash2, AlertTriangle, User } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

export default function SettingsPage() {
  const { user, addToast, setUser, currency, setCurrency } = useAppStore()
  const navigate = useNavigate()

  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

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

  return (
    <div className="settings-page">
      <div className="settings-inner">
        <h1 className="settings-title">Settings</h1>

        {/* Currency Section */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            <Globe size={16} />
            <span>Pricing Currency</span>
          </h2>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-label">Display Currency</div>
                <div className="settings-value-description">
                  Affects how prices are displayed on subscription and upgrade screens.
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

        {/* Account Details Section */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            <User size={16} />
            <span>Profile Details</span>
          </h2>
          <div className="settings-card">
            <div className="profile-details-grid">
              <div className="settings-detail-row">
                <span className="detail-field-label">Full Name</span>
                <span className="detail-field-value">{user?.name}</span>
              </div>
              <div className="settings-detail-row">
                <span className="detail-field-label">Email Address</span>
                <span className="detail-field-value">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone Section */}
        <div className="settings-section danger-section">
          <h2 className="settings-section-title danger-title">
            <AlertTriangle size={16} />
            <span>Danger Zone</span>
          </h2>
          <div className="settings-card danger-card">
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-label" style={{ color: 'var(--color-error)' }}>Delete Account</div>
                <div className="settings-value-description">
                  Permanently deletes your account, campaigns, posts, and data.
                  Active subscriptions are cancelled immediately. This cannot be undone.
                </div>
              </div>
              <button
                className="btn delete-account-btn"
                onClick={() => setDeleteModal(true)}
              >
                <Trash2 size={13} />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => { setDeleteModal(false); setDeleteInput(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8, color: 'var(--color-error)' }}>
                Delete Account
              </h2>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                This will permanently delete your account, all generated campaigns, and cancel any active subscription immediately.
                There is no undo.
              </p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>
                Type <strong style={{ color: 'var(--color-text-primary)' }}>DELETE MY ACCOUNT</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                style={{
                  width: '100%',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  color: 'var(--color-text-primary)',
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
                style={{ background: 'var(--color-error)', color: 'white' }}
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
          color: var(--color-text-primary);
          letter-spacing: -0.03em;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .settings-section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .settings-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: 24px;
          box-shadow: var(--shadow-card);
        }

        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .settings-row-text {
          flex: 1;
          min-width: 250px;
        }

        .settings-label {
          font-size: 11px;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .settings-value-description {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: 4px;
          line-height: 1.4;
        }

        .currency-toggle {
          display: flex;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
          background: var(--color-bg);
        }

        .currency-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          font-family: var(--font-body);
          transition: all var(--transition);
        }

        .currency-btn.active {
          background: var(--color-primary-start);
          color: white;
        }

        .currency-btn:not(.active):hover {
          background: var(--color-border);
          color: var(--color-text-primary);
        }

        .profile-details-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .settings-detail-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-field-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .detail-field-value {
          font-size: 15px;
          color: var(--color-text-primary);
          font-weight: 500;
        }

        .danger-section .settings-section-title {
          color: var(--color-error);
        }

        .danger-card {
          border-color: rgba(239, 68, 68, 0.2);
          background: var(--color-error-bg);
        }

        .delete-account-btn {
          background: transparent;
          color: var(--color-error);
          border: 1px solid var(--color-error);
          font-size: 13px;
        }

        .delete-account-btn:hover {
          background: var(--color-error);
          color: white;
        }

        @media (max-width: 768px) {
          .settings-page {
            padding: 20px 16px;
          }
          .settings-row {
            flex-direction: column;
            align-items: stretch;
          }
          .currency-toggle {
            justify-content: center;
            margin-top: 12px;
          }
          .delete-account-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}


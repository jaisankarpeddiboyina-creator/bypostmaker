import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Link2, ShieldCheck, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'

interface Connection {
  id: string
  platform: string
  label: string
  status: string
  created_at: number
}

// Official Discord Brand Icon Mark
function DiscordIcon({ size = 22, color = '#5865F2' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

export default function ConnectionsPage() {
  const { addToast } = useAppStore()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Form State
  const [label, setLabel] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const fetchConnections = async () => {
    try {
      setLoading(true)
      const res = await api.omnipost.getConnections()
      if (res.success && res.data) {
        setConnections(res.data)
      }
    } catch (err: any) {
      addToast(err?.message || 'Failed to load connections', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!webhookUrl.trim()) {
      setFormError('Webhook URL is required')
      return
    }

    try {
      setAdding(true)
      const res = await api.omnipost.createConnection('discord', webhookUrl.trim(), label.trim() || undefined)
      
      if (res.success && res.data) {
        addToast('Discord webhook connected successfully!', 'success')
        setLabel('')
        setWebhookUrl('')
        fetchConnections()
      } else {
        setFormError(res.error || 'Failed to connect webhook')
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to connect webhook')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteConnection = async (id: string) => {
    try {
      setDeletingId(id)
      const res = await api.omnipost.deleteConnection(id)
      if (res.success) {
        addToast('Connection removed successfully', 'info')
        setConnections(prev => prev.filter(c => c.id !== id))
        setConfirmDeleteId(null)
      } else {
        addToast(res.error || 'Failed to delete connection', 'error')
      }
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete connection', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="connections-page-container">
      {/* Header Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Connected Accounts</h1>
          <p className="page-subtitle">Connect your social platforms to publish posts instantly or schedule for later.</p>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="stat-cards-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper primary">
            <Link2 size={20} />
          </div>
          <div>
            <span className="stat-value">{connections.length}</span>
            <span className="stat-label">Connected Webhooks</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper success">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="stat-value">100%</span>
            <span className="stat-label">Delivery Health</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper info">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="stat-value">Secure</span>
            <span className="stat-label">Isolated Auth Scope</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="connections-content-grid">
        {/* Left Column: Connected Channels List */}
        <div className="glass-card connections-list-card">
          <div className="list-header">
            <h2 className="section-title">Your Connected Accounts</h2>
            <span className="channel-count-badge">{connections.length} Active</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <Loader2 size={28} className="animate-spin text-primary" />
              <span>Loading saved channels...</span>
            </div>
          ) : connections.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-circle">
                <DiscordIcon size={32} color="#5865F2" />
              </div>
              <h3>No Channels Connected Yet</h3>
              <p>Add a Discord Webhook URL on the right to start publishing directly from PostMaker.</p>
            </div>
          ) : (
            <div className="connections-list">
              {connections.map(item => (
                <div key={item.id} className="connection-row-item">
                  <div className="connection-platform-info">
                    <div className="platform-icon-badge discord">
                      <DiscordIcon size={24} color="#ffffff" />
                    </div>
                    <div className="connection-text-details">
                      <div className="connection-title-row">
                        <span className="connection-platform-name">Discord</span>
                        <span className="connection-status-tag connected">Connected</span>
                      </div>
                      <span className="connection-label-text">{item.label || 'Discord Channel'}</span>
                      <span className="connection-date-text">
                        Added {new Date(item.created_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions / Confirmation */}
                  <div className="connection-actions">
                    {confirmDeleteId === item.id ? (
                      <div className="confirm-delete-group">
                        <span className="confirm-text">Remove?</span>
                        <button
                          type="button"
                          className="btn-danger-xs"
                          disabled={deletingId === item.id}
                          onClick={() => handleDeleteConnection(item.id)}
                        >
                          {deletingId === item.id ? <Loader2 size={12} className="animate-spin" /> : 'Yes, Delete'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-icon-remove"
                        title="Remove connection"
                        onClick={() => setConfirmDeleteId(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Add Webhook Form */}
        <div className="glass-card add-connection-card">
          <div className="form-card-header">
            <div className="form-header-icon">
              <DiscordIcon size={22} color="#ffffff" />
            </div>
            <div>
              <h2 className="section-title">Add Discord Webhook</h2>
              <p className="form-subtitle">Connect a channel using a Discord Webhook URL.</p>
            </div>
          </div>

          <form onSubmit={handleAddConnection} className="add-connection-form">
            {formError && (
              <div className="form-error-alert">
                <AlertCircle size={16} className="error-icon" />
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="conn-label" className="form-label">Channel Label (Optional)</label>
              <input
                id="conn-label"
                type="text"
                className="form-input"
                placeholder="e.g. #announcements or Production Channel"
                value={label}
                onChange={e => setLabel(e.target.value)}
                disabled={adding}
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="webhook-url" className="form-label">Discord Webhook URL *</label>
              <input
                id="webhook-url"
                type="url"
                className="form-input"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                disabled={adding}
                required
              />
              <span className="form-hint">Obtain from Discord Channel Settings → Integrations → Webhooks</span>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-connect" disabled={adding}>
              {adding ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Validating Webhook...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Connect Channel</span>
                </>
              )}
            </button>
          </form>

          {/* Help Teaser */}
          <div className="security-notice-footer">
            <ShieldCheck size={14} className="text-primary" />
            <span>Webhook URLs are stored securely and SSRF-validated on Cloudflare D1.</span>
          </div>
        </div>
      </div>

      <style>{`
        .connections-page-container {
          padding: 28px 36px;
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          height: 100%;
          overflow-y: auto;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .page-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--color-text-primary);
        }

        .page-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin-top: 4px;
        }

        /* Stat Cards Grid */
        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .stat-card {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .stat-icon-wrapper {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon-wrapper.primary {
          background: rgba(56, 189, 248, 0.12);
          color: #38BDF8;
        }

        .stat-icon-wrapper.success {
          background: rgba(34, 197, 94, 0.12);
          color: #22C55E;
        }

        .stat-icon-wrapper.info {
          background: rgba(168, 85, 247, 0.12);
          color: #A855F7;
        }

        .stat-value {
          display: block;
          font-size: 20px;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .stat-label {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        /* Main Content Grid */
        .connections-content-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 24px;
          align-items: start;
        }

        .connections-list-card, .add-connection-card {
          padding: 24px;
        }

        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--color-border);
          margin-bottom: 18px;
        }

        .section-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .channel-count-badge {
          font-size: 12px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
          background: rgba(34, 197, 94, 0.12);
          color: #22C55E;
        }

        .loading-state {
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: var(--color-text-secondary);
          font-size: 14px;
        }

        .empty-state {
          padding: 48px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .empty-icon-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(88, 101, 242, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .empty-state p {
          font-size: 13px;
          color: var(--color-text-secondary);
          max-width: 340px;
          line-height: 1.5;
        }

        /* Connections List Rows */
        .connections-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .connection-row-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          transition: all var(--transition);
        }

        .connection-row-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--color-border-hover);
        }

        .connection-platform-info {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .platform-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .platform-icon-badge.discord {
          background: #5865F2;
          box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);
        }

        .connection-text-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .connection-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .connection-platform-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .connection-status-tag {
          font-size: 11px;
          font-weight: 600;
          padding: 1px 7px;
          border-radius: 10px;
        }

        .connection-status-tag.connected {
          background: rgba(34, 197, 94, 0.15);
          color: #22C55E;
        }

        .connection-label-text {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .connection-date-text {
          font-size: 11.5px;
          color: var(--color-text-secondary);
        }

        /* Actions & Confirm Delete */
        .btn-icon-remove {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          padding: 8px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--transition);
        }

        .btn-icon-remove:hover {
          color: #EF4444;
          background: rgba(239, 68, 68, 0.12);
        }

        .confirm-delete-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .confirm-text {
          font-size: 12px;
          font-weight: 600;
          color: #EF4444;
        }

        .btn-danger-xs {
          background: #EF4444;
          color: #ffffff;
          border: none;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-secondary-xs {
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11.5px;
          cursor: pointer;
        }

        /* Add Webhook Form Card */
        .form-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--color-border);
          margin-bottom: 20px;
        }

        .form-header-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: #5865F2;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .form-subtitle {
          font-size: 12.5px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        .add-connection-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-error-alert {
          padding: 10px 12px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-sm);
          color: #FCA5A5;
          font-size: 12.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .form-input {
          padding: 10px 14px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-text-primary);
          font-size: 13px;
          outline: none;
          transition: all var(--transition);
        }

        .form-input:focus {
          border-color: var(--color-primary-start);
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
        }

        .form-hint {
          font-size: 11px;
          color: var(--color-text-secondary);
          line-height: 1.3;
        }

        .btn-connect {
          margin-top: 6px;
        }

        .security-notice-footer {
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11.5px;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        @media (max-width: 1024px) {
          .connections-content-grid {
            grid-template-columns: 1fr;
          }
          .stat-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

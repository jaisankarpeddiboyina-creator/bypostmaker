import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Link2, ShieldCheck, Search, X, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_MAP } from '@@config/platforms'

interface Connection {
  id: string
  platform: string
  label: string
  username?: string | null
  status: string
  created_at: number
}

const PLATFORM_GRID_ITEMS = [
  { id: 'twitter', name: 'X / Twitter', category: 'oauth', color: '#1D9BF0' },
  { id: 'linkedin', name: 'LinkedIn', category: 'oauth', color: '#0A66C2' },
  { id: 'mastodon', name: 'Mastodon', category: 'oauth', color: '#6364FF' },
  { id: 'threads', name: 'Threads', category: 'oauth', color: '#000000' },
  { id: 'reddit', name: 'Reddit', category: 'oauth', color: '#FF4500' },
  { id: 'youtube', name: 'YouTube', category: 'oauth', color: '#FF0000' },
  { id: 'pinterest', name: 'Pinterest', category: 'oauth', color: '#E60023' },
  { id: 'facebook', name: 'Facebook', category: 'oauth', color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', category: 'oauth', color: '#E1306C' },
  { id: 'bluesky', name: 'Bluesky', category: 'credentials', color: '#0085FF' },
  { id: 'discord', name: 'Discord Webhook', category: 'webhook', color: '#5865F2' },
  { id: 'slack', name: 'Slack Webhook', category: 'webhook', color: '#4A154B' },
  { id: 'webhooks', name: 'Generic Webhook', category: 'webhook', color: '#64748B' },
]

export default function ConnectionsPage() {
  const { addToast } = useAppStore()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'oauth' | 'webhook' | 'credentials'>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<typeof PLATFORM_GRID_ITEMS[0] | null>(null)

  // Form States
  const [label, setLabel] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [handle, setHandle] = useState('')
  const [appPassword, setAppPassword] = useState('')
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

  const handleTileClick = (plat: typeof PLATFORM_GRID_ITEMS[0]) => {
    setFormError(null)
    setLabel('')
    setWebhookUrl('')
    setHandle('')
    setAppPassword('')

    if (plat.category === 'oauth') {
      window.location.href = `/api/omnipost/oauth/connect?platform=${plat.id}`
    } else {
      setSelectedPlatform(plat)
    }
  }

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!selectedPlatform) return

    const platform = selectedPlatform.id

    if (selectedPlatform.category === 'webhook' && !webhookUrl.trim()) {
      setFormError('Webhook URL is required')
      return
    }

    if (platform === 'bluesky' && (!handle.trim() || !appPassword.trim())) {
      setFormError('Bluesky Handle and App Password are required')
      return
    }

    try {
      setAdding(true)
      let res
      if (platform === 'bluesky') {
        res = await api.omnipost.createConnection(
          platform,
          undefined,
          label.trim() || undefined,
          handle.trim(),
          appPassword.trim()
        )
      } else {
        res = await api.omnipost.createConnection(
          platform,
          webhookUrl.trim(),
          label.trim() || undefined
        )
      }

      if (res.success && res.data) {
        addToast(`${selectedPlatform.name} connected successfully!`, 'success')
        setSelectedPlatform(null)
        setLabel('')
        setWebhookUrl('')
        setHandle('')
        setAppPassword('')
        fetchConnections()
      } else {
        setFormError(res.error || 'Failed to connect account')
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to connect account')
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

  const getPlatformName = (platformId: string) => {
    if (platformId === 'webhooks') return 'Generic Webhook'
    return PLATFORM_MAP[platformId]?.name || platformId
  }

  const filteredPlatforms = PLATFORM_GRID_ITEMS.filter(plat => {
    const matchesSearch = plat.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || plat.category === activeTab
    return matchesSearch && matchesTab
  })

  return (
    <div className="connections-page-container">
      {/* Header Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Connected Accounts</h1>
          <p className="page-subtitle">Connect your social platforms to publish posts instantly or schedule for later.</p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="connections-content-grid">
        {/* Left Column: Explorer Grid & Active Connections */}
        <div className="left-column-container">
          
          {/* Active Connections List */}
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
                  <Link2 size={32} className="text-secondary" />
                </div>
                <h3>No Channels Connected Yet</h3>
                <p>Select a platform below or add a Webhook on the right to start publishing directly from PostMaker.</p>
              </div>
            ) : (
              <div className="connections-list">
                {connections.map(item => {
                  const brandColor = PLATFORM_MAP[item.platform]?.brandColor || '#64748B'
                  return (
                    <div key={item.id} className="connection-row-item">
                      <div className="connection-platform-info">
                        <div className="platform-icon-badge" style={{ backgroundColor: brandColor }}>
                          <PlatformIcon id={item.platform} size={20} color="#ffffff" useBrandColor={false} />
                        </div>
                        <div className="connection-text-details">
                          <div className="connection-title-row">
                            <span className="connection-platform-name">{getPlatformName(item.platform)}</span>
                            <span className="connection-status-tag connected">Connected</span>
                          </div>
                          {item.username && (
                            <span className="connection-handle-text">{item.username}</span>
                          )}
                          <span className="connection-label-text">{item.label}</span>
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
                  )
                })}
              </div>
            )}
          </div>

          {/* Platform Explorer Grid Card */}
          <div className="glass-card explorer-card">
            <div className="explorer-header">
              <h2 className="section-title">Add New Connection</h2>
              <p className="explorer-subtitle">Choose a platform to authenticate via OAuth, Webhook, or Credentials.</p>
            </div>

            {/* Filter controls */}
            <div className="controls-row">
              <div className="search-box-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search platforms..."
                  className="search-input-field"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="category-tabs-row">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'oauth' ? 'active' : ''}`}
                  onClick={() => setActiveTab('oauth')}
                >
                  OAuth
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'webhook' ? 'active' : ''}`}
                  onClick={() => setActiveTab('webhook')}
                >
                  Webhooks
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'credentials' ? 'active' : ''}`}
                  onClick={() => setActiveTab('credentials')}
                >
                  Credentials
                </button>
              </div>
            </div>

            {/* Platforms Grid */}
            <div className="platforms-grid">
              {filteredPlatforms.map(plat => (
                <button
                  key={plat.id}
                  type="button"
                  className="platform-tile-btn"
                  onClick={() => handleTileClick(plat)}
                >
                  <div className="tile-icon-badge" style={{ backgroundColor: plat.color }}>
                    <PlatformIcon id={plat.id} size={22} color="#ffffff" useBrandColor={false} />
                  </div>
                  <span className="tile-platform-name">{plat.name}</span>
                  <ChevronRight size={14} className="tile-arrow" />
                </button>
              ))}
              {filteredPlatforms.length === 0 && (
                <div className="no-platforms-found">
                  No platforms match "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Connection Configuration form */}
        <div className="right-column-container">
          {selectedPlatform ? (
            <div className="glass-card add-connection-card">
              <div className="form-card-header">
                <div className="form-header-icon" style={{ backgroundColor: selectedPlatform.color }}>
                  <PlatformIcon id={selectedPlatform.id} size={22} color="#ffffff" useBrandColor={false} />
                </div>
                <div>
                  <h2 className="section-title">Connect {selectedPlatform.name}</h2>
                  <p className="form-subtitle">
                    {selectedPlatform.category === 'webhook'
                      ? 'Configure a direct push channel integration.'
                      : 'Provide your account login credentials.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close-form"
                  onClick={() => setSelectedPlatform(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddConnection} className="add-connection-form">
                {formError && (
                  <div className="form-error-alert">
                    <AlertCircle size={16} className="error-icon" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="conn-label" className="form-label">Connection Name / Label *</label>
                  <input
                    id="conn-label"
                    type="text"
                    className="form-input"
                    placeholder={`e.g. My ${selectedPlatform.name}`}
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    disabled={adding}
                    maxLength={50}
                    required
                  />
                </div>

                {selectedPlatform.category === 'webhook' && (
                  <div className="form-group">
                    <label htmlFor="webhook-url" className="form-label">Webhook URL *</label>
                    <input
                      id="webhook-url"
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={webhookUrl}
                      onChange={e => setWebhookUrl(e.target.value)}
                      disabled={adding}
                      required
                    />
                    <span className="form-hint">
                      {selectedPlatform.id === 'discord'
                        ? 'Discord Settings → Integrations → Webhooks'
                        : selectedPlatform.id === 'slack'
                        ? 'Slack App Directory → Incoming Webhooks'
                        : 'Specify any target webhook HTTP POST URL.'}
                    </span>
                  </div>
                )}

                {selectedPlatform.id === 'bluesky' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="bsky-handle" className="form-label">Bluesky Handle *</label>
                      <input
                        id="bsky-handle"
                        type="text"
                        className="form-input"
                        placeholder="username.bsky.social"
                        value={handle}
                        onChange={e => setHandle(e.target.value)}
                        disabled={adding}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="bsky-password" className="form-label">App Password *</label>
                      <input
                        id="bsky-password"
                        type="password"
                        className="form-input"
                        placeholder="xxxx-xxxx-xxxx-xxxx"
                        value={appPassword}
                        onChange={e => setAppPassword(e.target.value)}
                        disabled={adding}
                        required
                      />
                      <span className="form-hint">
                        Bluesky Settings → App Passwords → Generate App Password.
                      </span>
                    </div>
                  </>
                )}

                <button type="submit" className="btn btn-primary w-full btn-connect" disabled={adding}>
                  {adding ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Validating credentials...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Connect Integration</span>
                    </>
                  )}
                </button>
              </form>

              {/* Help & Vault Info */}
              <div className="security-notice-footer">
                <ShieldCheck size={16} className="text-success-icon" />
                <span className="notice-text">
                  Vault secrets are envelope-encrypted with WebCrypto AES-GCM and stored securely on Cloudflare D1.
                </span>
              </div>
            </div>
          ) : (
            <div className="glass-card configure-placeholder-card">
              <ShieldCheck size={48} className="placeholder-shield-icon" />
              <h3>Secure Connections</h3>
              <p>
                Select any platform on the left to begin configuring its webhook or credentials integrations. OAuth connections will authenticate securely through their provider screens.
              </p>
            </div>
          )}
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

        /* Main Content Layout Grid */
        .connections-content-grid {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 24px;
          align-items: start;
        }

        .left-column-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .right-column-container {
          position: sticky;
          top: 24px;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 24px;
          transition: border-color var(--transition);
        }

        .glass-card:hover {
          border-color: var(--color-border-hover);
        }

        .list-header, .explorer-header {
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
          padding: 40px 20px;
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
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .empty-state p {
          font-size: 13px;
          color: var(--color-text-secondary);
          max-width: 380px;
          line-height: 1.5;
        }

        /* Connections List */
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
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          transition: all var(--transition);
        }

        .connection-row-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--color-border-hover);
        }

        .connection-platform-info {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
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

        .connection-text-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
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

        .connection-handle-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-primary-start);
          margin-top: 1px;
        }

        .connection-label-text {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .connection-date-text {
          font-size: 11px;
          color: var(--color-text-secondary);
          opacity: 0.7;
        }

        .connection-actions {
          flex-shrink: 0;
          margin-left: 12px;
        }

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
          font-size: 11.5px;
          font-weight: 600;
          color: #EF4444;
        }

        .btn-danger-xs {
          background: #EF4444;
          color: #ffffff;
          border: none;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-secondary-xs {
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        /* Explorer Grid Controls */
        .explorer-subtitle {
          font-size: 12.5px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        .controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .search-box-wrapper {
          position: relative;
          flex: 1;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-secondary);
        }

        .search-input-field {
          width: 100%;
          padding: 8px 36px 8px 36px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text-primary);
          font-size: 13px;
          outline: none;
          transition: all var(--transition);
        }

        .search-input-field:focus {
          border-color: var(--color-primary-start);
        }

        .search-clear-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .category-tabs-row {
          display: flex;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 3px;
          gap: 2px;
        }

        .tab-btn {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          transition: all var(--transition);
        }

        .tab-btn:hover {
          color: var(--color-text-primary);
        }

        .tab-btn.active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--color-text-primary);
        }

        /* Platforms Grid */
        .platforms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 12px;
        }

        .platform-tile-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition);
          width: 100%;
        }

        .platform-tile-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--color-border-hover);
          transform: translateY(-1px);
        }

        .tile-icon-badge {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tile-platform-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          flex: 1;
        }

        .tile-arrow {
          color: var(--color-text-secondary);
          opacity: 0.5;
          transition: transform var(--transition);
        }

        .platform-tile-btn:hover .tile-arrow {
          opacity: 1;
          transform: translateX(2px);
        }

        .no-platforms-found {
          grid-column: 1 / -1;
          text-align: center;
          padding: 30px;
          color: var(--color-text-secondary);
          font-size: 13px;
        }

        /* Add connection card configuration */
        .form-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--color-border);
          margin-bottom: 20px;
          position: relative;
        }

        .form-header-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .btn-close-form {
          position: absolute;
          right: 0;
          top: 0;
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: all var(--transition);
        }

        .btn-close-form:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.05);
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
          width: 100%;
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
          line-height: 1.4;
          margin-top: 2px;
        }

        .btn-connect {
          margin-top: 6px;
        }

        /* Security footer */
        .security-notice-footer {
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px solid var(--color-border);
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .text-success-icon {
          color: #22C55E;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .notice-text {
          font-size: 11.5px;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        /* Configure placeholder */
        .configure-placeholder-card {
          padding: 48px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          min-height: 320px;
        }

        .placeholder-shield-icon {
          color: var(--color-text-secondary);
          opacity: 0.3;
        }

        .configure-placeholder-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .configure-placeholder-card p {
          font-size: 13px;
          color: var(--color-text-secondary);
          line-height: 1.6;
          max-width: 320px;
        }

        @media (max-width: 1024px) {
          .connections-content-grid {
            grid-template-columns: 1fr;
          }
          .right-column-container {
            position: static;
          }
        }
      `}</style>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'
import { Send, Plus, Loader2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react'

interface Connection {
  id: string
  platform: string
  label: string
  status: string
  created_at: number
}

interface PublishControlProps {
  text: string
  mediaUrls?: string[]
}

export function PublishControl({ text, mediaUrls = [] }: PublishControlProps) {
  const { addToast } = useAppStore()
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showAddWebhook, setShowAddWebhook] = useState(false)
  const [webhookUrlInput, setWebhookUrlInput] = useState('')
  const [webhookLabelInput, setWebhookLabelInput] = useState('')
  const [addingWebhook, setAddingWebhook] = useState(false)
  const [lastPublishedUrl, setLastPublishedUrl] = useState<string | null>(null)

  const fetchConnections = async () => {
    try {
      setLoading(true)
      const res = await api.omnipost.getConnections()
      if (res.success && Array.isArray(res.data)) {
        setConnections(res.data)
        if (res.data.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(res.data[0].id)
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch connections:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!webhookUrlInput.trim()) return

    const DISCORD_REGEX = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/
    if (!DISCORD_REGEX.test(webhookUrlInput.trim())) {
      addToast('Invalid Discord webhook URL format', 'error')
      return
    }

    try {
      setAddingWebhook(true)
      const res = await api.omnipost.createConnection(
        'discord',
        webhookUrlInput.trim(),
        webhookLabelInput.trim() || 'Discord Channel'
      )

      if (res.success && res.data) {
        addToast('Discord webhook connected successfully!', 'success')
        setWebhookUrlInput('')
        setWebhookLabelInput('')
        setShowAddWebhook(false)
        await fetchConnections()
        setSelectedConnectionId(res.data.id)
      } else {
        addToast(res.error || 'Failed to save webhook', 'error')
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to connect webhook', 'error')
    } finally {
      setAddingWebhook(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedConnectionId) {
      addToast('Please select or connect a Discord channel first', 'error')
      return
    }
    if (!text.trim() && mediaUrls.length === 0) {
      addToast('Post text or media is required to publish', 'error')
      return
    }

    try {
      setPublishing(true)
      setLastPublishedUrl(null)
      const clientUuid = crypto.randomUUID()
      const res = await api.omnipost.publish(selectedConnectionId, text, mediaUrls, clientUuid)

      if (res.success && res.data?.status === 'success') {
        addToast('Published to Discord successfully!', 'success')
        if (res.data.url) {
          setLastPublishedUrl(res.data.url)
        }
      } else {
        addToast(res.error || 'Dispatch failed', 'error')
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to publish to Discord', 'error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="publish-control-container glass-card" style={{ padding: '16px 20px', margin: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={16} style={{ color: 'var(--color-primary-start)' }} />
          <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Publish to Discord
          </h4>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowAddWebhook(!showAddWebhook)}
          style={{ height: 30, padding: '0 10px', fontSize: 12 }}
        >
          <Plus size={14} />
          <span>{showAddWebhook ? 'Cancel' : 'Add Webhook'}</span>
        </button>
      </div>

      {showAddWebhook && (
        <form onSubmit={handleAddWebhook} style={{ marginBottom: 16, padding: 12, background: 'rgba(255, 255, 255, 0.4)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="Discord Webhook URL (https://discord.com/api/webhooks/...)"
              value={webhookUrlInput}
              onChange={(e) => setWebhookUrlInput(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border-input)',
                background: '#FFFFFF',
                fontSize: 13,
                fontFamily: 'var(--font-mono)'
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Channel Name / Label (Optional)"
                value={webhookLabelInput}
                onChange={(e) => setWebhookLabelInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-input)',
                  background: '#FFFFFF',
                  fontSize: 13
                }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={addingWebhook || !webhookUrlInput.trim()}
              >
                {addingWebhook ? <Loader2 size={14} className="spin" /> : 'Save Webhook'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <select
          value={selectedConnectionId}
          onChange={(e) => setSelectedConnectionId(e.target.value)}
          disabled={loading || publishing || connections.length === 0}
          style={{
            flex: 1,
            height: 38,
            padding: '0 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border-input)',
            background: '#FFFFFF',
            color: 'var(--color-text-primary)',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          {connections.length === 0 ? (
            <option value="">No Discord webhooks connected</option>
          ) : (
            connections.map(c => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.id.slice(0, 8)})
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handlePublish}
          disabled={publishing || !selectedConnectionId || (!text.trim() && mediaUrls.length === 0)}
          style={{ height: 38 }}
        >
          {publishing ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          <span>{publishing ? 'Publishing...' : 'Publish Now'}</span>
        </button>
      </div>

      {lastPublishedUrl && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)' }}>
          <CheckCircle2 size={15} />
          <span>Message live on Discord!</span>
          <a
            href={lastPublishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'underline', color: 'var(--color-primary-start)', marginLeft: 6 }}
          >
            <span>View Message</span>
            <ExternalLink size={13} />
          </a>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, TrendingUp, Tag, Shield, Search, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

interface Stats {
  users: { total: number; free: number; starter: number; pro: number; business: number; beta: number; disabled: number; new_today: number; new_week: number }
  subscriptions: { total: number; active: number; usd: number; inr: number }
  campaigns: { total: number; today: number }
  usage: { total: number }
  topPlatforms: Array<{ platform_id: string; count: number }>
}

interface AdminUser {
  id: string; email: string; name: string
  plan: string; role: string; disabled: number; created_at: number
}

interface Promo {
  code: string; description: string; discount_pct: number
  max_uses: number | null; uses: number; active: number
}

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  threads: 'Threads',
  youtube: 'YouTube',
}

export default function AdminPage() {
  const { user, addToast } = useAppStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'stats'|'users'|'promos'>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  const [search, setSearch] = useState('')
  const [promos, setPromos] = useState<Promo[]>([])
  const [newPromo, setNewPromo] = useState({ code: '', description: '', discount_pct: 20, max_uses: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin' && user !== null) { navigate('/app'); return }
    if (tab === 'stats') loadStats()
    if (tab === 'users') loadUsers(1, '')
    if (tab === 'promos') loadPromos()
  }, [tab, user])

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' })
      if (!res.ok) {
        addToast('Failed to load stats', 'error')
        return
      }
      const data = await res.json()
      if (data.error) {
        addToast(data.error, 'error')
        return
      }
      setStats(data)
    } catch { addToast('Failed to load stats', 'error') }
  }

  const loadUsers = async (page: number, q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(q)}`, { credentials: 'include' })
      const data = await res.json() as { users: AdminUser[]; total: number }
      setUsers(data.users); setUserTotal(data.total); setUserPage(page)
    } catch { addToast('Failed to load users', 'error') }
    setLoading(false)
  }

  const loadPromos = async () => {
    try {
      const res = await fetch('/api/admin/promos', { credentials: 'include' })
      const data = await res.json() as { promos: Promo[] }
      setPromos(data.promos)
    } catch { addToast('Failed to load promos', 'error') }
  }

  const updateUser = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    loadUsers(userPage, search)
    addToast('User updated', 'success')
  }

  const createPromo = async () => {
    if (!newPromo.code) { addToast('Code required', 'error'); return }
    await fetch('/api/admin/promos', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPromo, max_uses: newPromo.max_uses ? parseInt(newPromo.max_uses) : null }),
    })
    setNewPromo({ code: '', description: '', discount_pct: 20, max_uses: '' })
    loadPromos()
    addToast('Promo created', 'success')
  }

  const deactivatePromo = async (code: string) => {
    await fetch(`/api/admin/promos/${code}`, { method: 'DELETE', credentials: 'include' })
    loadPromos()
    addToast('Promo deactivated', 'success')
  }

  return (
    <div className="admin-page">
      <div className="admin-inner">
        <div className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={20} color="var(--accent)" />
            <h1 className="admin-title">Admin</h1>
          </div>
          <div className="admin-tabs">
            {(['stats','users','promos'] as const).map(t => (
              <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {tab === 'stats' && stats && (
          <div className="admin-stats">
            <div className="stat-group">
              <h3 className="stat-group-title"><Users size={14} /> Users</h3>
              <div className="stat-grid">
                {[
                  ['Total', stats.users.total],
                  ['New today', stats.users.new_today],
                  ['New this week', stats.users.new_week],
                  ['Free', stats.users.free],
                  ['Starter', stats.users.starter],
                  ['Pro', stats.users.pro],
                  ['Business', stats.users.business],
                  ['Beta', stats.users.beta],
                  ['Disabled', stats.users.disabled],
                ].map(([label, value]) => (
                  <div key={String(label)} className="stat-card">
                    <div className="stat-value">{value}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="stat-group">
              <h3 className="stat-group-title"><TrendingUp size={14} /> Revenue & Usage</h3>
              <div className="stat-grid">
                {[
                  ['Active subs', stats.subscriptions.active],
                  ['Total subs', stats.subscriptions.total],
                  ['USD subs', stats.subscriptions.usd],
                  ['INR subs', stats.subscriptions.inr],
                  ['Total campaigns', stats.campaigns.total],
                  ['Campaigns today', stats.campaigns.today],
                  ['Generations (30d)', stats.usage.total],
                ].map(([label, value]) => (
                  <div key={String(label)} className="stat-card">
                    <div className="stat-value">{value}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="stat-group">
              <h3 className="stat-group-title"><BarChart2 size={14} /> Top Platforms</h3>
              <div className="platform-list">
                {stats.topPlatforms && stats.topPlatforms.length > 0 ? (
                  stats.topPlatforms.map((p, idx) => (
                    <div key={p.platform_id} className="platform-row">
                      <div className="platform-rank">#{idx + 1}</div>
                      <div className="platform-name">
                        {PLATFORM_NAMES[p.platform_id.toLowerCase()] || p.platform_id}
                      </div>
                      <div className="platform-count">
                        <span className="platform-count-value">{p.count}</span> generations
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0' }}>
                    No completed campaigns found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="admin-users">
            <div className="admin-search">
              <Search size={14} />
              <input placeholder="Search by email or name…" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers(1, search)} />
              <button className="btn btn-ghost" style={{ height: 32 }}
                onClick={() => loadUsers(1, search)}>Search</button>
            </div>
            <div className="admin-table">
              <div className="admin-table-header">
                <span>User</span><span>Plan</span><span>Role</span><span>Status</span><span>Actions</span>
              </div>
              {users.map(u => (
                <div key={u.id} className="admin-table-row">
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email}</div>
                  </div>
                  <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{u.role}</span>
                  <span style={{ fontSize: 12, color: u.disabled ? 'var(--error)' : 'var(--success)' }}>
                    {u.disabled ? 'Disabled' : 'Active'}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select className="admin-select"
                      value={u.role}
                      onChange={e => updateUser(u.id, { role: e.target.value })}>
                      <option value="user">User</option>
                      <option value="beta">Beta</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select className="admin-select"
                      value={u.plan}
                      onChange={e => updateUser(u.id, { plan: e.target.value })}>
                      {['free','starter','pro','business'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <button className="btn-icon"
                      onClick={() => updateUser(u.id, { disabled: !u.disabled })}
                      title={u.disabled ? 'Enable' : 'Disable'}>
                      {u.disabled ? '✓' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {userTotal > 50 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', padding: 16 }}>
                <button className="btn btn-ghost" onClick={() => loadUsers(userPage - 1, search)} disabled={userPage === 1}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  Page {userPage} · {userTotal} users
                </span>
                <button className="btn btn-ghost" onClick={() => loadUsers(userPage + 1, search)} disabled={userPage * 50 >= userTotal}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Promos */}
        {tab === 'promos' && (
          <div className="admin-promos">
            <div className="promo-create">
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 12 }}>
                <Tag size={14} style={{ marginRight: 6 }} />Create promo code
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="promo-input" placeholder="CODE" value={newPromo.code}
                  onChange={e => setNewPromo(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                <input className="promo-input" placeholder="Description" value={newPromo.description}
                  onChange={e => setNewPromo(p => ({ ...p, description: e.target.value }))}
                  style={{ flex: 2 }} />
                <input className="promo-input" type="number" placeholder="Discount %" value={newPromo.discount_pct}
                  onChange={e => setNewPromo(p => ({ ...p, discount_pct: parseInt(e.target.value) || 0 }))}
                  style={{ width: 100 }} />
                <input className="promo-input" type="number" placeholder="Max uses (∞)" value={newPromo.max_uses}
                  onChange={e => setNewPromo(p => ({ ...p, max_uses: e.target.value }))}
                  style={{ width: 120 }} />
                <button className="btn btn-primary" onClick={createPromo}>Create</button>
              </div>
            </div>
            <div className="admin-table">
              <div className="admin-table-header">
                <span>Code</span><span>Description</span><span>Discount</span><span>Uses</span><span>Status</span><span></span>
              </div>
              {promos.map(p => (
                <div key={p.code} className="admin-table-row">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{p.code}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{p.description}</span>
                  <span style={{ fontSize: 13, color: 'var(--accent)' }}>{p.discount_pct}% off</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {p.uses}{p.max_uses ? `/${p.max_uses}` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: p.active ? 'var(--success)' : 'var(--text-4)' }}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                  {p.active === 1 && (
                    <button className="btn-icon" onClick={() => deactivatePromo(p.code)} title="Deactivate">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .admin-page { height: 100%; overflow-y: auto; padding: 32px 24px; }
        .admin-inner { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        .admin-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .admin-title { font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--text-1); letter-spacing: -0.03em; }
        .admin-tabs { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 3px; gap: 2px; }
        .admin-tab { padding: 6px 16px; border-radius: 7px; border: none; background: transparent; color: var(--text-3); font-size: 13px; cursor: pointer; font-family: var(--font-body); transition: all var(--transition); }
        .admin-tab.active { background: var(--card); color: var(--text-1); font-weight: 600; }
        .stat-group { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; }
        .stat-group-title { font-size: 12px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px; display: flex; align-items: center; gap: 6px; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
        .stat-card { padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
        .stat-value { font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--text-1); }
        .stat-label { font-size: 11px; color: var(--text-3); margin-top: 2px; }
        .admin-stats { display: flex; flex-direction: column; gap: 16px; }
        .platform-list { display: flex; flex-direction: column; gap: 8px; }
        .platform-row { display: flex; align-items: center; padding: 12px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); gap: 16px; transition: transform var(--transition), border-color var(--transition); }
        .platform-row:hover { transform: translateX(4px); border-color: var(--accent); }
        .platform-rank { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--accent); width: 28px; }
        .platform-name { font-size: 14px; font-weight: 600; color: var(--text-1); flex: 1; }
        .platform-count { font-size: 13px; color: var(--text-3); }
        .platform-count-value { font-weight: 600; color: var(--text-1); }
        .admin-search { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 12px; }
        .admin-search input { flex: 1; background: none; border: none; outline: none; color: var(--text-1); font-size: 13px; font-family: var(--font-body); }
        .admin-table { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .admin-table-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 12px; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .admin-table-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); align-items: center; }
        .admin-table-row:last-child { border-bottom: none; }
        .admin-select { background: var(--surface); border: 1px solid var(--border); color: var(--text-2); border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family: var(--font-body); cursor: pointer; }
        .promo-create { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; }
        .promo-input { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 12px; color: var(--text-1); font-family: var(--font-body); font-size: 13px; outline: none; }
        .promo-input:focus { border-color: var(--accent); }
        .admin-promos { display: flex; flex-direction: column; gap: 16px; }
        .admin-users { display: flex; flex-direction: column; gap: 12px; }
      `}</style>
    </div>
  )
}

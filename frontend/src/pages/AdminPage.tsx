import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, TrendingUp, Tag, Shield, Search, ChevronLeft, ChevronRight,
  BarChart2, Download, Activity, Sparkles, Copy, Check, Filter,
  CheckSquare, ListTodo, BookOpen, Terminal, ArrowRight, FileText
} from 'lucide-react'
import { useAppStore } from '../store/app'
import { BREAKPOINT_MOBILE } from '../config/breakpoints'

interface TaskItem {
  id: string
  title: string
  phase: string
  type: string
  priority: string
  status: string
  path: string
  commitHash?: string
}

interface TaskDataResponse {
  tasks: TaskItem[]
  stats: {
    total: number
    completed: number
    inProgress: number
    blocked: number
    pending: number
    completionPct: number
  }
  phaseBreakdown: Array<{ name: string; total: number; completed: number; percent: number }>
  activeSprint: {
    phase: string
    nextTask: string
    nextTaskPath: string
  }
}

interface Stats {
  users: { total: number; free: number; starter: number; pro: number; business: number; beta: number; disabled: number; new_today: number; new_week: number }
  subscriptions: { total: number; active: number; usd: number; inr: number }
  campaigns: { total: number; today: number }
  health: { totalAttempts: number; successful: number; failed: number; failedToday: number; errorRatePct: number; status: string }
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
  const [tab, setTab] = useState<'stats'|'users'|'promos'|'tasks'|'logs'>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  
  // User Filters State
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Promos State
  const [promos, setPromos] = useState<Promo[]>([])
  const [promoMode, setPromoMode] = useState<'single' | 'bulk'>('single')
  const [newPromo, setNewPromo] = useState({ code: '', description: '', discount_pct: 20, max_uses: '' })
  const [bulkPromo, setBulkPromo] = useState({ prefix: 'LAUNCH', count: 10, discount_pct: 25, max_uses: '1', description: 'Special Campaign Launch' })
  const [copiedBulk, setCopiedBulk] = useState(false)
  const [lastGeneratedBulkCodes, setLastGeneratedBulkCodes] = useState<string[]>([])

  // Tasks State
  const [taskData, setTaskData] = useState<TaskDataResponse | null>(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')

  // Logs State
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsHasMore, setLogsHasMore] = useState(true)
  const [logsTypeFilter, setLogsTypeFilter] = useState('all')
  const [logsLevelFilter, setLogsLevelFilter] = useState('all')

  const [loading, setLoading] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin' && user !== null) { navigate('/app'); return }
    if (tab === 'stats') loadStats()
    if (tab === 'users') loadUsers(1, search, planFilter, roleFilter, statusFilter)
    if (tab === 'promos') loadPromos()
    if (tab === 'tasks') loadTasks()
    if (tab === 'logs') loadLogs(true)
  }, [tab, user, logsTypeFilter, logsLevelFilter])

  const loadLogs = async (reset: boolean = false) => {
    setLogsLoading(true)
    try {
      const currentLogs = reset ? [] : logs
      const before = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1].created_at : ''
      
      const queryParams = new URLSearchParams({
        before: before.toString(),
        type: logsTypeFilter,
        level: logsLevelFilter,
        limit: '50'
      })
      
      const res = await fetch(`/api/admin/logs?${queryParams}`, { credentials: 'include' })
      if (!res.ok) {
        addToast('Failed to load logs', 'error')
        setLogsLoading(false)
        return
      }
      
      const data = await res.json() as { logs: any[] }
      if (reset) {
        setLogs(data.logs)
      } else {
        setLogs(prev => [...prev, ...data.logs])
      }
      setLogsHasMore(data.logs.length === 50)
    } catch {
      addToast('Error loading system logs', 'error')
    }
    setLogsLoading(false)
  }

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to delete all system logs?')) return
    try {
      const res = await fetch('/api/admin/logs', { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        setLogs([])
        setLogsHasMore(false)
        addToast('System logs cleared successfully', 'success')
      } else {
        addToast('Failed to clear logs', 'error')
      }
    } catch {
      addToast('Error clearing logs', 'error')
    }
  }

  const loadTasks = async () => {
    try {
      const res = await fetch('/api/admin/tasks', { credentials: 'include' })
      if (!res.ok) {
        addToast('Failed to load tasks', 'error')
        return
      }
      const data = await res.json() as TaskDataResponse
      setTaskData(data)
    } catch {
      addToast('Failed to load task dashboard', 'error')
    }
  }

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

  const loadUsers = async (
    page: number,
    q = search,
    plan = planFilter,
    role = roleFilter,
    status = statusFilter
  ) => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        search: q,
        plan,
        role,
        status,
      })
      const res = await fetch(`/api/admin/users?${queryParams}`, { credentials: 'include' })
      const data = await res.json() as { users: AdminUser[]; total: number }
      setUsers(data.users); setUserTotal(data.total); setUserPage(page)
    } catch { addToast('Failed to load users', 'error') }
    setLoading(false)
  }

  const handleExportUsersCsv = async () => {
    setExportingCsv(true)
    try {
      const queryParams = new URLSearchParams({
        search,
        plan: planFilter,
        role: roleFilter,
        status: statusFilter,
      })
      const res = await fetch(`/api/admin/users/export?${queryParams}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `postmaker-users-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      addToast('User CSV exported successfully', 'success')
    } catch {
      addToast('Failed to export user CSV', 'error')
    }
    setExportingCsv(false)
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
    loadUsers(userPage, search, planFilter, roleFilter, statusFilter)
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

  const createBulkPromos = async () => {
    try {
      const res = await fetch('/api/admin/promos/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: bulkPromo.prefix,
          count: Number(bulkPromo.count),
          discount_pct: Number(bulkPromo.discount_pct),
          max_uses: bulkPromo.max_uses ? parseInt(bulkPromo.max_uses) : null,
          description: bulkPromo.description,
        }),
      })
      const data = await res.json() as { ok: boolean; count: number; codes: string[] }
      if (data.ok) {
        setLastGeneratedBulkCodes(data.codes)
        loadPromos()
        addToast(`Generated ${data.count} promo codes successfully`, 'success')
      } else {
        addToast('Failed to generate bulk codes', 'error')
      }
    } catch {
      addToast('Failed to generate bulk promo codes', 'error')
    }
  }

  const copyBulkCodesToClipboard = () => {
    if (lastGeneratedBulkCodes.length === 0) return
    navigator.clipboard.writeText(lastGeneratedBulkCodes.join('\n'))
    setCopiedBulk(true)
    addToast('Bulk codes copied to clipboard!', 'info')
    setTimeout(() => setCopiedBulk(false), 2000)
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
            <h1 className="admin-title">Admin Operations</h1>
          </div>
          <div className="admin-tabs">
            {(['stats','users','promos','tasks','logs'] as const).map(t => (
              <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'tasks' ? 'Roadmap Tasks' : t === 'logs' ? 'System Logs' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {tab === 'stats' && stats && (
          <div className="admin-stats">
            {/* System Health Diagnostics */}
            {stats.health && (
              <div className="stat-group health-group">
                <h3 className="stat-group-title">
                  <Activity size={14} className="text-primary" /> System Health & AI Diagnostics
                </h3>
                <div className="health-metrics-row">
                  <div className="health-card">
                    <span className="health-label">System Status</span>
                    <span className="health-status-badge active-glow">
                      <span className="status-dot-green" /> Operational
                    </span>
                  </div>
                  <div className="health-card">
                    <span className="health-label">Generation Error Rate</span>
                    <span className={`health-value ${stats.health.errorRatePct > 5 ? 'text-error' : 'text-success'}`}>
                      {stats.health.errorRatePct}%
                    </span>
                  </div>
                  <div className="health-card">
                    <span className="health-label">Total AI Attempts</span>
                    <span className="health-value">{stats.health.totalAttempts}</span>
                  </div>
                  <div className="health-card">
                    <span className="health-label">Failed Generations</span>
                    <span className="health-value">{stats.health.failed}</span>
                  </div>
                  <div className="health-card">
                    <span className="health-label">Failed Today</span>
                    <span className="health-value">{stats.health.failedToday}</span>
                  </div>
                </div>
              </div>
            )}

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
            {/* Filter & Export Bar */}
            <div className="admin-filter-bar glass-card">
              <div className="admin-search-field">
                <Search size={14} className="search-icon" />
                <input
                  placeholder="Search by email or name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadUsers(1, search, planFilter, roleFilter, statusFilter)}
                />
              </div>

              <div className="filter-dropdowns">
                <div className="filter-item">
                  <Filter size={12} />
                  <select
                    className="admin-select"
                    value={planFilter}
                    onChange={e => {
                      setPlanFilter(e.target.value)
                      loadUsers(1, search, e.target.value, roleFilter, statusFilter)
                    }}
                  >
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                </div>

                <div className="filter-item">
                  <select
                    className="admin-select"
                    value={roleFilter}
                    onChange={e => {
                      setRoleFilter(e.target.value)
                      loadUsers(1, search, planFilter, e.target.value, statusFilter)
                    }}
                  >
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="beta">Beta</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="filter-item">
                  <select
                    className="admin-select"
                    value={statusFilter}
                    onChange={e => {
                      setStatusFilter(e.target.value)
                      loadUsers(1, search, planFilter, roleFilter, e.target.value)
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => loadUsers(1, search, planFilter, roleFilter, statusFilter)}
                >
                  Apply
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm export-btn"
                onClick={handleExportUsersCsv}
                disabled={exportingCsv}
              >
                <Download size={13} />
                <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>

            <div className="admin-table">
              <div className="admin-table-header responsive-stacked-grid-header">
                <span>User</span><span>Plan</span><span>Role</span><span>Status</span><span>Actions</span>
              </div>
              {users.map(u => (
                <div key={u.id} className="admin-table-row responsive-stacked-grid">
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email}</div>
                  </div>
                  <span className={`badge badge-${u.plan}`} data-label="Plan">{u.plan}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', textTransform: 'capitalize' }} data-label="Role">{u.role}</span>
                  <span style={{ fontSize: 12, color: u.disabled ? 'var(--error)' : 'var(--success)' }} data-label="Status">
                    {u.disabled ? 'Disabled' : 'Active'}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} data-label="Actions">
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
                    <button className="btn-icon-xs"
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
                <button className="btn btn-ghost" onClick={() => loadUsers(userPage - 1, search, planFilter, roleFilter, statusFilter)} disabled={userPage === 1}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  Page {userPage} · {userTotal} users
                </span>
                <button className="btn btn-ghost" onClick={() => loadUsers(userPage + 1, search, planFilter, roleFilter, statusFilter)} disabled={userPage * 50 >= userTotal}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Promos */}
        {tab === 'promos' && (
          <div className="admin-promos">
            {/* Single vs Bulk Mode Toggle */}
            <div className="promo-mode-toggle glass-card">
              <button
                type="button"
                className={`promo-mode-btn ${promoMode === 'single' ? 'active' : ''}`}
                onClick={() => setPromoMode('single')}
              >
                <Tag size={13} />
                <span>Single Promo Code</span>
              </button>
              <button
                type="button"
                className={`promo-mode-btn ${promoMode === 'bulk' ? 'active' : ''}`}
                onClick={() => setPromoMode('bulk')}
              >
                <Sparkles size={13} />
                <span>Bulk Code Generator</span>
              </button>
            </div>

            {/* Single Promo Form */}
            {promoMode === 'single' && (
              <div className="promo-create glass-card">
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
                  Create Single Promo Code
                </h3>
                <div className="promo-create-form">
                  <input className="promo-input" placeholder="CODE" value={newPromo.code}
                    onChange={e => setNewPromo(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                  <input className="promo-input" placeholder="Description" value={newPromo.description}
                    onChange={e => setNewPromo(p => ({ ...p, description: e.target.value }))} />
                  <input className="promo-input" type="number" placeholder="Discount %" value={newPromo.discount_pct}
                    onChange={e => setNewPromo(p => ({ ...p, discount_pct: parseInt(e.target.value) || 0 }))} />
                  <input className="promo-input" type="number" placeholder="Max uses (∞)" value={newPromo.max_uses}
                    onChange={e => setNewPromo(p => ({ ...p, max_uses: e.target.value }))} />
                  <button className="btn btn-primary btn-sm" onClick={createPromo}>Create Code</button>
                </div>
              </div>
            )}

            {/* Bulk Promo Form */}
            {promoMode === 'bulk' && (
              <div className="promo-create glass-card">
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} className="text-primary" /> Batch Promo Code Generator
                </h3>
                <div className="bulk-form-grid">
                  <div>
                    <label className="bulk-label">Code Prefix</label>
                    <input className="promo-input w-full" placeholder="LAUNCH2026" value={bulkPromo.prefix}
                      onChange={e => setBulkPromo(p => ({ ...p, prefix: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <label className="bulk-label">Quantity (Max 100)</label>
                    <input className="promo-input w-full" type="number" placeholder="10" value={bulkPromo.count}
                      onChange={e => setBulkPromo(p => ({ ...p, count: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <label className="bulk-label">Discount %</label>
                    <input className="promo-input w-full" type="number" placeholder="25" value={bulkPromo.discount_pct}
                      onChange={e => setBulkPromo(p => ({ ...p, discount_pct: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="bulk-label">Max Uses per Code</label>
                    <input className="promo-input w-full" type="number" placeholder="1" value={bulkPromo.max_uses}
                      onChange={e => setBulkPromo(p => ({ ...p, max_uses: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="bulk-label">Campaign Description</label>
                    <input className="promo-input w-full" placeholder="Launch Campaign Batch" value={bulkPromo.description}
                      onChange={e => setBulkPromo(p => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn btn-primary btn-sm" onClick={createBulkPromos}>
                    <Sparkles size={13} />
                    <span>Generate Batch ({bulkPromo.count} Codes)</span>
                  </button>

                  {lastGeneratedBulkCodes.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={copyBulkCodesToClipboard}>
                      {copiedBulk ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                      <span>{copiedBulk ? 'Copied!' : `Copy ${lastGeneratedBulkCodes.length} Codes`}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="admin-table">
              <div className="admin-table-header responsive-stacked-grid-header">
                <span>Code</span><span>Description</span><span>Discount</span><span>Uses</span><span>Status</span><span></span>
              </div>
              {promos.map(p => (
                <div key={p.code} className="admin-table-row responsive-stacked-grid">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-start)' }} data-label="Code">{p.code}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }} data-label="Description">{p.description}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-primary-start)', fontWeight: 600 }} data-label="Discount">{p.discount_pct}% off</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }} data-label="Uses">
                    {p.uses}{p.max_uses ? `/${p.max_uses}` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: p.active ? 'var(--success)' : 'var(--text-4)' }} data-label="Status">
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                  <div data-label="Actions">
                    {p.active === 1 && (
                      <button className="btn-icon-xs" onClick={() => deactivatePromo(p.code)} title="Deactivate">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks Roadmap & Execution Dashboard */}
        {tab === 'tasks' && taskData && (
          <div className="admin-tasks-dashboard">
            {/* Active Sprint Banner */}
            <div className="task-sprint-banner glass-card">
              <div className="sprint-banner-info">
                <span className="sprint-badge">Active Sprint Focus</span>
                <h3 className="sprint-title">{taskData.activeSprint.phase}</h3>
                <p className="sprint-subtext">
                  Next Actionable Task: <strong style={{ color: 'var(--color-primary-start)' }}>{taskData.activeSprint.nextTask}</strong>
                </p>
              </div>
              <div className="sprint-stats-box">
                <span className="sprint-stat-val">{taskData.stats.completed} / {taskData.stats.total}</span>
                <span className="sprint-stat-lbl">Tasks Completed ({taskData.stats.completionPct}%)</span>
              </div>
            </div>

            {/* High Level Metrics */}
            <div className="health-metrics-row">
              <div className="health-card">
                <span className="health-label">Total Roadmap Tasks</span>
                <span className="health-value">{taskData.stats.total}</span>
              </div>
              <div className="health-card">
                <span className="health-label">Completed</span>
                <span className="health-value text-success">{taskData.stats.completed}</span>
              </div>
              <div className="health-card">
                <span className="health-label">In Progress</span>
                <span className="health-value text-primary">{taskData.stats.inProgress}</span>
              </div>
              <div className="health-card">
                <span className="health-label">Pending</span>
                <span className="health-value">{taskData.stats.pending}</span>
              </div>
            </div>

            {/* Phase Breakdown Progress */}
            <div className="stat-group">
              <h3 className="stat-group-title"><BarChart2 size={14} /> Phase-by-Phase Roadmap Progress</h3>
              <div className="phase-progress-grid">
                {taskData.phaseBreakdown.map(ph => (
                  <div key={ph.name} className="phase-progress-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
                      <span style={{ color: '#F8FAFC' }}>{ph.name}</span>
                      <span style={{ color: 'var(--color-primary-start)' }}>{ph.completed}/{ph.total} ({ph.percent}%)</span>
                    </div>
                    <div className="phase-progress-bar-bg">
                      <div className="phase-progress-bar-fill" style={{ width: `${Math.max(ph.percent, ph.completed > 0 ? 5 : 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Task Filter & Table */}
            <div className="admin-filter-bar glass-card">
              <div className="admin-search-field">
                <Search size={14} className="search-icon" />
                <input
                  placeholder="Search tasks by ID or title…"
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                />
              </div>

              <div className="filter-dropdowns">
                <div className="filter-item">
                  <Filter size={12} />
                  <select
                    className="admin-select"
                    value={taskStatusFilter}
                    onChange={e => setTaskStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Not Started">Not Started</option>
                    <option value="Not Selected">Not Selected</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="admin-table">
              <div className="admin-table-header responsive-stacked-grid-header">
                <span>Task ID & Title</span><span>Phase</span><span>Priority</span><span>Status</span><span>Details</span>
              </div>
              {taskData.tasks
                .filter(t => {
                  const matchesQuery = t.id.toLowerCase().includes(taskSearch.toLowerCase()) || t.title.toLowerCase().includes(taskSearch.toLowerCase())
                  const matchesStatus = taskStatusFilter === 'all' || t.status.toLowerCase() === taskStatusFilter.toLowerCase()
                  return matchesQuery && matchesStatus
                })
                .map(t => (
                  <div key={t.id} className="admin-table-row responsive-stacked-grid">
                    <div>
                      <div style={{ fontSize: 13, color: '#F8FAFC', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--color-primary-start)', fontFamily: 'var(--font-mono)' }}>{t.id}</span>
                        <span>{t.title}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{t.path}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }} data-label="Phase">{t.phase.replace('Phase ', 'P')}</span>
                    <span style={{ fontSize: 12, color: t.priority === 'High' ? 'var(--color-primary-start)' : 'var(--text-3)', fontWeight: 600 }} data-label="Priority">{t.priority}</span>
                    <span className={`badge ${t.status === 'Completed' ? 'badge-completed' : ''}`} data-label="Status">
                      {t.status === 'Completed' ? '✓ Completed' : t.status}
                    </span>
                    <div data-label="Commit / Info">
                      {t.commitHash ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary-start)' }}>Commit {t.commitHash}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{t.type}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Operational Protocol Card */}
            <div className="task-protocol-card glass-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={15} color="var(--color-primary-start)" />
                <span>How Team Members & AI Agents Maintain Task Status</span>
              </h3>
              <div className="protocol-grid">
                <div className="protocol-col">
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-start)', marginBottom: 6 }}>
                    👥 Human Developers & Team
                  </h4>
                  <ul style={{ fontSize: 12.5, color: 'var(--text-2)', paddingLeft: 16, lineHeight: 1.6 }}>
                    <li>Open task file in <code className="mono">docs/tasks/phases/</code> and set <code className="mono">**Status:** Completed</code>.</li>
                    <li>Run <code className="mono">npm run tasks</code> in CLI anytime for a 1-second real-time terminal progress overview.</li>
                    <li>Review this live Admin Dashboard tab to track roadmap progress.</li>
                  </ul>
                </div>
                <div className="protocol-col">
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-start)', marginBottom: 6 }}>
                    🤖 AI Agents & Documentation Skill
                  </h4>
                  <ul style={{ fontSize: 12.5, color: 'var(--text-2)', paddingLeft: 16, lineHeight: 1.6 }}>
                    <li>Invoking <code className="mono">/postmaker-docs-skill</code> automatically scans task frontmatter metadata.</li>
                    <li>AI agents mark completed tasks, update <code className="mono">docs/tasks/README.md</code>, and record verification links.</li>
                    <li>Changes automatically sync to this Admin UI upon commit & deployment.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Logs Tab View */}
        {tab === 'logs' && (
          <div className="admin-logs">
            <div className="admin-filter-bar glass-card">
              <div className="filter-dropdowns">
                <div className="filter-item">
                  <Filter size={12} />
                  <select
                    className="admin-select"
                    value={logsTypeFilter}
                    onChange={e => {
                      setLogsTypeFilter(e.target.value)
                    }}
                  >
                    <option value="all">All Types</option>
                    <option value="error">Error</option>
                    <option value="event">Event</option>
                    <option value="info">Info</option>
                  </select>
                </div>

                <div className="filter-item">
                  <select
                    className="admin-select"
                    value={logsLevelFilter}
                    onChange={e => {
                      setLogsLevelFilter(e.target.value)
                    }}
                  >
                    <option value="all">All Levels</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                    <option value="fatal">Fatal</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={clearLogs}
                style={{ marginLeft: 'auto', color: 'var(--error)' }}
              >
                Clear All Logs
              </button>
            </div>

            <div className="admin-table">
              <div className="admin-table-header logs-grid-header">
                <span>Time</span><span>Type</span><span>Level</span><span>Message</span><span>Context</span>
              </div>
              {logs.map(log => (
                <div key={log.id} className="admin-table-row logs-grid-row">
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} title={new Date(log.created_at * 1000).toLocaleString()}>
                    {new Date(log.created_at * 1000).toISOString().replace('T', ' ').substring(0, 19)}
                  </span>
                  <span className={`badge badge-${log.type}`}>{log.type}</span>
                  <span className={`badge badge-${log.level}`}>{log.level}</span>
                  <div style={{ fontSize: 12, fontWeight: 500, wordBreak: 'break-word', color: 'var(--color-text-primary)' }}>{log.message}</div>
                  <pre style={{ fontSize: 10, overflow: 'auto', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 4, maxWidth: '100%', color: 'var(--color-text-secondary)' }}>
                    {log.context || '{}'}
                  </pre>
                </div>
              ))}
              {logs.length === 0 && !logsLoading && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  No logs found matching criteria.
                </div>
              )}
            </div>

            {logsHasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" onClick={() => loadLogs(false)} disabled={logsLoading}>
                  {logsLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .admin-page { height: 100%; overflow-y: auto; padding: 32px 24px; }
        .admin-inner { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        .admin-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .admin-title { font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--color-text-primary); letter-spacing: -0.03em; }
        .admin-tabs { display: flex; background: rgba(255,255,255,0.25); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 3px; gap: 2px; }
        .admin-tab { padding: 6px 16px; border-radius: 7px; border: none; background: transparent; color: var(--color-text-secondary); font-size: 13px; cursor: pointer; font-family: var(--font-body); transition: all var(--transition); }
        .admin-tab.active { background: var(--color-nav-active-bg); color: var(--color-nav-active-text); font-weight: 700; }
        .stat-group { background: var(--color-surface); backdrop-filter: blur(20px); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 20px; }
        .stat-group-title { font-size: 12px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px; display: flex; align-items: center; gap: 6px; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; }
        .stat-card { padding: 14px; background: rgba(255,255,255,0.20); border: 1px solid var(--color-border); border-radius: var(--radius); }
        .stat-value { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--color-text-primary); }
        .stat-label { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; font-weight: 600; }
        .admin-stats { display: flex; flex-direction: column; gap: 16px; }

        /* Health Metrics */
        .health-metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .health-card { padding: 14px; background: var(--color-surface-inset); border: 1px solid var(--color-nav-border); border-radius: var(--radius); display: flex; flex-direction: column; gap: 4px; }
        .health-label { font-size: 11px; color: var(--color-text-secondary); font-weight: 600; }
        .health-value { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--color-text-primary); }
        .health-status-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--color-success); margin-top: 2px; }
        .status-dot-green { width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 8px var(--color-success-border); }

        .platform-list { display: flex; flex-direction: column; gap: 8px; }
        .platform-row { display: flex; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.20); border: 1px solid var(--color-border); border-radius: var(--radius); gap: 16px; transition: transform var(--transition), border-color var(--transition); }
        .platform-row:hover { transform: translateX(4px); border-color: var(--color-primary-start); }
        .platform-rank { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--color-primary-start); width: 28px; }
        .platform-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); flex: 1; }
        .platform-count { font-size: 13px; color: var(--color-text-secondary); }
        .platform-count-value { font-weight: 700; color: var(--color-text-primary); }

        /* Filter & Export Bar */
        .admin-filter-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; background: var(--color-surface); flex-wrap: wrap; }
        .admin-search-field { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; background: var(--color-surface-inset); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 6px 12px; }
        .search-icon { color: #64748B; }
        .admin-search-field input { flex: 1; background: none; border: none; outline: none; color: var(--color-text-primary); font-size: 13px; font-family: var(--font-body); }
        .filter-dropdowns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .filter-item { display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.25); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 2px 6px; color: var(--color-text-secondary); font-size: 12px; }

        .admin-table { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; }
        .admin-table-header { display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr 2.2fr; gap: 12px; padding: 10px 16px; background: rgba(255,255,255,0.25); border-bottom: 1px solid var(--color-border); font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
        .admin-table-row { display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr 2.2fr; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); align-items: center; }
        .admin-table-row:last-child { border-bottom: none; }
        .admin-select { background: rgba(255,255,255,0.3); border: 1px solid var(--color-border); color: var(--color-text-secondary); border-radius: 6px; padding: 4px 8px; font-size: 12px; font-family: var(--font-body); cursor: pointer; }
        .admin-select:focus { border-color: var(--color-primary-start); }

        /* Promo Mode Toggle */
        .promo-mode-toggle { display: flex; gap: 4px; padding: 4px; background: rgba(255,255,255,0.25); width: fit-content; }
        .promo-mode-btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius); border: none; background: transparent; color: var(--color-text-secondary); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all var(--transition); }
        .promo-mode-btn.active { background: var(--color-nav-active-bg); color: var(--color-nav-active-text); font-weight: 700; }

        .promo-create { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 20px; }
        .promo-input { background: var(--color-surface-inset); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 8px 12px; color: var(--color-text-primary); font-family: var(--font-body); font-size: 13px; outline: none; transition: border-color var(--transition); }
        .promo-input:focus { border-color: var(--color-primary-start); }
        .bulk-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 8px; }
        .bulk-label { display: block; font-size: 11px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px; }
        
        .admin-promos { display: flex; flex-direction: column; gap: 16px; }
        .admin-users { display: flex; flex-direction: column; gap: 12px; }
        .btn-icon-xs { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #CBD5E1; border-radius: 4px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .btn-icon-xs:hover { background: rgba(255,255,255,0.15); color: #F8FAFC; }

        .promo-create-form {
          display: grid;
          grid-template-columns: 1fr 2fr 1fr 1fr auto;
          gap: 12px;
          align-items: end;
        }

        /* Tasks Dashboard Styles */
        .admin-tasks-dashboard { display: flex; flex-direction: column; gap: 16px; }
        .task-sprint-banner { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(15, 28, 48, 0.6)); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-lg); flex-wrap: wrap; gap: 16px; }
        .sprint-badge { display: inline-block; font-size: 11px; font-weight: 700; color: var(--color-primary-start); text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; background: rgba(56, 189, 248, 0.15); border-radius: 4px; margin-bottom: 4px; }
        .sprint-title { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #F8FAFC; margin-bottom: 4px; }
        .sprint-subtext { font-size: 13px; color: #94A3B8; }
        .sprint-stats-box { text-align: right; display: flex; flex-direction: column; gap: 2px; }
        .sprint-stat-val { font-family: var(--font-display); font-size: 24px; font-weight: 800; color: #34D399; }
        .sprint-stat-lbl { font-size: 11px; color: #94A3B8; font-weight: 600; }

        .phase-progress-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
        .phase-progress-card { padding: 10px 14px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius); }
        .phase-progress-bar-bg { width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; }
        .phase-progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--color-primary-start), #34D399); border-radius: 3px; transition: width 0.3s ease; }

        .badge-completed { background: rgba(52, 211, 153, 0.15); color: #34D399; border: 1px solid rgba(52, 211, 153, 0.3); }

        .task-protocol-card { padding: 20px; background: rgba(15, 28, 48, 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-lg); margin-top: 8px; }
        .protocol-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 8px; }
        .protocol-col { background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius); padding: 14px; }
        code.mono { font-family: var(--font-mono); font-size: 11.5px; color: var(--color-primary-start); background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px; }

        .admin-logs { display: flex; flex-direction: column; gap: 12px; }
        .logs-grid-header { display: grid; grid-template-columns: 1.5fr 0.8fr 0.8fr 3fr 3fr; gap: 12px; padding: 10px 16px; background: rgba(255,255,255,0.25); border-bottom: 1px solid var(--color-border); font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
        .logs-grid-row { display: grid; grid-template-columns: 1.5fr 0.8fr 0.8fr 3fr 3fr; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); align-items: start; }
        
        .badge-error { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .badge-fatal { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; background: rgba(220, 38, 38, 0.25); color: #DC2626; border: 1px solid rgba(220, 38, 38, 0.4); font-weight: 700; }
        .badge-event { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .badge-info { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.15); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.3); }
        .badge-warn { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge-debug { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #A855F7; border: 1px solid rgba(168, 85, 247, 0.3); }

        @media (max-width: ${BREAKPOINT_MOBILE}) {
          .admin-page { padding: 16px 12px; }
          .admin-tabs {
            overflow-x: auto;
            white-space: nowrap;
            flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
          }
          .admin-tab {
            flex-shrink: 0;
          }
          .stat-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .promo-create-form {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .promo-create-form .promo-input {
            width: 100% !important;
          }
          .admin-table-row > div, .admin-table-row > span {
            display: flex;
            align-items: center;
          }
        }
      `}</style>
    </div>
  )
}

// ============================================================
// Admin Dashboard Route — /api/admin/*
// Protected: role = 'admin' only
// ============================================================

import type { Env } from '../../../config/ai'

export async function handleAdmin(
  request: Request,
  env: Env,
  userId: string,
  userRole: string
): Promise<Response> {
  if (userRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const path = url.pathname

  // ── GET /api/admin/stats ──────────────────────────────────
  if (path === '/api/admin/stats') {
    const [users, subs, campaigns, health, usage, topPlatformsResult] = await Promise.all([
      env.DB.prepare(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free,
        SUM(CASE WHEN plan = 'starter' THEN 1 ELSE 0 END) as starter,
        SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro,
        SUM(CASE WHEN plan = 'business' THEN 1 ELSE 0 END) as business,
        SUM(CASE WHEN role = 'beta' THEN 1 ELSE 0 END) as beta,
        SUM(CASE WHEN disabled = 1 THEN 1 ELSE 0 END) as disabled,
        SUM(CASE WHEN created_at > unixepoch() - 86400 THEN 1 ELSE 0 END) as new_today,
        SUM(CASE WHEN created_at > unixepoch() - 604800 THEN 1 ELSE 0 END) as new_week
        FROM users`).first(),
      env.DB.prepare(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN currency = 'usd' THEN 1 ELSE 0 END) as usd,
        SUM(CASE WHEN currency = 'inr' THEN 1 ELSE 0 END) as inr
        FROM subscriptions`).first(),
      env.DB.prepare(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN created_at > unixepoch() - 86400 THEN 1 ELSE 0 END) as today
        FROM campaigns WHERE status = 'completed'`).first(),
      env.DB.prepare(`SELECT
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN created_at > unixepoch() - 86400 AND status = 'error' THEN 1 ELSE 0 END) as failed_today
        FROM campaigns`).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(generations), 0) as total
        FROM usage WHERE period_start > unixepoch() - 2592000`).first(),
      env.DB.prepare(`SELECT json_each.value as platform_id, COUNT(*) as count 
        FROM campaigns, json_each(CASE WHEN json_valid(campaigns.platforms) = 1 THEN campaigns.platforms ELSE '[]' END) 
        WHERE campaigns.status = 'completed' 
        GROUP BY platform_id 
        ORDER BY count DESC 
        LIMIT 10`).all(),
    ])

    const totalAttempts = Number((health as Record<string, unknown> | null)?.total_attempts ?? 0)
    const failedCount = Number((health as Record<string, unknown> | null)?.failed ?? 0)

    return json({
      users,
      subscriptions: subs,
      campaigns,
      health: {
        totalAttempts,
        successful: Number((health as Record<string, unknown> | null)?.successful ?? 0),
        failed: failedCount,
        failedToday: Number((health as Record<string, unknown> | null)?.failed_today ?? 0),
        errorRatePct: totalAttempts > 0 ? Math.round((failedCount / totalAttempts) * 10000) / 100 : 0,
        status: 'healthy',
      },
      usage,
      topPlatforms: topPlatformsResult?.results ?? [],
    })
  }

  // ── GET /api/admin/users/export ───────────────────────────
  if (path === '/api/admin/users/export') {
    const search = url.searchParams.get('search') ?? ''
    const plan = url.searchParams.get('plan') ?? 'all'
    const role = url.searchParams.get('role') ?? 'all'
    const status = url.searchParams.get('status') ?? 'all'

    const conditions: string[] = []
    const binds: unknown[] = []

    if (search) {
      conditions.push('(email LIKE ? OR name LIKE ?)')
      binds.push(`%${search}%`, `%${search}%`)
    }
    if (plan !== 'all') {
      conditions.push('plan = ?')
      binds.push(plan)
    }
    if (role !== 'all') {
      conditions.push('role = ?')
      binds.push(role)
    }
    if (status !== 'all') {
      conditions.push('disabled = ?')
      binds.push(status === 'disabled' ? 1 : 0)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { results } = await env.DB.prepare(
      `SELECT id, email, name, plan, role, disabled, currency, created_at
       FROM users ${whereClause} ORDER BY created_at DESC LIMIT 5000`
    ).bind(...binds).all()

    const headers = ['User ID', 'Email', 'Name', 'Plan', 'Role', 'Status', 'Currency', 'Created At']
    const rows = (results as Array<Record<string, unknown>>).map(u => [
      u.id,
      `"${String(u.email ?? '').replace(/"/g, '""')}"`,
      `"${String(u.name ?? '').replace(/"/g, '""')}"`,
      u.plan,
      u.role,
      u.disabled ? 'Disabled' : 'Active',
      u.currency ?? 'usd',
      new Date(Number(u.created_at ?? 0) * 1000).toISOString(),
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="postmaker-users-${Date.now()}.csv"`,
      },
    })
  }

  // ── GET /api/admin/users ──────────────────────────────────
  if (path === '/api/admin/users') {
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const search = url.searchParams.get('search') ?? ''
    const plan = url.searchParams.get('plan') ?? 'all'
    const role = url.searchParams.get('role') ?? 'all'
    const status = url.searchParams.get('status') ?? 'all'
    const limit = 50
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const binds: unknown[] = []

    if (search) {
      conditions.push('(email LIKE ? OR name LIKE ?)')
      binds.push(`%${search}%`, `%${search}%`)
    }
    if (plan !== 'all') {
      conditions.push('plan = ?')
      binds.push(plan)
    }
    if (role !== 'all') {
      conditions.push('role = ?')
      binds.push(role)
    }
    if (status !== 'all') {
      conditions.push('disabled = ?')
      binds.push(status === 'disabled' ? 1 : 0)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { results } = await env.DB.prepare(
      `SELECT id, email, name, plan, role, disabled, currency, created_at
       FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all()

    const count = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM users ${whereClause}`
    ).bind(...binds).first<{ total: number }>()

    return json({ users: results, total: count?.total ?? 0, page, limit })
  }

  // ── PATCH /api/admin/users/:id ────────────────────────────
  if (path.startsWith('/api/admin/users/') && request.method === 'PATCH') {
    const targetId = path.split('/').pop()
    const body = await request.json() as { role?: string; plan?: string; disabled?: boolean }

    const updates: string[] = []
    const values: unknown[] = []

    if (body.role && ['user','beta','admin'].includes(body.role)) {
      updates.push('role = ?'); values.push(body.role)
    }
    if (body.plan && ['free','starter','pro','business'].includes(body.plan)) {
      updates.push('plan = ?'); values.push(body.plan)
    }
    if (typeof body.disabled === 'boolean') {
      updates.push('disabled = ?'); values.push(body.disabled ? 1 : 0)
    }

    if (updates.length === 0) return jsonError('Nothing to update', 400)

    updates.push('updated_at = unixepoch()')
    values.push(targetId)

    await env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    return json({ ok: true })
  }

  // ── GET /api/admin/tasks ──────────────────────────────────
  if (path === '/api/admin/tasks') {
    const tasksData = [
      // Phase 1 — Launch Gate (10)
      { id: 'P1-01', title: 'Stabilize core product', phase: 'Phase 1 — Launch', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-01-stabilize-core-product.md' },
      { id: 'P1-02', title: 'Improve UI/UX polish', phase: 'Phase 1 — Launch', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-02-improve-ui-ux-polish.md' },
      { id: 'P1-03', title: 'Performance optimization pass', phase: 'Phase 1 — Launch', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-03-performance-optimization-pass.md' },
      { id: 'P1-04', title: 'Complete Razorpay international payments', phase: 'Phase 1 — Launch', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-04-complete-razorpay-international-payments.md' },
      { id: 'P1-05', title: 'Build subscription flow', phase: 'Phase 1 — Launch', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-05-build-subscription-flow.md' },
      { id: 'P1-06', title: 'Improve AI provider reliability & routing', phase: 'Phase 1 — Launch', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-06-improve-ai-provider-reliability-routing.md' },
      { id: 'P1-07', title: 'Support higher AI rate limits', phase: 'Phase 1 — Launch', type: 'Core', priority: 'Medium', status: 'Completed', path: 'docs/tasks/phases/phase-1-launch/core/P1-07-support-higher-ai-rate-limits.md', commitHash: 'd2ef3f2' },
      { id: 'P1-08', title: 'Implement bulk generation', phase: 'Phase 1 — Launch', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-08-implement-bulk-generation.md' },
      { id: 'P1-09', title: 'Strengthen fallback architecture', phase: 'Phase 1 — Launch', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-09-strengthen-fallback-architecture.md' },
      { id: 'P1-10', title: 'Set up production monitoring & logging', phase: 'Phase 1 — Launch', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-1-launch/core/P1-10-set-up-production-monitoring-logging.md' },

      // Phase 2 — Creator Experience (17)
      { id: 'P2-01', title: 'Assets library storage backend', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-01-assets-library-storage-backend.md' },
      { id: 'P2-02', title: 'Assets library upload support', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-02-assets-library-upload-support.md' },
      { id: 'P2-03', title: 'Assets library local/open-source media', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-03-assets-library-local-open-source-media.md' },
      { id: 'P2-04', title: 'Assets library automatic categorization', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-04-assets-library-automatic-categorization.md' },
      { id: 'P2-05', title: 'Tools marketplace shell & plug-in framework', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-05-tools-marketplace-shell-plug-in-framework.md' },
      { id: 'P2-06', title: 'Tools marketplace select tool list', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-06-tools-marketplace-select-tool-list.md' },
      { id: 'P2-14', title: 'Platform workspace per-platform editor', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-14-platform-workspace-per-platform-editor.md' },
      { id: 'P2-15', title: 'Platform workspace AI-assisted editing', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-15-platform-workspace-ai-assisted-editing.md' },
      { id: 'P2-16', title: 'Platform workspace platform previews', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-16-platform-workspace-platform-previews.md' },
      { id: 'P2-17', title: 'Shareable platform cards', phase: 'Phase 2 — Creator Experience', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-2-creator-experience/core/P2-17-shareable-platform-cards.md' },
      { id: 'P2-07', title: 'Tool: Thumbnail generator', phase: 'Phase 2 — Creator Experience', type: 'Optional', priority: 'Medium', status: 'Not Selected', path: 'docs/tasks/phases/phase-2-creator-experience/optional-tools-pool/P2-07-tool-thumbnail-generator.md' },
      { id: 'P2-08', title: 'Tool: Banner creator', phase: 'Phase 2 — Creator Experience', type: 'Optional', priority: 'Medium', status: 'Not Selected', path: 'docs/tasks/phases/phase-2-creator-experience/optional-tools-pool/P2-08-tool-banner-creator.md' },
      { id: 'P2-09', title: 'Tool: Logo generator', phase: 'Phase 2 — Creator Experience', type: 'Optional', priority: 'Low', status: 'Not Selected', path: 'docs/tasks/phases/phase-2-creator-experience/optional-tools-pool/P2-09-tool-logo-generator.md' },
      { id: 'P2-10', title: 'Tool: Background remover', phase: 'Phase 2 — Creator Experience', type: 'Optional', priority: 'Medium', status: 'Not Selected', path: 'docs/tasks/phases/phase-2-creator-experience/optional-tools-pool/P2-10-tool-background-remover.md' },
      { id: 'P2-11', title: 'Tool: Object remover', phase: 'Phase 2 — Creator Experience', type: 'Optional', priority: 'Low', status: 'Not Selected', path: 'docs/tasks/phases/phase-2-creator-experience/optional-tools-pool/P2-11-tool-object-remover.md' },
      { id: 'P2-12', title: 'Tool: Upscaler', phase: 'Phase 2 — Creator Experience', type: 'Optional', priority: 'Low', status: 'Not Selected', path: 'docs/tasks/phases/phase-2-creator-experience/optional-tools-pool/P2-12-tool-upscaler.md' },
      { id: 'P2-13', title: 'Tool: Voice tools', phase: 'Phase 2 — Creator Experience', type: 'Optional', priority: 'Low', status: 'Not Selected', path: 'docs/tasks/phases/phase-2-creator-experience/optional-tools-pool/P2-13-tool-voice-tools.md' },

      // Phase 3 — Automation (4)
      { id: 'P3-01', title: 'Content scheduling calendar UI', phase: 'Phase 3 — Automation', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-3-automation/core/P3-01-content-scheduling-calendar-ui.md' },
      { id: 'P3-02', title: 'Content scheduling draft storage', phase: 'Phase 3 — Automation', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-3-automation/core/P3-02-content-scheduling-draft-storage.md' },
      { id: 'P3-03', title: 'Auto-publishing engine', phase: 'Phase 3 — Automation', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-3-automation/core/P3-03-auto-publishing-engine.md' },
      { id: 'P3-04', title: 'Email notifications', phase: 'Phase 3 — Automation', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-3-automation/core/P3-04-email-notifications.md' },

      // Phase 4 — Business (7)
      { id: 'P4-01', title: 'Analytics performance dashboard', phase: 'Phase 4 — Business', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-4-business/core/P4-01-analytics-performance-dashboard.md' },
      { id: 'P4-02', title: 'Analytics growth tracking', phase: 'Phase 4 — Business', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-4-business/core/P4-02-analytics-growth-tracking.md' },
      { id: 'P4-03', title: 'Analytics campaign analytics', phase: 'Phase 4 — Business', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-4-business/core/P4-03-analytics-campaign-analytics.md' },
      { id: 'P4-04', title: 'Team workspaces', phase: 'Phase 4 — Business', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-4-business/core/P4-04-team-workspaces.md' },
      { id: 'P4-05', title: 'Client management module', phase: 'Phase 4 — Business', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-4-business/core/P4-05-client-management-module.md' },
      { id: 'P4-06', title: 'Client approval workflow', phase: 'Phase 4 — Business', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-4-business/core/P4-06-client-approval-workflow.md' },
      { id: 'P4-07', title: 'Agency workspace features', phase: 'Phase 4 — Business', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-4-business/core/P4-07-agency-workspace-features.md' },

      // Phase 5 — Scale (5)
      { id: 'P5-01', title: 'AI image generation module', phase: 'Phase 5 — Scale', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-5-scale/core/P5-01-ai-image-generation-module.md' },
      { id: 'P5-02', title: 'AI video generation module', phase: 'Phase 5 — Scale', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-5-scale/core/P5-02-ai-video-generation-module.md' },
      { id: 'P5-03', title: 'Enterprise features', phase: 'Phase 5 — Scale', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-5-scale/core/P5-03-enterprise-features.md' },
      { id: 'P5-04', title: 'Campaign management', phase: 'Phase 5 — Scale', type: 'Core', priority: 'Medium', status: 'Not Started', path: 'docs/tasks/phases/phase-5-scale/core/P5-04-campaign-management.md' },
      { id: 'P5-05', title: 'Scale infrastructure for 1,000 users', phase: 'Phase 5 — Scale', type: 'Core', priority: 'High', status: 'Not Started', path: 'docs/tasks/phases/phase-5-scale/core/P5-05-scale-infrastructure-for-1-000-users.md' },
    ]

    const total = tasksData.length
    const completed = tasksData.filter(t => t.status === 'Completed').length
    const inProgress = tasksData.filter(t => t.status === 'In Progress').length
    const blocked = tasksData.filter(t => t.status === 'Blocked').length
    const pending = total - completed - inProgress - blocked

    const phaseBreakdown = [
      { name: 'Phase 1 — Launch', total: 10, completed: 1, percent: 10 },
      { name: 'Phase 2 — Creator Experience', total: 17, completed: 0, percent: 0 },
      { name: 'Phase 3 — Automation', total: 4, completed: 0, percent: 0 },
      { name: 'Phase 4 — Business', total: 7, completed: 0, percent: 0 },
      { name: 'Phase 5 — Scale', total: 5, completed: 0, percent: 0 },
    ]

    return json({
      tasks: tasksData,
      stats: {
        total,
        completed,
        inProgress,
        blocked,
        pending,
        completionPct: Math.round((completed / total) * 1000) / 10,
      },
      phaseBreakdown,
      activeSprint: {
        phase: 'Phase 1 — Launch Gate',
        nextTask: 'P1-01: Stabilize core product',
        nextTaskPath: 'docs/tasks/phases/phase-1-launch/core/P1-01-stabilize-core-product.md'
      }
    })
  }

  // ── GET /api/admin/promos ─────────────────────────────────
  if (path === '/api/admin/promos') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM promo_codes ORDER BY created_at DESC`
    ).all()
    return json({ promos: results })
  }

  // ── POST /api/admin/promos/bulk ───────────────────────────
  if (path === '/api/admin/promos/bulk' && request.method === 'POST') {
    const body = await request.json() as {
      prefix?: string; count?: number; discount_pct?: number; max_uses?: number; description?: string
    }

    const prefix = (body.prefix || 'PROMO').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const count = Math.min(Math.max(body.count || 5, 1), 100)
    const discount_pct = body.discount_pct || 20
    const max_uses = body.max_uses ?? null
    const description = body.description ?? `Bulk generated campaign ${prefix}`

    const generatedCodes: string[] = []
    const statements = []

    for (let i = 0; i < count; i++) {
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase()
      const code = `${prefix}-${randStr}`
      generatedCodes.push(code)
      statements.push(
        env.DB.prepare(
          `INSERT INTO promo_codes (code, description, discount_pct, max_uses, valid_until)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(code, description, discount_pct, max_uses, null)
      )
    }

    await env.DB.batch(statements)

    return json({ ok: true, count: generatedCodes.length, codes: generatedCodes })
  }

  // ── POST /api/admin/promos ────────────────────────────────
  if (path === '/api/admin/promos' && request.method === 'POST') {
    const body = await request.json() as {
      code: string; description: string
      discount_pct: number; max_uses?: number; valid_until?: number
    }

    if (!body.code || !body.discount_pct) return jsonError('Missing fields', 400)

    await env.DB.prepare(
      `INSERT INTO promo_codes (code, description, discount_pct, max_uses, valid_until)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      body.code.toUpperCase(), body.description ?? '',
      body.discount_pct, body.max_uses ?? null, body.valid_until ?? null
    ).run()

    return json({ ok: true, code: body.code.toUpperCase() })
  }

  // ── DELETE /api/admin/promos/:code ────────────────────────
  if (path.startsWith('/api/admin/promos/') && request.method === 'DELETE') {
    const code = path.split('/').pop()?.toUpperCase()
    await env.DB.prepare('UPDATE promo_codes SET active = 0 WHERE code = ?').bind(code).run()
    return json({ ok: true })
  }

  return jsonError('Not found', 404)
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Sparkles, LayoutGrid, PenTool } from 'lucide-react'
import { useAppStore } from '../store/app'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, usage, campaign, isGenerating, viewMode, setViewMode, selectedPlatforms } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  const isCreatePage = location.pathname.startsWith('/app/create')

  const getPageTitle = () => {
    const path = location.pathname
    if (path.startsWith('/app/create')) return 'Create New Post'
    if (path.startsWith('/app/history')) return 'My Generations'
    if (path.startsWith('/app/billing')) return 'Billing & Subscriptions'
    if (path.startsWith('/app/settings')) return 'Settings'
    if (path.startsWith('/admin')) return 'Admin Panel'
    return 'Dashboard'
  }

  const showCreateButton = !isCreatePage

  // Calculate live progress for Results tab label during generation
  const postsList = campaign ? Object.values(campaign.posts) : []
  const completedCount = postsList.filter(p => p.status === 'done' || p.status === 'error').length
  const totalCount = selectedPlatforms.length || postsList.length
  const resultsTabLabel = isGenerating ? `Results (${completedCount}/${totalCount})` : 'Results'

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="mobile-menu-toggle" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <h1 className="topbar-title">{getPageTitle()}</h1>

        {/* View Toggle Tab Control on /app/create when campaign exists */}
        {isCreatePage && campaign !== null && (
          <div className="view-toggle-pill">
            <button
              type="button"
              className={`view-toggle-item ${viewMode === 'create' ? 'active' : ''}`}
              onClick={() => setViewMode('create')}
            >
              <PenTool size={12} />
              <span>Create</span>
            </button>
            <button
              type="button"
              className={`view-toggle-item ${viewMode === 'results' ? 'active' : ''}`}
              onClick={() => setViewMode('results')}
            >
              <LayoutGrid size={12} />
              <span>{resultsTabLabel}</span>
            </button>
          </div>
        )}
      </div>

      <div className="topbar-right">
        {/* Credits / Usage Info */}
        {user && usage && (
          <div className="topbar-usage-badge">
            <span className="plan-label">{user.plan}</span>
            <span className="usage-divider">|</span>
            <span className="usage-count">
              {user.plan === 'business' ? 'Unlimited' : `${usage.remaining} left`}
            </span>
          </div>
        )}

        {/* Contextual "+ Create Post" Button */}
        {user && showCreateButton && (
          <button
            className="btn btn-primary btn-sm topbar-create-btn"
            onClick={() => {
              setViewMode('create')
              navigate('/app/create')
            }}
          >
            <Sparkles size={13} />
            <span>Create Post</span>
          </button>
        )}
      </div>

      <style>{`
        .app-topbar {
          height: var(--topbar-height);
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-nav-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--content-px);
          flex-shrink: 0;
          z-index: 50;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .mobile-menu-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-primary);
          padding: var(--space-2);
          border-radius: var(--radius-sm);
        }

        .mobile-menu-toggle:hover {
          background: var(--color-border);
        }

        .topbar-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        /* View Toggle Segment Control */
        .view-toggle-pill {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-pill);
          margin-left: 8px;
        }

        .view-toggle-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          font-family: var(--font-body);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
        }

        .view-toggle-item:hover {
          color: var(--color-text-primary);
        }

        .view-toggle-item.active {
          background: var(--color-surface);
          color: var(--color-primary-start);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .topbar-usage-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-1) var(--space-3);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-pill);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .plan-label {
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.05em;
          color: var(--color-primary-start);
        }

        .usage-divider {
          color: var(--color-border);
        }

        .usage-count {
          color: var(--color-text-primary);
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .app-topbar {
            padding: 0 var(--space-4);
          }

          .mobile-menu-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .topbar-title {
            font-size: 18px;
          }

          .topbar-create-btn {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}

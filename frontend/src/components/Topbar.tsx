import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Sparkles, LayoutGrid, PenTool, Command, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/app'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, usage, campaign, isGenerating, viewMode, setViewMode, selectedPlatforms } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  const isCreatePage = location.pathname.startsWith('/app/create')

  const getBreadcrumb = () => {
    const path = location.pathname
    if (path.startsWith('/app/create')) return { section: 'Studio', page: 'New Campaign' }
    if (path.startsWith('/app/history')) return { section: 'Studio', page: 'Generations Hub' }
    if (path.startsWith('/app/brand-kit')) return { section: 'Brand', page: 'Brand Kit Studio' }
    if (path.startsWith('/app/billing')) return { section: 'Account', page: 'Billing & Subscriptions' }
    if (path.startsWith('/app/settings')) return { section: 'Account', page: 'Settings' }
    if (path.startsWith('/admin')) return { section: 'System', page: 'Admin Panel' }
    return { section: 'Studio', page: 'Dashboard' }
  }

  const breadcrumb = getBreadcrumb()
  const showCreateButton = !isCreatePage

  // Calculate live progress for Results tab label during generation
  const postsList = campaign ? Object.values(campaign.posts) : []
  const completedCount = postsList.filter(p => p.status === 'done' || p.status === 'error').length
  const totalCount = selectedPlatforms.length || postsList.length
  const resultsTabLabel = isGenerating ? `Results (${completedCount}/${totalCount})` : 'Results'

  return (
    <header className="app-topbar glass-card">
      <div className="topbar-left">
        <button className="mobile-menu-toggle" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} />
        </button>

        {/* Dynamic Studio Breadcrumb */}
        <div className="topbar-breadcrumb">
          <span className="crumb-section">{breadcrumb.section}</span>
          <ChevronRight size={14} className="crumb-arrow" />
          <h1 className="crumb-page">{breadcrumb.page}</h1>
        </div>

        {/* Live Generation Status Pill */}
        {isCreatePage && (
          <div className={`status-pill ${isGenerating ? 'generating' : 'idle'}`}>
            <span className="status-dot" />
            <span className="status-text">
              {isGenerating ? `Generating (${completedCount}/${totalCount})` : 'Drafting'}
            </span>
          </div>
        )}

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
        {/* Command Palette Shortcut Hint */}
        <div className="cmd-hint-pill hide-mobile">
          <Command size={11} />
          <span>K</span>
        </div>

        {/* Glowing Plan Badge */}
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
          background: rgba(10, 20, 36, 0.85);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border-bottom: 1px solid var(--color-border);
          border-radius: 0;
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
          gap: 16px;
        }

        .mobile-menu-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: #94A3B8;
          padding: 6px;
          border-radius: var(--radius-sm);
        }

        .mobile-menu-toggle:hover {
          color: #F8FAFC;
          background: rgba(255, 255, 255, 0.08);
        }

        .topbar-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .crumb-section {
          font-size: 13px;
          font-weight: 600;
          color: #64748B;
        }

        .crumb-arrow {
          color: #475569;
        }

        .crumb-page {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: #F8FAFC;
          letter-spacing: -0.02em;
        }

        /* Live Status Pill */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          font-size: 11.5px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .status-pill.idle {
          color: #94A3B8;
        }

        .status-pill.generating {
          color: var(--color-primary-start);
          border-color: rgba(56, 189, 248, 0.30);
          background: rgba(56, 189, 248, 0.10);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #64748B;
        }

        .status-pill.idle .status-dot {
          background: #34D399;
          box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
        }

        .status-pill.generating .status-dot {
          background: var(--color-primary-start);
          animation: pulseDot 1.2s infinite ease-in-out;
        }

        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
        }

        /* View Toggle Segment Control */
        .view-toggle-pill {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          background: rgba(0, 0, 0, 0.40);
          border: 1px solid rgba(255, 255, 255, 0.08);
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
          color: #94A3B8;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
        }

        .view-toggle-item:hover {
          color: #F8FAFC;
        }

        .view-toggle-item.active {
          background: rgba(255, 255, 255, 0.12);
          color: #F8FAFC;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .cmd-hint-pill {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 11px;
          font-weight: 700;
          color: #64748B;
        }

        .topbar-usage-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: var(--radius-pill);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
          color: #F8FAFC;
        }

        .plan-label {
          text-transform: uppercase;
          font-size: 10.5px;
          letter-spacing: 0.06em;
          color: var(--color-primary-start);
        }

        .usage-divider {
          color: rgba(255, 255, 255, 0.15);
        }

        .usage-count {
          color: #F8FAFC;
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

          .crumb-section, .crumb-arrow {
            display: none;
          }

          .crumb-page {
            font-size: 15px;
          }

          .topbar-create-btn {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}

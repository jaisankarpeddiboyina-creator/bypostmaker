import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Sparkles, LogOut, Settings, Shield } from 'lucide-react'
import { useAppStore } from '../store/app'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, usage } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  const getPageTitle = () => {
    const path = location.pathname
    if (path.startsWith('/app/create')) return 'Create New Post'
    if (path.startsWith('/app/history')) return 'My Generations'
    if (path.startsWith('/app/billing')) return 'Billing & Subscriptions'
    if (path.startsWith('/app/settings')) return 'Settings'
    if (path.startsWith('/admin')) return 'Admin Panel'
    return 'Dashboard'
  }

  const showCreateButton = !location.pathname.startsWith('/app/create')

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="mobile-menu-toggle" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <h1 className="topbar-title">{getPageTitle()}</h1>
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
            onClick={() => navigate('/app/create')}
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
          gap: var(--space-3);
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
            display: none; /* Hide contextual button on narrow mobile screens to prevent squishing */
          }
        }
      `}</style>
    </header>
  )
}

import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, Bookmark, History, CreditCard, Settings, Zap, X, Shield, LogOut, Plug, Image
} from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  onUpgradeClick?: () => void
}

export function Sidebar({ isOpen, onClose, onUpgradeClick }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const { user, setUser, setUsage, addToast } = useAppStore()

  const userPlan = user?.plan ?? 'free'

  const handleLogout = async () => {
    try {
      await api.auth.logout()
      setUser(null)
      setUsage(null)
      addToast('Signed out successfully.', 'info')
      navigate('/')
    } catch (err: any) {
      addToast(err?.message || 'Failed to sign out', 'error')
    }
  }

  const navItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'Create Post', path: '/app/create', icon: PlusCircle, highlight: true },
    { label: 'Connections', path: '/app/connections', icon: Plug },
    { label: 'Brand Kit', path: '/app/brand-kit', icon: Bookmark },
    { label: 'Media Studio', path: '/app/media', icon: Image },
    { label: 'My Generations', path: '/app/history', icon: History },
    { label: 'Billing', path: '/app/billing', icon: CreditCard },
    { label: 'Settings', path: '/app/settings', icon: Settings },
    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', path: '/admin', icon: Shield }] : [])
  ]

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar-container glass-card ${isOpen ? 'mobile-open' : ''}`}>
        {/* Signature Brand Header */}
        <div className="sidebar-brand-wrapper">
          <Link to="/app" className="sidebar-brand-link" onClick={onClose}>
            {/* Signature Custom Vector Emblem Logo */}
            <div className="brand-logo-emblem">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="brand-name-text">
              Post<span className="brand-highlight">Maker</span>
            </span>
          </Link>

          {/* Mobile Close Button */}
          {isOpen && (
            <button type="button" className="btn-icon-xs sidebar-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Main Nav Items */}
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = path === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={[
                  'nav-item-link',
                  isActive ? 'active' : '',
                  item.highlight ? 'highlight-item' : ''
                ].join(' ')}
                onClick={onClose}
              >
                <Icon size={18} className="nav-item-icon" />
                <span className="nav-item-label">{item.label}</span>
                {isActive && <span className="active-pill-indicator" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer User Profile & Upgrade Card */}
        <div className="sidebar-footer">
          {userPlan === 'free' && (
            <div className="upgrade-teaser-card glass-card">
              <div className="teaser-header">
                <Zap size={14} className="text-primary" />
                <span className="teaser-title">Unlock All Channels</span>
              </div>
              <p className="teaser-desc">Get access to 30+ networks and AI Vision image analysis.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm w-full"
                onClick={() => {
                  onClose?.()
                  onUpgradeClick?.()
                }}
              >
                Upgrade Now
              </button>
            </div>
          )}

          {/* User Profile & Logout Card */}
          <div className="user-profile-card">
            <div className="avatar-circle">
              {user?.email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="user-info-text">
              <span className="user-email-name truncate" title={user?.email ?? 'Creator'}>
                {user?.email ?? 'Creator'}
              </span>
              <span className="user-tier-badge">{userPlan.toUpperCase()} Plan</span>
            </div>
            <button
              type="button"
              className="user-logout-btn"
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <style>{`
          .sidebar-container {
            width: var(--sidebar-width);
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 90;
            display: flex;
            flex-direction: column;
            background: var(--color-nav-bg);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border-right: 1px solid var(--color-nav-border);
            border-radius: 0;
            padding: 20px 14px;
            transition: transform var(--transition);
          }

          .sidebar-brand-wrapper {
            padding: 8px 10px 24px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .sidebar-brand-link {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
          }

          .sidebar-close-btn {
            background: none;
            border: none;
            color: var(--color-nav-item-text);
            cursor: pointer;
            display: none;
          }

          /* Iconic 3D Vector Brand Emblem */
          .brand-logo-emblem {
            width: 36px;
            height: 36px;
            border-radius: var(--radius-md);
            background: var(--gradient-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 20px rgba(255, 75, 145, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.60);
            transition: transform var(--transition);
          }

          .sidebar-brand-link:hover .brand-logo-emblem {
            transform: scale(1.05) rotate(-3deg);
          }

          .brand-name-text {
            font-size: 19px;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: var(--color-text-primary);
          }

          .brand-highlight {
            color: var(--color-primary-start);
          }

          .sidebar-nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
          }

          .nav-item-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            border-radius: var(--radius);
            color: var(--color-nav-item-text);
            font-size: 13.5px;
            font-weight: 600;
            text-decoration: none;
            position: relative;
            transition: all var(--transition);
          }

          .nav-item-link:hover {
            color: var(--color-text-primary);
            background: rgba(255, 255, 255, 0.25);
          }

          .nav-item-link.active {
            color: var(--color-nav-active-text);
            background: var(--color-nav-active-bg);
          }

          .nav-item-link.active .nav-item-icon {
            color: var(--color-nav-active-icon);
          }

          .active-pill-indicator {
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 18px;
            background: var(--color-primary-start);
            border-radius: 0 4px 4px 0;
            box-shadow: 0 0 10px rgba(255, 75, 145, 0.6);
          }

          .sidebar-footer {
            display: flex;
            flex-direction: column;
            gap: 14px;
            padding-top: 14px;
            border-top: 1px solid var(--color-nav-border);
          }

          .upgrade-teaser-card {
            padding: 12px;
            background: rgba(255, 75, 145, 0.04);
            border-color: rgba(255, 75, 145, 0.2);
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .teaser-header {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .teaser-title {
            font-size: 12.5px;
            font-weight: 700;
            color: var(--color-primary-start);
          }

          .teaser-desc {
            font-size: 11.5px;
            color: var(--color-text-secondary);
            line-height: 1.4;
          }

          .user-profile-card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            background: rgba(255, 255, 255, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: var(--radius);
            min-width: 0;
            width: 100%;
          }

          .avatar-circle {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            color: var(--color-text-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            border: 1px solid rgba(255, 255, 255, 0.5);
            flex-shrink: 0;
          }

          .user-info-text {
            display: flex;
            flex-direction: column;
            min-width: 0;
            flex: 1;
            overflow: hidden;
          }

          .user-email-name {
            font-size: 12.5px;
            font-weight: 700;
            color: var(--color-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
            width: 100%;
          }

          .user-tier-badge {
            font-size: 11px;
            color: var(--color-text-secondary);
          }

          .user-logout-btn {
            background: transparent;
            border: none;
            color: var(--color-text-secondary);
            padding: 6px;
            border-radius: var(--radius-sm);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all var(--transition);
          }

          .user-logout-btn:hover {
            color: var(--color-error);
            background: var(--color-error-bg);
          }

          .sidebar-mobile-backdrop {
            display: none;
          }

          @media (max-width: 768px) {
            .sidebar-container {
              transform: translateX(-100%);
            }
            .sidebar-container.mobile-open {
              transform: translateX(0);
            }
            .sidebar-close-btn {
              display: block;
            }
            .sidebar-mobile-backdrop {
              display: block;
              position: fixed;
              inset: 0;
              background: rgba(15, 23, 42, 0.4);
              backdrop-filter: blur(4px);
              z-index: 85;
            }
          }
        `}</style>
      </aside>
    </>
  )
}


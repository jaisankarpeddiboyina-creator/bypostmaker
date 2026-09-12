import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, Bookmark, History, CreditCard, Settings, Zap, X, Shield, LogOut, Plug, Image, MessageSquare, Sparkles, Menu
} from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import styles from './Sidebar.module.css'

const cx = (...args: (string | false | null | undefined)[]) =>
  args.filter(Boolean).join(' ')

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  onUpgradeClick?: () => void
}

export function Sidebar({ isOpen, onClose, onUpgradeClick }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const { user, setUser, setUsage, addToast, setShowFeedbackModal, sidebarCollapsed, toggleSidebarCollapsed } = useAppStore()

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

  const handleToggle = () => {
    if (isOpen) {
      onClose?.()
    } else {
      toggleSidebarCollapsed()
    }
  }

  const navItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'Create Post', path: '/app/create', icon: PlusCircle, highlight: true },
    { label: 'Brand Kit', path: '/app/brand-kit', icon: Bookmark },
    { label: 'Media Studio', path: '/app/media', icon: Image },
    { label: 'History', path: '/app/history', icon: History },
    { label: 'AI Tools', path: '/ai-tools', icon: Sparkles },
    { label: 'Billing', path: '/app/billing', icon: CreditCard },
    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', path: '/admin', icon: Shield }] : [])
  ]

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className={styles['sidebar-mobile-backdrop']}
          onClick={onClose}
        />
      )}

      <aside className={cx(
        'glass-card',
        styles['sidebar-container'],
        sidebarCollapsed && styles['collapsed'],
        isOpen && styles['mobile-open']
      )}>
        {/* Signature Brand Header */}
        <div className={styles['sidebar-brand-wrapper']}>
          <Link
            to="/app"
            className={styles['sidebar-brand-link']}
            onClick={onClose}
            title={sidebarCollapsed ? 'PostMaker' : undefined}
          >
            {/* Signature Custom Vector Emblem Logo */}
            <div className={styles['brand-logo-emblem']}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className={styles['brand-name-text']}>
              Post<span className={styles['brand-highlight']}>Maker</span>
            </span>
          </Link>

          <div className={styles['sidebar-header-actions']}>
            {/* Collapse / Expand Toggle Control (Hamburger style) */}
            <button
              type="button"
              className={styles['sidebar-toggle-btn']}
              onClick={handleToggle}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu size={18} />
            </button>

            {/* Mobile Close Button */}
            {isOpen && (
              <button
                type="button"
                className={styles['sidebar-close-btn']}
                onClick={onClose}
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Main Nav Items */}
        <nav className={styles['sidebar-nav']}>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = path === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cx(
                  styles['nav-item-link'],
                  isActive && styles['active'],
                  item.highlight && styles['highlight-item']
                )}
                onClick={onClose}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={18} className={styles['nav-item-icon']} />
                <span className={styles['nav-item-label']}>{item.label}</span>
                {isActive && <span className={styles['active-pill-indicator']} />}
              </Link>
            )
          })}
        </nav>

        {/* Footer User Profile & Upgrade Card */}
        <div className={styles['sidebar-footer']}>
          <div className={styles['sidebar-footer-nav']}>
            <Link
              to="/app/settings"
              className={cx(
                styles['nav-item-link'],
                path === '/app/settings' && styles['active']
              )}
              onClick={onClose}
              title={sidebarCollapsed ? 'Settings' : undefined}
            >
              <Settings size={18} className={styles['nav-item-icon']} />
              <span className={styles['nav-item-label']}>Settings</span>
              {path === '/app/settings' && <span className={styles['active-pill-indicator']} />}
            </Link>
            <button
              type="button"
              className={cx(styles['nav-item-link'], styles['sidebar-btn-link'])}
              onClick={() => {
                onClose?.()
                setShowFeedbackModal(true)
              }}
              title={sidebarCollapsed ? 'Give Feedback' : undefined}
            >
              <MessageSquare size={18} className={styles['nav-item-icon']} />
              <span className={styles['nav-item-label']}>Give Feedback</span>
            </button>
          </div>

          {userPlan === 'free' && (
            <>
              {/* Expanded Upgrade Teaser */}
              <div className={cx(styles['upgrade-teaser-card'], 'glass-card')}>
                <div className={styles['teaser-header']}>
                  <Zap size={14} className="text-primary" />
                  <span className={styles['teaser-title']}>Unlock All Channels</span>
                </div>
                <p className={styles['teaser-desc']}>Get access to 30+ networks and AI Vision image analysis.</p>
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

              {/* Collapsed Compact Upgrade Button */}
              <button
                type="button"
                className={styles['upgrade-collapsed-btn']}
                onClick={() => {
                  onClose?.()
                  onUpgradeClick?.()
                }}
                title="Upgrade to unlock all channels"
                aria-label="Upgrade to unlock all channels"
              >
                <Zap size={16} />
              </button>
            </>
          )}

          {/* User Profile & Logout Card */}
          <div className={styles['user-profile-card']}>
            <div
              className={styles['avatar-circle']}
              title={user?.email ?? 'Account'}
            >
              {user?.email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className={styles['user-info-text']}>
              <span className={cx(styles['user-email-name'], 'truncate')} title={user?.email ?? 'Creator'}>
                {user?.email ?? 'Creator'}
              </span>
              <span className={styles['user-tier-badge']}>{userPlan.toUpperCase()} Plan</span>
            </div>
            <button
              type="button"
              className={styles['user-logout-btn']}
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

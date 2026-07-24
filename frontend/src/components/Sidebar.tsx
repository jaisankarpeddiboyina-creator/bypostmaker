import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard,
  Sparkles,
  Palette,

  History,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  X
} from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, usage, setUser, setShowUpgradeModal } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await api.auth.logout()
    setUser(null)
    navigate('/')
  }

  const navItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'Create Post', path: '/app/create', icon: Sparkles },
    { label: 'Brand Kit', path: '/app/brand-kit', icon: Palette },

    { label: 'My Generations', path: '/app/history', icon: History },
    { label: 'Billing', path: '/app/billing', icon: CreditCard },
    { label: 'Settings', path: '/app/settings', icon: Settings },
  ]


  const currentPath = location.pathname

  const isItemActive = (path: string) => {
    if (path === '/app') {
      // Dashboard is active if pathname is exactly /app or redirects to it
      return currentPath === '/app'
    }
    return currentPath.startsWith(path)
  }

  const showUpgradeCard = user && (user.plan === 'free' || user.plan === 'starter')

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Top Header */}
        <div className="sidebar-header">
          <button className="sidebar-logo" onClick={() => { navigate('/app'); onClose(); }}>
            Post<span>Maker</span>
          </button>
          <button className="sidebar-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="sidebar-nav">
          <ul className="sidebar-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isItemActive(item.path)
              return (
                <li key={item.path}>
                  <button
                    className={`sidebar-nav-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      navigate(item.path)
                      onClose()
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                </li>
              )
            })}

            {/* Conditional Admin Section */}
            {user?.role === 'admin' && (
              <li style={{ marginTop: 'auto', paddingTop: '12px' }}>
                <button
                  className={`sidebar-nav-item admin-item ${currentPath.startsWith('/admin') ? 'active' : ''}`}
                  onClick={() => {
                    navigate('/admin')
                    onClose()
                  }}
                >
                  <Shield size={18} />
                  <span>Admin Panel</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Upgrade Card */}
        {showUpgradeCard && (
          <div className="sidebar-upgrade-card">
            <h4 className="upgrade-title">Upgrade to Pro ✨</h4>
            <ul className="upgrade-features">
              <li>• Unlimited generations</li>
              <li>• All 30+ platforms</li>
              <li>• No watermark</li>
              <li>• Priority support</li>
            </ul>
            <button
              className="btn btn-primary upgrade-btn-action"
              onClick={() => setShowUpgradeModal(true)}
            >
              Upgrade Now →
            </button>
          </div>
        )}

        {/* User Profile section at bottom */}
        {user && (
          <div className="sidebar-profile-wrapper" ref={menuRef}>
            <button
              className="sidebar-profile-card"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar-fallback">{user.name[0]}</div>
              )}
              <div className="profile-info">
                <span className="profile-name truncate">{user.name}</span>
                <span className="profile-plan capitalize">{user.plan} Plan</span>
              </div>
              <ChevronDown size={14} className={`profile-chevron ${menuOpen ? 'rotated' : ''}`} />
            </button>

            {menuOpen && (
              <div className="profile-dropdown-menu">
                <div className="dropdown-header">
                  <span className="dropdown-email truncate">{user.email}</span>
                </div>
                <hr className="dropdown-divider" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    navigate('/app/settings')
                    setMenuOpen(false)
                    onClose()
                  }}
                >
                  <Settings size={14} />
                  <span>Settings</span>
                </button>
                {user.role === 'admin' && (
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      navigate('/admin')
                      setMenuOpen(false)
                      onClose()
                    }}
                  >
                    <Shield size={14} />
                    <span>Admin</span>
                  </button>
                )}
                <button className="dropdown-item danger" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <style>{`
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.40);
          backdrop-filter: blur(4px);
          z-index: 990;
          display: none;
        }

        .app-sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-right: 1px solid var(--color-nav-border);
          box-shadow: var(--shadow-sidebar);
          display: flex;
          flex-direction: column;
          padding: var(--space-5) var(--space-4);
          z-index: 1000;
          flex-shrink: 0;
          position: relative;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-6);
        }

        .sidebar-logo {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 800;
          color: var(--color-text-primary);
          background: none;
          border: none;
          cursor: pointer;
          letter-spacing: -0.04em;
          padding: 0;
          text-align: left;
        }

        .sidebar-logo span {
          color: var(--color-primary-start);
        }

        .sidebar-close-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-secondary);
          padding: var(--space-1);
          border-radius: var(--radius-sm);
        }

        .sidebar-close-btn:hover {
          background: var(--color-border);
          color: var(--color-text-primary);
        }

        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          margin-bottom: var(--space-4);
        }

        .sidebar-nav-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          height: 100%;
        }

        .sidebar-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--nav-item-py) var(--nav-item-px);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          color: var(--color-nav-item-text);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition);
        }

        .sidebar-nav-item svg {
          color: var(--color-nav-item-icon);
          transition: all var(--transition);
        }

        .sidebar-nav-item:hover {
          background: var(--color-border);
          color: var(--color-text-primary);
        }

        .sidebar-nav-item:hover svg {
          color: var(--color-text-secondary);
        }

        .sidebar-nav-item.active {
          background: var(--color-nav-active-bg);
          color: var(--color-nav-active-text);
        }

        .sidebar-nav-item.active svg {
          color: var(--color-nav-active-icon);
        }

        .admin-item {
          border: 1px dashed rgba(147, 51, 234, 0.3);
        }

        .admin-item:hover {
          border-color: var(--color-primary-end);
          background: rgba(147, 51, 234, 0.05);
        }

        .admin-item.active {
          background: rgba(147, 51, 234, 0.1);
          color: var(--color-primary-end);
          border-color: var(--color-primary-end);
        }

        .admin-item.active svg {
          color: var(--color-primary-end);
        }

        /* Upgrade Card */
        .sidebar-upgrade-card {
          background: linear-gradient(135deg, var(--color-upgrade-start), var(--color-upgrade-end));
          border: 1px solid rgba(236, 72, 153, 0.1);
          border-radius: var(--radius-card);
          padding: var(--space-4);
          margin-bottom: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .upgrade-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-nav-active-text);
        }

        .upgrade-features {
          list-style: none;
          font-size: 11px;
          color: var(--color-text-secondary);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .upgrade-btn-action {
          width: 100%;
          height: 32px;
          font-size: 12px;
          justify-content: center;
          padding: 0 var(--space-3);
          margin-top: var(--space-2);
        }

        /* Profile card */
        .sidebar-profile-wrapper {
          position: relative;
          margin-top: auto;
        }

        .sidebar-profile-card {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2);
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition);
        }

        .sidebar-profile-card:hover {
          background: var(--color-border);
          border-color: var(--color-border);
        }

        .profile-avatar {
          width: var(--avatar-size);
          height: var(--avatar-size);
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--color-border);
        }

        .profile-avatar-fallback {
          width: var(--avatar-size);
          height: var(--avatar-size);
          border-radius: 50%;
          background: var(--color-nav-active-bg);
          border: 1px solid rgba(236, 72, 153, 0.2);
          color: var(--color-nav-active-text);
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .profile-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .profile-plan {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .profile-chevron {
          color: var(--color-text-muted);
          transition: transform var(--transition);
        }

        .profile-chevron.rotated {
          transform: rotate(180deg);
        }

        /* Profile Dropdown Menu */
        .profile-dropdown-menu {
          position: absolute;
          bottom: calc(100% + var(--space-2));
          left: 0;
          right: 0;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-modal);
          padding: var(--space-2);
          z-index: 1010;
          display: flex;
          flex-direction: column;
          animation: dropdownFadeIn 150ms ease forwards;
        }

        @keyframes dropdownFadeIn {
          from { transform: translateY(4px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .dropdown-header {
          padding: var(--space-2) var(--space-3);
        }

        .dropdown-email {
          font-size: 11px;
          color: var(--color-text-secondary);
          display: block;
        }

        .dropdown-divider {
          border: none;
          border-top: 1px solid var(--color-border);
          margin: var(--space-1) 0;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: 8px var(--space-3);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border-radius: var(--radius-sm);
          text-align: left;
          transition: all var(--transition);
        }

        .dropdown-item svg {
          color: var(--color-text-muted);
        }

        .dropdown-item:hover {
          background: var(--color-border);
          color: var(--color-text-primary);
        }

        .dropdown-item:hover svg {
          color: var(--color-text-secondary);
        }

        .dropdown-item.danger:hover {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .dropdown-item.danger:hover svg {
          color: var(--color-error);
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .sidebar-overlay {
            display: block;
          }

          .app-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            transition: transform var(--transition-slow);
            box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
          }

          .app-sidebar.open {
            transform: translateX(0);
          }

          .sidebar-close-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>
    </>
  )
}

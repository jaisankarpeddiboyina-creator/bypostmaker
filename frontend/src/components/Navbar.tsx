import { useState, useRef, useEffect } from 'react'
import { History, Settings, LogOut, ChevronDown, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

export function Navbar() {
  const { user, addToast, setUser } = useAppStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const authUrl = import.meta.env.DEV ? '/api/auth/dev' : '/api/auth/google'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await api.auth.logout()
    setUser(null)
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="navbar-logo" onClick={() => navigate('/app')}>
          Post<span>Maker</span>
        </button>
      </div>

      <div className="navbar-right">
        <button className="btn btn-ghost navbar-btn" onClick={() => navigate('/app/history')}>
          <History size={14} /> History
        </button>
        <button className="btn btn-ghost navbar-btn" onClick={() => navigate('/app/settings')}>
          <Settings size={14} /> Settings
        </button>
        {user?.role === 'admin' && (
          <button className="btn btn-ghost navbar-btn admin-btn" onClick={() => navigate('/admin')}>
            <Shield size={14} /> Admin
          </button>
        )}

        {user ? (
          <div className="user-menu-wrapper" ref={menuRef}>
            <button className="user-menu-trigger" onClick={() => setMenuOpen(o => !o)}>
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="user-avatar" />
                : <div className="user-avatar-fallback">{user.name[0]}</div>
              }
              <span className="user-name">{user.name.split(' ')[0]}</span>
              {user.role !== 'user' && (
                <span className={`badge badge-${user.role === 'admin' ? 'pro' : 'starter'}`}
                  style={{ fontSize: 9, padding: '1px 5px' }}>
                  {user.role}
                </span>
              )}
              <ChevronDown size={11} />
            </button>

            {menuOpen && (
              <div className="user-menu">
                <div className="user-menu-email">{user.email}</div>
                <div className="user-menu-plan">
                  <span className={`badge badge-${user.plan}`}>{user.plan}</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                <button className="user-menu-item" onClick={() => { navigate('/app/settings'); setMenuOpen(false) }}>
                  <Settings size={13} /> Settings
                </button>
                {user.role === 'admin' && (
                  <button className="user-menu-item" onClick={() => { navigate('/admin'); setMenuOpen(false) }}>
                    <Shield size={13} /> Admin
                  </button>
                )}
                <button className="user-menu-item danger" onClick={handleLogout}>
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Sign in
          </button>
        )}
      </div>

      <style>{`
        .navbar { height: 52px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: var(--surface); flex-shrink: 0; z-index: 50; }
        .navbar-logo { font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--text-1); background: none; border: none; cursor: pointer; letter-spacing: -0.04em; padding: 0; }
        .navbar-logo span { color: var(--accent); }
        .navbar-left, .navbar-right { display: flex; align-items: center; gap: 8px; }
        .navbar-btn { height: 32px; font-size: 13px; }
        .admin-btn { color: var(--accent); border-color: rgba(124,58,237,0.3); }
        .admin-btn:hover { background: var(--accent-subtle); border-color: var(--accent); color: var(--accent); }
        .user-menu-wrapper { position: relative; }
        .user-menu-trigger { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border: 1px solid var(--border); border-radius: 99px; background: transparent; cursor: pointer; color: var(--text-2); font-size: 13px; font-family: var(--font-body); transition: all var(--transition); }
        .user-menu-trigger:hover { background: var(--card); border-color: var(--border-light); }
        .user-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        .user-avatar-fallback { width: 24px; height: 24px; border-radius: 50%; background: var(--accent-subtle); border: 1px solid rgba(124,58,237,0.2); color: var(--accent); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .user-name { font-weight: 500; }
        .user-menu { position: absolute; top: calc(100% + 8px); right: 0; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; min-width: 200px; box-shadow: var(--shadow-card); z-index: 100; }
        .user-menu-email { font-size: 12px; color: var(--text-3); padding: 2px 6px 4px; word-break: break-all; }
        .user-menu-plan { padding: 2px 6px 6px; }
        .user-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 8px; border: none; background: none; color: var(--text-2); font-size: 13px; cursor: pointer; border-radius: var(--radius-sm); font-family: var(--font-body); text-align: left; transition: all var(--transition); }
        .user-menu-item:hover { background: var(--surface); color: var(--text-1); }
        .user-menu-item.danger:hover { background: var(--error-bg); color: var(--error); }
      `}</style>
    </nav>
  )
}

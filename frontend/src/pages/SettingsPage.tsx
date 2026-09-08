import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Copy,
  Check,
  Edit3,
  LogOut,
  Crown,
  Infinity as InfinityIcon,
  Layers,
  Zap,
  Calendar,
  ExternalLink,
  Shield,
  Lock,
  AlertTriangle,
  Trash2,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { getAvatarUrl } from '../lib/avatar'
import { PLANS } from '../config/pricing'
import { TIER_LIMITS } from '@@config/platforms'

export default function SettingsPage() {
  const { user, setUser, setUsage, addToast } = useAppStore()
  const navigate = useNavigate()

  // ── Profile Card State ─────────────────────────────────────
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(user?.name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [copiedUsername, setCopiedUsername] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarMenuRef = useRef<HTMLDivElement>(null)

  // Close avatar action menu on click outside
  useEffect(() => {
    if (!avatarMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [avatarMenuOpen])

  // Sync name input when user data changes
  useEffect(() => {
    if (user?.name && !isEditingName) {
      setNameInput(user.name)
    }
  }, [user?.name, isEditingName])

  // ── Subscription & Plan State ──────────────────────────────
  const [subData, setSubData] = useState<any>(null)
  const [loadingSub, setLoadingSub] = useState(true)

  useEffect(() => {
    let isMounted = true
    api.payments.status()
      .then(res => {
        if (isMounted) setSubData(res)
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingSub(false)
      })
    return () => { isMounted = false }
  }, [])

  // ── Change Password Modal State ────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  // Complexity rules (matching AuthPage and ResetPasswordPage)
  const pwRules = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[\W_]/.test(newPassword),
  }
  const isNewPasswordValid = Object.values(pwRules).every(Boolean)
  const isPasswordMatch = newPassword === confirmPassword && newPassword.length > 0

  // ── Delete Account Modal State ─────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteEmailInput, setDeleteEmailInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  // ── Handlers ───────────────────────────────────────────────

  // Copy username to clipboard
  const usernameText = user?.email ? `@${user.email.split('@')[0]}` : '@user'
  const handleCopyUsername = async () => {
    try {
      await navigator.clipboard.writeText(usernameText)
      setCopiedUsername(true)
      addToast('Username copied to clipboard', 'info')
      setTimeout(() => setCopiedUsername(false), 2000)
    } catch {
      addToast('Failed to copy username', 'error')
    }
  }

  // Trigger avatar file upload
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      addToast('Please select a valid image file (JPEG, PNG, WEBP, GIF, SVG)', 'error')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      addToast('Avatar image must be under 15MB', 'error')
      return
    }

    setUploadingAvatar(true)
    try {
      // Direct R2 upload
      const uploadRes = await api.upload.direct(file)
      if (!uploadRes.objectKey) throw new Error('Upload failed')

      // Save avatar key in user profile
      const res = await api.user.updateProfile({ avatar_url: uploadRes.objectKey })
      if (res.user) {
        setUser(res.user)
      } else if (user) {
        setUser({ ...user, avatar_url: uploadRes.objectKey })
      }
      addToast('Avatar updated successfully', 'success')
    } catch (err: any) {
      addToast(err?.message || 'Failed to update avatar', 'error')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Remove uploaded avatar photo
  const handleRemoveAvatar = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setAvatarMenuOpen(false)
    setRemovingAvatar(true)
    try {
      const res = await api.user.removeAvatar()
      if (res.user) {
        setUser(res.user)
      } else if (user) {
        setUser({ ...user, avatar_url: null })
      }
      addToast('Profile photo removed successfully', 'info')
    } catch (err: any) {
      addToast(err?.message || 'Failed to remove profile photo', 'error')
    } finally {
      setRemovingAvatar(false)
    }
  }

  // Save Full Name
  const handleSaveProfile = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      addToast('Full name cannot be empty', 'error')
      return
    }

    setSavingProfile(true)
    try {
      const res = await api.user.updateProfile({ name: trimmed })
      if (res.user) {
        setUser(res.user)
      } else if (user) {
        setUser({ ...user, name: trimmed })
      }
      setIsEditingName(false)
      addToast('Profile updated successfully', 'success')
    } catch (err: any) {
      addToast(err?.message || 'Failed to update profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  // Sign out
  const handleSignOut = async () => {
    try {
      await api.auth.logout()
    } catch {
      // Continue client cleanup even if network fails
    }
    setUser(null)
    setUsage(null)
    addToast('Signed out successfully.', 'info')
    navigate('/login', { replace: true })
  }

  // Submit Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordTouched(true)

    if (!currentPassword) {
      addToast('Please enter your current password', 'error')
      return
    }
    if (!isNewPasswordValid) {
      addToast('New password does not meet complexity requirements', 'error')
      return
    }
    if (!isPasswordMatch) {
      addToast('New passwords do not match', 'error')
      return
    }

    setChangingPassword(true)
    try {
      await api.user.changePassword({ currentPassword, newPassword })
      addToast('Password updated successfully', 'success')
      setShowPasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordTouched(false)
    } catch (err: any) {
      addToast(err?.message || 'Failed to update password', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  // Handle Delete Account
  const handleDeleteAccountConfirm = async () => {
    if (deleteEmailInput.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase()) {
      addToast('Please type your exact email address to confirm deletion', 'error')
      return
    }

    setDeleting(true)
    try {
      await api.user.deleteAccount('DELETE MY ACCOUNT')
      setUser(null)
      setUsage(null)
      addToast('Your account has been deleted.', 'info')
      navigate('/', { replace: true })
    } catch (err: any) {
      addToast(err?.message || 'Account deletion failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Derive Current Plan Data
  const currentPlanKey = subData?.subscription?.plan || user?.plan || 'free'
  const planStatus = subData?.subscription?.status || user?.plan_status || 'active'
  const currentPlanMeta = PLANS.find(p => p.key === currentPlanKey) || PLANS[0]
  const planDisplayName = currentPlanMeta.name

  // Derived renewal / expiration date
  const periodEndSec = subData?.subscription?.current_period_end
  const renewalDateString = periodEndSec
    ? new Date(periodEndSec * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  // Plan features for the card
  const planFeatures = React.useMemo(() => {
    if (currentPlanKey === 'business') {
      return [
        { icon: InfinityIcon, text: 'Unlimited generations' },
        { icon: Layers, text: 'All 30+ platforms' },
        { icon: Zap, text: 'Priority generation' },
      ]
    }
    if (currentPlanKey === 'pro') {
      return [
        { icon: InfinityIcon, text: `${TIER_LIMITS.pro.generations} generations/month` },
        { icon: Layers, text: 'All 30+ platforms' },
        { icon: Zap, text: 'Priority generation' },
      ]
    }
    if (currentPlanKey === 'starter') {
      return [
        { icon: InfinityIcon, text: `${TIER_LIMITS.starter.generations} generations/month` },
        { icon: Layers, text: 'All 30+ platforms' },
        { icon: Zap, text: 'Standard AI generation' },
      ]
    }
    return [
      { icon: InfinityIcon, text: `${TIER_LIMITS.free.generations} generations/month` },
      { icon: Layers, text: `${TIER_LIMITS.free.platforms} platforms included` },
      { icon: Zap, text: 'Standard generation' },
    ]
  }, [currentPlanKey])

  // Avatar Image Source (single source of truth with cache-busting)
  const avatarSrc = getAvatarUrl(user?.avatar_url, user?.updated_at)

  const userInitial = (user?.name?.trim() || user?.email?.trim() || 'U')
    .charAt(0)
    .toUpperCase()

  return (
    <div className="settings-page">
      <div className="settings-container">
        
        {/* Top Grid: Profile Card (Left) & Current Plan Card (Right) */}
        <div className="settings-top-grid">
          
          {/* ── 1. Profile Card ── */}
          <div className="settings-card profile-card glass-card">
            <div className="profile-card-content">
              
              {/* Avatar with Camera Overlay & Action Menu */}
              <div className="avatar-section">
                <div className="avatar-circle-wrapper" ref={avatarMenuRef}>
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={user?.name || 'User Avatar'} className="avatar-image" />
                  ) : (
                    <div className="avatar-fallback-circle">
                      <span className="avatar-fallback-initial">{userInitial}</span>
                    </div>
                  )}
                  
                  {/* Camera Upload / Menu Trigger Button */}
                  <button
                    type="button"
                    className="avatar-upload-trigger-btn"
                    onClick={() => {
                      if (avatarSrc) {
                        setAvatarMenuOpen(prev => !prev)
                      } else {
                        fileInputRef.current?.click()
                      }
                    }}
                    title={avatarSrc ? 'Avatar options' : 'Upload profile photo'}
                    disabled={uploadingAvatar || removingAvatar}
                  >
                    {uploadingAvatar || removingAvatar ? (
                      <Loader2 size={13} className="spin" />
                    ) : (
                      <Camera size={13} />
                    )}
                  </button>

                  {/* Avatar Action Dropdown Menu */}
                  {avatarMenuOpen && avatarSrc && (
                    <div className="avatar-action-menu" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="avatar-menu-item"
                        onClick={e => {
                          e.stopPropagation()
                          setAvatarMenuOpen(false)
                          fileInputRef.current?.click()
                        }}
                      >
                        <Camera size={13} />
                        <span>Change Photo</span>
                      </button>
                      <button
                        type="button"
                        className="avatar-menu-item danger"
                        onClick={e => {
                          e.stopPropagation()
                          handleRemoveAvatar(e)
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Remove Photo</span>
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFileSelect}
                  />
                </div>
              </div>

              {/* Fields Column */}
              <div className="profile-fields-col">
                
                {/* Full Name */}
                <div className="profile-field-group">
                  <label className="field-label">FULL NAME</label>
                  <div className="field-input-wrapper">
                    <input
                      type="text"
                      className={`field-input ${isEditingName ? 'editable' : 'readonly'}`}
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      readOnly={!isEditingName}
                      placeholder="Your full name"
                      autoFocus={isEditingName}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="profile-field-group">
                  <label className="field-label">EMAIL ADDRESS</label>
                  <div className="field-input-wrapper">
                    <input
                      type="email"
                      className="field-input readonly"
                      value={user?.email ?? ''}
                      readOnly
                      title="Your registered email address"
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="profile-field-group">
                  <label className="field-label">USERNAME</label>
                  <div className="field-input-wrapper with-icon">
                    <input
                      type="text"
                      className="field-input readonly"
                      value={usernameText}
                      readOnly
                    />
                    <button
                      type="button"
                      className="field-copy-btn"
                      onClick={handleCopyUsername}
                      title={copiedUsername ? 'Copied!' : 'Copy username'}
                    >
                      {copiedUsername ? (
                        <Check size={14} className="copied-icon" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Profile Action Buttons */}
            <div className="profile-actions-row">
              {isEditingName ? (
                <div className="edit-mode-btns">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setNameInput(user?.name ?? '')
                      setIsEditingName(false)
                    }}
                    disabled={savingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 size={13} className="spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm profile-edit-btn"
                  onClick={() => setIsEditingName(true)}
                >
                  <Edit3 size={13} />
                  <span>Edit Profile</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm signout-btn"
                onClick={handleSignOut}
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* ── 2. Current Plan Card ── */}
          <div className="settings-card current-plan-card glass-card">
            <div className="plan-header-row">
              <div className="plan-title-group">
                <div className="plan-icon-box">
                  <Crown size={20} />
                </div>
                <div className="plan-name-wrap">
                  <span className="plan-subtitle-label">Current Plan</span>
                  <h3 className="plan-main-name">{planDisplayName}</h3>
                </div>
              </div>
              <div className="plan-status-wrap">
                <span className={`badge ${planStatus === 'active' ? 'badge-completed' : 'sub-badge'}`}>
                  {planStatus === 'active' ? 'Active' : planStatus}
                </span>
              </div>
            </div>

            {/* Features List */}
            <div className="plan-features-list">
              {planFeatures.map((feat, idx) => {
                const IconComp = feat.icon
                return (
                  <div key={idx} className="plan-feature-item">
                    <IconComp size={15} className="plan-feature-icon" />
                    <span className="plan-feature-text">{feat.text}</span>
                  </div>
                )
              })}

              {/* Renewal Date Item */}
              <div className="plan-feature-item">
                <Calendar size={15} className="plan-feature-icon" />
                <span className="plan-feature-text">
                  {renewalDateString
                    ? planStatus === 'cancelled'
                      ? `Expires on ${renewalDateString}`
                      : `Renews on ${renewalDateString}`
                    : 'Free forever plan'}
                </span>
              </div>
            </div>

            {/* Manage Subscription Button */}
            <button
              type="button"
              className="btn btn-ghost manage-sub-btn"
              onClick={() => navigate('/app/billing')}
            >
              <span>Manage Subscription</span>
              <ExternalLink size={13} />
            </button>
          </div>

        </div>

        {/* ── 3. Password Card ── */}
        <div className="settings-card horizontal-action-card glass-card">
          <div className="horizontal-card-left">
            <div className="card-icon-box blue-box">
              <Shield size={20} />
            </div>
            <div className="horizontal-card-text">
              <h3 className="horizontal-card-title">Password</h3>
              <p className="horizontal-card-desc">Keep your account secure with a strong password.</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost change-password-btn"
            onClick={() => {
              setCurrentPassword('')
              setNewPassword('')
              setConfirmPassword('')
              setPasswordTouched(false)
              setShowPasswordModal(true)
            }}
          >
            <Lock size={13} />
            <span>Change Password</span>
          </button>
        </div>

        {/* ── 4. Delete Account Card ── */}
        <div className="settings-card horizontal-action-card danger-card glass-card">
          <div className="horizontal-card-left">
            <div className="card-icon-box red-box">
              <AlertTriangle size={20} />
            </div>
            <div className="horizontal-card-text">
              <h3 className="horizontal-card-title danger-text">Delete Account</h3>
              <p className="horizontal-card-desc">
                Permanently delete your account, campaigns, posts, generations, brand kit, and all data. This cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn delete-account-btn"
            onClick={() => {
              setDeleteEmailInput('')
              setShowDeleteModal(true)
            }}
          >
            <Trash2 size={13} />
            <span>Delete Account</span>
          </button>
        </div>

      </div>

      {/* ── Change Password Modal ── */}
      {showPasswordModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h3 className="modal-title">Change Password</h3>
                <p className="modal-subtitle">Update your password to keep your account safe.</p>
              </div>
              <button
                type="button"
                className="btn-icon modal-close-btn"
                onClick={() => setShowPasswordModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="password-form">
              <div className="modal-field-group">
                <label className="modal-field-label">Current Password</label>
                <input
                  type="password"
                  className="field-input"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="modal-field-group">
                <label className="modal-field-label">New Password</label>
                <input
                  type="password"
                  className="field-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter strong new password"
                  autoComplete="new-password"
                  required
                />
                
                {/* Real-time complexity check */}
                {newPassword.length > 0 && (
                  <div className="password-rules-box">
                    <span className="rules-title">Password must include:</span>
                    <div className="rules-grid">
                      <span className={`rule-item ${pwRules.length ? 'met' : ''}`}>
                        {pwRules.length ? <Check size={11} /> : <span className="rule-dot" />} At least 8 characters
                      </span>
                      <span className={`rule-item ${pwRules.uppercase ? 'met' : ''}`}>
                        {pwRules.uppercase ? <Check size={11} /> : <span className="rule-dot" />} 1 uppercase letter
                      </span>
                      <span className={`rule-item ${pwRules.number ? 'met' : ''}`}>
                        {pwRules.number ? <Check size={11} /> : <span className="rule-dot" />} 1 number
                      </span>
                      <span className={`rule-item ${pwRules.special ? 'met' : ''}`}>
                        {pwRules.special ? <Check size={11} /> : <span className="rule-dot" />} 1 special character
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-field-group">
                <label className="modal-field-label">Confirm New Password</label>
                <input
                  type="password"
                  className={`field-input ${confirmPassword && !isPasswordMatch ? 'invalid' : ''}`}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  required
                />
                {confirmPassword && !isPasswordMatch && (
                  <span className="field-error-msg">
                    <AlertCircle size={12} /> Passwords do not match
                  </span>
                )}
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={changingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changingPassword || !isNewPasswordValid || !isPasswordMatch || !currentPassword}
                >
                  {changingPassword ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Account Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-box delete-modal-box glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="delete-modal-title-group">
                <div className="card-icon-box red-box-sm">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="modal-title danger-text">Delete Account Confirmation</h3>
                  <p className="modal-subtitle">This action is permanent and irreversible.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon modal-close-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="delete-modal-body">
              <div className="delete-warning-banner">
                <p>
                  Deleting your account will immediately and permanently erase:
                </p>
                <ul className="delete-list">
                  <li>Your user profile and credentials</li>
                  <li>All saved campaigns and generated social posts</li>
                  <li>All uploaded images and media assets in your library</li>
                  <li>Your Brand Kit and custom configurations</li>
                  <li>Any active paid subscriptions (cancelled immediately)</li>
                </ul>
              </div>

              <div className="delete-confirmation-input-wrap">
                <label className="modal-field-label">
                  To confirm, type your email address (<strong>{user?.email}</strong>):
                </label>
                <input
                  type="text"
                  className="field-input delete-input"
                  value={deleteEmailInput}
                  onChange={e => setDeleteEmailInput(e.target.value)}
                  placeholder={user?.email || 'user@example.com'}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn delete-confirm-submit-btn"
                onClick={handleDeleteAccountConfirm}
                disabled={
                  deleting ||
                  deleteEmailInput.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase()
                }
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    <span>Deleting Account...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Permanently Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scoped Styling ── */}
      <style>{`
        .settings-page {
          height: 100%;
          overflow-y: auto;
          padding: 32px 32px 64px 32px;
        }

        .settings-container {
          max-width: 1040px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Base Card Structure ── */
        .settings-card {
          background: var(--color-surface);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-card);
          padding: 24px;
        }

        /* ── Top 2-Column Grid ── */
        .settings-top-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          gap: 24px;
          align-items: stretch;
        }

        /* ── 1. Profile Card ── */
        .profile-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 20px;
        }

        .profile-card-content {
          display: flex;
          align-items: flex-start;
          gap: 24px;
        }

        /* Avatar */
        .avatar-section {
          flex-shrink: 0;
        }

        .avatar-circle-wrapper {
          position: relative;
          width: 92px;
          height: 92px;
        }

        .avatar-image {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.9);
        }

        .avatar-fallback-circle {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #FF6B9E 0%, #F72585 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(247, 37, 133, 0.28);
          border: 2px solid rgba(255, 255, 255, 0.9);
        }

        .avatar-fallback-initial {
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 700;
          color: #FFFFFF;
          line-height: 1;
        }

        .avatar-upload-trigger-btn {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
          transition: all var(--transition);
        }

        .avatar-upload-trigger-btn:hover {
          color: var(--color-primary-end);
          border-color: var(--color-primary-start);
          transform: scale(1.08);
        }

        /* Avatar Action Menu */
        .avatar-action-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          width: 150px;
          background: #FFFFFF;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          padding: 4px;
          z-index: 60;
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: avatarMenuFadeIn 150ms ease-out;
        }

        @keyframes avatarMenuFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .avatar-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-primary, #334155);
          cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
          text-align: left;
        }

        .avatar-menu-item:hover {
          background: var(--color-nav-active-bg, #F1F5F9);
          color: var(--color-text-primary, #0F172A);
        }

        .avatar-menu-item.danger {
          color: #EF4444;
        }

        .avatar-menu-item.danger:hover {
          background: #FEF2F2;
          color: #DC2626;
        }

        /* Profile Fields */
        .profile-fields-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }

        .profile-field-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .field-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          text-transform: uppercase;
        }

        .field-input-wrapper {
          position: relative;
          width: 100%;
        }

        .field-input {
          width: 100%;
          height: 38px;
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius);
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-text-primary);
          transition: all var(--transition);
        }

        .field-input.readonly {
          background: rgba(255, 255, 255, 0.40);
          color: var(--color-text-secondary);
          cursor: default;
        }

        .field-input.editable {
          background: #FFFFFF;
          border-color: var(--color-primary-start);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
        }

        .field-input-wrapper.with-icon .field-input {
          padding-right: 36px;
        }

        .field-copy-btn {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition);
        }

        .field-copy-btn:hover {
          color: var(--color-primary-end);
          background: var(--color-nav-active-bg);
        }

        .copied-icon {
          color: var(--color-success);
        }

        /* Profile Actions Row */
        .profile-actions-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-top: 6px;
        }

        .edit-mode-btns {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .profile-edit-btn {
          padding: 0 20px;
        }

        .signout-btn {
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid var(--color-border);
        }

        .signout-btn:hover {
          color: var(--color-error);
          border-color: var(--color-error-border);
          background: var(--color-error-bg);
        }

        /* ── 2. Current Plan Card ── */
        .current-plan-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 18px;
        }

        .plan-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .plan-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .plan-icon-box {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: rgba(56, 189, 248, 0.16);
          color: var(--color-primary-end);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .plan-name-wrap {
          display: flex;
          flex-direction: column;
        }

        .plan-subtitle-label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .plan-main-name {
          font-family: var(--font-display);
          font-size: 19px;
          font-weight: 800;
          color: var(--color-text-primary);
          line-height: 1.2;
        }

        .plan-status-wrap .badge {
          font-size: 12px;
          padding: 4px 12px;
        }

        /* Plan Features List */
        .plan-features-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }

        .plan-feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .plan-feature-icon {
          color: var(--color-text-muted);
          flex-shrink: 0;
        }

        .manage-sub-btn {
          width: 100%;
          justify-content: center;
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid var(--color-border);
          font-size: 13.5px;
          height: 40px;
        }

        .manage-sub-btn:hover {
          background: rgba(255, 255, 255, 0.85);
          border-color: var(--color-primary-start);
          color: var(--color-primary-end);
        }

        /* ── 3. & 4. Horizontal Action Cards (Password & Delete) ── */
        .horizontal-action-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 24px;
        }

        .horizontal-card-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .card-icon-box {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .card-icon-box.blue-box {
          background: rgba(56, 189, 248, 0.16);
          color: var(--color-primary-end);
        }

        .card-icon-box.red-box {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .card-icon-box.red-box-sm {
          width: 36px;
          height: 36px;
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .horizontal-card-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .horizontal-card-title {
          font-family: var(--font-display);
          font-size: 15.5px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .horizontal-card-title.danger-text {
          color: var(--color-error);
        }

        .horizontal-card-desc {
          font-size: 13px;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        .change-password-btn {
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid var(--color-border);
          flex-shrink: 0;
          height: 40px;
          padding: 0 20px;
        }

        .change-password-btn:hover {
          background: rgba(255, 255, 255, 0.85);
          border-color: var(--color-primary-start);
          color: var(--color-primary-end);
        }

        /* Danger Card & Button */
        .danger-card {
          border-color: rgba(225, 29, 72, 0.22);
          background: rgba(255, 255, 255, 0.40);
        }

        .delete-account-btn {
          background: transparent;
          color: var(--color-error);
          border: 1.5px solid var(--color-error);
          flex-shrink: 0;
          height: 40px;
          padding: 0 20px;
          font-size: 13.5px;
          font-weight: 700;
        }

        .delete-account-btn:hover {
          background: var(--color-error);
          color: #FFFFFF;
          box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);
        }

        /* ── Modals ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .modal-box {
          width: 100%;
          max-width: 480px;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-modal);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .delete-modal-box {
          max-width: 520px;
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .delete-modal-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 19px;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .modal-subtitle {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        .modal-close-btn {
          border: none;
          background: rgba(0, 0, 0, 0.04);
        }

        .password-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .modal-field-label {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .field-input.invalid {
          border-color: var(--color-error);
          background: var(--color-error-bg);
        }

        .field-error-msg {
          font-size: 12px;
          color: var(--color-error);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Password rules checklist */
        .password-rules-box {
          padding: 10px 14px;
          background: rgba(241, 245, 249, 0.85);
          border-radius: var(--radius);
          border: 1px solid rgba(203, 213, 225, 0.6);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .rules-title {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .rules-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .rule-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .rule-item.met {
          color: var(--color-success);
        }

        .rule-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-text-muted);
        }

        /* Delete modal body */
        .delete-modal-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .delete-warning-banner {
          padding: 14px 16px;
          background: var(--color-error-bg);
          border: 1px solid var(--color-error-border);
          border-radius: var(--radius);
          font-size: 13px;
          color: var(--color-text-primary);
          line-height: 1.5;
        }

        .delete-list {
          margin-top: 8px;
          padding-left: 20px;
          font-size: 12.5px;
          color: var(--color-text-secondary);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .delete-confirmation-input-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .delete-input {
          background: #FFFFFF;
          border-color: rgba(225, 29, 72, 0.35);
        }

        .delete-input:focus {
          border-color: var(--color-error);
          outline-color: var(--color-error);
        }

        .modal-actions-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 4px;
        }

        .delete-confirm-submit-btn {
          background: var(--color-error);
          color: #FFFFFF;
          border: none;
        }

        .delete-confirm-submit-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
        }

        /* ── Responsive Breakpoints (1024px & 768px) ── */
        @media (max-width: 1024px) {
          .settings-top-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .settings-page {
            padding: 20px 16px 40px 16px;
          }

          .profile-card-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .profile-fields-col {
            width: 100%;
          }

          .profile-actions-row {
            justify-content: center;
            width: 100%;
          }

          .profile-edit-btn,
          .signout-btn {
            flex: 1;
            justify-content: center;
          }

          .horizontal-action-card {
            flex-direction: column;
            align-items: stretch;
            text-align: left;
            gap: 16px;
          }

          .change-password-btn,
          .delete-account-btn {
            width: 100%;
            justify-content: center;
          }

          .rules-grid {
            grid-template-columns: 1fr;
          }

          .modal-box {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  )
}


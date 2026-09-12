import { useState } from 'react'
import { AlertCircle, Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { PlatformIcon } from '../PlatformIcon'
import { useAppStore } from '../../store/app'
import { getAvatarUrl } from '../../lib/avatar'

export function CardSkeleton({ statusText }: { statusText?: string }) {
  return (
    <div className="cs-container">
      {/* Skeleton Header */}
      <div className="cs-header">
        <div className="cs-shimmer cs-header-title" />
        {statusText && <span className="cs-status-text">{statusText}</span>}
      </div>

      {/* Skeleton Body */}
      <div className="cs-body">
        <div className="cs-profile-row">
          <div className="cs-shimmer cs-avatar" />
          <div className="cs-profile-lines">
            <div className="cs-shimmer cs-line cs-line-short" />
            <div className="cs-shimmer cs-line cs-line-xs" />
          </div>
        </div>

        {/* Media Frame Skeleton */}
        <div className="cs-shimmer cs-media-placeholder" />

        {/* Action Row Skeleton */}
        <div className="cs-actions-row">
          <div className="cs-shimmer cs-action-icon" />
          <div className="cs-shimmer cs-action-icon" />
          <div className="cs-shimmer cs-action-icon" />
        </div>

        {/* Caption Lines */}
        <div className="cs-shimmer cs-line cs-line-full" />
        <div className="cs-shimmer cs-line cs-line-long" />
        <div className="cs-shimmer cs-line cs-line-med" />
      </div>

      {/* Skeleton Footer */}
      <div className="cs-footer">
        <div className="cs-shimmer cs-line cs-line-xs" />
      </div>

      <style>{cardStatesStyles}</style>
    </div>
  )
}

export function CardGenerating({ name, statusText }: { name: string; statusText?: string }) {
  const { user } = useAppStore()
  const avatarSrc = getAvatarUrl(user?.avatar_url, user?.updated_at)
  const handleName = user?.name
    ? user.name.toLowerCase().replace(/\s+/g, '.')
    : (user?.email ? user.email.split('@')[0] : 'your.brand')
  const platformId = name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '')

  return (
    <div className="cs-container cs-container-generating">
      {/* Top Header Bar */}
      <div className="cs-header cs-header-generating">
        <div className="cs-brand-group">
          <PlatformIcon id={platformId} size={16} useBrandColor />
          <span className="cs-brand-name">{name.toUpperCase()}</span>
        </div>
        <div className="cs-status-badge cs-badge-generating">
          <Loader2 size={12} className="cs-spin-icon" />
          <span>{statusText || 'Generating...'}</span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="cs-body cs-generating-body">
        {/* Profile Row */}
        <div className="cs-profile-row">
          <div className="cs-avatar cs-avatar-placeholder">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="cs-avatar-img" />
            ) : (
              handleName[0]?.toUpperCase() || 'Y'
            )}
          </div>
          <div className="cs-profile-info">
            <span className="cs-username">{handleName}</span>
            <span className="cs-time">Just now</span>
          </div>
        </div>

        {/* Centered Hero Canvas with Progress Bar */}
        <div className="cs-hero-canvas">
          <div className="cs-hero-icon-wrapper">
            <PlatformIcon id={platformId} size={44} useBrandColor />
          </div>
          <h4 className="cs-hero-title">Generating your post...</h4>
          <p className="cs-hero-subtext">Crafting the perfect caption for {name}</p>

          {/* Animated Gradient Progress Bar */}
          <div className="cs-progress-track">
            <div className="cs-progress-fill" />
          </div>
        </div>

        {/* Social Actions Row */}
        <div className="cs-actions-row">
          <div className="cs-action-dots">
            <span className="cs-dot cs-dot-active" />
            <span className="cs-dot" />
            <span className="cs-dot" />
          </div>
        </div>

        {/* Caption Preview Area */}
        <div className="cs-caption-preview">
          <div className="cs-caption-header">
            <span className="cs-username">{handleName}</span>
            <div className="cs-caption-status-pill">
              <Loader2 size={11} className="cs-spin-icon" />
              <span>Generating caption...</span>
            </div>
          </div>
          <div className="cs-shimmer cs-line cs-line-full" />
          <div className="cs-shimmer cs-line cs-line-long" />
          <div className="cs-shimmer cs-line cs-line-med" />

          {/* Hashtag Pills Skeleton */}
          <div className="cs-hashtag-pills-row">
            <div className="cs-shimmer cs-pill-tag" />
            <div className="cs-shimmer cs-pill-tag" />
            <div className="cs-shimmer cs-pill-tag" />
            <div className="cs-shimmer cs-pill-tag" />
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="cs-footer cs-footer-generating">
        <span className="cs-char-counter">0 chars</span>
        <div className="cs-cta-badge-generating">
          <Sparkles size={13} />
          <span>Generating with AI...</span>
        </div>
      </div>

      <style>{cardStatesStyles}</style>
    </div>
  )
}

export function CardError({ name, message, brandColor, onRetry }: {
  name: string
  message: string
  brandColor?: string
  onRetry?: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const platformId = name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '')

  const handleClick = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="cs-container cs-container-error">
      {/* Top Header Bar */}
      <div className="cs-header cs-header-error">
        <div className="cs-brand-group">
          <PlatformIcon id={platformId} size={16} useBrandColor />
          <span className="cs-brand-name">{name.toUpperCase()}</span>
        </div>
        <div className="cs-status-badge cs-badge-error">
          <AlertCircle size={12} />
          <span>Failed</span>
        </div>
      </div>

      {/* Single Error Body Canvas */}
      <div className="cs-body cs-error-body">
        {/* Failed Canvas Hero (Rose Gradient Background with Alert Badge Overlay) */}
        <div className="cs-hero-canvas cs-hero-canvas-error">
          <div className="cs-hero-icon-wrapper cs-error-icon-wrapper">
            <PlatformIcon id={platformId} size={40} useBrandColor />
            <div className="cs-error-badge-overlay">
              <AlertCircle size={13} color="#ffffff" />
            </div>
          </div>
          <h4 className="cs-hero-title cs-title-error">Failed to generate post</h4>
          <p className="cs-hero-subtext cs-subtext-error">{message}</p>

          {onRetry && (
            <button
              type="button"
              onClick={handleClick}
              disabled={retrying}
              className="cs-retry-btn-hero"
            >
              <RefreshCw size={14} className={retrying ? 'cs-spin-icon' : ''} />
              <span>{retrying ? 'Retrying...' : 'Try Again'}</span>
            </button>
          )}
        </div>
      </div>

      <style>{cardStatesStyles}</style>
    </div>
  )
}

const cardStatesStyles = `
  .cs-container {
    width: 100%;
    max-width: 470px;
    margin: 0 auto;
    background: var(--color-surface-solid, #ffffff);
    border: 1px solid var(--color-border, #E2E8F0);
    border-radius: var(--radius-card, 24px);
    overflow: hidden;
    box-shadow: var(--shadow-card, 0 10px 30px -10px rgba(31, 38, 135, 0.06));
    font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
    transition: all var(--transition, 160ms cubic-bezier(0.16, 1, 0.3, 1));
  }

  .cs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #F8FAFC;
    border-bottom: 1px solid var(--color-border, #E2E8F0);
  }

  .cs-header-generating {
    background: rgba(56, 189, 248, 0.06);
    border-bottom-color: rgba(56, 189, 248, 0.20);
  }

  .cs-header-error {
    background: var(--color-error-bg, rgba(225, 29, 72, 0.08));
    border-bottom-color: var(--color-error-border, rgba(225, 29, 72, 0.20));
  }

  .cs-brand-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cs-brand-name {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-text-primary, #0F172A);
  }

  .cs-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: var(--radius-pill, 999px);
    font-size: 11px;
    font-weight: 600;
  }

  .cs-badge-generating {
    background: rgba(56, 189, 248, 0.12);
    color: #0284C7;
  }

  .cs-badge-error {
    background: var(--color-error-bg, rgba(225, 29, 72, 0.08));
    color: var(--color-error, #E11D48);
    border: 1px solid var(--color-error-border, rgba(225, 29, 72, 0.20));
  }

  .cs-body {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cs-profile-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cs-profile-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cs-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .cs-avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .cs-avatar-placeholder {
    background: linear-gradient(135deg, var(--color-primary-start, #38BDF8), #0284C7);
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cs-profile-info {
    display: flex;
    flex-direction: column;
  }

  .cs-username {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-primary, #0F172A);
  }

  .cs-time {
    font-size: 11px;
    color: var(--color-text-muted, #64748B);
  }

  .cs-status-text {
    font-size: 11px;
    color: var(--color-text-muted, #64748B);
    font-weight: 500;
  }

  .cs-hero-canvas {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    min-height: 200px;
    max-height: 320px;
    border-radius: var(--radius, 12px);
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(2, 132, 199, 0.05) 50%, rgba(255, 255, 255, 0.5) 100%);
    border: 1px solid var(--color-border, #E2E8F0);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    text-align: center;
  }

  .cs-hero-canvas-error {
    background: linear-gradient(135deg, rgba(225, 29, 72, 0.06) 0%, rgba(255, 241, 242, 0.6) 100%);
    border-color: var(--color-error-border, rgba(225, 29, 72, 0.20));
  }

  .cs-hero-icon-wrapper {
    position: relative;
    width: 68px;
    height: 68px;
    border-radius: 20px;
    background: var(--color-surface-solid, #ffffff);
    box-shadow: 0 8px 24px rgba(56, 189, 248, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  .cs-error-icon-wrapper {
    box-shadow: 0 8px 24px rgba(225, 29, 72, 0.12);
  }

  .cs-error-badge-overlay {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-error, #E11D48);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--color-surface-solid, #ffffff);
  }

  .cs-hero-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text-primary, #0F172A);
    margin-bottom: 4px;
  }

  .cs-title-error {
    color: #991B1B;
  }

  .cs-hero-subtext {
    font-size: 12px;
    color: var(--color-text-muted, #64748B);
    max-width: 260px;
    line-height: 1.4;
    margin-bottom: 16px;
  }

  .cs-subtext-error {
    color: #9F1239;
  }

  .cs-progress-track {
    width: 80%;
    max-width: 220px;
    height: 6px;
    background: rgba(226, 232, 240, 0.6);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }

  .cs-progress-fill {
    height: 100%;
    width: 100%;
    background: var(--gradient-primary-h, linear-gradient(90deg, #38BDF8, #0284C7));
    border-radius: 999px;
    animation: csIndeterminate 1.8s ease-in-out infinite;
  }

  @keyframes csIndeterminate {
    0%   { transform: translateX(-100%); }
    50%  { transform: translateX(0%); }
    100% { transform: translateX(100%); }
  }

  .cs-actions-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .cs-action-dots {
    display: flex;
    gap: 4px;
  }

  .cs-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #E2E8F0;
  }

  .cs-dot-active {
    background: var(--color-primary-start, #38BDF8);
  }

  .cs-caption-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cs-caption-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cs-caption-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--radius-pill, 999px);
    background: rgba(56, 189, 248, 0.08);
    color: #0284C7;
    font-size: 11px;
    font-weight: 500;
  }

  .cs-status-pill-error {
    background: var(--color-error-bg, rgba(225, 29, 72, 0.08));
    color: var(--color-error, #E11D48);
  }

  .cs-hashtag-pills-row {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .cs-pill-tag {
    height: 18px;
    width: 50px;
    border-radius: var(--radius-pill, 999px);
  }

  .cs-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #F8FAFC;
    border-top: 1px solid var(--color-border, #E2E8F0);
  }

  .cs-char-counter {
    font-size: 11px;
    color: var(--color-text-muted, #64748B);
    font-family: var(--font-mono, monospace);
  }

  .cs-cta-badge-generating {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: var(--radius-pill, 999px);
    background: rgba(56, 189, 248, 0.12);
    color: #0284C7;
    font-size: 12px;
    font-weight: 600;
  }

  .cs-retry-btn-hero {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 22px;
    border-radius: var(--radius-pill, 999px);
    background: var(--color-error, #E11D48);
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
    transition: all 120ms ease;
  }

  .cs-retry-btn-hero:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .cs-retry-btn-hero:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cs-retry-btn-footer {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: var(--radius-pill, 999px);
    background: var(--color-error-bg, rgba(225, 29, 72, 0.08));
    color: var(--color-error, #E11D48);
    border: 1px solid var(--color-error-border, rgba(225, 29, 72, 0.20));
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .cs-retry-btn-footer:hover {
    background: rgba(225, 29, 72, 0.15);
  }

  .cs-shimmer {
    background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%) !important;
    background-size: 800px 100% !important;
    animation: csShimmer 1.6s infinite linear !important;
    border-radius: 4px;
  }

  @keyframes csShimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }

  .cs-spin-icon {
    animation: csSpin 0.8s linear infinite;
  }

  @keyframes csSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .cs-line { height: 10px; }
  .cs-line-xs { width: 35%; }
  .cs-line-short { width: 55%; }
  .cs-line-med { width: 65%; }
  .cs-line-long { width: 85%; }
  .cs-line-full { width: 100%; }
  .cs-header-title { height: 12px; width: 100px; }
  .cs-media-placeholder { height: 160px; width: 100%; border-radius: var(--radius, 12px); }
  .cs-action-icon { width: 20px; height: 20px; border-radius: 4px; }
`


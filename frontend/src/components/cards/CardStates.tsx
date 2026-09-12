import { useState } from 'react'
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { PlatformIcon } from '../PlatformIcon'

export function CardSkeleton({ statusText }: { statusText?: string }) {
  return (
    <div className="cs-container">
      <div className="cs-header">
        <div className="cs-shimmer cs-header-title" />
        {statusText && <span className="cs-status-text">{statusText}</span>}
      </div>

      <div className="cs-body">
        <div className="cs-profile-row">
          <div className="cs-shimmer cs-avatar" />
          <div className="cs-profile-lines">
            <div className="cs-shimmer cs-line cs-line-short" />
            <div className="cs-shimmer cs-line cs-line-xs" />
          </div>
        </div>

        <div className="cs-shimmer cs-media-placeholder" />

        <div className="cs-actions-row">
          <div className="cs-shimmer cs-action-icon" />
          <div className="cs-shimmer cs-action-icon" />
          <div className="cs-shimmer cs-action-icon" />
        </div>

        <div className="cs-shimmer cs-line cs-line-full" />
        <div className="cs-shimmer cs-line cs-line-long" />
        <div className="cs-shimmer cs-line cs-line-med" />
      </div>

      <div className="cs-footer">
        <div className="cs-shimmer cs-line cs-line-xs" />
      </div>

      <style>{cardStatesStyles}</style>
    </div>
  )
}

export function CardGenerating({
  platformId,
  name,
  statusText,
}: {
  platformId: string
  name?: string
  statusText?: string
}) {
  const displayName = name || platformId

  return (
    <div className="cs-overlay-container cs-overlay-generating">
      <div className="cs-overlay-card">
        <div className="cs-hero-icon-wrapper cs-generating-icon-wrapper">
          <PlatformIcon id={platformId} size={32} useBrandColor />
          <div className="cs-spinner-badge">
            <Loader2 size={12} className="cs-spin-icon" color="#0284C7" />
          </div>
        </div>
        <h4 className="cs-hero-title">Generating your post...</h4>
        <p className="cs-hero-subtext">
          {statusText || `Crafting perfect caption for ${displayName}`}
        </p>

        {/* Animated Gradient Progress Bar */}
        <div className="cs-progress-track">
          <div className="cs-progress-fill" />
        </div>
      </div>

      <style>{cardStatesStyles}</style>
    </div>
  )
}

export function CardError({
  platformId,
  name,
  message,
  brandColor,
  onRetry,
}: {
  platformId: string
  name?: string
  message: string
  brandColor?: string
  onRetry?: () => void
}) {
  const [retrying, setRetrying] = useState(false)

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
    <div className="cs-overlay-container cs-overlay-error">
      <div className="cs-overlay-card cs-overlay-card-error">
        <div className="cs-hero-icon-wrapper cs-error-icon-wrapper">
          <PlatformIcon id={platformId} size={32} useBrandColor />
          <div className="cs-error-badge-overlay">
            <AlertCircle size={12} color="#ffffff" />
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

      <style>{cardStatesStyles}</style>
    </div>
  )
}

const cardStatesStyles = `
  .cs-overlay-container {
    position: absolute;
    inset: 0;
    z-index: 20;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    animation: csFadeIn 180ms ease-out;
  }

  @keyframes csFadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to   { opacity: 1; transform: scale(1); }
  }

  .cs-overlay-card {
    width: 100%;
    max-width: 320px;
    background: #ffffff;
    border: 1px solid var(--color-border, #E2E8F0);
    border-radius: 16px;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
  }

  .cs-overlay-card-error {
    background: #FFF5F5;
    border-color: rgba(225, 29, 72, 0.2);
  }

  .cs-generating-icon-wrapper {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 4px 16px rgba(56, 189, 248, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .cs-spinner-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #F0F9FF;
    border: 2px solid #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cs-hero-icon-wrapper {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 8px 24px rgba(56, 189, 248, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .cs-error-icon-wrapper {
    box-shadow: 0 8px 24px rgba(225, 29, 72, 0.12);
  }

  .cs-error-badge-overlay {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
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
    margin: 0 0 4px 0;
  }

  .cs-title-error {
    color: #991B1B;
  }

  .cs-hero-subtext {
    font-size: 12px;
    color: var(--color-text-muted, #64748B);
    max-width: 260px;
    line-height: 1.4;
    margin: 0 0 16px 0;
  }

  .cs-subtext-error {
    color: #9F1239;
  }

  .cs-progress-track {
    width: 80%;
    max-width: 200px;
    height: 5px;
    background: rgba(226, 232, 240, 0.8);
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

  .cs-spin-icon {
    animation: csSpin 0.8s linear infinite;
  }

  @keyframes csSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Skeleton styling kept for fallback */
  .cs-container {
    width: 100%;
    max-width: 470px;
    margin: 0 auto;
    background: var(--color-surface-solid, #ffffff);
    border: 1px solid var(--color-border, #E2E8F0);
    border-radius: var(--radius-card, 24px);
    overflow: hidden;
  }
  .cs-header { display: flex; justify-content: space-between; padding: 10px 14px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
  .cs-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  .cs-profile-row { display: flex; align-items: center; gap: 10px; }
  .cs-profile-lines { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .cs-avatar { width: 32px; height: 32px; border-radius: 50%; }
  .cs-footer { padding: 10px 14px; background: #F8FAFC; border-top: 1px solid #E2E8F0; }
  .cs-shimmer { background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%) !important; background-size: 800px 100% !important; animation: csShimmer 1.6s infinite linear !important; border-radius: 4px; }
  @keyframes csShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  .cs-line { height: 10px; }
  .cs-line-xs { width: 35%; }
  .cs-line-short { width: 55%; }
  .cs-line-med { width: 65%; }
  .cs-line-long { width: 85%; }
  .cs-line-full { width: 100%; }
  .cs-header-title { height: 12px; width: 100px; }
  .cs-media-placeholder { height: 160px; width: 100%; border-radius: 12px; }
  .cs-action-icon { width: 20px; height: 20px; border-radius: 4px; }
  .cs-actions-row { display: flex; gap: 16px; }
`



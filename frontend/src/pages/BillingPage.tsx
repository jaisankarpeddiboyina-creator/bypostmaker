import { useState, useEffect } from 'react'
import { Check, Info, ExternalLink } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { PLANS } from '../config/pricing'

const PLAN_TAGLINES: Record<string, string> = {
  free: 'Get started with PostMaker',
  starter: 'For individuals and small creators',
  pro: 'For growing creators and teams',
  business: 'For agencies, teams and founders',
}

export default function BillingPage() {
  const { user, usage, addToast, setShowUpgradeModal, setUpgradeReason, currency, setCurrency } = useAppStore()
  const [subStatus, setSubStatus] = useState<any>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    api.payments.status()
      .then(res => setSubStatus(res))
      .catch(() => {})
      .finally(() => setLoadingSub(false))
  }, [])

  const handleCurrencyToggle = async (c: 'usd' | 'inr') => {
    setCurrency(c)
    if (user) {
      try {
        await api.user.setCurrency(c)
      } catch { /* not critical */ }
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Cancel your subscription? You keep access until the end of this billing period.')) return
    setCancelling(true)
    try {
      await api.payments.cancel()
      addToast('Subscription cancelled. Access continues until period end.', 'success')
      window.location.reload()
    } catch (err: any) {
      addToast(err.message ?? 'Cancellation failed', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const getLimitText = () => {
    if (!usage) return ''
    return usage.limit === -1 ? 'Unlimited' : `${usage.limit} generations`
  }

  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end * 1000)
        .toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="billing-page">
      <div className="billing-container">
        
        {/* Header Section */}
        <div className="billing-header">
          <div className="billing-header-left">
            <h1 className="billing-title">Choose a Plan</h1>
            <p className="billing-subtitle">Upgrade or downgrade anytime. No long-term contracts.</p>
          </div>

          <div className="billing-header-right">
            <div className="currency-toggle-pill" role="group" aria-label="Currency selection">
              <button
                type="button"
                className={`currency-pill-btn ${currency === 'usd' ? 'active' : ''}`}
                onClick={() => handleCurrencyToggle('usd')}
              >
                USD ($)
              </button>
              <button
                type="button"
                className={`currency-pill-btn ${currency === 'inr' ? 'active' : ''}`}
                onClick={() => handleCurrencyToggle('inr')}
              >
                INR (₹)
              </button>
            </div>
            <span className="currency-caption">
              {currency === 'inr' ? 'Prices shown in Indian Rupees (₹)' : 'Prices shown in US Dollars ($)'}
            </span>
          </div>
        </div>

        {/* Subscription Status Bar (Active, Cancelled, Past Due, etc.) */}
        {loadingSub ? (
          <div className="sub-status-loading glass-card">Loading subscription details...</div>
        ) : (
          subStatus?.subscription && (
            <div className="sub-management-bar glass-card">
              <div className="sub-management-info">
                <div className="sub-detail-item">
                  <span className="sub-detail-label">Status</span>
                  <span className={`sub-badge status-${subStatus.subscription.status}`}>
                    {subStatus.subscription.status}
                  </span>
                </div>
                {periodEnd && (
                  <div className="sub-detail-item">
                    <span className="sub-detail-label">
                      {subStatus.subscription.status === 'cancelled' ? 'Expires' : 'Renews'}
                    </span>
                    <span className="sub-detail-value">{periodEnd}</span>
                  </div>
                )}
              </div>
              {subStatus.subscription.status === 'active' && (
                <button
                  type="button"
                  className="btn btn-ghost cancel-sub-btn"
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
                </button>
              )}
            </div>
          )
        )}

        {/* Generations Usage Quota Display */}
        {usage && user?.plan !== 'business' && (
          <div className="billing-usage-section glass-card">
            <div className="usage-labels">
              <span className="usage-title">Generations Used</span>
              <span className="usage-numbers">
                <strong>{usage.generations}</strong> / {usage.limit === -1 ? 'Unlimited' : usage.limit}
              </span>
            </div>
            <div className="usage-bar-container">
              <div
                className="usage-bar-fill-progress"
                style={{
                  width: `${Math.min(100, (usage.generations / (usage.limit === -1 ? 1 : usage.limit)) * 100)}%`,
                  background: usage.remaining === 0 ? 'var(--color-error)' : 'var(--gradient-primary-h)',
                }}
              />
            </div>
            <div className="usage-footer">
              <span>{usage.limit === -1 ? 'Unlimited generations' : `${usage.remaining} remaining this month`}</span>
            </div>
          </div>
        )}

        {/* 4-Plan Grid */}
        <div className="billing-plans-grid">
          {PLANS.map((plan) => {
            const isCurrent = user?.plan === plan.key
            const canUpgrade = user?.plan !== 'business' && plan.key !== 'free' && plan.key !== user?.plan

            return (
              <div
                key={plan.key}
                className={`billing-plan-card ${plan.key === 'pro' ? 'featured' : ''}`}
              >
                {plan.key === 'pro' && (
                  <div className="plan-featured-badge">MOST POPULAR</div>
                )}
                <h2 className="plan-card-name">{plan.name}</h2>
                <p className="plan-card-tagline">{PLAN_TAGLINES[plan.key] || ''}</p>
                
                <div className="plan-card-price-row">
                  <span className="plan-card-price-value">
                    {currency === 'inr' ? plan.price.inr : plan.price.usd}
                  </span>
                  <span className="plan-card-period">/month</span>
                </div>

                <ul className="plan-card-features">
                  {plan.features.map((f) => (
                    <li key={f} className="plan-card-feature-item">
                      <div className="plan-feature-check-wrap">
                        <Check size={11} strokeWidth={2.5} />
                      </div>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button type="button" className="plan-action-btn btn-current" disabled>
                    Current Plan
                  </button>
                ) : canUpgrade ? (
                  <button
                    type="button"
                    className={`plan-action-btn ${plan.key === 'pro' ? 'btn-upgrade-primary' : 'btn-upgrade-ghost'}`}
                    onClick={() => {
                      setUpgradeReason(`Subscribe to our ${plan.name} plan for expanded limits.`)
                      setShowUpgradeModal(true)
                    }}
                  >
                    Upgrade to {plan.name}
                  </button>
                ) : (
                  <button type="button" className="plan-action-btn btn-disabled" disabled>
                    Unavailable
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Custom Plan Info Banner */}
        <div className="custom-plan-banner glass-card">
          <div className="custom-plan-content">
            <div className="custom-plan-icon">
              <Info size={20} />
            </div>
            <div className="custom-plan-text">
              <h3 className="custom-plan-title">Need a custom plan?</h3>
              <p className="custom-plan-desc">Contact us for high-volume usage, custom limits or enterprise features.</p>
            </div>
          </div>
          <a
            href="mailto:support@bypostamaker.com?subject=Custom%20Plan%20Inquiry"
            className="contact-sales-btn"
          >
            <span>Contact Sales</span>
            <ExternalLink size={14} />
          </a>
        </div>

      </div>

      <style>{`
        .billing-page {
          height: 100%;
          overflow-y: auto;
          padding: 32px 32px 64px 32px;
        }

        .billing-container {
          max-width: 1160px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Header */
        .billing-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .billing-title {
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }

        .billing-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .billing-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          flex-shrink: 0;
        }

        .currency-toggle-pill {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-pill);
          padding: 3px;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .currency-pill-btn {
          padding: 6px 16px;
          border-radius: var(--radius-pill);
          border: none;
          background: transparent;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition);
        }

        .currency-pill-btn:hover:not(.active) {
          color: var(--color-text-primary);
        }

        .currency-pill-btn.active {
          background: var(--color-primary-end);
          color: #FFFFFF;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
        }

        .currency-caption {
          font-size: 11.5px;
          color: var(--color-text-muted);
        }

        /* Subscription Management Bar */
        .sub-status-loading {
          padding: 14px 20px;
          border-radius: 16px;
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
        }

        .sub-management-bar {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-radius: 16px;
          flex-wrap: wrap;
        }

        .sub-management-info {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .sub-detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sub-detail-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sub-detail-value {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .sub-badge {
          display: inline-flex;
          padding: 2px 10px;
          border-radius: var(--radius-pill);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .sub-badge.status-active {
          background: var(--color-success-bg);
          color: var(--color-success);
          border: 1px solid var(--color-success-border);
        }

        .sub-badge.status-cancelled {
          background: var(--color-error-bg);
          color: var(--color-error);
          border: 1px solid var(--color-error-border);
        }

        .sub-badge.status-past_due {
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border: 1px solid var(--color-warning-border);
        }

        .cancel-sub-btn {
          color: var(--color-error);
          border-color: rgba(225, 29, 72, 0.25);
          font-size: 12.5px;
          height: 32px;
          padding: 0 14px;
        }

        .cancel-sub-btn:hover:not(:disabled) {
          background: var(--color-error-bg);
          border-color: var(--color-error);
          color: var(--color-error);
        }

        /* Usage Quota Card */
        .billing-usage-section {
          padding: 16px 20px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .usage-labels {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .usage-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .usage-numbers {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .usage-numbers strong {
          color: var(--color-text-primary);
        }

        .usage-bar-container {
          height: 8px;
          background: rgba(203, 213, 225, 0.45);
          border-radius: var(--radius-pill);
          overflow: hidden;
        }

        .usage-bar-fill-progress {
          height: 100%;
          border-radius: var(--radius-pill);
          transition: width 0.5s ease;
        }

        .usage-footer {
          display: flex;
          justify-content: flex-end;
          font-size: 12px;
          color: var(--color-text-muted);
        }

        /* 4-Plan Grid */
        .billing-plans-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          align-items: stretch;
        }

        .billing-plan-card {
          background: var(--color-surface);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          padding: 24px 20px 20px 20px;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: var(--shadow-card);
          transition: all var(--transition);
        }

        .billing-plan-card.featured {
          border: 1.5px solid var(--color-primary-start);
          box-shadow: 0 12px 32px -8px rgba(56, 189, 248, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.9);
        }

        .plan-featured-badge {
          position: absolute;
          top: -11px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-primary-end);
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 3px 12px;
          border-radius: var(--radius-pill);
          text-transform: uppercase;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
        }

        .plan-card-name {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 4px;
        }

        .plan-card-tagline {
          font-size: 12px;
          color: var(--color-text-secondary);
          min-height: 32px;
          line-height: 1.35;
          margin-bottom: 12px;
        }

        .plan-card-price-row {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 800;
          color: var(--color-text-primary);
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 18px;
          letter-spacing: -0.03em;
        }

        .plan-card-period {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          letter-spacing: 0;
        }

        .plan-card-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          margin-bottom: 24px;
        }

        .plan-card-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12.5px;
          color: var(--color-text-secondary);
          line-height: 1.35;
        }

        .plan-feature-check-wrap {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.16);
          color: var(--color-primary-end);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .plan-action-btn {
          width: 100%;
          height: 40px;
          border-radius: var(--radius-pill);
          font-family: var(--font-body);
          font-size: 13.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition);
          border: none;
          text-decoration: none;
        }

        .plan-action-btn.btn-current {
          background: rgba(241, 245, 249, 0.85);
          color: var(--color-text-muted);
          cursor: default;
          border: 1px solid rgba(203, 213, 225, 0.6);
        }

        .plan-action-btn.btn-upgrade-ghost {
          background: rgba(255, 255, 255, 0.7);
          color: var(--color-primary-end);
          border: 1.5px solid var(--color-primary-start);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .plan-action-btn.btn-upgrade-ghost:hover {
          background: var(--color-primary-end);
          color: #FFFFFF;
          border-color: var(--color-primary-end);
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);
        }

        .plan-action-btn.btn-upgrade-primary {
          background: var(--color-primary-end);
          color: #FFFFFF;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
        }

        .plan-action-btn.btn-upgrade-primary:hover {
          filter: brightness(1.1);
          box-shadow: 0 6px 18px rgba(2, 132, 199, 0.45);
        }

        .plan-action-btn.btn-disabled {
          background: rgba(241, 245, 249, 0.6);
          color: var(--color-text-placeholder);
          cursor: not-allowed;
          border: 1px solid var(--color-border);
        }

        /* Custom Plan Info Banner */
        .custom-plan-banner {
          background: var(--color-surface);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: var(--shadow-card);
        }

        .custom-plan-content {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .custom-plan-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.16);
          color: var(--color-primary-end);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .custom-plan-title {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .custom-plan-desc {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        .contact-sales-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 18px;
          height: 38px;
          border-radius: var(--radius-pill);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid var(--color-border);
          text-decoration: none;
          transition: all var(--transition);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .contact-sales-btn:hover {
          background: rgba(255, 255, 255, 0.9);
          border-color: var(--color-primary-start);
          color: var(--color-primary-end);
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .billing-plans-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .billing-page {
            padding: 20px 16px 40px 16px;
          }

          .billing-header {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }

          .billing-header-right {
            align-items: flex-start;
          }

          .billing-plans-grid {
            grid-template-columns: 1fr;
          }

          .custom-plan-banner {
            flex-direction: column;
            align-items: stretch;
            text-align: left;
          }

          .contact-sales-btn {
            width: 100%;
            justify-content: center;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .billing-plan-card,
          .currency-pill-btn,
          .plan-action-btn,
          .contact-sales-btn {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { CreditCard, Sparkles, AlertTriangle, ShieldCheck, Check } from 'lucide-react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

const PLANS_INFO = {
  free: { name: 'Free', price: '₹0', gens: 5, features: ['5 generations/month', 'Basic platforms', '7-day history'] },
  starter: { name: 'Starter', price: '₹299', gens: 50, features: ['50 generations/month', 'All 30+ platforms', '30-day history', 'AI refinement'] },
  pro: { name: 'Pro', price: '₹799', gens: 200, features: ['200 generations/month', 'All 30+ platforms', '90-day history', 'Priority generation'] },
  business: { name: 'Business', price: '₹1,999', gens: 1000, features: ['1,000 generations/month', 'All 30+ platforms', '1-year history', 'API access (v2)'] }
}

export default function BillingPage() {
  const { user, usage, addToast, setShowUpgradeModal, setUpgradeReason } = useAppStore()
  const [subStatus, setSubStatus] = useState<any>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    api.payments.status()
      .then(res => setSubStatus(res))
      .catch(() => {})
      .finally(() => setLoadingSub(false))
  }, [])

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

  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end * 1000)
        .toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const getLimitText = () => {
    if (!usage) return ''
    return usage.limit === -1 ? 'Unlimited' : `${usage.limit} generations`
  }

  return (
    <div className="billing-page">
      <div className="billing-inner">
        
        {/* Active Subscription Summary */}
        <div className="billing-card main-plan-card">
          <div className="card-header">
            <div>
              <span className="section-label">CURRENT PLAN</span>
              <h2 className="plan-name">{user?.plan ? PLANS_INFO[user.plan as keyof typeof PLANS_INFO]?.name : 'Free'} Plan</h2>
            </div>
            <span className={`badge badge-${user?.plan}`}>{user?.plan}</span>
          </div>

          {/* Usage Stats Bar */}
          {usage && user?.plan !== 'business' && (
            <div className="billing-usage-section">
              <div className="usage-labels">
                <span className="usage-title">Generations Used</span>
                <span className="usage-numbers">
                  <strong>{usage.generations}</strong> / {usage.limit}
                </span>
              </div>
              <div className="usage-bar-container">
                <div
                  className="usage-bar-fill-progress"
                  style={{
                    width: `${Math.min(100, (usage.generations / usage.limit) * 100)}%`,
                    background: usage.remaining === 0 ? 'var(--color-error)' : 'var(--gradient-primary-h)',
                  }}
                />
              </div>
              <div className="usage-footer">
                <span>{usage.remaining} remaining this month</span>
              </div>
            </div>
          )}

          {/* Razorpay Subscription status */}
          {loadingSub ? (
            <div className="sub-status-loading">Loading subscription details...</div>
          ) : (
            subStatus?.subscription && (
              <div className="sub-status-container">
                <div className="sub-details">
                  <div className="sub-detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`sub-badge status-${subStatus.subscription.status}`}>
                      {subStatus.subscription.status}
                    </span>
                  </div>
                  {periodEnd && (
                    <div className="sub-detail-item">
                      <span className="detail-label">
                        {subStatus.subscription.status === 'cancelled' ? 'Expires' : 'Renews'}
                      </span>
                      <span className="detail-value">{periodEnd}</span>
                    </div>
                  )}
                </div>

                {subStatus.subscription.status === 'active' && (
                  <button
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
        </div>

        {/* INR Only Alert banner */}
        <div className="inr-only-alert">
          <AlertTriangle size={16} />
          <span><strong>INR Payments Only:</strong> Displayed prices are in INR (₹). USD billing is temporarily unavailable.</span>
        </div>

        {/* Available Plans */}
        <div className="billing-upgrade-section">
          <h3 className="upgrade-section-title">Available Subscription Plans</h3>
          <div className="plans-grid">
            {Object.entries(PLANS_INFO).map(([key, plan]) => {
              const isCurrent = user?.plan === key
              const canUpgrade = user?.plan !== 'business' && key !== 'free' && key !== user?.plan

              return (
                <div key={key} className={`plan-card-item ${isCurrent ? 'active' : ''} ${key === 'pro' ? 'featured' : ''}`}>
                  {key === 'pro' && <div className="featured-badge">Most Popular</div>}
                  <h4 className="plan-item-name">{plan.name}</h4>
                  <div className="plan-item-price">
                    {plan.price}<span className="price-period">/month</span>
                  </div>
                  <ul className="plan-item-features">
                    {plan.features.map(f => (
                      <li key={f}>
                        <Check size={12} className="feature-check" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="current-plan-indicator">
                      <ShieldCheck size={14} /> Current Plan
                    </div>
                  ) : canUpgrade ? (
                    <button
                      className={`btn ${key === 'pro' ? 'btn-primary' : 'btn-ghost'} select-plan-btn`}
                      onClick={() => {
                        setUpgradeReason(`Subscribe to our ${plan.name} plan for expanded limits.`)
                        setShowUpgradeModal(true)
                      }}
                    >
                      Choose {plan.name}
                    </button>
                  ) : (
                    <button className="btn btn-ghost select-plan-btn" disabled>
                      Unavailable
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        .billing-page {
          height: 100%;
          overflow-y: auto;
          padding: 32px 24px;
        }

        .billing-inner {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .billing-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: 24px;
          box-shadow: var(--shadow-card);
        }

        .main-plan-card {
          border-color: var(--color-border-input);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .section-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-secondary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .plan-name {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-top: 4px;
        }

        .billing-usage-section {
          background: var(--color-bg);
          border-radius: var(--radius);
          padding: var(--space-4);
          margin-bottom: 20px;
        }

        .usage-labels {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--space-2);
        }

        .usage-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .usage-numbers {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .usage-bar-container {
          height: 8px;
          background: var(--color-border-input);
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
          margin-top: var(--space-2);
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .sub-status-loading {
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
          padding: var(--space-4);
        }

        .sub-status-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--color-border);
          padding-top: 20px;
          margin-top: 20px;
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .sub-details {
          display: flex;
          gap: var(--space-6);
        }

        .sub-detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .detail-value {
          font-size: 14px;
          color: var(--color-text-primary);
          font-weight: 600;
        }

        .sub-badge {
          display: inline-flex;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .sub-badge.status-active {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .sub-badge.status-cancelled {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .cancel-sub-btn {
          color: var(--color-error);
          border-color: rgba(239, 68, 68, 0.3);
          font-size: 13px;
        }

        .cancel-sub-btn:hover:not(:disabled) {
          background: var(--color-error-bg);
          border-color: var(--color-error);
          color: var(--color-error);
        }

        .inr-only-alert {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          background: var(--color-warning-bg);
          border: 1px solid var(--color-warning-border);
          border-radius: var(--radius);
          padding: var(--space-3) var(--space-4);
          font-size: 13px;
          color: var(--color-warning);
          line-height: 1.4;
        }

        .billing-upgrade-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: var(--space-4);
        }

        .upgrade-section-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--space-4);
        }

        .plan-card-item {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: 24px var(--space-4);
          display: flex;
          flex-direction: column;
          position: relative;
          transition: all var(--transition);
        }

        .plan-card-item.active {
          border-color: var(--color-success);
          background: rgba(34, 197, 94, 0.02);
        }

        .plan-card-item.featured {
          border-color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
        }

        .featured-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-primary-start);
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: var(--radius-pill);
          text-transform: uppercase;
          white-space: nowrap;
        }

        .plan-item-name {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: var(--space-2);
        }

        .plan-item-price {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 20px;
          display: flex;
          align-items: baseline;
        }

        .price-period {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .plan-item-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
          flex: 1;
        }

        .plan-item-features li {
          display: flex;
          align-items: flex-start;
          gap: var(--space-2);
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .feature-check {
          color: var(--color-success);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .current-plan-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 38px;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-success);
          background: var(--color-success-bg);
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-success-border);
        }

        .select-plan-btn {
          width: 100%;
          height: 38px;
          font-size: 13px;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .billing-page {
            padding: 20px 16px;
          }
          .sub-status-container {
            flex-direction: column;
            align-items: stretch;
          }
          .cancel-sub-btn {
            width: 100%;
          }
          .sub-details {
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  )
}

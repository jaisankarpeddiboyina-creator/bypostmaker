import { X, Tag, Check } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { trackEvent } from '../lib/monitoring'

const PLANS = {
  starter:  { name: 'Starter',  usd: 9,   inr: 299,   gens: 50,  platforms: 33, features: ['50 generations/month','All 30+ platforms','30-day history','AI refinement'] },
  pro:      { name: 'Pro',      usd: 19,  inr: 799,   gens: 200, platforms: 33, features: ['200 generations/month','All 30+ platforms','90-day history','Priority generation'] },
  business: { name: 'Business', usd: 49,  inr: 1999,  gens: 1000, platforms: 33, features: ['1,000 generations/month','All 30+ platforms','1-year history','API access (v2)'] },
}

const PLAN_ORDER = ['free', 'starter', 'pro', 'business']

export function UpgradeModal() {
  const { setShowUpgradeModal, upgradeReason, currency, user, addToast } = useAppStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount_pct: number } | null>(null)
  const [promoError, setPromoError] = useState('')

  const applyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoError('')
    try {
      const res = await fetch('/api/promos/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        setPromoError(err.error ?? 'Invalid code')
        return
      }
      const data = await res.json() as { code: string; discount_pct: number; description: string }
      setPromoApplied(data)
      trackEvent('promo_applied', { code: data.code, discount: data.discount_pct })
    } catch {
      setPromoError('Could not validate code')
    }
  }

  const getPrice = (plan: keyof typeof PLANS) => {
    const base = currency === 'inr' ? PLANS[plan].inr : PLANS[plan].usd
    if (!promoApplied) return base
    return Math.round(base * (1 - promoApplied.discount_pct / 100))
  }

  const handleSubscribe = async (plan: string) => {
    if (!user) { window.location.href = '/api/auth/google'; return }
    if (!window.Razorpay) {
      addToast('Payment could not be loaded, please disable ad blockers or try a different browser.', 'error')
      return
    }
    setLoading(plan)
    trackEvent('checkout_started', { plan, currency })
    try {
      const res = await api.payments.subscribe(plan, currency, promoApplied?.code)
      const rzp = new window.Razorpay({
        key: res.keyId,
        subscription_id: res.subscriptionId,
        name: 'PostMaker',
        description: `${PLANS[plan as keyof typeof PLANS]?.name} Plan`,
        theme: { color: '#7c3aed' },
        handler: () => {
          const p = PLANS[plan as keyof typeof PLANS]
          const msg = plan === 'business'
            ? 'Welcome to Business! 1,000 generations/month unlocked.'
            : plan === 'pro'
            ? 'Welcome to Pro! 200 generations/month unlocked.'
            : 'Welcome to Starter! 50 generations/month unlocked.'
          addToast(msg, 'success')
          trackEvent('subscription_created', { plan, currency })
          setShowUpgradeModal(false)
          window.location.reload()
        },
        modal: { ondismiss: () => setLoading(null) },
      })
      rzp.open()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed'
      addToast(msg, 'error')
      setLoading(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
      <div className="modal upgrade-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.03em' }}>Upgrade PostMaker</h2>
            {upgradeReason && <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{upgradeReason}</p>}
          </div>
          <button className="btn-icon" onClick={() => setShowUpgradeModal(false)}><X size={16} /></button>
        </div>

        <div className="upgrade-plans">
          {Object.entries(PLANS)
            .filter(([key]) => {
              const userPlanIndex = PLAN_ORDER.indexOf(user?.plan ?? 'free')
              const thisPlanIndex = PLAN_ORDER.indexOf(key)
              return thisPlanIndex > userPlanIndex
            })
            .map(([key, plan]) => (
            <div key={key} className={`upgrade-plan ${key === 'pro' ? 'featured' : ''}`}>
              {key === 'pro' && <div className="upgrade-badge">Most popular</div>}
              <div className="up-name">{plan.name}</div>
              <div className="up-price">
                {currency === 'inr' ? '₹' : '$'}{getPrice(key as keyof typeof PLANS)}
                {promoApplied && (
                  <span className="up-original">
                    {currency === 'inr' ? '₹' : '$'}{currency === 'inr' ? plan.inr : plan.usd}
                  </span>
                )}
                <span className="up-period">/mo</span>
              </div>
              <ul className="up-features">
                {plan.features.map(f => (
                  <li key={f}><Check size={11} />{f}</li>
                ))}
              </ul>
              <button
                className={`btn ${key === 'pro' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={() => handleSubscribe(key)}
                disabled={!!loading}
              >
                {loading === key ? 'Opening…' : `Get ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Promo code */}
        <div className="promo-row">
          <Tag size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            className="promo-code-input"
            placeholder="Promo code"
            value={promoCode}
            onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
            onKeyDown={e => e.key === 'Enter' && applyPromo()}
          />
          {promoApplied ? (
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
              {promoApplied.discount_pct}% off ✓
            </span>
          ) : (
            <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={applyPromo}>
              Apply
            </button>
          )}
        </div>
        {promoError && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4, paddingLeft: 4 }}>{promoError}</p>}

        <style>{`
          .upgrade-modal { max-width: 620px; }
          .upgrade-plans { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 16px; }
          .upgrade-plan { padding: 18px; border: 1px solid var(--border); border-radius: var(--radius); position: relative; background: var(--surface); display: flex; flex-direction: column; }
          .upgrade-plan.featured { border-color: var(--accent); background: var(--accent-subtle); }
          .upgrade-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 99px; white-space: nowrap; }
          .up-name { font-size: 12px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
          .up-price { font-family: var(--font-display); font-size: 30px; font-weight: 800; color: var(--text-1); display: flex; align-items: baseline; gap: 4px; }
          .up-original { font-size: 14px; color: var(--text-4); text-decoration: line-through; font-family: var(--font-body); font-weight: 400; }
          .up-period { font-size: 13px; color: var(--text-3); font-family: var(--font-body); font-weight: 400; }
          .up-features { list-style: none; margin-top: 12px; flex: 1; display: flex; flex-direction: column; gap: 5px; }
          .up-features li { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); }
          .up-features li svg { color: var(--success); flex-shrink: 0; }
          .promo-row { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 12px; }
          .promo-code-input { flex: 1; background: none; border: none; outline: none; color: var(--text-1); font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.04em; }
          .promo-code-input::placeholder { color: var(--text-4); font-family: var(--font-body); letter-spacing: 0; }
        `}</style>
      </div>
    </div>
  )
}

// frontend/src/pages/PricingPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ArrowLeft } from 'lucide-react'
import { useAppStore } from '../store/app'
import { useDocumentMetadata } from '../lib/seo'
import { PLANS } from '../config/pricing'

export default function PricingPage() {
  const navigate = useNavigate()
  const { user, currency, setCurrency } = useAppStore()
  const [billingCurrency, setBillingCurrency] = useState<'usd' | 'inr'>(currency)

  useEffect(() => { setBillingCurrency(currency) }, [currency])

  // Keep in sync with the registry entry for this route
  // (config/routeRegistry.ts — same title/description used server-side
  // by the Worker's HeadInjector for bots and the pre-rendered snapshot).
  useDocumentMetadata(
    'Pricing — PostMaker',
    'Choose a plan that fits your creator workflow.'
  )

  const toggleCurrency = () => {
    const next = billingCurrency === 'usd' ? 'inr' : 'usd'
    setBillingCurrency(next)
    setCurrency(next)
  }

  const handleCTA = () => {
    if (user) { navigate('/app'); return }
    navigate('/signup')
  }

  return (
    <div className="pricing-page">
      {/* Nav */}
      <nav className="pricing-nav">
        <div className="pricing-nav-inner">
          <div className="pricing-logo" onClick={() => navigate('/')}>Post<span>Maker</span></div>
          <div className="pricing-nav-links">
            <a href="/#features">Features</a>
            <a href="/blog">Blog</a>
            <a href="mailto:support@bypostamaker.com">Support</a>
          </div>
          <div className="pricing-nav-cta">
            {user
              ? <button className="btn btn-primary" onClick={() => navigate('/app')}>Open app →</button>
              : <button className="btn btn-primary" onClick={() => navigate('/signup')}>Start free →</button>
            }
          </div>
        </div>
      </nav>

      <div className="pricing-hero">
        <button className="pricing-back-link" onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Back to home
        </button>
        <h1 className="pricing-title">Simple, honest pricing</h1>
        <p className="pricing-sub">
          Every plan includes the full content kit, not a stripped-down version. What changes
          as you move up is how many generations you get per month and how many platforms you
          can target at once — so you only pay for volume, never for features you'd otherwise
          expect to already be included. Start free, no credit card required.
        </p>

        <div className="pricing-toggle">
          <span className={billingCurrency === 'usd' ? 'active' : ''}>USD</span>
          <button className="toggle-switch" onClick={toggleCurrency} aria-label="Toggle currency">
            <div className={`toggle-knob ${billingCurrency === 'inr' ? 'right' : ''}`} />
          </button>
          <span className={billingCurrency === 'inr' ? 'active' : ''}>INR</span>
        </div>
      </div>

      <div className="pricing-grid-wrap">
        <div className="pricing-grid">
          {PLANS.map(plan => (
            <div key={plan.key} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && <div className="pricing-badge">Most popular</div>}
              <div className="pricing-name">{plan.name}</div>
              <div className="pricing-price">
                {billingCurrency === 'inr' ? plan.price.inr : plan.price.usd}
                {plan.key !== 'free' && <span className="pricing-period">/month</span>}
              </div>
              <div className="pricing-platforms">
                {plan.key === 'free' ? plan.platforms : `${plan.platforms}+`} platforms · {plan.gens} gen/mo
              </div>
              <ul className="pricing-features">
                {plan.features.map((f, i) => (
                  <li key={i}><Check size={12} />{f}</li>
                ))}
              </ul>
              <button
                className={`btn ${plan.featured ? 'btn-primary' : 'btn-ghost'} pricing-cta`}
                onClick={handleCTA}
              >
                {plan.key === 'free' ? 'Get started free' : `Get ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      <section className="pricing-faq-note">
        <h2>Questions about a plan?</h2>
        <p>
          Every plan can be cancelled at any time from Settings → Billing, and upgrading or
          downgrading takes effect immediately with prorated billing. If you need a custom
          volume beyond the Business plan, email us and we'll work out a fit.
        </p>
        <a href="mailto:support@bypostamaker.com" className="pricing-faq-link">support@bypostamaker.com</a>
      </section>

      {/* Footer */}
      <footer className="pricing-footer">
        <div className="pricing-footer-inner">
          <div className="pricing-footer-logo">Post<span>Maker</span></div>
          <div className="pricing-footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/refund">Refund Policy</a>
            <a href="/cookies">Cookies</a>
            <a href="/blog">Blog</a>
            <a href="mailto:support@bypostamaker.com">Support</a>
            <a href="/contact">Contact Us</a>
            <a href="/shipping">Delivery Policy</a>
          </div>
          <div className="pricing-footer-copy">© {new Date().getFullYear()} PostMaker. All rights reserved.</div>
        </div>
      </footer>

      <style>{pricingStyles}</style>
    </div>
  )
}

const pricingStyles = `
  .pricing-page {
    min-height: 100vh;
    background: var(--bg);
  }

  /* Nav */
  .pricing-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid var(--border);
    background: rgba(8,8,8,0.85);
    backdrop-filter: blur(12px);
  }
  .pricing-nav-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 32px;
  }
  .pricing-logo {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.04em;
    flex-shrink: 0;
    cursor: pointer;
  }
  .pricing-logo span { color: var(--accent); }
  .pricing-nav-links { display: flex; gap: 24px; flex: 1; }
  .pricing-nav-links a {
    font-size: 14px;
    color: var(--text-3);
    text-decoration: none;
    transition: color var(--transition);
  }
  .pricing-nav-links a:hover { color: var(--text-1); }
  .pricing-nav-cta { flex-shrink: 0; }

  /* Hero */
  .pricing-hero {
    max-width: 700px;
    margin: 0 auto;
    padding: 64px 24px 32px;
    text-align: center;
  }
  .pricing-back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 13px;
    cursor: pointer;
    margin-bottom: 24px;
    padding: 0;
    transition: color var(--transition);
  }
  .pricing-back-link:hover { color: var(--text-1); }
  .pricing-title {
    font-family: var(--font-display);
    font-size: clamp(32px, 5vw, 48px);
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin-bottom: 16px;
  }
  .pricing-sub {
    font-size: 16px;
    color: var(--text-2);
    line-height: 1.7;
    margin-bottom: 32px;
  }

  .pricing-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 13px;
    color: var(--text-3);
  }
  .pricing-toggle span.active { color: var(--text-1); font-weight: 600; }
  .toggle-switch {
    width: 40px; height: 22px;
    border-radius: 11px;
    background: var(--border-light);
    border: none;
    cursor: pointer;
    position: relative;
    transition: background var(--transition);
  }
  .toggle-knob {
    position: absolute;
    top: 3px; left: 3px;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--accent);
    transition: left var(--transition);
  }
  .toggle-knob.right { left: 21px; }

  /* Pricing grid */
  .pricing-grid-wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  .pricing-card {
    padding: 24px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pricing-card.featured {
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
  .pricing-badge {
    position: absolute;
    top: -11px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent);
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 12px;
    border-radius: 99px;
    white-space: nowrap;
    letter-spacing: 0.04em;
  }
  .pricing-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .pricing-price {
    font-family: var(--font-display);
    font-size: 36px;
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.04em;
  }
  .pricing-period {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-3);
    font-weight: 400;
    letter-spacing: 0;
  }
  .pricing-platforms { font-size: 12px; color: var(--text-3); }
  .pricing-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }
  .pricing-features li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-2);
  }
  .pricing-features li svg { color: var(--success); flex-shrink: 0; }
  .pricing-cta { width: 100%; justify-content: center; height: 40px; }

  /* FAQ note */
  .pricing-faq-note {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 24px 80px;
    text-align: center;
    border-top: 1px solid var(--border);
    padding-top: 48px;
  }
  .pricing-faq-note h2 {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--text-1);
    margin-bottom: 12px;
  }
  .pricing-faq-note p {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.7;
    margin-bottom: 12px;
  }
  .pricing-faq-link {
    font-size: 14px;
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
  }
  .pricing-faq-link:hover { text-decoration: underline; }

  /* Footer */
  .pricing-footer {
    border-top: 1px solid var(--border);
    padding: 40px 24px;
  }
  .pricing-footer-inner {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 32px;
    flex-wrap: wrap;
  }
  .pricing-footer-logo {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.04em;
  }
  .pricing-footer-logo span { color: var(--accent); }
  .pricing-footer-links { display: flex; gap: 20px; flex: 1; flex-wrap: wrap; }
  .pricing-footer-links a {
    font-size: 13px;
    color: var(--text-3);
    text-decoration: none;
    transition: color var(--transition);
  }
  .pricing-footer-links a:hover { color: var(--text-1); }
  .pricing-footer-copy { font-size: 12px; color: var(--text-4); }

  @media (max-width: 768px) {
    .pricing-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 480px) {
    .pricing-grid { grid-template-columns: 1fr; }
    .pricing-nav-links { display: none; }
  }
`

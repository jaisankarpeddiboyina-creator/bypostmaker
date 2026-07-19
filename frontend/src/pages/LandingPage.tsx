import { useState, useEffect } from 'react'
import { Sparkles, Download, Zap, Globe, ArrowRight, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'

const PLATFORMS_PREVIEW = [
  'Twitter','LinkedIn','Instagram','Reddit','TikTok',
  'YouTube','Discord','Threads','Hacker News','Bluesky',
  'Product Hunt','Medium','Pinterest','Telegram','GitHub',
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, currency, setCurrency } = useAppStore()
  const [billingCurrency, setBillingCurrency] = useState<'usd'|'inr'>(currency)
  const authUrl = import.meta.env.DEV ? '/api/auth/dev' : '/api/auth/google'

  useEffect(() => { setBillingCurrency(currency) }, [currency])

  const toggleCurrency = () => {
    const next = billingCurrency === 'usd' ? 'inr' : 'usd'
    setBillingCurrency(next)
    setCurrency(next)
  }

  const handleCTA = () => {
    if (user) { navigate('/app'); return }
    navigate('/signup')
  }

  const plans = [
    {
      key: 'free',
      name: 'Free',
      price: { usd: '$0', inr: '₹0' },
      gens: 5,
      platforms: 6,
      features: ['5 generations/month', '6 platforms', 'Full content kit download', 'Image resizing (beta)'],
    },
    {
      key: 'starter',
      name: 'Starter',
      price: { usd: '$9', inr: '₹299' },
      gens: 50,
      platforms: 30,
      features: ['50 generations/month', 'All 30+ platforms', '30-day history', 'AI refinement'],
    },
    {
      key: 'pro',
      name: 'Pro',
      price: { usd: '$19', inr: '₹799' },
      gens: 200,
      platforms: 30,
      features: ['200 generations/month', 'All 30+ platforms', '90-day history', 'Priority generation'],
      featured: true,
    },
    {
      key: 'business',
      name: 'Business',
      price: { usd: '$49', inr: '₹1,999' },
      gens: 1000,
      platforms: 30,
      features: ['1,000 generations/month', 'All 30+ platforms', '1-year history', 'API access (coming soon)'],
    },
  ]

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">Post<span>Maker</span></div>
          <div className="landing-nav-links">
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
            <a href="/blog">Blog</a>
            <a href="mailto:support@bypostamaker.com">Support</a>
          </div>
          <div className="landing-nav-cta">
            {user
              ? <button className="btn btn-primary" onClick={() => navigate('/app')}>Open app →</button>
              : <button className="btn btn-primary" onClick={() => navigate('/signup')}>Start free →</button>
            }
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">
            <Sparkles size={12} />
            <span>30+ platforms · One prompt</span>
          </div>

          <h1 className="hero-title">
            Write once.<br />
            Generate <span className="hero-accent">everywhere.</span>
          </h1>

          <p className="hero-sub">
            Describe what you want to share. PostMaker generates
            platform-perfect content for every social network
            and packages it into a ready-to-use content kit.
          </p>

          <div className="hero-cta-row">
            <button className="btn hero-btn-primary" onClick={handleCTA}>
              <Sparkles size={16} />
              {user ? 'Open PostMaker' : 'Start free — no card needed'}
            </button>
            <span className="hero-cta-note">5 free generations · No credit card</span>
          </div>

          {/* Platform ticker */}
          <div className="platform-ticker">
            <div className="ticker-track">
              {[...PLATFORMS_PREVIEW, ...PLATFORMS_PREVIEW].map((name, i) => (
                <div key={i} className="ticker-item">{name}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why PostMaker */}
      <section className="section" id="why">
        <div className="section-inner">
          <div className="section-label">Why PostMaker</div>
          <h2 className="section-title">One post never looks right everywhere else</h2>
          <p className="section-intro">
            A tweet doesn't work as a LinkedIn post. A LinkedIn post reads stiff on Threads.
            And whatever you wrote for Instagram needs a completely different shape on Reddit,
            where obvious self-promotion gets you downvoted in minutes. Most people solve this
            by either posting the same text everywhere and quietly underperforming on every
            platform but one, or by manually rewriting each version themselves — which turns a
            five-minute idea into an hour of busywork. PostMaker exists to close that gap: you
            write what you want to say once, and it comes back out the other side already
            shaped for wherever it's going.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="section" id="features">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2 className="section-title">Three steps to your content kit</h2>
          <p className="section-intro">
            There's no dashboard to learn and no content calendar to fill in ahead of time.
            You pick where you're posting, describe what you want to say, and PostMaker
            handles the platform-specific work — tone, length, hashtags, formatting quirks —
            that would otherwise mean opening ten tabs and rewriting the same idea ten
            different ways.
          </p>

          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <h3 className="step-title">Pick your platforms</h3>
              <p className="step-desc">
                Select from 30+ social platforms in one click. Mix and match — Twitter,
                LinkedIn, Reddit, TikTok, and more — based on where your audience actually
                spends time, not just where you remembered to post last week.
              </p>
            </div>
            <div className="step-arrow"><ArrowRight size={18} /></div>
            <div className="step">
              <div className="step-num">2</div>
              <h3 className="step-title">Write one prompt</h3>
              <p className="step-desc">
                Describe your content in plain language, the way you'd explain it to a
                friend. Add an image or video if you have one, and PostMaker handles tone,
                format, hashtags, and character limits for every platform you picked —
                automatically, without you needing to know each platform's unwritten rules.
              </p>
            </div>
            <div className="step-arrow"><ArrowRight size={18} /></div>
            <div className="step">
              <div className="step-num">3</div>
              <h3 className="step-title">Download your kit</h3>
              <p className="step-desc">
                Get a ZIP with platform-organised folders — post text, correctly resized
                images, share links, and everything else ready to upload. No more guessing
                which image dimensions a platform wants this month, or manually cropping the
                same photo six different ways before lunch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="section features-section">
        <div className="section-inner">
          <div className="section-label">Features</div>
          <h2 className="section-title">Built for people who post seriously</h2>
          <p className="section-intro">
            These aren't nice-to-haves bolted onto a generic AI writer. Every feature below
            exists because posting the same idea across 30+ networks surfaces a specific,
            repeatable annoyance — mismatched formats, inconsistent tone, images that are the
            wrong size for half your platforms — and we built PostMaker specifically to remove
            that annoyance rather than ask you to work around it.
          </p>

          <div className="features-grid">
            {[
              {
                icon: <Zap size={18} />,
                title: 'Parallel generation',
                desc: 'All platforms generated simultaneously, not one after another — your full kit is ready in seconds, not the twenty minutes it would take to write each version by hand.',
              },
              {
                icon: <Globe size={18} />,
                title: 'Platform-native tone',
                desc: 'Every platform has its own tone, format, and character rules — what reads well on LinkedIn gets ignored on Reddit. PostMaker learns and follows all of them, so you don\'t have to memorize a single one.',
              },
              {
                icon: <Download size={18} />,
                title: 'Download-ready kit',
                desc: 'One ZIP file, folders per platform — post text and correctly resized images, organised and named so you know exactly what goes where the moment you open it.',
              },
              {
                icon: <Sparkles size={18} />,
                title: 'AI refinement',
                desc: 'Not happy with one specific post? Chat with the AI to refine just that platform\'s version without touching anything else — one targeted fix instead of starting over on all 30+.',
              },
              {
                icon: <Check size={18} />,
                title: 'Inline editing',
                desc: 'Edit any card directly in the browser, the same way you\'d edit a normal text box. Your changes persist in the final kit when you download it, so nothing gets lost in between.',
              },
              {
                icon: <Globe size={18} />,
                title: 'Any language',
                desc: 'Write your prompt in Hindi, Spanish, Arabic, or dozens of other languages, and PostMaker generates every platform\'s post in that same language — no separate translation step required.',
              },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="section" id="who">
        <div className="section-inner">
          <div className="section-label">Who it's for</div>
          <h2 className="section-title">Built for how you actually work</h2>

          <div className="features-grid">
            {[
              {
                title: 'Solo founders',
                desc: 'You are marketing, support, and product in one person. PostMaker turns one product update into a week of platform-ready posts, so social media stops eating the hours you need for everything else.',
              },
              {
                title: 'Social media managers',
                desc: 'Managing several client accounts across different platforms means constant context-switching. PostMaker keeps every client\'s voice consistent while cutting out the manual rewriting that fills up most of a workday.',
              },
              {
                title: 'Agencies',
                desc: 'Deliverables multiply fast when every client wants a presence on every platform. PostMaker lets you produce a full multi-platform kit per client without adding headcount or slipping deadlines.',
              },
              {
                title: 'Independent creators',
                desc: 'Your best ideas don\'t always arrive with the energy to format them six different ways. Write it once while it\'s fresh, and let PostMaker handle the platform-specific busywork after.',
              },
            ].map((a, i) => (
              <div key={i} className="feature-card">
                <h3 className="feature-title">{a.title}</h3>
                <p className="feature-desc">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section" id="pricing">
        <div className="section-inner">
          <div className="section-label">Pricing</div>
          <h2 className="section-title">Simple, honest pricing</h2>
          <p className="section-intro">
            Every plan includes the full content kit, not a stripped-down version. What
            changes as you move up is how many generations you get per month and how many
            platforms you can target at once — so you only pay for volume, never for
            features you'd otherwise expect to already be included.
          </p>

          <div className="pricing-toggle">
            <span className={billingCurrency === 'usd' ? 'active' : ''}>USD</span>
            <button
              className="toggle-switch"
              onClick={toggleCurrency}
              aria-label="Toggle currency"
            >
              <div className={`toggle-knob ${billingCurrency === 'inr' ? 'right' : ''}`} />
            </button>
            <span className={billingCurrency === 'inr' ? 'active' : ''}>INR</span>
          </div>

          <div className="pricing-grid">
            {plans.map(plan => (
              <div key={plan.key} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
                {plan.featured && <div className="pricing-badge">Most popular</div>}
                <div className="pricing-name">{plan.name}</div>
                <div className="pricing-price">
                  {billingCurrency === 'inr' ? plan.price.inr : plan.price.usd}
                  {plan.key !== 'free' && <span className="pricing-period">/month</span>}
                </div>
                <div className="pricing-platforms">
                  {plan.platforms === 6 ? plan.platforms : `${plan.platforms}+`} platforms · {plan.gens === -1 ? 'Unlimited' : plan.gens} gen/mo
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
      </section>

      {/* Closing */}
      <section className="section" id="trust">
        <div className="section-inner" style={{ textAlign: 'center' }}>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>
            Write once. Stop rewriting forever.
          </h2>
          <p className="section-intro" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
            PostMaker was built by people who got tired of opening the same ten tabs every
            time they wanted to share one idea. If that sounds familiar, the free plan gives
            you five generations across six platforms with no credit card required — enough
            to see whether it actually saves you the time we think it will.
          </p>
          <button className="btn hero-btn-primary" onClick={handleCTA} style={{ margin: '24px auto 0' }}>
            <Sparkles size={16} />
            {user ? 'Open PostMaker' : 'Start free — no card needed'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo">Post<span>Maker</span></div>
          <div className="footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/refund">Refund Policy</a>
            <a href="/cookies">Cookies</a>
            <a href="/blog">Blog</a>
            <a href="mailto:support@bypostamaker.com">Support</a>
            <a href="/contact">Contact Us</a>
            <a href="/shipping">Delivery Policy</a>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} PostMaker. All rights reserved.</div>
        </div>
      </footer>

      <style>{`
        .landing {
          min-height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--bg);
        }

        /* Nav */
        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid var(--border);
          background: rgba(8,8,8,0.85);
          backdrop-filter: blur(12px);
        }
        .landing-nav-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
          height: 56px;
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .landing-logo {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 800;
          color: var(--text-1);
          letter-spacing: -0.04em;
          flex-shrink: 0;
        }
        .landing-logo span { color: var(--accent); }
        .landing-nav-links {
          display: flex;
          gap: 24px;
          flex: 1;
        }
        .landing-nav-links a {
          font-size: 14px;
          color: var(--text-3);
          text-decoration: none;
          transition: color var(--transition);
        }
        .landing-nav-links a:hover { color: var(--text-1); }
        .landing-nav-cta { flex-shrink: 0; }

        /* Hero */
        .hero {
          padding: 100px 24px 80px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-inner {
          max-width: 700px;
          margin: 0 auto;
          position: relative;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border: 1px solid rgba(124,58,237,0.3);
          border-radius: 99px;
          background: var(--accent-subtle);
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 28px;
          letter-spacing: 0.02em;
        }
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(48px, 8vw, 76px);
          font-weight: 800;
          color: var(--text-1);
          line-height: 1.0;
          margin-bottom: 24px;
          letter-spacing: -0.04em;
        }
        .hero-accent {
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: 18px;
          color: var(--text-2);
          line-height: 1.7;
          margin-bottom: 36px;
          max-width: 540px;
          margin-left: auto;
          margin-right: auto;
        }
        .hero-cta-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 48px;
          flex-wrap: wrap;
        }
        .hero-btn-primary {
          height: 48px;
          padding: 0 28px;
          font-size: 15px;
          font-weight: 600;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all var(--transition);
        }
        .hero-btn-primary:hover { background: var(--accent-dim); transform: translateY(-1px); }
        .hero-cta-note {
          font-size: 13px;
          color: var(--text-3);
        }

        /* Platform ticker */
        .platform-ticker {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
        .ticker-track {
          display: flex;
          gap: 8px;
          width: max-content;
          animation: ticker 30s linear infinite;
        }
        .ticker-item {
          padding: 6px 14px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 99px;
          font-size: 12px;
          color: var(--text-3);
          white-space: nowrap;
          font-weight: 500;
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        /* Section */
        .section {
          padding: 80px 24px;
          border-top: 1px solid var(--border);
        }
        .section-inner {
          max-width: 1100px;
          margin: 0 auto;
        }
        .section-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent);
          font-weight: 700;
          margin-bottom: 12px;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 700;
          color: var(--text-1);
          margin-bottom: 48px;
          letter-spacing: -0.03em;
        }
        .section-intro {
          font-size: 15px;
          color: var(--text-2);
          line-height: 1.75;
          max-width: 640px;
          margin: -28px auto 40px;
        }

        /* Steps */
        .steps {
          display: flex;
          align-items: flex-start;
          gap: 24px;
        }
        .step {
          flex: 1;
          padding: 28px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .step-num {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: var(--accent-subtle);
          border: 1px solid rgba(124,58,237,0.2);
          color: var(--accent);
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .step-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--text-1);
          margin-bottom: 8px;
        }
        .step-desc { font-size: 14px; color: var(--text-2); line-height: 1.7; }
        .step-arrow { color: var(--text-4); margin-top: 40px; flex-shrink: 0; }

        /* Features */
        .features-section { background: var(--surface); }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .feature-card {
          padding: 24px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          transition: border-color var(--transition);
        }
        .feature-card:hover { border-color: var(--border-light); }
        .feature-icon {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: var(--accent-subtle);
          border: 1px solid rgba(124,58,237,0.15);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .feature-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-1);
          margin-bottom: 6px;
        }
        .feature-desc { font-size: 13px; color: var(--text-2); line-height: 1.7; }

        /* Pricing */
        .pricing-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 40px;
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
        .pricing-platforms {
          font-size: 12px;
          color: var(--text-3);
        }
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
        .pricing-cta {
          width: 100%;
          justify-content: center;
          height: 40px;
        }

        /* Footer */
        .footer {
          border-top: 1px solid var(--border);
          padding: 40px 24px;
        }
        .footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
        }
        .footer-logo {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 800;
          color: var(--text-1);
          letter-spacing: -0.04em;
        }
        .footer-logo span { color: var(--accent); }
        .footer-links {
          display: flex;
          gap: 20px;
          flex: 1;
          flex-wrap: wrap;
        }
        .footer-links a {
          font-size: 13px;
          color: var(--text-3);
          text-decoration: none;
          transition: color var(--transition);
        }
        .footer-links a:hover { color: var(--text-1); }
        .footer-copy {
          font-size: 12px;
          color: var(--text-4);
        }

        @media (max-width: 768px) {
          .steps { flex-direction: column; }
          .step-arrow { display: none; }
          .features-grid { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 480px) {
          .pricing-grid { grid-template-columns: 1fr; }
          .landing-nav-links { display: none; }
        }
      `}</style>
    </div>
  )
}

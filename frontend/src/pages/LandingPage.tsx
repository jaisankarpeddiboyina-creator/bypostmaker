import { useState, useEffect } from 'react'
import {
  Sparkles, Download, Zap, Globe, ArrowRight, Check, ChevronDown, Wand2, FolderOpen, CreditCard,
  Copy, Menu, X, Share2, Layers, RefreshCw, type LucideIcon
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app'
import { PLANS } from '../config/pricing'
import { faqEntries } from '../../../config/faq'
import { testimonials } from '../../../config/testimonials'
import PostMakerLogo from '../components/PostMakerLogo'
import { PlatformIcon } from '../components/PlatformIcon'

const PLATFORMS_PREVIEW = [
  { id: 'twitter', name: 'X / Twitter' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'discord', name: 'Discord' },
  { id: 'threads', name: 'Threads' },
  { id: 'hackernews', name: 'Hacker News' },
  { id: 'bluesky', name: 'Bluesky' },
  { id: 'producthunt', name: 'Product Hunt' },
  { id: 'medium', name: 'Medium' },
  { id: 'pinterest', name: 'Pinterest' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'github', name: 'GitHub' },
]

interface WhyPoint {
  icon: LucideIcon
  title: string
  description: string
}

const WHY_POINTS: WhyPoint[] = [
  {
    icon: Wand2,
    title: 'One prompt, every platform',
    description: 'Describe your idea once. PostMaker adapts tone, length, character limits, and hashtags automatically for each of the 30+ platforms — no rewriting required.',
  },
  {
    icon: FolderOpen,
    title: 'Everything organized, ready to post',
    description: 'Download a single ZIP with platform-organized folders — post text, resized images, and share links all formatted and ready for upload.',
  },
  {
    icon: CreditCard,
    title: 'Start free, no card required',
    description: 'Try PostMaker with 5 free generations — no credit card needed to test the studio and download your complete content kits.',
  },
]

// Sample Interactive Studio Prompts & Pre-formatted Platform Outputs
const DEMO_PRESETS = [
  {
    id: 'feature',
    label: '🚀 AI SaaS Launch',
    prompt: 'Launching PostMaker 2.0 with instant 30-platform post generation & instant ZIP kit downloads!',
    outputs: {
      linkedin: `🚀 We just launched PostMaker 2.0 — transform 1 prompt into 30+ platform-perfect social posts in seconds!\n\nKey highlights:\n• Parallel multi-platform generation\n• Native tone & character count compliance\n• Instant organized ZIP kit download\n\nStop spending 4 hours rewriting content per launch. Try it free today!\n\n#SaaS #ContentMarketing #AI #Productivity #BuildingInPublic`,
      twitter: `🚀 PostMaker 2.0 is LIVE!\n\n1 Prompt ➔ 30+ Platforms ➔ Instant ZIP Download 📦\n\nNo more manual copy-pasting or manual image resizing. Describe your idea once, broadcast everywhere.\n\nTry 5 free generations 🧵👇\n#buildinpublic #indiehackers #ai`,
      instagram: `✨ BIG NEWS: PostMaker 2.0 is officially here! 📦✨\n\nTransform one single prompt into platform-tailored posts for Instagram, LinkedIn, X, TikTok, & 30+ networks simultaneously.\n\nSwipe left to see how it formats your content kits! 📲\n\nLink in bio to try free 🚀\n\n#contentcreator #socialmediamarketing #aisaas #growthmindset #indiehackers`,
      reddit: `Show Reddit: PostMaker — I built a tool that takes 1 prompt and generates native posts + images for 30+ social platforms at once.\n\nHey r/SideProject! As a solo builder, cross-posting was eating up 3-4 hours every launch. Built PostMaker to automate tone formatting, character limits, and media packaging into one clean ZIP file. Would love your feedback!`,
      tiktok: `POV: You used to spend 4 hours rewriting one post for 8 social media platforms 😭 vs PostMaker generating all 30 in 5 seconds ✨ #saas #contentcreator #ai #productivityhack`,
      youtube: `How to Broadcast 1 Prompt to 30+ Social Networks (PostMaker 2.0 Walkthrough)\n\nIn this short video, we demonstrate how PostMaker automatically adapts tone, character counts, and image dimensions for X, LinkedIn, Reddit, and Instagram in real time!`,
    },
  },
  {
    id: 'tip',
    label: '💡 Dev Pro Tip',
    prompt: 'Always use strict TypeScript types and design tokens to maintain Apple Staff Engineer UI craft.',
    outputs: {
      linkedin: `💡 Software Engineering Craft Tip:\n\nGreat UI/UX isn't just about pixel perfection — it's built on resilient architecture.\n\n3 principles we follow at PostMaker:\n1. Tokenized CSS Design Systems (CSS Variables)\n2. 3-Layer Visual Hierarchy (Focus → Controls → Glass Surface)\n3. Strict Null & Type Checks across Worker & React\n\nHow do you enforce frontend standards in your engineering team?\n\n#WebDev #TypeScript #Frontend #EngineeringCraft`,
      twitter: `💡 Dev Tip: Stop hardcoding inline hex colors!\n\nUse CSS Design Tokens for your theme layer:\n• Liquid glass backdrop filters\n• Specular top rim shine highlights\n• Smooth 160ms cubic-bezier transitions\n\nClean code = fast UI ⚡\n#webdev #typescript #css`,
      instagram: `🎨 Code Craft Breakdown: The Secret Behind Liquid Glass UI 💎\n\nSwipe to see how design tokens & 3-layer visual hierarchy create stunning web applications! ✨\n\nSave this post for your next frontend build 🏷️\n\n#developer #designsystem #uidesign #webdeveloper #coding`,
      reddit: `r/webdev - Why we dropped utility clutter for Vanilla CSS Design Tokens in our React + Vite app\n\nSharing lessons learned while building PostMaker: by relying on native CSS variables (--color-primary, --shadow-card) and modular components, build bundles stayed small and liquid glass micro-interactions rendered at 60fps.`,
      tiktok: `3 Frontend Tricks to make your app look like Apple built it 🍎✨ #coding #webdev #tech #uiux`,
      youtube: `Building Apple-Grade Design Systems in React & CSS (Full Code Tutorial)\n\nLearn how to structure CSS design tokens, liquid glass cards, and micro-interactions for production applications.`,
    },
  },
]

type PlatformTab = 'linkedin' | 'twitter' | 'instagram' | 'reddit' | 'tiktok' | 'youtube'

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, currency, setCurrency } = useAppStore()
  const [billingCurrency, setBillingCurrency] = useState<'usd' | 'inr'>(currency)
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Interactive Demo State
  const [activePreset, setActivePreset] = useState(DEMO_PRESETS[0])
  const [activeTab, setActiveTab] = useState<PlatformTab>('linkedin')
  const [copied, setCopied] = useState(false)

  useEffect(() => { setBillingCurrency(currency) }, [currency])

  const toggleCurrency = () => {
    const next = billingCurrency === 'usd' ? 'inr' : 'usd'
    setBillingCurrency(next)
    setCurrency(next)
  }

  const handleCTA = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    navigate('/app')
  }

  const handleCopyDemo = () => {
    const text = activePreset.outputs[activeTab]
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const plans = PLANS

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo-wrapper" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <PostMakerLogo variant="full" size={28} animated />
          </div>

          <div className="landing-nav-links">
            <a href="#demo">Live Studio Demo</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="/blog">Blog</a>
          </div>

          <div className="landing-nav-cta">
            {user ? (
              <button className="btn btn-primary" onClick={() => navigate('/app')}>
                Open Studio →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => navigate('/app')}>
                Start free →
              </button>
            )}
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="landing-mobile-drawer">
            <a href="#demo" onClick={() => setMobileMenuOpen(false)}>Live Studio Demo</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <a href="/blog" onClick={() => setMobileMenuOpen(false)}>Blog</a>
            <button className="btn btn-primary w-full" onClick={() => { setMobileMenuOpen(false); handleCTA() }}>
              Start free — 5 Generations Free
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-inner-grid">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              <Sparkles size={13} className="sparkle-icon" />
              <span>30+ Platforms · One Prompt · Instant ZIP Kit</span>
            </div>

            <h1 className="hero-title">
              Write once.<br />
              Generate <span className="hero-accent">everywhere.</span>
            </h1>

            <p className="hero-sub">
              Describe your idea once. PostMaker automatically adapts tone, length,
              and formatting for 30+ social networks and packages everything into an organized download kit.
            </p>

            <div className="hero-cta-row">
              <button className="btn hero-btn-primary" onClick={handleCTA}>
                <Sparkles size={17} />
                {user ? 'Open PostMaker Studio' : 'Start free — no card needed'}
              </button>
              <span className="hero-cta-note">⚡ 5 free generations · Instant ZIP download</span>
            </div>

            {/* Marquee Social Network Ticker */}
            <div className="platform-ticker-container">
              <div className="ticker-label">SUPPORTED SOCIAL NETWORKS</div>
              <div className="platform-ticker">
                <div className="ticker-track">
                  {[...PLATFORMS_PREVIEW, ...PLATFORMS_PREVIEW].map((p, i) => (
                    <div key={`${p.id}-${i}`} className="ticker-item">
                      <PlatformIcon id={p.id} size={14} useBrandColor />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </div>
          </section>
              
      {/* How it works */}
      <section className="section" id="features">
        <div className="section-inner">
          <div className="section-label">HOW IT WORKS</div>
          <h2 className="section-title">Three steps to your complete content kit</h2>

          <div className="steps">
            <div className="step glass-card">
              <div className="step-num">1</div>
              <h3 className="step-title">Pick your platforms</h3>
              <p className="step-desc">
                Select from 30+ social platforms in one click — mix LinkedIn, X/Twitter,
                Instagram, Reddit, TikTok, and YouTube in a single generation session.
              </p>
            </div>
            <div className="step-arrow"><ArrowRight size={20} /></div>

            <div className="step glass-card">
              <div className="step-num">2</div>
              <h3 className="step-title">Write one prompt</h3>
              <p className="step-desc">
                Describe your message or launch idea once. PostMaker automatically adapts tone,
                formatting, hashtags, and character constraints natively for each destination.
              </p>
            </div>
            <div className="step-arrow"><ArrowRight size={20} /></div>

            <div className="step glass-card">
              <div className="step-num">3</div>
              <h3 className="step-title">Download your kit</h3>
              <p className="step-desc">
                Download a clean, structured ZIP file with folders organized by platform —
                post text files, resized image assets, and share links ready to broadcast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section features-section">
        <div className="section-inner">
          <div className="section-label">STUDIO FEATURES</div>
          <h2 className="section-title">Engineered for creators who post seriously</h2>

          <div className="features-grid">
            {[
              {
                icon: <Zap size={20} />,
                title: 'Parallel Multi-Platform Engine',
                desc: 'All 30+ platform posts generated concurrently in seconds — no sequential waiting.',
              },
              {
                icon: <Globe size={20} />,
                title: 'Native Platform Tone Rules',
                desc: 'LinkedIn professional carousels, Twitter threads, Reddit conversational posts — each post matches platform expectations.',
              },
              {
                icon: <Download size={20} />,
                title: 'Structured ZIP Kit Downloads',
                desc: 'Instant ZIP package with dedicated subfolders containing copy, resized images, and launch metadata.',
              },
              {
                icon: <RefreshCw size={20} />,
                title: 'Targeted AI Refinement',
                desc: 'Refine a single platform card via AI chat without re-generating all 30 platforms.',
              },
              {
                icon: <Check size={20} />,
                title: 'Inline Content Editor',
                desc: 'Edit post text directly in place. All changes persist automatically into your final ZIP download.',
              },
              {
                icon: <Layers size={20} />,
                title: 'Global Multi-Language Support',
                desc: 'Write prompts in Spanish, Hindi, German, or Japanese — AI produces native posts in your selected language.',
              },
            ].map((f, i) => (
              <div key={i} className="feature-card glass-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why PostMaker Section */}
      <section className="section" id="why">
        <div className="section-inner">
          <div className="section-label">WHY POSTMAKER</div>
          <h2 className="section-title">Built to eliminate tedious cross-posting busywork</h2>

          <div className="why-grid">
            {WHY_POINTS.map((point) => (
              <div className="why-card glass-card" key={point.title}>
                <point.icon size={24} className="why-icon" />
                <h3 className="why-title">{point.title}</h3>
                <p className="why-desc">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="section" id="testimonials">
          <div className="section-inner">
            <div className="section-label">USER STORIES</div>
            <h2 className="section-title">Loved by creators and marketing teams</h2>

            <div className="testimonials-grid">
              {testimonials.map((t) => (
                <div key={t.id} className="testimonial-card glass-card">
                  <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                  <div className="testimonial-author">
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt={t.authorName} className="testimonial-avatar" />
                    ) : (
                      <div className="testimonial-avatar testimonial-avatar-fallback">
                        {t.authorName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="testimonial-name">{t.authorName}</div>
                      <div className="testimonial-role">{t.authorRole}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="section" id="pricing">
        <div className="section-inner">
          <div className="section-label">PRICING</div>
          <h2 className="section-title">Simple, transparent plans for every scale</h2>

          <div className="pricing-toggle">
            <span className={billingCurrency === 'usd' ? 'active' : ''}>USD ($)</span>
            <button
              className="toggle-switch"
              onClick={toggleCurrency}
              aria-label="Toggle currency"
            >
              <div className={`toggle-knob ${billingCurrency === 'inr' ? 'right' : ''}`} />
            </button>
            <span className={billingCurrency === 'inr' ? 'active' : ''}>INR (₹)</span>
          </div>

          <div className="pricing-grid">
            {plans.map((plan) => (
              <div key={plan.key} className={`pricing-card glass-card ${plan.featured ? 'featured' : ''}`}>
                {plan.featured && <div className="pricing-badge">Most Popular</div>}
                <div className="pricing-name">{plan.name}</div>
                <div className="pricing-price">
                  {billingCurrency === 'inr' ? plan.price.inr : plan.price.usd}
                  {plan.key !== 'free' && <span className="pricing-period">/month</span>}
                </div>
                <div className="pricing-platforms">
                  {plan.key === 'free' ? plan.platforms : `${plan.platforms}+`} platforms · {plan.gens === -1 ? 'Unlimited' : plan.gens} gens/mo
                </div>
                <ul className="pricing-features">
                  {plan.features.map((f, i) => (
                    <li key={i}><Check size={13} />{f}</li>
                  ))}
                </ul>
                <button
                  className={`btn ${plan.featured ? 'btn-primary' : 'btn-ghost'} pricing-cta`}
                  onClick={handleCTA}
                >
                  {plan.key === 'free' ? 'Get Started Free' : `Get ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="section-inner">
          <div className="section-label">FAQ</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-intro">
            Have a question before getting started? Reach out anytime at{' '}
            <a href="mailto:support@bypostamaker.com">support@bypostamaker.com</a>.
          </p>

          <div className="faq-list">
            {faqEntries.map((entry) => {
              const isOpen = openFaqId === entry.id
              return (
                <div key={entry.id} className={`faq-item glass-card ${isOpen ? 'open' : ''}`}>
                  <button
                    className="faq-question"
                    onClick={() => setOpenFaqId(isOpen ? null : entry.id)}
                    aria-expanded={isOpen}
                  >
                    <span>{entry.question}</span>
                    <ChevronDown size={18} className="faq-chevron" />
                  </button>
                  <p className="faq-answer">{entry.answer}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo-wrapper" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <PostMakerLogo variant="full" size={24} />
          </div>
          <div className="footer-links">
            <a href="/tools">Post Generators</a>
            <a href="/vs">Compare</a>
            <a href="/for">Use Cases</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/refund">Refund Policy</a>
            <a href="/cookies">Cookies</a>
            <a href="/blog">Blog</a>
            <a href="mailto:support@bypostamaker.com">Support</a>
            <a href="/contact">Contact</a>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} PostMaker. All rights reserved.</div>
        </div>
      </footer>

      {/* Landing Page Styles */}
      <style>{`
        .landing {
          min-height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          background: transparent;
        }

        /* Nav */
        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-nav-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .landing-nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }
        .landing-nav-links {
          display: flex;
          gap: 28px;
          align-items: center;
        }
        .landing-nav-links a {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          transition: color var(--transition);
        }
        .landing-nav-links a:hover { color: var(--color-primary-start); }
        .landing-nav-cta { display: flex; align-items: center; gap: 12px; }

        .mobile-menu-toggle {
          display: none;
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .landing-mobile-drawer {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px 24px;
          background: var(--color-surface-solid);
          border-bottom: 1px solid var(--color-border);
        }
        .landing-mobile-drawer a {
          font-size: 15px;
          color: var(--color-text-primary);
          text-decoration: none;
        }

        /* Hero */
        .hero {
          padding: 72px 24px 60px;
          position: relative;
        }
        .hero-inner-grid {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 48px;
          align-items: center;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border: 1px solid rgba(56, 189, 248, 0.40);
          border-radius: 99px;
          background: rgba(56, 189, 248, 0.12);
          color: var(--color-primary-start);
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 24px;
          letter-spacing: 0.01em;
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.20);
        }
        .hero-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-primary-start);
          box-shadow: 0 0 8px var(--color-primary-start);
          animation: pulseDot 1.5s infinite ease-in-out;
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(38px, 4.8vw, 62px);
          font-weight: 800;
          color: var(--color-text-primary);
          line-height: 1.06;
          margin-bottom: 20px;
          letter-spacing: -0.04em;
        }
        .hero-accent {
          background: linear-gradient(135deg, #38BDF8 0%, #0284C7 50%, #34D399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: 17px;
          color: var(--color-text-secondary);
          line-height: 1.65;
          margin-bottom: 32px;
          max-width: 540px;
        }
        .hero-cta-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }
        .hero-btn-primary {
          height: 50px;
          padding: 0 30px;
          font-size: 15px;
          font-weight: 800;
          background: var(--gradient-primary);
          color: #0A101D;
          border-radius: var(--radius-pill);
          box-shadow: var(--shadow-btn);
        }
        .hero-cta-note {
          font-size: 13px;
          color: var(--color-text-muted);
        }

        /* Marquee Social Ticker */
        .platform-ticker-container {
          margin-top: 12px;
        }
        .ticker-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--color-text-muted);
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .platform-ticker {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
        .ticker-track {
          display: flex;
          gap: 10px;
          width: max-content;
          animation: ticker 35s linear infinite;
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--color-border);
          border-radius: 99px;
          font-size: 12px;
          color: var(--color-text-secondary);
          white-space: nowrap;
          font-weight: 600;
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        /* Sections */
        .section {
          padding: 80px 24px;
          border-top: 1px solid var(--color-border);
        }
        .section-inner {
          max-width: 1200px;
          margin: 0 auto;
        }
        .section-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-primary-start);
          font-weight: 800;
          margin-bottom: 12px;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 3.8vw, 42px);
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 48px;
          letter-spacing: -0.03em;
        }
        .section-intro {
          font-size: 16px;
          color: var(--color-text-secondary);
          margin-bottom: 32px;
        }

        /* Steps */
        .steps {
          display: flex;
          align-items: flex-start;
          gap: 20px;
        }
        .step {
          flex: 1;
          padding: 28px;
          border-radius: var(--radius-card);
        }
        .step-num {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(56, 189, 248, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.35);
          color: var(--color-primary-start);
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .step-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 10px;
        }
        .step-desc { font-size: 14px; color: var(--color-text-secondary); line-height: 1.65; }
        .step-arrow { color: var(--color-text-muted); margin-top: 48px; flex-shrink: 0; }

        /* Features Grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .feature-card {
          padding: 28px;
          border-radius: var(--radius-card);
        }
        .feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(56, 189, 248, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.35);
          color: var(--color-primary-start);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .feature-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 8px;
        }
        .feature-desc { font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.65; }

        /* Why PostMaker */
        .why-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .why-card {
          padding: 32px;
          border-radius: var(--radius-card);
        }
        .why-icon { color: var(--color-primary-start); margin-bottom: 16px; }
        .why-title { font-size: 17px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 10px; }
        .why-desc { font-size: 14px; color: var(--color-text-secondary); line-height: 1.65; }

        /* Testimonials */
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        .testimonial-card {
          padding: 28px;
          border-radius: var(--radius-card);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 20px;
        }
        .testimonial-quote { font-size: 15px; line-height: 1.65; color: var(--color-text-primary); }
        .testimonial-author { display: flex; align-items: center; gap: 12px; }
        .testimonial-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .testimonial-avatar-fallback {
          display: flex; align-items: center; justify-content: center;
          background: rgba(56, 189, 248, 0.2); color: var(--color-primary-start);
          font-weight: 700; font-size: 15px;
        }
        .testimonial-name { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
        .testimonial-role { font-size: 12px; color: var(--color-text-muted); }

        /* Pricing */
        .pricing-toggle {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          font-size: 14px;
          color: var(--color-text-muted);
        }
        .pricing-toggle span.active { color: var(--color-text-primary); font-weight: 700; }
        .toggle-switch {
          width: 44px; height: 24px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid var(--color-border);
          cursor: pointer;
          position: relative;
        }
        .toggle-knob {
          position: absolute;
          top: 3px; left: 3px;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: var(--color-primary-start);
          transition: left var(--transition);
        }
        .toggle-knob.right { left: 23px; }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .pricing-card {
          padding: 28px;
          border-radius: var(--radius-card);
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .pricing-card.featured {
          border-color: var(--color-primary-start);
          box-shadow: 0 0 40px rgba(56, 189, 248, 0.25);
        }
        .pricing-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--gradient-primary);
          color: #0A101D;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 14px;
          border-radius: 99px;
          white-space: nowrap;
          letter-spacing: 0.04em;
        }
        .pricing-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .pricing-price {
          font-family: var(--font-display);
          font-size: 38px;
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.04em;
        }
        .pricing-period {
          font-size: 14px;
          color: var(--color-text-muted);
          font-weight: 400;
        }
        .pricing-platforms { font-size: 12.5px; color: var(--color-text-muted); }
        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }
        .pricing-features li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .pricing-features li svg { color: var(--color-success); flex-shrink: 0; }
        .pricing-cta { width: 100%; justify-content: center; height: 42px; }

        /* FAQ */
        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 800px;
          margin: 0 auto;
        }
        .faq-item {
          border-radius: 16px;
          overflow: hidden;
          transition: border-color var(--transition);
        }
        .faq-item.open { border-color: var(--color-primary-start); }
        .faq-question {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 24px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .faq-chevron {
          flex-shrink: 0;
          color: var(--color-text-muted);
          transition: transform var(--transition);
        }
        .faq-item.open .faq-chevron {
          transform: rotate(180deg);
          color: var(--color-primary-start);
        }
        .faq-answer {
          display: none;
          padding: 0 24px 20px;
          font-size: 14.5px;
          line-height: 1.65;
          color: var(--color-text-secondary);
        }
        .faq-item.open .faq-answer { display: block; }

        /* Footer */
        .footer {
          border-top: 1px solid var(--color-border);
          padding: 48px 24px;
        }
        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
          flex-wrap: wrap;
        }
        .footer-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .footer-links a {
          font-size: 13.5px;
          color: var(--color-text-muted);
          text-decoration: none;
          transition: color var(--transition);
        }
        .footer-links a:hover { color: var(--color-text-primary); }
        .footer-copy { font-size: 12px; color: var(--color-text-muted); }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .hero-inner-grid { grid-template-columns: 1fr; gap: 40px; }
          .features-grid, .why-grid { grid-template-columns: 1fr 1fr; }
          .pricing-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 768px) {
          .landing-nav-links { display: none; }
          .mobile-menu-toggle { display: flex; }
          .steps { flex-direction: column; gap: 16px; }
          .step-arrow { display: none; }
          .features-grid, .why-grid, .pricing-grid { grid-template-columns: 1fr; gap: 16px; }
          .hero-cta-row { flex-direction: column; align-items: stretch; gap: 12px; }
          .hero-btn-primary { justify-content: center; width: 100%; }
        }
      `}</style>
    </div>
  )
}


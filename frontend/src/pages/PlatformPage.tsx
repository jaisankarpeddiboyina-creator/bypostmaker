// frontend/src/pages/PlatformPage.tsx
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, HelpCircle } from 'lucide-react'
import { platformPages } from '../../../config/platformPages'
import { PLATFORM_MAP } from '../../../config/platforms'
import { PlatformIcon } from '../components/PlatformIcon'
import { useDocumentMetadata } from '../lib/seo'

function getRelatedAudiences(platformSlug: string) {
  switch (platformSlug) {
    case 'linkedin':
      return [
        { name: 'Social Media Managers', path: '/for/social-media-managers' },
        { name: 'Marketing Agencies', path: '/for/marketing-agencies' },
      ]
    case 'instagram':
      return [
        { name: 'Content Creators', path: '/for/content-creators' },
        { name: 'Ecommerce Brands', path: '/for/ecommerce-brands' },
      ]
    case 'twitter':
      return [
        { name: 'Social Media Managers', path: '/for/social-media-managers' },
      ]
    case 'tiktok':
      return [
        { name: 'Content Creators', path: '/for/content-creators' },
      ]
    case 'facebook':
      return [
        { name: 'Small Businesses', path: '/for/small-businesses' },
      ]
    case 'pinterest':
      return [
        { name: 'Ecommerce Brands', path: '/for/ecommerce-brands' },
      ]
    case 'youtube':
      return [
        { name: 'Content Creators', path: '/for/content-creators' },
      ]
    case 'threads':
      return [
        { name: 'Social Media Managers', path: '/for/social-media-managers' },
      ]
    default:
      return []
  }
}

export default function PlatformPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  const entry = slug ? platformPages.find(p => p.slug === slug) : null

  const title = slug
    ? (entry ? entry.title : 'Tool Not Found | PostMaker')
    : 'AI Social Media Post Generators & Caption Writers | PostMaker'

  const description = slug
    ? (entry ? entry.description : 'The platform creation tool you are looking for does not exist or has been moved.')
    : 'Choose a platform to generate native, scroll-stopping content designed to perform. We optimize lengths, tags, and structure.'

  useDocumentMetadata(title, description)

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  // ── 1. Unknown Slug (404 Page) ──────────────────────────────────
  if (slug && !entry) {
    return (
      <div className="platform-container error-view">
        <div className="platform-nav-bar">
          <Link to="/tools" className="platform-back-link">
            <ArrowLeft size={16} /> Back to all tools
          </Link>
        </div>
        <div className="platform-error-card">
          <AlertCircle size={48} className="error-icon" />
          <h1>Tool Not Found</h1>
          <p>The platform generator you requested could not be found. It may have been renamed or removed.</p>
          <button className="btn btn-primary" onClick={() => navigate('/tools')}>
            Browse all tools
          </button>
        </div>
        <style>{platformStyles}</style>
      </div>
    )
  }

  // ── 2. Single Platform Page Detail View ────────────────────────────
  if (slug && entry) {
    const spec = PLATFORM_MAP[entry.platformId]

    return (
      <div className="platform-container detail-view">
        <header className="platform-header">
          <Link to="/tools" className="platform-back-link">
            <ArrowLeft size={16} /> Back to all tools
          </Link>

          <div className="platform-badge">
            <PlatformIcon id={entry.platformId} size={16} useBrandColor={true} />
            <span>{entry.platformName} Tool</span>
          </div>

          <h1 className="platform-title">{entry.h1}</h1>
          <p className="platform-hero-sub">{entry.heroSubheading}</p>
        </header>

        {/* Introduction Block */}
        <section className="platform-intro-section">
          <p className="platform-intro-text">{entry.introText}</p>
          <div className="platform-audience-box">
            <strong>Target Audience:</strong> {entry.audienceDescription}
          </div>
        </section>

        {/* Dynamic Specifications Panel */}
        {spec && (
          <section className="platform-specs-section">
            <h2 className="platform-section-title">Platform Specifications & Format Rules</h2>
            <div className="platform-specs-grid">
              <div className="platform-spec-card">
                <span className="spec-label">Character Limit</span>
                <span className="spec-value">
                  {spec.charLimit ? `${spec.charLimit.toLocaleString()} chars` : 'Unlimited'}
                </span>
              </div>
              <div className="platform-spec-card">
                <span className="spec-label">Hashtag Style</span>
                <span className="spec-value">
                  {spec.hashtagStyle === 'none'
                    ? 'None'
                    : spec.hashtagStyle === 'inline'
                    ? 'Inline Tags'
                    : 'Block at Bottom'}
                </span>
              </div>
              <div className="platform-spec-card">
                <span className="spec-label">Max Allowed Hashtags</span>
                <span className="spec-value">
                  {spec.maxHashtags > 0 ? `${spec.maxHashtags} tags` : 'No hashtags'}
                </span>
              </div>
              <div className="platform-spec-card">
                <span className="spec-label">Max Media Uploads</span>
                <span className="spec-value">
                  {spec.maxImages > 0 ? `${spec.maxImages} files` : 'Text only'}
                </span>
              </div>
            </div>
            <div className="platform-tip-card">
              <Info size={16} className="tip-icon" />
              <p><strong>Formatter Best Practice:</strong> {entry.formattingTip}</p>
            </div>
          </section>
        )}

        {/* Contrast / Example Section */}
        <section className="platform-comparison-section">
          <h2 className="platform-section-title">How PostMaker Outputs Differ from Generic Cross-Posts</h2>
          <div className="platform-comparison-grid">
            <div className="comparison-card generic">
              <h3>Generic Cross-Post (Lazy Copy-Paste)</h3>
              <div className="comparison-content">
                <p>"{entry.postMakerVsGeneric.genericCrossPost}"</p>
              </div>
              <span className="comparison-badge badge-red">Poor Engagement</span>
            </div>
            <div className="comparison-card optimized">
              <h3>PostMaker Output (Platform-Optimized)</h3>
              <div className="comparison-content">
                <p>"{entry.postMakerVsGeneric.platformSpecific}"</p>
              </div>
              <span className="comparison-badge badge-green">High Engagement</span>
            </div>
          </div>
          <p className="platform-comparison-expl">{entry.postMakerVsGeneric.explanation}</p>
        </section>

        {/* Core Features */}
        <section className="platform-features-section">
          <h2 className="platform-section-title">Built-In Smart Features for {entry.platformName}</h2>
          <div className="platform-features-grid">
            {entry.features.map((feat, idx) => (
              <div className="platform-feat-card" key={`feat-${idx}`}>
                <CheckCircle2 size={20} className="feat-icon" />
                <h3>{feat.title}</h3>
                <p>{feat.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Accordion */}
        {entry.faqs.length > 0 && (
          <section className="platform-faq-section">
            <h2 className="platform-section-title">Frequently Asked Questions</h2>
            <div className="platform-faq-list">
              {entry.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div className={`platform-faq-item ${isOpen ? 'active' : ''}`} key={`faq-${idx}`}>
                    <button className="platform-faq-trigger" onClick={() => toggleFaq(idx)}>
                      <HelpCircle size={18} className="faq-icon" />
                      <span>{faq.question}</span>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className="platform-faq-content" style={{ display: isOpen ? 'block' : 'none' }}>
                      <p>{faq.answer}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Cross-linking audience use cases */}
        <section className="platform-audience-linking">
          <h2 className="platform-section-title">Designed for Your Specific Workflow</h2>
          <p className="platform-intro-text" style={{ marginBottom: '16px' }}>
            See how PostMaker fits into your daily routine, whether you are a creator or managing a marketing team:
          </p>
          <div className="platform-audience-links-grid">
            {getRelatedAudiences(entry.slug).map(aud => (
              <Link key={aud.path} to={aud.path} className="platform-audience-link-card">
                <strong>For {aud.name} →</strong>
                <span>Learn how we automate and scale content production</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="platform-footer-cta">
          <h3>Try the {entry.platformName} Post Maker</h3>
          <p>Describe your content idea in one sentence. Get native, formatted, high-performance posts in seconds.</p>
          <button className="btn btn-primary" onClick={() => navigate('/signup')}>
            {entry.ctaText} →
          </button>
        </footer>

        <style>{platformStyles}</style>
      </div>
    )
  }

  // ── 3. Platform List View ──────────────────────────────────────────
  return (
    <div className="platform-container list-view">
      <header className="platform-list-header">
        <Link to="/" className="platform-back-link">
          <ArrowLeft size={16} /> Back to homepage
        </Link>
        <h1 className="platform-list-title">AI Social Media Post Generators</h1>
        <p className="platform-list-sub">
          Generate scroll-stopping posts tailored precisely to the quirks, rules, and algorithms of each platform.
        </p>
      </header>

      <div className="platform-cards-grid">
        {platformPages.map(page => (
          <Link
            key={page.slug}
            to={`/tools/${page.slug}`}
            className="platform-card"
          >
            <div className="platform-card-icon-wrapper">
              <PlatformIcon id={page.platformId} size={32} useBrandColor={true} />
            </div>
            <h2 className="platform-card-title">{page.platformName} Post Maker</h2>
            <p className="platform-card-excerpt">{page.description}</p>
            <span className="platform-card-more">Open Tool →</span>
          </Link>
        ))}
      </div>

      <style>{platformStyles}</style>
    </div>
  )
}

// ── Styles (Scoped, using design system tokens) ──────────────────────
const platformStyles = `
  .platform-container {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-body);
  }

  /* --- Error View --- */
  .platform-container.error-view {
    max-width: 600px;
    margin: 80px auto;
    padding: 0 24px;
  }
  .platform-nav-bar {
    margin-bottom: 24px;
  }
  .platform-error-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    padding: 40px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-card);
    backdrop-filter: var(--backdrop-blur);
  }
  .platform-error-card h1 {
    font-size: 24px;
    color: var(--color-text-primary);
  }
  .platform-error-card p {
    color: var(--color-text-secondary);
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 8px;
  }
  .error-icon {
    color: var(--color-error);
  }

  /* --- Detail View --- */
  .platform-container.detail-view {
    max-width: 800px;
    margin: 60px auto 100px;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
  .platform-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .platform-back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-accent);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    width: fit-content;
    transition: transform var(--transition);
  }
  .platform-back-link:hover {
    transform: translateX(-2px);
  }
  .platform-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border: 1px solid rgba(255, 75, 145, 0.3);
    border-radius: 99px;
    background: rgba(255, 75, 145, 0.08);
    color: var(--color-primary-start);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    width: fit-content;
  }
  .platform-title {
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 800;
    line-height: 1.15;
    color: var(--color-text-primary);
    letter-spacing: -0.03em;
  }
  .platform-hero-sub {
    font-size: 18px;
    color: var(--color-text-secondary);
    line-height: 1.5;
    max-width: 640px;
  }

  /* Intro Section */
  .platform-intro-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .platform-intro-text {
    font-size: 16px;
    line-height: 1.7;
    color: var(--color-text-secondary);
  }
  .platform-audience-box {
    background: rgba(255, 255, 255, 0.20);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px 20px;
    font-size: 14px;
    color: var(--color-text-secondary);
  }
  .platform-audience-box strong {
    color: var(--color-text-primary);
  }

  /* Specs Section */
  .platform-specs-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .platform-section-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
  }
  .platform-specs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
  }
  .platform-spec-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--shadow-card);
    backdrop-filter: var(--backdrop-blur);
  }
  .spec-label {
    font-size: 12px;
    text-transform: uppercase;
    color: var(--color-text-muted);
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .spec-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .platform-tip-card {
    display: flex;
    gap: 12px;
    background: rgba(255, 75, 145, 0.04);
    border: 1px solid rgba(255, 75, 145, 0.2);
    border-radius: var(--radius);
    padding: 16px 20px;
    align-items: flex-start;
  }
  .tip-icon {
    color: var(--color-primary-start);
    margin-top: 2px;
    flex-shrink: 0;
  }
  .platform-tip-card p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  /* Comparison Section */
  .platform-comparison-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .platform-comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .comparison-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    box-shadow: var(--shadow-card);
    backdrop-filter: var(--backdrop-blur);
  }
  .comparison-card.optimized {
    border-color: rgba(255, 75, 145, 0.35);
    background: rgba(255, 255, 255, 0.25);
  }
  .comparison-card h3 {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text-primary);
  }
  .comparison-content {
    flex: 1;
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    white-space: pre-wrap;
    background: rgba(255, 255, 255, 0.30);
    padding: 14px;
    border-radius: var(--radius-sm);
  }
  .comparison-badge {
    align-self: flex-start;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 99px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge-red {
    background: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid var(--color-error-border);
  }
  .badge-green {
    background: var(--color-success-bg);
    color: var(--color-success);
    border: 1px solid var(--color-success-border);
  }
  .platform-comparison-expl {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  /* Features Section */
  .platform-features-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .platform-features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
  }
  .platform-feat-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    padding: 24px;
    box-shadow: var(--shadow-card);
    backdrop-filter: var(--backdrop-blur);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .feat-icon {
    color: var(--color-primary-start);
  }
  .platform-feat-card h3 {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
  }
  .platform-feat-card p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  /* FAQ Section */
  .platform-faq-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .platform-faq-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .platform-faq-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color var(--transition);
  }
  .platform-faq-item.active {
    border-color: rgba(255, 75, 145, 0.3);
  }
  .platform-faq-trigger {
    width: 100%;
    background: none;
    border: none;
    padding: 18px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    justify-content: space-between;
  }
  .faq-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
  .platform-faq-trigger span {
    flex: 1;
  }
  .platform-faq-content {
    padding: 0 24px 20px 54px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  /* Footer CTA */
  .platform-footer-cta {
    margin-top: 40px;
    padding: 48px;
    background: var(--gradient-primary-glow);
    border: 1px solid rgba(255, 75, 145, 0.2);
    border-radius: var(--radius-card);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-card);
  }
  .platform-footer-cta h3 {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text-primary);
  }
  .platform-footer-cta p {
    color: var(--color-text-secondary);
    font-size: 15px;
    max-width: 520px;
    line-height: 1.6;
  }

  /* --- List View --- */
  .platform-container.list-view {
    max-width: 1000px;
    margin: 60px auto 100px;
    padding: 0 24px;
  }
  .platform-list-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    margin-bottom: 48px;
  }
  .platform-list-title {
    font-size: clamp(28px, 6vw, 42px);
    font-weight: 800;
    color: var(--color-text-primary);
    letter-spacing: -0.03em;
  }
  .platform-list-sub {
    font-size: 16px;
    color: var(--color-text-secondary);
    max-width: 560px;
    line-height: 1.6;
  }
  .platform-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 24px;
  }
  .platform-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    cursor: pointer;
    box-shadow: var(--shadow-card);
    backdrop-filter: var(--backdrop-blur);
    text-decoration: none;
    transition: all var(--transition);
  }
  .platform-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-card-hover);
    border-color: var(--color-primary-start);
  }
  .platform-card-icon-wrapper {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.20);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }
  .platform-card-title {
    font-size: 19px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1.3;
  }
  .platform-card-excerpt {
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.6;
    flex: 1;
  }
  .platform-card-more {
    color: var(--color-text-accent);
    font-weight: 600;
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .platform-comparison-grid {
      grid-template-columns: 1fr;
    }
    .platform-specs-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .platform-audience-linking {
    margin-bottom: 24px;
  }
  .platform-audience-links-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  .platform-audience-link-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color var(--transition);
  }
  .platform-audience-link-card:hover {
    border-color: var(--color-primary-start);
  }
  .platform-audience-link-card strong {
    font-size: 14px;
    color: var(--color-text-primary);
  }
  .platform-audience-link-card span {
    font-size: 12px;
    color: var(--color-text-muted);
  }
`

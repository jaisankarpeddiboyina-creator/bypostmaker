// frontend/src/pages/ForPage.tsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Users, CheckCircle2 } from 'lucide-react'
import { forPages } from '../../../config/forPages'
import { useDocumentMetadata } from '../lib/seo'

export default function ForPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const entry = slug ? forPages.find(p => p.slug === slug) : null

  const title = slug
    ? (entry ? entry.title : 'Page Not Found | PostMaker')
    : 'PostMaker For Every Team — Find Your Use Case | PostMaker'

  const description = slug
    ? (entry ? entry.description : 'The page you are looking for does not exist or has been moved.')
    : 'See how PostMaker fits your specific workflow, whether you manage one brand or many.'

  useDocumentMetadata(title, description)

  // ── Unknown slug ─────────────────────────────────────────────
  if (slug && !entry) {
    return (
      <div className="for-container error-view">
        <div className="for-nav-bar">
          <Link to="/for" className="for-back-link">
            <ArrowLeft size={16} /> Back to use cases
          </Link>
        </div>
        <div className="for-error-card">
          <AlertCircle size={48} className="error-icon" />
          <h1>Page Not Found</h1>
          <p>The use case you requested could not be found. It may have been renamed or removed.</p>
          <button className="btn btn-primary" onClick={() => navigate('/for')}>
            Browse all use cases
          </button>
        </div>
        <style>{forStyles}</style>
      </div>
    )
  }

  // ── Single audience page detail ──────────────────────────────
  if (slug && entry) {
    return (
      <div className="for-container detail-view">
        <header className="for-header">
          <Link to="/for" className="for-back-link">
            <ArrowLeft size={16} /> Back to all use cases
          </Link>

          <div className="for-badge">
            <Users size={14} />
            <span>{entry.audienceName}</span>
          </div>

          <h1 className="for-title">PostMaker for {entry.audienceName}</h1>
          <p className="for-subheading">{entry.heroSubheading}</p>
        </header>

        <section className="for-pain-section">
          <h2 className="for-section-title">Sound familiar?</h2>
          <ul className="for-pain-list">
            {entry.painPoints.map(item => (
              <li key={item} className="for-pain-item">{item}</li>
            ))}
          </ul>
        </section>

        <section className="for-benefits-section">
          <h2 className="for-section-title">How PostMaker helps</h2>
          <div className="for-benefits-grid">
            {entry.benefits.map(benefit => (
              <div key={benefit.title} className="for-benefit-card">
                <CheckCircle2 size={20} className="for-benefit-icon" />
                <h3 className="for-benefit-title">{benefit.title}</h3>
                <p className="for-benefit-desc">{benefit.description}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="for-footer-cta">
          <h3>Built for {entry.audienceName.toLowerCase()}</h3>
          <p>Describe your idea once and get tailored content for 30+ platforms instantly.</p>
          <button className="btn btn-primary" onClick={() => navigate('/signup')}>
            {entry.ctaText}
          </button>
        </footer>

        <style>{forStyles}</style>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────
  return (
    <div className="for-container list-view">
      <header className="for-list-header">
        <Link to="/" className="for-back-link">
          <ArrowLeft size={16} /> Back to homepage
        </Link>
        <div className="for-badge">
          <Users size={14} />
          <span>Use Cases</span>
        </div>
        <h1 className="for-list-title">Built for how you actually work</h1>
        <p className="for-list-sub">
          Find the workflow that matches yours and see exactly how PostMaker fits.
        </p>
      </header>

      {forPages.length === 0 ? (
        <div className="for-empty-state">
          <AlertCircle size={32} />
          <p>No use cases published yet. Check back soon!</p>
        </div>
      ) : (
        <div className="for-cards-grid">
          {forPages.map(entry => (
            <article
              key={entry.slug}
              className="for-card"
              onClick={() => navigate(`/for/${entry.slug}`)}
            >
              <h2 className="for-card-title">For {entry.audienceName}</h2>
              <p className="for-card-excerpt">{entry.description}</p>
              <span className="for-card-more">See how →</span>
            </article>
          ))}
        </div>
      )}

      <style>{forStyles}</style>
    </div>
  )
}

// ── Styles (shared across all views, follows BlogPage.tsx's token usage) ──
const forStyles = `
  .for-container.error-view { max-width: 600px; margin: 80px auto; padding: 0 24px; }
  .for-error-card {
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius-card); padding: 40px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    box-shadow: var(--shadow-card);
  }
  .for-error-card h1 { font-size: 24px; color: var(--color-text-primary); }
  .for-error-card p { color: var(--color-text-secondary); font-size: 15px; line-height: 1.6; margin-bottom: 8px; }
  .error-icon { color: var(--color-error); }

  .for-container.detail-view { max-width: 800px; margin: 60px auto 100px; padding: 0 24px; }
  .for-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 48px; }
  .for-back-link {
    display: inline-flex; align-items: center; gap: 8px;
    color: var(--color-text-accent); text-decoration: none;
    font-size: 14px; font-weight: 600; width: fit-content;
    transition: transform var(--transition);
  }
  .for-back-link:hover { transform: translateX(-2px); }
  .for-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 14px; border: 1px solid rgba(247,37,133,0.3);
    border-radius: 99px; background: rgba(247,37,133,0.08);
    color: var(--color-primary-start); font-size: 12px; font-weight: 600;
    letter-spacing: 0.02em; width: fit-content;
  }
  .for-title {
    font-size: clamp(28px, 5vw, 40px); font-weight: 800; line-height: 1.15;
    color: var(--color-text-primary); letter-spacing: -0.03em;
  }
  .for-subheading { font-size: 18px; color: var(--color-text-secondary); line-height: 1.5; max-width: 640px; }

  .for-section-title { font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 20px; }
  .for-pain-section { margin-bottom: 48px; }
  .for-pain-list { display: flex; flex-direction: column; gap: 12px; padding-left: 20px; }
  .for-pain-item { font-size: 15px; line-height: 1.6; color: var(--color-text-secondary); }

  .for-benefits-section { margin-bottom: 48px; }
  .for-benefits-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
  .for-benefit-card {
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius-card); padding: 24px; box-shadow: var(--shadow-card);
  }
  .for-benefit-icon { color: var(--color-primary-start); margin-bottom: 12px; }
  .for-benefit-title { font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 8px; }
  .for-benefit-desc { font-size: 14px; line-height: 1.6; color: var(--color-text-secondary); }

  .for-footer-cta {
    margin-top: 64px; padding: 36px;
    background: linear-gradient(135deg, rgba(247,37,133,0.04), rgba(147,51,234,0.04));
    border: 1px solid rgba(247,37,133,0.15); border-radius: var(--radius-card);
    text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .for-footer-cta h3 { font-size: 20px; font-weight: 700; color: var(--color-text-primary); }
  .for-footer-cta p { color: var(--color-text-secondary); font-size: 15px; max-width: 480px; margin-bottom: 8px; }

  .for-container.list-view { max-width: 1000px; margin: 60px auto 100px; padding: 0 24px; }
  .for-list-header {
    text-align: center; display: flex; flex-direction: column; align-items: center;
    gap: 16px; margin-bottom: 48px;
  }
  .for-list-title {
    font-size: clamp(28px, 6vw, 42px); font-weight: 800;
    color: var(--color-text-primary); letter-spacing: -0.03em;
  }
  .for-list-sub { font-size: 16px; color: var(--color-text-secondary); max-width: 520px; line-height: 1.6; }

  .for-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
  .for-card {
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius-card); padding: 28px; display: flex;
    flex-direction: column; gap: 12px; cursor: pointer;
    box-shadow: var(--shadow-card); transition: all var(--transition);
  }
  .for-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-card-hover); border-color: var(--color-primary-start); }
  .for-card-title { font-size: 19px; font-weight: 700; color: var(--color-text-primary); line-height: 1.3; }
  .for-card-excerpt { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; flex: 1; }
  .for-card-more { color: var(--color-text-accent); font-weight: 600; font-size: 13px; }

  .for-empty-state {
    text-align: center; padding: 48px; color: var(--color-text-muted);
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
`

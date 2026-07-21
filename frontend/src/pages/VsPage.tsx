// frontend/src/pages/VsPage.tsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Check, Minus, AlertCircle, Scale } from 'lucide-react'
import { vsPages } from '../../../config/vsPages'
import { useDocumentMetadata } from '../lib/seo'

export default function VsPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const entry = slug ? vsPages.find(p => p.slug === slug) : null

  const title = slug
    ? (entry ? entry.title : 'Comparison Not Found | PostMaker')
    : 'Compare PostMaker — See How We Stack Up | PostMaker'

  const description = slug
    ? (entry ? entry.description : 'The comparison you are looking for does not exist or has been moved.')
    : 'Compare PostMaker against other social media content tools on AI generation, platform coverage, and pricing.'

  useDocumentMetadata(title, description)

  // ── Unknown slug ─────────────────────────────────────────────
  if (slug && !entry) {
    return (
      <div className="vs-container error-view">
        <div className="vs-nav-bar">
          <Link to="/vs" className="vs-back-link">
            <ArrowLeft size={16} /> Back to comparisons
          </Link>
        </div>
        <div className="vs-error-card">
          <AlertCircle size={48} className="error-icon" />
          <h1>Comparison Not Found</h1>
          <p>The comparison you requested could not be found. It may have been renamed or removed.</p>
          <button className="btn btn-primary" onClick={() => navigate('/vs')}>
            Browse all comparisons
          </button>
        </div>
        <style>{vsStyles}</style>
      </div>
    )
  }

  // ── Single comparison detail ─────────────────────────────────
  if (slug && entry) {
    return (
      <div className="vs-container detail-view">
        <header className="vs-header">
          <Link to="/vs" className="vs-back-link">
            <ArrowLeft size={16} /> Back to all comparisons
          </Link>

          <div className="vs-badge">
            <Scale size={14} />
            <span>Comparison</span>
          </div>

          <h1 className="vs-title">PostMaker vs {entry.competitorName}</h1>
          <p className="vs-intro">{entry.intro}</p>
        </header>

        <section className="vs-table-section">
          <h2 className="vs-section-title">Feature by feature</h2>
          <div className="vs-table">
            <div className="vs-table-row vs-table-head">
              <div className="vs-table-cell vs-table-feature">Feature</div>
              <div className="vs-table-cell">PostMaker</div>
              <div className="vs-table-cell">{entry.competitorName}</div>
            </div>
            {entry.features.map(row => (
              <div className="vs-table-row" key={row.feature}>
                <div className="vs-table-cell vs-table-feature">{row.feature}</div>
                <div className={`vs-table-cell ${row.postmakerWins ? 'vs-cell-win' : ''}`}>
                  {row.postmakerWins ? <Check size={14} className="vs-cell-icon" /> : <Minus size={14} className="vs-cell-icon vs-cell-icon-neutral" />}
                  {row.postmaker}
                </div>
                <div className="vs-table-cell">{row.competitor}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="vs-columns">
          <section className="vs-column">
            <h2 className="vs-section-title">Choose PostMaker if</h2>
            <ul className="vs-list">
              {entry.postmakerAdvantages.map(item => (
                <li key={item} className="vs-list-item">{item}</li>
              ))}
            </ul>
          </section>
          <section className="vs-column">
            <h2 className="vs-section-title">Choose {entry.competitorName} if</h2>
            <ul className="vs-list">
              {entry.competitorStrengths.map(item => (
                <li key={item} className="vs-list-item">{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="vs-verdict">
          <h2 className="vs-section-title">The verdict</h2>
          <p>{entry.verdict}</p>
        </section>

        <footer className="vs-footer-cta">
          <h3>See it for yourself</h3>
          <p>Describe your idea once and get tailored content for 30+ platforms instantly.</p>
          <button className="btn btn-primary" onClick={() => navigate('/signup')}>
            Start Generating Free →
          </button>
        </footer>

        <style>{vsStyles}</style>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────
  return (
    <div className="vs-container list-view">
      <header className="vs-list-header">
        <Link to="/" className="vs-back-link">
          <ArrowLeft size={16} /> Back to homepage
        </Link>
        <div className="vs-badge">
          <Scale size={14} />
          <span>Comparisons</span>
        </div>
        <h1 className="vs-list-title">See how PostMaker compares</h1>
        <p className="vs-list-sub">
          Honest, feature-by-feature comparisons to help you pick the right tool for your workflow.
        </p>
      </header>

      {vsPages.length === 0 ? (
        <div className="vs-empty-state">
          <AlertCircle size={32} />
          <p>No comparisons published yet. Check back soon!</p>
        </div>
      ) : (
        <div className="vs-cards-grid">
          {vsPages.map(entry => (
            <article
              key={entry.slug}
              className="vs-card"
              onClick={() => navigate(`/vs/${entry.slug}`)}
            >
              <h2 className="vs-card-title">PostMaker vs {entry.competitorName}</h2>
              <p className="vs-card-excerpt">{entry.description}</p>
              <span className="vs-card-more">Compare →</span>
            </article>
          ))}
        </div>
      )}

      <style>{vsStyles}</style>
    </div>
  )
}

// ── Styles (shared across all views, follows BlogPage.tsx's token usage) ──
const vsStyles = `
  .vs-container.error-view {
    max-width: 600px;
    margin: 80px auto;
    padding: 0 24px;
  }
  .vs-error-card {
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
  }
  .vs-error-card h1 { font-size: 24px; color: var(--color-text-primary); }
  .vs-error-card p { color: var(--color-text-secondary); font-size: 15px; line-height: 1.6; margin-bottom: 8px; }
  .error-icon { color: var(--color-error); }

  .vs-container.detail-view {
    max-width: 800px;
    margin: 60px auto 100px;
    padding: 0 24px;
  }
  .vs-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 40px; }
  .vs-back-link {
    display: inline-flex; align-items: center; gap: 8px;
    color: var(--color-text-accent); text-decoration: none;
    font-size: 14px; font-weight: 600; width: fit-content;
    transition: transform var(--transition);
  }
  .vs-back-link:hover { transform: translateX(-2px); }
  .vs-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 14px; border: 1px solid rgba(247,37,133,0.3);
    border-radius: 99px; background: rgba(247,37,133,0.08);
    color: var(--color-primary-start); font-size: 12px; font-weight: 600;
    letter-spacing: 0.02em; width: fit-content;
  }
  .vs-title {
    font-size: clamp(28px, 5vw, 40px); font-weight: 800; line-height: 1.15;
    color: var(--color-text-primary); letter-spacing: -0.03em;
  }
  .vs-intro { font-size: 17px; color: var(--color-text-secondary); line-height: 1.6; max-width: 640px; }

  .vs-section-title {
    font-size: 20px; font-weight: 700; color: var(--color-text-primary);
    margin-bottom: 16px;
  }
  .vs-table-section { margin-bottom: 40px; }
  .vs-table {
    border: 1px solid var(--color-border); border-radius: var(--radius-card);
    overflow: hidden; box-shadow: var(--shadow-card);
  }
  .vs-table-row {
    display: grid; grid-template-columns: 1.4fr 1fr 1fr;
    border-bottom: 1px solid var(--color-border);
  }
  .vs-table-row:last-child { border-bottom: none; }
  .vs-table-head {
    background: var(--color-bg); font-weight: 700; font-size: 13px;
    color: var(--color-text-primary);
  }
  .vs-table-cell {
    padding: 14px 16px; font-size: 14px; color: var(--color-text-secondary);
    display: flex; align-items: center; gap: 6px;
  }
  .vs-table-feature { color: var(--color-text-primary); font-weight: 600; }
  .vs-cell-win { color: var(--color-text-primary); font-weight: 600; }
  .vs-cell-icon { color: var(--color-primary-start); flex-shrink: 0; }
  .vs-cell-icon-neutral { color: var(--color-text-muted); }

  .vs-columns {
    display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px;
  }
  .vs-list { display: flex; flex-direction: column; gap: 10px; padding-left: 20px; }
  .vs-list-item { font-size: 15px; line-height: 1.6; color: var(--color-text-secondary); }

  .vs-verdict {
    background: var(--color-bg); border: 1px solid var(--color-border);
    border-radius: var(--radius-card); padding: 24px; margin-bottom: 40px;
  }
  .vs-verdict p { font-size: 15px; line-height: 1.7; color: var(--color-text-secondary); }

  .vs-footer-cta {
    margin-top: 64px; padding: 36px;
    background: linear-gradient(135deg, rgba(247,37,133,0.04), rgba(147,51,234,0.04));
    border: 1px solid rgba(247,37,133,0.15); border-radius: var(--radius-card);
    text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .vs-footer-cta h3 { font-size: 20px; font-weight: 700; color: var(--color-text-primary); }
  .vs-footer-cta p { color: var(--color-text-secondary); font-size: 15px; max-width: 480px; margin-bottom: 8px; }

  .vs-container.list-view { max-width: 1000px; margin: 60px auto 100px; padding: 0 24px; }
  .vs-list-header {
    text-align: center; display: flex; flex-direction: column; align-items: center;
    gap: 16px; margin-bottom: 48px;
  }
  .vs-list-title {
    font-size: clamp(28px, 6vw, 42px); font-weight: 800;
    color: var(--color-text-primary); letter-spacing: -0.03em;
  }
  .vs-list-sub { font-size: 16px; color: var(--color-text-secondary); max-width: 520px; line-height: 1.6; }

  .vs-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
  .vs-card {
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius-card); padding: 28px; display: flex;
    flex-direction: column; gap: 12px; cursor: pointer;
    box-shadow: var(--shadow-card); transition: all var(--transition);
  }
  .vs-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-card-hover); border-color: var(--color-primary-start); }
  .vs-card-title { font-size: 19px; font-weight: 700; color: var(--color-text-primary); line-height: 1.3; }
  .vs-card-excerpt { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; flex: 1; }
  .vs-card-more { color: var(--color-text-accent); font-weight: 600; font-size: 13px; }

  .vs-empty-state {
    text-align: center; padding: 48px; color: var(--color-text-muted);
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }

  @media (max-width: 640px) {
    .vs-columns { grid-template-columns: 1fr; }
    .vs-table-row { grid-template-columns: 1fr; }
    .vs-table-cell { border-bottom: 1px solid var(--color-border); }
  }
`

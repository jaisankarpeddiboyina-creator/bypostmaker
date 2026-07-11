// frontend/src/pages/BlogPage.tsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, User, Tag, BookOpen, AlertCircle } from 'lucide-react'
import { blogPosts } from '../../../config/blog'
import { useDocumentMetadata } from '../lib/seo'

// Lightweight Markdown-to-HTML parser.
// Handles headings, bold, italic, inline code, blockquotes, links, lists, paragraphs.
function parseMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Headers
  html = html.replace(/^# (.*?)$/gm, '<h1 class="blog-post-h1">$1</h1>')
  html = html.replace(/^## (.*?)$/gm, '<h2 class="blog-post-h2">$1</h2>')
  html = html.replace(/^### (.*?)$/gm, '<h3 class="blog-post-h3">$1</h3>')

  // Inline formatting (bold before italic to avoid conflicts)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/`(.*?)`/g, '<code class="blog-post-inline-code">$1</code>')

  // Blockquotes
  html = html.replace(/^&gt; (.*?)$/gm, '<blockquote class="blog-post-blockquote">$1</blockquote>')

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="blog-post-link" target="_blank" rel="noopener noreferrer">$1</a>')

  // Unordered lists
  html = html.replace(/^\s*-\s*(.*?)$/gm, '<li class="blog-post-li">$1</li>')
  html = html.replace(/(<li class="blog-post-li">.*?<\/li>)+/gs, '<ul class="blog-post-ul">$&</ul>')

  // Ordered lists
  html = html.replace(/^\s*\d+\.\s*(.*?)$/gm, '<li class="blog-post-li">$1</li>')

  // Paragraphs: split on blank lines, wrap non-block content
  const blocks = html.split(/\n\s*\n/)
  html = blocks.map(block => {
    block = block.trim()
    if (!block) return ''
    if (
      block.startsWith('<h1') ||
      block.startsWith('<h2') ||
      block.startsWith('<h3') ||
      block.startsWith('<ul') ||
      block.startsWith('<blockquote')
    ) {
      return block
    }
    return `<p class="blog-post-p">${block.replace(/\n/g, '<br />')}</p>`
  }).join('\n')

  return html
}

export default function BlogPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // ── Resolve metadata unconditionally (Rules of Hooks) ──────────
  const post = slug ? blogPosts.find(p => p.slug === slug) : null

  const title = slug
    ? (post
        ? `${post.title} | PostMaker Blog`
        : 'Post Not Found | PostMaker Blog')
    : 'PostMaker Blog — Social Media Tips, AI & Creation Strategy'

  const description = slug
    ? (post
        ? post.description
        : 'The blog post you are looking for does not exist or has been moved.')
    : 'Learn how to multiply your reach, write perfect AI prompts, and optimize your social media strategy with PostMaker.'

  // Hook is always called at the top level, never inside a conditional
  useDocumentMetadata(title, description)

  // ── Render: Unknown slug (404) ─────────────────────────────────
  if (slug && !post) {
    return (
      <div className="blog-container error-view">
        <div className="blog-nav-bar">
          <Link to="/blog" className="blog-back-link">
            <ArrowLeft size={16} /> Back to blog
          </Link>
        </div>
        <div className="blog-error-card">
          <AlertCircle size={48} className="error-icon" />
          <h1>Article Not Found</h1>
          <p>The post you requested could not be found. It may have been renamed or deleted.</p>
          <button className="btn btn-primary" onClick={() => navigate('/blog')}>
            Browse all articles
          </button>
        </div>
        <style>{blogStyles}</style>
      </div>
    )
  }

  // ── Render: Single post detail ─────────────────────────────────
  if (slug && post) {
    return (
      <div className="blog-container detail-view">
        <header className="blog-header">
          <Link to="/blog" className="blog-back-link">
            <ArrowLeft size={16} /> Back to all articles
          </Link>

          <div className="blog-post-meta">
            <span className="blog-meta-item"><Calendar size={14} /> {post.date}</span>
            <span className="blog-meta-item"><Clock size={14} /> {post.readingTime}</span>
            <span className="blog-meta-item"><User size={14} /> By {post.author}</span>
          </div>

          <h1 className="blog-post-title">{post.title}</h1>
          <p className="blog-post-description">{post.description}</p>

          <div className="blog-post-tags">
            {post.tags.map(tag => (
              <span key={tag} className="blog-tag"><Tag size={12} /> {tag}</span>
            ))}
          </div>
        </header>

        <hr className="blog-divider" />

        <article
          className="blog-article-content"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }}
        />

        <footer className="blog-footer-cta">
          <h3>Create perfect posts in seconds</h3>
          <p>Describe your idea once and get tailored content for 30+ platforms instantly.</p>
          <button className="btn btn-primary" onClick={() => navigate('/signup')}>
            Start Generating Free →
          </button>
        </footer>

        <style>{blogStyles}</style>
      </div>
    )
  }

  // ── Render: Blog list ──────────────────────────────────────────
  return (
    <div className="blog-container list-view">
      <header className="blog-list-header">
        <Link to="/" className="blog-back-link">
          <ArrowLeft size={16} /> Back to homepage
        </Link>
        <div className="blog-badge">
          <BookOpen size={14} />
          <span>PostMaker Blog</span>
        </div>
        <h1 className="blog-list-title">Social Media & AI Marketing Insights</h1>
        <p className="blog-list-sub">
          Guides, frameworks, and strategies to help you write once and grow everywhere.
        </p>
      </header>

      {blogPosts.length === 0 ? (
        <div className="blog-empty-state">
          <AlertCircle size={32} />
          <p>No articles published yet. Check back soon!</p>
        </div>
      ) : (
        <div className="blog-posts-grid">
          {blogPosts.map(post => (
            <article
              key={post.slug}
              className="blog-card"
              onClick={() => navigate(`/blog/${post.slug}`)}
            >
              <div className="blog-card-meta">
                <span className="blog-card-meta-item"><Calendar size={12} /> {post.date}</span>
                <span className="blog-card-meta-item"><Clock size={12} /> {post.readingTime}</span>
              </div>
              <h2 className="blog-card-title">{post.title}</h2>
              <p className="blog-card-excerpt">{post.description}</p>
              <div className="blog-card-footer">
                <span className="blog-card-author">By {post.author}</span>
                <span className="blog-card-more">Read article →</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <style>{blogStyles}</style>
    </div>
  )
}

// ── Styles (shared across all views) ───────────────────────────────
const blogStyles = `
  /* Error view */
  .blog-container.error-view {
    max-width: 600px;
    margin: 80px auto;
    padding: 0 24px;
  }
  .blog-error-card {
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
  .blog-error-card h1 {
    font-size: 24px;
    color: var(--color-text-primary);
  }
  .blog-error-card p {
    color: var(--color-text-secondary);
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 8px;
  }
  .error-icon {
    color: var(--color-error);
  }

  /* Detail view */
  .blog-container.detail-view {
    max-width: 740px;
    margin: 60px auto 100px;
    padding: 0 24px;
  }
  .blog-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .blog-back-link {
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
  .blog-back-link:hover {
    transform: translateX(-2px);
  }
  .blog-post-title {
    font-size: clamp(32px, 5vw, 44px);
    font-weight: 800;
    line-height: 1.15;
    color: var(--color-text-primary);
    letter-spacing: -0.03em;
  }
  .blog-post-description {
    font-size: 18px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }
  .blog-post-meta {
    display: flex;
    gap: 20px;
    font-size: 13px;
    color: var(--color-text-muted);
    flex-wrap: wrap;
  }
  .blog-meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .blog-post-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .blog-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--color-text-secondary);
    font-weight: 500;
  }
  .blog-divider {
    border: 0;
    border-top: 1px solid var(--color-border);
    margin: 32px 0;
  }

  /* Markdown article styling */
  .blog-article-content {
    color: var(--color-text-primary);
    font-size: 17px;
    line-height: 1.8;
  }
  .blog-post-h1 {
    font-size: 28px;
    margin-top: 32px;
    margin-bottom: 16px;
    font-weight: 700;
  }
  .blog-post-h2 {
    font-size: 22px;
    margin-top: 28px;
    margin-bottom: 14px;
    font-weight: 700;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 6px;
  }
  .blog-post-h3 {
    font-size: 18px;
    margin-top: 24px;
    margin-bottom: 12px;
    font-weight: 600;
  }
  .blog-post-p {
    margin-bottom: 20px;
  }
  .blog-post-ul {
    margin-bottom: 20px;
    padding-left: 24px;
  }
  .blog-post-li {
    margin-bottom: 8px;
  }
  .blog-post-blockquote {
    border-left: 4px solid var(--color-primary-start);
    background: var(--color-bg);
    padding: 12px 20px;
    margin: 24px 0;
    border-radius: 0 var(--radius) var(--radius) 0;
    font-style: italic;
    color: var(--color-text-secondary);
  }
  .blog-post-link {
    color: var(--color-text-accent);
    text-decoration: underline;
  }
  .blog-post-inline-code {
    font-family: var(--font-mono);
    font-size: 14px;
    background: var(--color-bg);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--color-border);
  }

  /* Bottom CTA */
  .blog-footer-cta {
    margin-top: 64px;
    padding: 36px;
    background: linear-gradient(135deg, rgba(247,37,133,0.04), rgba(147,51,234,0.04));
    border: 1px solid rgba(247,37,133,0.15);
    border-radius: var(--radius-card);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .blog-footer-cta h3 {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text-primary);
  }
  .blog-footer-cta p {
    color: var(--color-text-secondary);
    font-size: 15px;
    max-width: 480px;
    margin-bottom: 8px;
  }

  /* List view */
  .blog-container.list-view {
    max-width: 1000px;
    margin: 60px auto 100px;
    padding: 0 24px;
  }
  .blog-list-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    margin-bottom: 48px;
  }
  .blog-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border: 1px solid rgba(247,37,133,0.3);
    border-radius: 99px;
    background: rgba(247,37,133,0.08);
    color: var(--color-primary-start);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .blog-list-title {
    font-size: clamp(28px, 6vw, 42px);
    font-weight: 800;
    color: var(--color-text-primary);
    letter-spacing: -0.03em;
  }
  .blog-list-sub {
    font-size: 16px;
    color: var(--color-text-secondary);
    max-width: 500px;
    line-height: 1.6;
  }

  .blog-posts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
  }
  .blog-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    cursor: pointer;
    box-shadow: var(--shadow-card);
    transition: all var(--transition);
  }
  .blog-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-card-hover);
    border-color: var(--color-primary-start);
  }
  .blog-card-meta {
    display: flex;
    gap: 14px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .blog-card-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .blog-card-title {
    font-size: 19px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1.3;
  }
  .blog-card-excerpt {
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.6;
    flex: 1;
  }
  .blog-card-footer {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--color-text-muted);
    border-top: 1px solid var(--color-border);
    padding-top: 14px;
    margin-top: 8px;
  }
  .blog-card-more {
    color: var(--color-text-accent);
    font-weight: 600;
  }

  .blog-empty-state {
    text-align: center;
    padding: 48px;
    color: var(--color-text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
`

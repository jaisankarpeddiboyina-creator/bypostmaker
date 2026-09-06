import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Sparkles, Clock, AlertTriangle, ArrowRight, Loader2, Globe } from 'lucide-react'
import { api } from '../lib/api'
import { PLATFORM_MAP } from '@@config/platforms'
import { PostCard } from '../components/PostCard'
import PostMakerLogo from '../components/PostMakerLogo'

interface SharedData {
  id: string
  title: string
  posts: Array<{
    platformId: string
    content: string
    edited?: boolean
    extraFields?: Record<string, string>
  }>
  imageUrls: string[]
  createdAt: number
  expiresAt: number
}

export default function SharedViewPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SharedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState<string>('all')

  useEffect(() => {
    if (!id) {
      setError('Invalid share link')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    api.share.get(id)
      .then(res => {
        if (active) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(err => {
        if (active) {
          setError(err?.message || 'This share link has expired or was removed by the creator.')
          setLoading(false)
        }
      })

    return () => { active = false }
  }, [id])

  const platformIds = useMemo(() => {
    if (!data?.posts) return []
    return data.posts.map(p => p.platformId)
  }, [data])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: platformIds.length }
    platformIds.forEach((pId: string) => {
      const p = PLATFORM_MAP[pId]
      if (p) {
        counts[p.group] = (counts[p.group] || 0) + 1
      }
    })
    return counts
  }, [platformIds])

  const filteredPosts = useMemo(() => {
    if (!data?.posts) return []
    if (filterGroup === 'all') return data.posts
    return data.posts.filter(p => PLATFORM_MAP[p.platformId]?.group === filterGroup)
  }, [data, filterGroup])

  const timeRemaining = useMemo(() => {
    if (!data?.expiresAt) return ''
    const now = Math.floor(Date.now() / 1000)
    const diff = data.expiresAt - now
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / 3600)
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h remaining`
    }
    const mins = Math.floor((diff % 3600) / 60)
    return `${hours}h ${mins}m remaining`
  }, [data])

  return (
    <div className="shared-page-container">
      {/* Top Navbar */}
      <header className="shared-nav">
        <div className="shared-nav-left">
          <Link to="/" className="shared-logo-link" aria-label="PostMaker Home">
            <PostMakerLogo />
          </Link>
          {data && (
            <div className="shared-badge">
              <Globe size={12} />
              <span>Shared Read-Only Kit</span>
            </div>
          )}
        </div>

        <div className="shared-nav-right">
          {timeRemaining && (
            <div className="shared-expiry-pill" title="Public links expire 48 hours after creation">
              <Clock size={12} />
              <span>{timeRemaining}</span>
            </div>
          )}
          <Link to="/signup" className="btn btn-primary btn-sm shared-cta-btn">
            <span>{data ? 'Generate Your Own' : 'Create with PostMaker'}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {loading ? (
        <main className="shared-loading-center">
          <Loader2 size={32} className="spin" color="var(--color-primary-start, #38BDF8)" />
          <p className="shared-loading-text">Loading shared content kit...</p>
        </main>
      ) : (error || !data) ? (
        <main className="shared-error-container">
          <div className="shared-error-card">
            <div className="shared-error-icon-box">
              <AlertTriangle size={28} color="#EF4444" />
            </div>
            <h1 className="shared-error-title">Link Expired or Not Found</h1>
            <p className="shared-error-desc">
              This share link has expired or was removed by the creator. Shared links on PostMaker are temporary and expire automatically after 48 hours.
            </p>
            <div className="shared-error-actions">
              <Link to="/" className="btn btn-primary">
                <span>Go to PostMaker</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/signup" className="btn btn-ghost">
                <span>Sign Up Free</span>
              </Link>
            </div>
          </div>
        </main>
      ) : (
        /* Main Content Area */
        <div className="shared-body-layout">
          {/* Title and Filter Rail */}
          <div className="shared-header-bar">
            <div className="shared-header-info">
              <h1 className="shared-title">Generated Content Kit ✨</h1>
              <p className="shared-subtitle">
                Public preview · {data.posts.length} platform {data.posts.length === 1 ? 'post' : 'posts'}
              </p>
            </div>

            {/* Category Filter Tabs */}
            {platformIds.length > 0 && (
              <div className="platform-filter-bar">
                {[
                  { id: 'all', label: 'All Platforms' },
                  { id: 'shortform', label: 'Social & Shortform' },
                  { id: 'professional', label: 'Professional' },
                  { id: 'video', label: 'Video & Media' },
                  { id: 'community', label: 'Community' },
                  { id: 'longform', label: 'Longform' },
                ].map(cat => {
                  const count = categoryCounts[cat.id] || 0
                  if (cat.id !== 'all' && count === 0) return null
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`platform-filter-tab ${filterGroup === cat.id ? 'active' : ''}`}
                      onClick={() => setFilterGroup(cat.id)}
                    >
                      <span>{cat.label}</span>
                      <span className="tab-count-badge">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <main className="shared-cards-area">
            <div className="results-cards-grid">
              {filteredPosts.map(p => {
                const platformPost = {
                  platformId: p.platformId,
                  content: p.content,
                  status: 'done' as const,
                  edited: Boolean(p.edited),
                  extraFields: p.extraFields,
                }
                return (
                  <PostCard
                    key={p.platformId}
                    platformId={p.platformId}
                    post={platformPost}
                    campaignId={data.id}
                    imageFiles={[]}
                    videoFile={null}
                    imageUrls={data.imageUrls}
                    onOpenRefinement={undefined as any}
                  />
                )
              })}
            </div>
          </main>
        </div>
      )}

      <style>{`
        .shared-page-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: var(--color-bg, #f8fafc);
        }

        .shared-nav {
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          background: var(--color-surface, #ffffff);
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          flex-shrink: 0;
          z-index: 20;
        }

        .shared-nav-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .shared-logo-link {
          display: flex;
          align-items: center;
          text-decoration: none;
        }

        .shared-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 99px;
          background: var(--color-bg, #f1f5f9);
          border: 1px solid var(--color-border, #cbd5e1);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--color-text-secondary, #475569);
        }

        .shared-nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .shared-expiry-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 99px;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.25);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--color-primary-end, #0284C7);
        }

        .shared-cta-btn {
          gap: 6px;
        }

        .shared-loading-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 48px;
        }
        .shared-loading-text {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-secondary, #64748B);
        }

        .shared-error-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
        }

        .shared-error-card {
          width: 100%;
          max-width: 480px;
          background: var(--color-surface, #FFFFFF);
          border: 1px solid var(--color-border, #E2E8F0);
          border-radius: 16px;
          padding: 36px 28px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        .shared-error-icon-box {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: #FEE2E2;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .shared-error-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-primary, #0F172A);
          margin: 0 0 8px;
        }

        .shared-error-desc {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--color-text-secondary, #64748B);
          margin: 0 0 24px;
        }

        .shared-error-actions {
          display: flex;
          gap: 10px;
          width: 100%;
          justify-content: center;
        }

        .shared-body-layout {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .shared-header-bar {
          background: var(--color-surface, #FFFFFF);
          border-bottom: 1px solid var(--color-border, #E2E8F0);
          padding: 16px 24px 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .shared-header-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .shared-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--color-text-primary, #0F172A);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .shared-subtitle {
          font-size: 12px;
          color: var(--color-text-secondary, #64748B);
          margin: 0;
        }

        .platform-filter-bar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 6px;
        }

        .platform-filter-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: var(--radius-pill, 99px);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary, #64748B);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all var(--transition, 150ms ease);
          white-space: nowrap;
        }
        .platform-filter-tab:hover {
          color: var(--color-text-primary, #0F172A);
          background: var(--color-bg, #F1F5F9);
        }
        .platform-filter-tab.active {
          color: #FFFFFF;
          background: var(--color-primary-start, #38BDF8);
          border-color: var(--color-primary-start, #38BDF8);
        }

        .tab-count-badge {
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.1);
        }

        .shared-cards-area {
          flex: 1;
          padding: 32px 24px 64px;
          overflow-y: auto;
        }

        .results-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
          justify-content: center;
          gap: 20px;
          align-items: flex-start;
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        @media (max-width: 640px) {
          .shared-nav {
            padding: 0 14px;
          }
          .shared-badge {
            display: none;
          }
          .shared-expiry-pill {
            display: none;
          }
          .shared-header-bar {
            padding: 12px 14px 8px;
          }
          .shared-cards-area {
            padding: 16px 12px 48px;
          }
          .results-cards-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  )
}

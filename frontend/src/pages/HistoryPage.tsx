import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Loader2,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  Search,
  Filter
} from 'lucide-react'
import { generateClientZip } from '../lib/downloadKit'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'
import { PLATFORM_MAP } from '@@config/platforms'
import { PlatformIcon } from '../components/PlatformIcon'
import { PostCard } from '../components/PostCard'

interface HistoryCampaign {
  id: string
  prompt: string
  platforms: string[]
  has_image: number
  image_key: string | null
  image_fetch_url: string | null
  has_video: number
  status: string
  generated_count: number
  created_at: number
  posts: Array<{
    platform_id: string
    content: string
    edited: number
  }>
}

export default function HistoryPage() {
  const { addToast, setPrompt, setSelectedPlatforms } = useAppStore()
  const navigate = useNavigate()

  const [campaigns, setCampaigns] = useState<HistoryCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [downloading, setDownloading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAllPlatforms, setShowAllPlatforms] = useState(false)

  // Interactive Platform Filter & Search
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [platformSearch, setPlatformSearch] = useState<string>('')

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await api.history.list(1)
      setCampaigns(res.campaigns || [])
      setSelectedIndex(0)
    } catch (error) {
      console.error(error)
      addToast('Failed to load generation history', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const selectedCampaign = useMemo(() => {
    if (campaigns.length === 0) return null
    return campaigns[selectedIndex] || campaigns[0]
  }, [campaigns, selectedIndex])

  const handleReuse = (campaign: HistoryCampaign) => {
    setPrompt(campaign.prompt)
    setSelectedPlatforms(campaign.platforms)
    addToast('Prompt & platforms loaded into Create Mode.', 'info')
    navigate('/app')
  }

  const handleDownloadKit = async (campaign: HistoryCampaign) => {
    if (downloading) return
    setDownloading(true)
    try {
      const postsList = campaign.posts.map(post => ({
        platformId: post.platform_id,
        content: post.content,
        edited: Boolean(post.edited)
      }))

      const zipBlob = await generateClientZip(
        campaign.id,
        campaign.prompt,
        postsList,
        [],
        null,
        () => {}
      )
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `postmaker_${campaign.id}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
      addToast('Kit download started', 'success')
    } catch (error) {
      console.error('Download failed:', error)
      addToast('Failed to download kit', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const formatDate = (unix: number) => {
    const d = new Date(unix * 1000)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Smooth scroll to card when clicking platform icon in rail
  const scrollToCard = (platformId: string) => {
    setCategoryFilter('all')
    setPlatformSearch('')

    setTimeout(() => {
      const el = document.getElementById(`postcard-${platformId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('postcard-highlight')
        setTimeout(() => el.classList.remove('postcard-highlight'), 1800)
      } else {
        addToast(`Card for ${PLATFORM_MAP[platformId]?.name || platformId} not found`, 'info')
      }
    }, 50)
  }

  // Interactive filtering of post cards inside selected campaign
  const filteredPosts = useMemo(() => {
    if (!selectedCampaign) return []
    return selectedCampaign.posts.filter(post => {
      const platform = PLATFORM_MAP[post.platform_id]
      const matchesCategory =
        categoryFilter === 'all' || (platform && platform.group === categoryFilter)
      const matchesSearch =
        !platformSearch ||
        (platform && platform.name.toLowerCase().includes(platformSearch.toLowerCase())) ||
        post.platform_id.toLowerCase().includes(platformSearch.toLowerCase()) ||
        post.content.toLowerCase().includes(platformSearch.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }, [selectedCampaign, categoryFilter, platformSearch])

  // Category counts based strictly on generated posts
  const categoryCounts = useMemo(() => {
    if (!selectedCampaign) return {}
    const counts: Record<string, number> = { all: selectedCampaign.posts.length }
    selectedCampaign.posts.forEach(post => {
      const p = PLATFORM_MAP[post.platform_id]
      if (p) {
        counts[p.group] = (counts[p.group] || 0) + 1
      }
    })
    return counts
  }, [selectedCampaign])

  // Real generated platforms list matching generated posts
  const generatedPlatformsList = useMemo(() => {
    if (!selectedCampaign) return []
    return selectedCampaign.posts.map(p => p.platform_id)
  }, [selectedCampaign])

  if (loading) {
    return (
      <div className="history-hub-loading">
        <div className="history-hub-skel-header" />
        <div className="history-hub-skel-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skel-card" />
          ))}
        </div>
        <style>{`
          .history-hub-loading {
            padding: var(--space-8);
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
            max-width: 1500px;
            margin: 0 auto;
          }
          .history-hub-skel-header {
            height: 80px;
            border-radius: var(--radius-card);
            background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-border) 50%, var(--color-surface) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }
          .history-hub-skel-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: var(--space-6);
          }
          .skel-card {
            height: 340px;
            border-radius: var(--radius-card);
            background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-border) 50%, var(--color-surface) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    )
  }

  if (campaigns.length === 0 || !selectedCampaign) {
    return (
      <div className="history-empty-wrapper">
        <div className="history-empty-card">
          <div className="empty-sparkle-circle">
            <Sparkles size={32} />
          </div>
          <h2>No Past Generations Found</h2>
          <p>You haven't generated any multi-platform post kits yet.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/app')}
            style={{ marginTop: '16px' }}
          >
            Create Your First Kit →
          </button>
        </div>
        <style>{`
          .history-empty-wrapper {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-8);
          }
          .history-empty-card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-card);
            padding: var(--space-12) var(--space-8);
            text-align: center;
            max-width: 480px;
            box-shadow: var(--shadow-card);
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .empty-sparkle-circle {
            width: 64px;
            height: 64px;
            border-radius: var(--radius-card);
            background: var(--color-nav-active-bg);
            color: var(--color-primary-start);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: var(--space-4);
          }
          .history-empty-card h2 {
            font-size: 20px;
            font-weight: 700;
            color: var(--color-text-primary);
          }
          .history-empty-card p {
            font-size: 14px;
            color: var(--color-text-secondary);
            margin-top: 6px;
          }
        `}</style>
      </div>
    )
  }

  const mediaUrls = selectedCampaign.image_fetch_url ? [selectedCampaign.image_fetch_url] : []
  const visiblePlatforms = showAllPlatforms ? generatedPlatformsList : generatedPlatformsList.slice(0, 8)
  const hiddenCount = generatedPlatformsList.length - 8

  return (
    <div className="history-hub-wrapper animate-fade-in">
      {/* SINGLE NON-REDUNDANT GENERATION SELECTOR BAR */}
      <div className="gen-hub-header-bar">
        {/* Campaign Picker Dropdown */}
        <div className="gen-picker-wrapper">
          <button
            type="button"
            className="gen-picker-trigger"
            onClick={() => setShowDropdown(p => !p)}
          >
            <div className="picker-trigger-content">
              <span className="picker-label">SELECT GENERATION KIT ({selectedIndex + 1} of {campaigns.length})</span>
              <span className="picker-title truncate">"{selectedCampaign.prompt}"</span>
            </div>
            <ChevronDown size={18} className={`picker-arrow ${showDropdown ? 'open' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="gen-picker-dropdown">
              <div className="dropdown-scroll-list">
                {campaigns.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`dropdown-item ${idx === selectedIndex ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedIndex(idx)
                      setShowDropdown(false)
                      setCategoryFilter('all')
                      setPlatformSearch('')
                    }}
                  >
                    <div className="item-thumb-mini">
                      {c.has_image === 1 && c.image_fetch_url ? (
                        <img src={c.image_fetch_url} alt="" loading="lazy" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                    </div>
                    <div className="item-details">
                      <span className="item-prompt truncate">"{c.prompt}"</span>
                      <span className="item-meta">
                        {formatDate(c.created_at)} • {c.posts.length} generated posts
                      </span>
                    </div>
                    {idx === selectedIndex && (
                      <CheckCircle2 size={16} className="item-active-check" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stepper Navigation */}
        <div className="gen-stepper-group">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            disabled={selectedIndex === 0}
            onClick={() => {
              setSelectedIndex(i => Math.max(0, i - 1))
              setCategoryFilter('all')
              setPlatformSearch('')
            }}
            title="Previous Generation"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="stepper-text">
            {selectedIndex + 1} / {campaigns.length}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            disabled={selectedIndex === campaigns.length - 1}
            onClick={() => {
              setSelectedIndex(i => Math.min(campaigns.length - 1, i + 1))
              setCategoryFilter('all')
              setPlatformSearch('')
            }}
            title="Next Generation"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Metadata Badges */}
        <div className="gen-meta-pills">
          <span className="badge badge-completed">
            <CheckCircle2 size={12} />
            Completed
          </span>
          <span className="gen-pill-meta">
            <Calendar size={12} />
            {formatDate(selectedCampaign.created_at)}
          </span>
          <span className="gen-pill-meta highlight">
            <Layers size={12} />
            {selectedCampaign.posts.length} generated posts
          </span>
        </div>

        {/* Action Group */}
        <div className="gen-actions-group">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => handleReuse(selectedCampaign)}
          >
            <RefreshCw size={13} />
            <span>Re-use Prompt</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleDownloadKit(selectedCampaign)}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <Loader2 size={13} className="spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Download Kit ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="history-hub-main-container">
        {/* Campaign Platform Header */}
        <div className="hub-grid-header">
          <div className="hub-header-left">
            <h2 className="hub-grid-title">Generated Post Kit</h2>
            <span className="hub-grid-sub">
              Showing {filteredPosts.length} of {selectedCampaign.posts.length} posts
            </span>
          </div>

          {/* Platform Rail */}
          <div className="hub-platform-chips-row">
            {visiblePlatforms.map(id => (
              <button
                key={id}
                type="button"
                className="hub-chip-circle-btn"
                title={`Jump to ${PLATFORM_MAP[id]?.name || id} card`}
                onClick={() => scrollToCard(id)}
              >
                <PlatformIcon id={id} size={14} />
              </button>
            ))}
            {!showAllPlatforms && hiddenCount > 0 && (
              <button
                type="button"
                className="hub-chip-extra-btn"
                onClick={() => setShowAllPlatforms(true)}
              >
                +{hiddenCount} more
              </button>
            )}
            {showAllPlatforms && (
              <button
                type="button"
                className="hub-chip-extra-btn"
                onClick={() => setShowAllPlatforms(false)}
              >
                Show less
              </button>
            )}
          </div>
        </div>

        {/* CATEGORY FILTER & SEARCH TOOLBAR */}
        <div className="hub-filter-toolbar">
          <div className="hub-search-box">
            <Search size={14} className="hub-search-icon" />
            <input
              type="text"
              placeholder="Search posts by platform or content..."
              value={platformSearch}
              onChange={e => setPlatformSearch(e.target.value)}
              className="hub-search-input"
            />
            {platformSearch && (
              <button
                type="button"
                className="hub-search-clear"
                onClick={() => setPlatformSearch('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="platform-filter-bar">
            {[
              { id: 'all', label: 'All Platforms' },
              { id: 'shortform', label: 'Social & Shortform' },
              { id: 'professional', label: 'Professional' },
              { id: 'video', label: 'Video & Media' },
              { id: 'community', label: 'Community' },
              { id: 'longform', label: 'Longform' }
            ].map(cat => {
              const count = categoryCounts[cat.id] || 0
              if (cat.id !== 'all' && count === 0) return null
              return (
                <button
                  key={cat.id}
                  className={`platform-filter-tab ${categoryFilter === cat.id ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat.id)}
                >
                  <span>{cat.label}</span>
                  <span className="tab-count-badge">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* FULL 1:1 NATIVE POSTCARD GRID */}
        {filteredPosts.length === 0 ? (
          <div className="no-posts-filtered">
            <Filter size={24} />
            <p>No post cards match your search or category filter.</p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCategoryFilter('all')
                setPlatformSearch('')
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="native-postcard-full-grid">
            {filteredPosts.map(post => {
              const platformPost = {
                platformId: post.platform_id,
                content: post.content,
                status: 'done' as const,
                edited: Boolean(post.edited)
              }

              return (
                <div
                  key={post.platform_id}
                  id={`postcard-${post.platform_id}`}
                  className="postcard-grid-cell"
                >
                  <PostCard
                    platformId={post.platform_id}
                    post={platformPost}
                    campaignId={selectedCampaign.id}
                    imageFiles={[]}
                    videoFile={null}
                    onOpenRefinement={() => handleReuse(selectedCampaign)}
                    {...({ imageUrls: mediaUrls } as any)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </main>

      <style>{`
        .history-hub-wrapper {
          height: 100%;
          overflow-y: auto;
          background: var(--color-bg);
          display: flex;
          flex-direction: column;
        }
        .gen-hub-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-8);
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          position: sticky;
          top: 0;
          z-index: 30;
          gap: var(--space-4);
          box-shadow: var(--shadow-card);
        }
        .gen-picker-wrapper {
          position: relative;
          flex: 1;
          max-width: 480px;
        }
        .gen-picker-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          background: var(--color-bg);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-card);
          cursor: pointer;
          transition: all var(--transition);
          text-align: left;
        }
        .gen-picker-trigger:hover {
          border-color: var(--color-primary-start);
          background: var(--color-surface);
        }
        .picker-trigger-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 2px;
        }
        .picker-label {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--color-primary-start);
          letter-spacing: 0.04em;
        }
        .picker-title {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .picker-arrow {
          color: var(--color-text-secondary);
          transition: transform var(--transition);
          flex-shrink: 0;
          margin-left: 8px;
        }
        .picker-arrow.open {
          transform: rotate(180deg);
        }
        .gen-picker-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-modal);
          z-index: 100;
          overflow: hidden;
          animation: slideIn 150ms ease forwards;
        }
        .dropdown-scroll-list {
          max-height: 340px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          cursor: pointer;
          transition: background var(--transition);
        }
        .dropdown-item:last-child { border-bottom: none; }
        .dropdown-item:hover { background: var(--color-bg); }
        .dropdown-item.active { background: var(--color-nav-active-bg); }
        .item-thumb-mini {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--color-border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary-start);
        }
        .item-thumb-mini img { width: 100%; height: 100%; object-fit: cover; }
        .item-details { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .item-prompt { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
        .item-meta { font-size: 11px; color: var(--color-text-secondary); }
        .item-active-check { color: var(--color-primary-start); flex-shrink: 0; }

        .gen-stepper-group {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-bg);
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-border);
        }
        .stepper-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          font-family: var(--font-mono);
          white-space: nowrap;
        }
        .gen-meta-pills {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .gen-pill-meta {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }
        .gen-pill-meta.highlight {
          color: var(--color-primary-start);
          font-weight: 700;
        }
        .gen-actions-group {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .history-hub-main-container {
          padding: var(--space-8);
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }
        .hub-grid-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--color-border);
        }
        .hub-header-left {
          display: flex;
          align-items: baseline;
          gap: var(--space-3);
        }
        .hub-grid-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .hub-grid-sub {
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .hub-platform-chips-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .hub-chip-circle-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition);
        }
        .hub-chip-circle-btn:hover {
          border-color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
          transform: scale(1.15);
        }
        .hub-chip-extra-btn {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          border: none;
          cursor: pointer;
          transition: background var(--transition);
        }
        .hub-chip-extra-btn:hover {
          background: rgba(236, 72, 153, 0.16);
        }

        .hub-filter-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          flex-wrap: wrap;
        }
        .hub-search-box {
          position: relative;
          flex: 1;
          max-width: 320px;
        }
        .hub-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted);
        }
        .hub-search-input {
          width: 100%;
          padding: 8px 30px 8px 34px;
          background: var(--color-surface);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-pill);
          font-size: 13px;
          color: var(--color-text-primary);
          outline: none;
          transition: border-color var(--transition);
        }
        .hub-search-input:focus { border-color: var(--color-primary-start); }
        .hub-search-clear {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; font-size: 16px; color: var(--color-text-muted); cursor: pointer;
        }

        .tab-count-badge {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.08);
          margin-left: 4px;
        }

        .no-posts-filtered {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-12);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          gap: var(--space-3);
          color: var(--color-text-secondary);
        }

        .native-postcard-full-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 470px));
          justify-content: center;
          gap: var(--space-8);
          align-items: flex-start;
        }
        .postcard-grid-cell {
          width: 100%;
          transition: transform var(--transition);
        }

        @keyframes cardPulseHighlight {
          0% { box-shadow: 0 0 0 4px var(--color-primary-start); transform: scale(1.02); }
          50% { box-shadow: 0 0 0 8px rgba(247, 37, 133, 0.4); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 transparent; transform: scale(1); }
        }
        .postcard-highlight {
          animation: cardPulseHighlight 1.5s ease forwards;
          border-radius: var(--radius-card);
        }

        /* ── RESPONSIVE MEDIA QUERIES (MOBILE, TABLET, DESKTOP) ── */
        @media (max-width: 900px) {
          .gen-hub-header-bar {
            flex-wrap: wrap;
            padding: var(--space-4);
            gap: var(--space-3);
          }
          .gen-picker-wrapper {
            max-width: 100%;
            order: 1;
            flex-basis: 100%;
          }
          .gen-stepper-group {
            order: 2;
          }
          .gen-meta-pills {
            order: 3;
          }
          .gen-actions-group {
            order: 4;
            margin-left: auto;
          }
        }

        @media (max-width: 640px) {
          .history-hub-main-container {
            padding: var(--space-4) var(--space-3);
          }
          .native-postcard-full-grid {
            grid-template-columns: 1fr;
            gap: var(--space-5);
          }
          .gen-meta-pills {
            display: none;
          }
          .hub-filter-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .hub-search-box {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
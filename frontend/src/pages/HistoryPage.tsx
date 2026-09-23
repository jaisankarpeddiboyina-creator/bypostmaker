import { useEffect, useState, useMemo, useRef } from 'react'
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
  Filter,
  Share2,
  Archive,
  FileText,
  LayoutGrid,
  Info,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'
import { PLATFORM_MAP } from '@@config/platforms'
import { PlatformIcon } from '../components/PlatformIcon'
import { PostCard } from '../components/PostCard'
import { BREAKPOINT_MOBILE } from '../config/breakpoints'

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

// ─────────────────────────────────────────────────────────────────────────────
// Category filter groups
// ─────────────────────────────────────────────────────────────────────────────
const FILTER_CATEGORIES = [
  { id: 'all',          label: 'All Platforms' },
  { id: 'shortform',   label: 'Social & Shortform' },
  { id: 'professional',label: 'Professional' },
  { id: 'video',       label: 'Video & Media' },
  { id: 'community',   label: 'Community' },
  { id: 'longform',    label: 'Longform' },
] as const

export default function HistoryPage() {
  const { addToast, setPrompt, setSelectedPlatforms, openExport, openShare } = useAppStore()
  const navigate = useNavigate()

  const [campaigns, setCampaigns] = useState<HistoryCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [downloading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAllPlatforms, setShowAllPlatforms] = useState(false)

  // Interactive Platform Filter & Search
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [platformSearch, setPlatformSearch] = useState<string>('')

  // Dropdown open state
  const [platformsDropOpen, setPlatformsDropOpen] = useState(false)
  const [detailsDropOpen, setDetailsDropOpen] = useState(false)
  const [exportDropOpen, setExportDropOpen] = useState(false)

  // Refs for click-outside
  const pickerRef     = useRef<HTMLDivElement>(null)
  const platformsRef  = useRef<HTMLDivElement>(null)
  const detailsRef    = useRef<HTMLDivElement>(null)
  const exportRef     = useRef<HTMLDivElement>(null)

  // Close all dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (showDropdown && pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      if (platformsDropOpen && platformsRef.current && !platformsRef.current.contains(e.target as Node)) {
        setPlatformsDropOpen(false)
      }
      if (detailsDropOpen && detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        setDetailsDropOpen(false)
      }
      if (exportDropOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showDropdown, platformsDropOpen, detailsDropOpen, exportDropOpen])

  // Escape key closes all
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowDropdown(false)
        setPlatformsDropOpen(false)
        setDetailsDropOpen(false)
        setExportDropOpen(false)
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

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

  const handleDownloadKit = (campaign: HistoryCampaign) => {
    const postsList = campaign.posts.map(post => ({
      platformId: post.platform_id,
      content: post.content,
      edited: Boolean(post.edited)
    }))

    openExport({
      campaignId: campaign.id,
      prompt: campaign.prompt,
      posts: postsList,
      imageFiles: [],
      videoFile: null,
      defaultFilename: `postmaker_${campaign.id}`
    })
    setExportDropOpen(false)
  }

  const handleShareCampaign = (campaign: HistoryCampaign) => {
    const donePosts = campaign.posts.map(post => ({
      platformId: post.platform_id,
      content: post.content,
      edited: Boolean(post.edited),
    }))
    openShare({
      campaignId: campaign.id,
      posts: donePosts,
    })
    setExportDropOpen(false)
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

  const activeCatLabel = FILTER_CATEGORIES.find(c => c.id === categoryFilter)?.label ?? 'All Platforms'

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
          <h2>No History Found</h2>
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
  const visiblePlatforms = showAllPlatforms ? generatedPlatformsList : generatedPlatformsList.slice(0, 12)
  const hiddenCount = generatedPlatformsList.length - 12

  return (
    <div className="history-hub-wrapper animate-fade-in">

      {/* ── HISTORY HEADER BAR ──────────────────────────────────────────── */}
      <div className="hx-bar">

        {/* Left group: Search + Generation Kit pager */}
        <div className="hx-bar-left">

          {/* Search */}
          <div className="hx-search-box">
            <Search size={14} className="hx-search-icon" />
            <input
              id="history-search"
              type="text"
              placeholder="Search posts..."
              value={platformSearch}
              onChange={e => setPlatformSearch(e.target.value)}
              className="hx-search-input"
              aria-label="Search posts by platform or content"
            />
            {platformSearch && (
              <button
                type="button"
                className="hx-search-clear"
                onClick={() => setPlatformSearch('')}
                aria-label="Clear search"
              >×</button>
            )}
          </div>

          {/* Generation Kit picker + pager */}
          <div className="hx-pager-group" ref={pickerRef}>
            <button
              type="button"
              id="hx-kit-picker-btn"
              className={`hx-kit-label ${showDropdown ? 'open' : ''}`}
              onClick={() => setShowDropdown(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={showDropdown}
            >
              <span className="hx-kit-text">Generation Kit ({selectedIndex + 1} of {campaigns.length})</span>
              <ChevronDown size={13} className={`hx-chevron ${showDropdown ? 'flipped' : ''}`} />
            </button>

            {/* Campaign picker dropdown */}
            {showDropdown && (
              <div className="hx-picker-dropdown" role="listbox" aria-labelledby="hx-kit-picker-btn">
                <div className="hx-dropdown-scroll">
                  {campaigns.map((c, idx) => (
                    <div
                      key={c.id}
                      role="option"
                      aria-selected={idx === selectedIndex}
                      className={`hx-dropdown-item ${idx === selectedIndex ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedIndex(idx)
                        setShowDropdown(false)
                        setCategoryFilter('all')
                        setPlatformSearch('')
                      }}
                    >
                      <div className="hx-item-thumb">
                        {c.has_image === 1 && c.image_fetch_url ? (
                          <img src={c.image_fetch_url} alt="" loading="lazy" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                      </div>
                      <div className="hx-item-details">
                        <span className="hx-item-prompt truncate">"{c.prompt}"</span>
                        <span className="hx-item-meta">
                          {formatDate(c.created_at)} · {c.posts.length} posts
                        </span>
                      </div>
                      {idx === selectedIndex && (
                        <CheckCircle2 size={15} className="hx-item-check" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prev / N / Next stepper */}
            <div className="hx-stepper">
              <button
                type="button"
                className="btn btn-ghost btn-icon hx-step-btn"
                disabled={selectedIndex === 0}
                onClick={() => {
                  setSelectedIndex(i => Math.max(0, i - 1))
                  setCategoryFilter('all')
                  setPlatformSearch('')
                }}
                aria-label="Previous generation"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="hx-stepper-text">
                {selectedIndex + 1} / {campaigns.length}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-icon hx-step-btn"
                disabled={selectedIndex === campaigns.length - 1}
                onClick={() => {
                  setSelectedIndex(i => Math.min(campaigns.length - 1, i + 1))
                  setCategoryFilter('all')
                  setPlatformSearch('')
                }}
                aria-label="Next generation"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right group: platform icon rail + dropdowns */}
        <div className="hx-bar-right">

          {/* Platform icon chips rail */}
          <div className="hx-platform-rail">
            {visiblePlatforms.map(id => (
              <button
                key={id}
                type="button"
                className="hx-chip-btn"
                title={`Jump to ${PLATFORM_MAP[id]?.name || id}`}
                onClick={() => scrollToCard(id)}
              >
                <PlatformIcon id={id} size={15} />
              </button>
            ))}
            {!showAllPlatforms && hiddenCount > 0 && (
              <button
                type="button"
                className="hx-chip-more"
                onClick={() => setShowAllPlatforms(true)}
              >
                +{hiddenCount}
              </button>
            )}
            {showAllPlatforms && generatedPlatformsList.length > 12 && (
              <button
                type="button"
                className="hx-chip-more"
                onClick={() => setShowAllPlatforms(false)}
              >
                less
              </button>
            )}
          </div>

          {/* Platforms dropdown (category filter) */}
          <div className="hx-drop-root" ref={platformsRef}>
            <button
              type="button"
              className={`hx-drop-btn ${platformsDropOpen ? 'open' : ''}`}
              onClick={() => { setPlatformsDropOpen(v => !v); setDetailsDropOpen(false); setExportDropOpen(false) }}
              aria-haspopup="listbox"
              aria-expanded={platformsDropOpen}
            >
              <LayoutGrid size={13} />
              <span>{activeCatLabel}</span>
              <ChevronDown size={12} className={`hx-chevron ${platformsDropOpen ? 'flipped' : ''}`} />
            </button>

            {platformsDropOpen && (
              <div className="hx-drop-panel" role="listbox">
                {FILTER_CATEGORIES.map(cat => {
                  const count = categoryCounts[cat.id] ?? 0
                  if (cat.id !== 'all' && count === 0) return null
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="option"
                      aria-selected={categoryFilter === cat.id}
                      className={`hx-drop-item ${categoryFilter === cat.id ? 'active' : ''}`}
                      onClick={() => {
                        setCategoryFilter(cat.id)
                        setPlatformsDropOpen(false)
                      }}
                    >
                      <span className="hx-drop-item-label">{cat.label}</span>
                      <span className="hx-drop-item-count">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Details dropdown (meta info) */}
          <div className="hx-drop-root" ref={detailsRef}>
            <button
              type="button"
              className={`hx-drop-btn ${detailsDropOpen ? 'open' : ''}`}
              onClick={() => { setDetailsDropOpen(v => !v); setPlatformsDropOpen(false); setExportDropOpen(false) }}
              aria-haspopup="menu"
              aria-expanded={detailsDropOpen}
            >
              <Info size={13} />
              <span>Details</span>
              <ChevronDown size={12} className={`hx-chevron ${detailsDropOpen ? 'flipped' : ''}`} />
            </button>

            {detailsDropOpen && (
              <div className="hx-drop-panel hx-details-panel" role="menu">
                <div className="hx-detail-row">
                  <CheckCircle2 size={14} className="hx-detail-icon success" />
                  <span className="hx-detail-label">Status</span>
                  <span className="hx-detail-val">Completed</span>
                </div>
                <div className="hx-detail-row">
                  <Calendar size={14} className="hx-detail-icon" />
                  <span className="hx-detail-label">Created</span>
                  <span className="hx-detail-val">{formatDate(selectedCampaign.created_at)}</span>
                </div>
                <div className="hx-detail-row">
                  <Layers size={14} className="hx-detail-icon" />
                  <span className="hx-detail-label">Posts</span>
                  <span className="hx-detail-val hx-detail-accent">{selectedCampaign.posts.length} generated</span>
                </div>
                <div className="hx-detail-divider" />
                <button
                  type="button"
                  className="hx-detail-reuse-btn"
                  onClick={() => { handleReuse(selectedCampaign); setDetailsDropOpen(false) }}
                >
                  <RefreshCw size={13} />
                  Re-use Prompt
                </button>
              </div>
            )}
          </div>

          {/* Export & Share combined dropdown */}
          <div className="hx-drop-root" ref={exportRef}>
            <button
              type="button"
              className={`btn btn-primary btn-sm hx-export-btn ${exportDropOpen ? 'open' : ''}`}
              onClick={() => { setExportDropOpen(v => !v); setPlatformsDropOpen(false); setDetailsDropOpen(false) }}
              aria-haspopup="menu"
              aria-expanded={exportDropOpen}
            >
              <Download size={13} />
              <span>Export &amp; Share</span>
              <ChevronDown size={12} className={`hx-chevron ${exportDropOpen ? 'flipped' : ''}`} />
            </button>

            {exportDropOpen && (
              <div className="hx-drop-panel hx-export-panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="hx-export-item"
                  onClick={() => handleDownloadKit(selectedCampaign)}
                  disabled={downloading}
                >
                  <Archive size={15} className="hx-export-icon" />
                  <span className="hx-export-text">
                    <span className="hx-export-title">
                      {downloading ? 'Downloading…' : 'Download Content Kit (ZIP)'}
                    </span>
                    <span className="hx-export-sub">All posts, media &amp; assets</span>
                  </span>
                  {downloading && <Loader2 size={13} className="hx-spin" />}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="hx-export-item"
                  onClick={() => handleDownloadKit(selectedCampaign)}
                >
                  <FileText size={15} className="hx-export-icon" />
                  <span className="hx-export-text">
                    <span className="hx-export-title">Download as PDF</span>
                    <span className="hx-export-sub">Campaign summary (PDF)</span>
                  </span>
                </button>

                <div className="hx-export-divider" role="separator" />

                <button
                  type="button"
                  role="menuitem"
                  className="hx-export-item"
                  onClick={() => handleShareCampaign(selectedCampaign)}
                >
                  <Share2 size={15} className="hx-export-icon" />
                  <span className="hx-export-text">
                    <span className="hx-export-title">Share Campaign</span>
                    <span className="hx-export-sub">Get a shareable link</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ──────────────────────────────────────────────────── */}
      <main className="history-hub-main-container">

        {/* Empty filter result */}
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
        /* ── Wrapper ─────────────────────────────────────────────────────── */
        .history-hub-wrapper {
          height: 100%;
          overflow-y: auto;
          background: transparent;
          display: flex;
          flex-direction: column;
        }

        /* ── History Header Bar ──────────────────────────────────────────── */
        .hx-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 20px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          position: sticky;
          top: 0;
          z-index: 30;
          box-shadow: var(--shadow-card);
          flex-wrap: wrap;
        }

        .hx-bar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .hx-bar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        /* ── Search ──────────────────────────────────────────────────────── */
        .hx-search-box {
          position: relative;
          width: 180px;
          flex-shrink: 0;
        }

        .hx-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }

        .hx-search-input {
          width: 100%;
          padding: 7px 28px 7px 30px;
          background: var(--color-bg);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-pill);
          font-size: 12.5px;
          color: var(--color-text-primary);
          outline: none;
          transition: border-color var(--transition);
          font-family: var(--font-body);
        }

        .hx-search-input::placeholder { color: var(--color-text-placeholder); }
        .hx-search-input:focus { border-color: var(--color-primary-start); }

        .hx-search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 15px;
          color: var(--color-text-muted);
          cursor: pointer;
          line-height: 1;
        }

        /* ── Generation Kit pager ────────────────────────────────────────── */
        .hx-pager-group {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .hx-kit-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          background: var(--color-bg);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-card);
          cursor: pointer;
          transition: all var(--transition);
          white-space: nowrap;
        }

        .hx-kit-label:hover,
        .hx-kit-label.open {
          border-color: var(--color-primary-start);
          background: var(--color-surface);
        }

        .hx-kit-text {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .hx-chevron {
          color: var(--color-text-secondary);
          transition: transform 0.18s ease;
          flex-shrink: 0;
        }

        .hx-chevron.flipped { transform: rotate(180deg); }

        /* Campaign picker dropdown */
        .hx-picker-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 340px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-modal);
          z-index: 200;
          overflow: hidden;
          animation: hxDropIn 0.12s ease;
        }

        .hx-dropdown-scroll {
          max-height: 320px;
          overflow-y: auto;
        }

        .hx-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--color-border);
          cursor: pointer;
          transition: background var(--transition);
        }

        .hx-dropdown-item:last-child { border-bottom: none; }

        .hx-dropdown-item:hover { background: var(--color-nav-active-bg); }
        .hx-dropdown-item.active { background: var(--color-nav-active-bg); }

        .hx-item-thumb {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          background: var(--color-border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: var(--color-primary-start);
        }

        .hx-item-thumb img { width: 100%; height: 100%; object-fit: cover; }

        .hx-item-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
          gap: 2px;
        }

        .hx-item-prompt {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hx-item-meta {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .hx-item-check {
          color: var(--color-primary-start);
          flex-shrink: 0;
        }

        /* Stepper */
        .hx-stepper {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--color-bg);
          padding: 3px 6px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .hx-step-btn {
          width: 26px !important;
          height: 26px !important;
          min-width: unset !important;
          padding: 0 !important;
        }

        .hx-stepper-text {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-secondary);
          font-family: var(--font-mono);
          white-space: nowrap;
          padding: 0 2px;
        }

        /* ── Platform icon rail ──────────────────────────────────────────── */
        .hx-platform-rail {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          max-width: 320px;
        }

        .hx-platform-rail::-webkit-scrollbar { display: none; }

        .hx-chip-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition);
          flex-shrink: 0;
        }

        .hx-chip-btn:hover {
          border-color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
          transform: scale(1.12);
        }

        .hx-chip-more {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
          padding: 3px 8px;
          border-radius: var(--radius-pill);
          border: none;
          cursor: pointer;
          transition: background var(--transition);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .hx-chip-more:hover { background: rgba(255, 75, 145, 0.16); }

        /* ── Shared dropdown root + button ──────────────────────────────── */
        .hx-drop-root {
          position: relative;
          flex-shrink: 0;
        }

        .hx-drop-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--color-bg);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-pill);
          font-size: 12.5px;
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all var(--transition);
          white-space: nowrap;
          font-family: var(--font-body);
        }

        .hx-drop-btn:hover,
        .hx-drop-btn.open {
          border-color: var(--color-primary-start);
          background: var(--color-surface);
        }

        /* Shared dropdown panel */
        .hx-drop-panel {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          min-width: 190px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-modal);
          z-index: 200;
          overflow: hidden;
          padding: 4px;
          animation: hxDropIn 0.12s ease;
        }

        @keyframes hxDropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Platform / category dropdown items */
        .hx-drop-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary);
          transition: background var(--transition);
          text-align: left;
        }

        .hx-drop-item:hover { background: var(--color-border); }

        .hx-drop-item.active {
          background: var(--color-nav-active-bg);
          color: var(--color-nav-active-text);
          font-weight: 700;
        }

        .hx-drop-item-label { flex: 1; }

        .hx-drop-item-count {
          font-size: 11px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.07);
          margin-left: 8px;
          flex-shrink: 0;
        }

        .hx-drop-item.active .hx-drop-item-count {
          background: rgba(255, 255, 255, 0.20);
        }

        /* ── Details panel ───────────────────────────────────────────────── */
        .hx-details-panel {
          min-width: 230px;
          padding: 8px;
        }

        .hx-detail-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 4px;
        }

        .hx-detail-icon { color: var(--color-text-secondary); flex-shrink: 0; }
        .hx-detail-icon.success { color: var(--color-success); }

        .hx-detail-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
          flex: 1;
        }

        .hx-detail-val {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .hx-detail-accent { color: var(--color-primary-start); }

        .hx-detail-divider {
          height: 1px;
          background: var(--color-border);
          margin: 6px 0;
        }

        .hx-detail-reuse-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          width: 100%;
          padding: 8px 4px;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: background var(--transition);
        }

        .hx-detail-reuse-btn:hover { background: var(--color-border); }

        /* ── Export & Share panel ────────────────────────────────────────── */
        .hx-export-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .hx-export-panel {
          min-width: 260px;
          right: 0;
        }

        .hx-export-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background var(--transition);
          font-family: var(--font-body);
          text-align: left;
        }

        .hx-export-item:hover { background: var(--color-border); }
        .hx-export-item:disabled { opacity: 0.5; cursor: not-allowed; }

        .hx-export-icon {
          margin-top: 1px;
          flex-shrink: 0;
          color: var(--color-text-secondary);
        }

        .hx-export-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .hx-export-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .hx-export-sub {
          font-size: 11px;
          font-weight: 400;
          color: var(--color-text-secondary);
        }

        .hx-export-divider {
          height: 1px;
          background: var(--color-border);
          margin: 4px 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .hx-spin { animation: spin 0.9s linear infinite; }

        /* ── Main container ──────────────────────────────────────────────── */
        .history-hub-main-container {
          padding: 24px 20px;
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          flex: 1;
        }

        /* ── Card grid ───────────────────────────────────────────────────── */
        .native-postcard-full-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
          justify-content: center;
          gap: 20px;
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

        /* No results */
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

        /* ── Responsive ──────────────────────────────────────────────────── */
        @media (max-width: 900px) {
          .hx-bar {
            gap: 8px;
          }
          .hx-bar-left {
            flex-wrap: wrap;
          }
          .hx-platform-rail {
            max-width: 220px;
          }
        }

        @media (max-width: 768px) {
          .hx-bar {
            padding: 8px 12px;
            flex-direction: column;
            align-items: stretch;
          }
          .hx-bar-left,
          .hx-bar-right {
            flex-wrap: wrap;
            gap: 6px;
          }
          .hx-search-box {
            width: 100%;
          }
          .hx-platform-rail {
            max-width: 100%;
            overflow-x: auto;
          }
          .native-postcard-full-grid {
            grid-template-columns: 1fr;
          }
          .history-hub-main-container {
            padding: 16px 12px;
          }
        }

        @media (max-width: 480px) {
          .hx-bar-right {
            justify-content: flex-start;
          }
          /* Show icons only on export btn */
          .hx-export-btn span:not(.hx-chevron) { display: none; }
          .hx-drop-btn span:not(.hx-chevron)   { display: none; }
          /* Only collapse kit label text */
          .hx-kit-text { display: none; }
        }

        @media (max-width: ${BREAKPOINT_MOBILE}) {
          .hx-step-btn {
            width: 36px !important;
            height: 36px !important;
          }
        }
      `}</style>
    </div>
  )
}
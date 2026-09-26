import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Menu, Sparkles, LayoutGrid, PenTool, Command, ChevronRight,
  ChevronDown, Download, Share2, ArrowLeft, Archive, FileText, Loader2,
} from 'lucide-react'
import { useAppStore } from '../store/app'
import { PLATFORM_MAP } from '@@config/platforms'

interface TopbarProps {
  onMenuClick: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Category definitions mirrored from ResultsView (single source kept in sync)
// ─────────────────────────────────────────────────────────────────────────────
const FILTER_CATEGORIES = [
  { id: 'all',          label: 'All Platforms' },
  { id: 'shortform',   label: 'Social & Shortform' },
  { id: 'professional',label: 'Professional' },
  { id: 'video',       label: 'Video & Media' },
  { id: 'community',   label: 'Community' },
  { id: 'longform',    label: 'Longform' },
] as const

export function Topbar({ onMenuClick }: TopbarProps) {
  const {
    user, usage,
    campaign, isGenerating,
    viewMode, setViewMode,
    selectedPlatforms,
    imageFiles, videoFile,
    openExport, openShare,
    resultsFilterGroup, setResultsFilterGroup,
    setIsGenerating,
  } = useAppStore()

  const location  = useLocation()
  const navigate  = useNavigate()

  const isCreatePage   = location.pathname.startsWith('/app/create')
  const isHistoryPage  = location.pathname.startsWith('/app/history')

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const getBreadcrumb = () => {
    const path = location.pathname
    if (path.startsWith('/app/create'))    return { section: 'Studio',  page: 'New Campaign' }
    if (path.startsWith('/app/history'))   return { section: 'Studio',  page: 'History' }
    if (path.startsWith('/app/brand-kit')) return { section: 'Brand',   page: 'Brand Kit Studio' }
    if (path.startsWith('/app/billing'))   return { section: 'Account', page: 'Billing & Subscriptions' }
    if (path.startsWith('/app/settings'))  return { section: 'Account', page: 'Settings' }
    if (path.startsWith('/admin'))         return { section: 'System',  page: 'Admin Panel' }
    return { section: 'Studio', page: 'Dashboard' }
  }

  const breadcrumb       = getBreadcrumb()
  const showCreateButton = !isCreatePage

  // ── Results-tab label ─────────────────────────────────────────────────────
  const postsList      = campaign ? Object.values(campaign.posts) : []
  const completedCount = postsList.filter(p => p.status === 'done' || p.status === 'error').length
  const totalCount     = selectedPlatforms.length || postsList.length
  const resultsTabLabel = isGenerating ? `Results (${completedCount}/${totalCount})` : 'Results'

  // ── Results-mode derived values ───────────────────────────────────────────
  const isResultsMode    = isCreatePage && viewMode === 'results' && campaign !== null
  const completedPosts   = postsList.filter(p => p.status === 'done')
  const completedN       = completedPosts.length
  const totalN           = selectedPlatforms.length || postsList.length

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: selectedPlatforms.length }
    selectedPlatforms.forEach((id: string) => {
      const p = PLATFORM_MAP[id]
      if (p) counts[p.group] = (counts[p.group] || 0) + 1
    })
    return counts
  }, [selectedPlatforms])

  const activeCat   = FILTER_CATEGORIES.find(c => c.id === resultsFilterGroup) ?? FILTER_CATEGORIES[0]
  const filterLabel = resultsFilterGroup === 'all'
    ? `All Platforms (${selectedPlatforms.length})`
    : `${activeCat.label} (${categoryCounts[resultsFilterGroup] ?? 0})`

  // ── Dropdown state ────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const filterRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filterOpen && !exportOpen) return
    function handle(e: MouseEvent) {
      if (filterOpen && filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
      if (exportOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [filterOpen, exportOpen])

  // Close dropdowns on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') { setFilterOpen(false); setExportOpen(false) }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  // ── Results-mode handlers ─────────────────────────────────────────────────
  const handleEditInputs = () => {
    setIsGenerating(false)
    setViewMode('create')
  }

  const buildExportPayload = () => ({
    campaignId: campaign!.id,
    prompt: campaign!.prompt,
    posts: postsList.map(p => ({
      platformId: p.platformId,
      content: p.content,
      extraFields: p.extraFields,
    })),
    imageFiles,
    videoFile,
    defaultFilename: 'postmaker_kit',
  })

  const handleExportZip = () => {
    if (!campaign?.id) return
    openExport(buildExportPayload())
    setExportOpen(false)
  }

  const handleExportPdf = () => {
    if (!campaign?.id) return
    openExport(buildExportPayload())
    setExportOpen(false)
  }

  const handleShareCampaign = () => {
    if (!campaign?.id) return
    openShare({
      campaignId: campaign.id,
      posts: completedPosts.map(p => ({
        platformId: p.platformId,
        content: p.content,
        edited: p.edited,
        extraFields: p.extraFields,
      })),
    })
    setExportOpen(false)
  }

  // History page owns its own full header — suppress shared Topbar entirely
  if (isHistoryPage) return null

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <header className="app-topbar glass-card">
      <div className="topbar-left">
        <button className="mobile-menu-toggle" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} />
        </button>

        {/* Dynamic Studio Breadcrumb */}
        <div className="topbar-breadcrumb">
          <span className="crumb-section">{breadcrumb.section}</span>
          <ChevronRight size={14} className="crumb-arrow" />
          <h1 className="crumb-page">{breadcrumb.page}</h1>
        </div>

        {/* Live Generation Status Pill — only on create page, not results mode */}
        {isCreatePage && !isResultsMode && (
          <div className={`status-pill ${isGenerating ? 'generating' : 'idle'}`}>
            <span className="status-dot" />
            <span className="status-text">
              {isGenerating ? `Generating (${completedCount}/${totalCount})` : 'Drafting'}
            </span>
          </div>
        )}

        {/* View Toggle Tab Control */}
        {isCreatePage && campaign !== null && (
          <div className="view-toggle-pill">
            <button
              type="button"
              className={`view-toggle-item ${viewMode === 'create' ? 'active' : ''}`}
              onClick={() => setViewMode('create')}
            >
              <PenTool size={12} />
              <span>Create</span>
            </button>
            <button
              type="button"
              className={`view-toggle-item ${viewMode === 'results' ? 'active' : ''}`}
              onClick={() => setViewMode('results')}
            >
              <LayoutGrid size={12} />
              <span>{resultsTabLabel}</span>
            </button>
          </div>
        )}

        {/* ← Edit Inputs — visible only in results mode */}
        {isResultsMode && (
          <button
            type="button"
            className="topbar-edit-inputs-btn"
            onClick={handleEditInputs}
          >
            <ArrowLeft size={13} />
            <span className="hide-mobile">Edit Inputs</span>
          </button>
        )}
      </div>

      {/* ── Right side ───────────────────────────────────────────────────── */}
      <div className="topbar-right">
        {isResultsMode ? (
          <>
            {/* Status badge */}
            <div className={`topbar-results-status ${isGenerating ? 'generating' : 'ready'}`}>
              {isGenerating ? (
                <>
                  <Loader2 size={12} className="topbar-spin" />
                  <span>Generating ({completedN}/{totalN})</span>
                </>
              ) : (
                <>
                  <span className="topbar-ready-dot" />
                  <span>Ready ({completedN}/{totalN})</span>
                </>
              )}
            </div>

            {/* All Platforms dropdown */}
            {selectedPlatforms.length > 0 && (
              <div className="topbar-dropdown-root" ref={filterRef}>
                <button
                  type="button"
                  className={`topbar-filter-pill ${filterOpen ? 'open' : ''}`}
                  onClick={() => { setFilterOpen(v => !v); setExportOpen(false) }}
                  aria-haspopup="listbox"
                  aria-expanded={filterOpen}
                >
                  <LayoutGrid size={13} />
                  <span>{filterLabel}</span>
                  <ChevronDown size={12} className={`topbar-chevron ${filterOpen ? 'flipped' : ''}`} />
                </button>

                {filterOpen && (
                  <div className="topbar-dropdown-panel" role="listbox">
                    {FILTER_CATEGORIES.map(cat => {
                      const count = categoryCounts[cat.id] ?? 0
                      if (cat.id !== 'all' && count === 0) return null
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          role="option"
                          aria-selected={resultsFilterGroup === cat.id}
                          className={`topbar-dropdown-item ${resultsFilterGroup === cat.id ? 'active' : ''}`}
                          onClick={() => {
                            setResultsFilterGroup(cat.id)
                            setFilterOpen(false)
                          }}
                        >
                          <span className="dropdown-item-label">{cat.label}</span>
                          <span className="dropdown-item-count">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Export & Share combined dropdown */}
            {completedN > 0 && campaign?.id && (
              <div className="topbar-dropdown-root" ref={exportRef}>
                <button
                  type="button"
                  className={`btn btn-primary btn-sm topbar-export-btn ${exportOpen ? 'open' : ''}`}
                  onClick={() => { setExportOpen(v => !v); setFilterOpen(false) }}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                >
                  <Download size={13} />
                  <span>Export &amp; Share ({completedN})</span>
                  <ChevronDown size={12} className={`topbar-chevron ${exportOpen ? 'flipped' : ''}`} />
                </button>

                {exportOpen && (
                  <div className="topbar-dropdown-panel topbar-export-panel" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="topbar-dropdown-item topbar-export-item"
                      onClick={handleExportZip}
                    >
                      <Archive size={15} className="export-item-icon" />
                      <span className="export-item-text">
                        <span className="export-item-title">Download Content Kit (ZIP)</span>
                        <span className="export-item-sub">All posts, media &amp; assets</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="topbar-dropdown-item topbar-export-item"
                      onClick={handleExportPdf}
                    >
                      <FileText size={15} className="export-item-icon" />
                      <span className="export-item-text">
                        <span className="export-item-title">Download as PDF</span>
                        <span className="export-item-sub">Campaign summary (PDF)</span>
                      </span>
                    </button>

                    <div className="topbar-export-divider" role="separator" />

                    <button
                      type="button"
                      role="menuitem"
                      className="topbar-dropdown-item topbar-export-item"
                      onClick={handleShareCampaign}
                    >
                      <Share2 size={15} className="export-item-icon" />
                      <span className="export-item-text">
                        <span className="export-item-title">Share Campaign</span>
                        <span className="export-item-sub">Get a shareable link</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : isHistoryPage ? (
          // History page owns its own full-width control bar below —
          // suppress all default right-side controls here so there's no double bar.
          <></>
        ) : (
          <>
            {/* Command Palette Shortcut Hint */}
            <div className="cmd-hint-pill hide-mobile">
              <Command size={11} />
              <span>K</span>
            </div>

            {/* Glowing Plan Badge */}
            {user && usage && (
              <div className="topbar-usage-badge">
                <span className="plan-label">{user.plan}</span>
                <span className="usage-divider">|</span>
                <span className="usage-count">
                  {user.plan === 'business' ? 'Unlimited' : `${usage.remaining} left`}
                </span>
              </div>
            )}

            {/* Contextual "+ Create Post" Button */}
            {user && showCreateButton && (
              <button
                className="btn btn-primary btn-sm topbar-create-btn"
                onClick={() => {
                  setViewMode('create')
                  navigate('/app/create')
                }}
              >
                <Sparkles size={13} />
                <span>Create Post</span>
              </button>
            )}
          </>
        )}
      </div>

      <style>{`
        .app-topbar {
          height: var(--topbar-height);
          background: var(--color-nav-bg);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border-bottom: 1px solid var(--color-nav-border);
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--content-px);
          flex-shrink: 0;
          z-index: 50;
          position: relative;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .mobile-menu-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-nav-item-text);
          padding: 6px;
          border-radius: var(--radius-sm);
        }

        .mobile-menu-toggle:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.25);
        }

        .topbar-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .crumb-section {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .crumb-arrow {
          color: var(--color-text-placeholder);
        }

        .crumb-page {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        /* Live Status Pill */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          font-size: 11.5px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid rgba(255, 255, 255, 0.40);
        }

        .status-pill.idle { color: var(--color-text-secondary); }

        .status-pill.generating {
          color: var(--color-primary-start);
          border-color: rgba(255, 75, 145, 0.30);
          background: rgba(255, 75, 145, 0.05);
        }

        .status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--color-text-placeholder);
        }

        .status-pill.idle .status-dot {
          background: var(--color-success);
          box-shadow: 0 0 8px var(--color-success-border);
        }

        .status-pill.generating .status-dot {
          background: var(--color-primary-start);
          animation: pulseDot 1.2s infinite ease-in-out;
        }

        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
        }

        /* View Toggle Segment Control */
        .view-toggle-pill {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          background: rgba(255, 255, 255, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.40);
          border-radius: var(--radius-pill);
        }

        .view-toggle-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
        }

        .view-toggle-item:hover { color: var(--color-text-primary); }

        .view-toggle-item.active {
          background: rgba(255, 255, 255, 0.50);
          color: var(--color-text-primary);
        }

        /* ← Edit Inputs button in results mode */
        .topbar-edit-inputs-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-border);
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          color: var(--color-text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
          flex-shrink: 0;
        }

        .topbar-edit-inputs-btn:hover {
          background: rgba(255, 255, 255, 0.80);
          color: var(--color-text-primary);
          border-color: var(--color-border);
        }

        /* Topbar right */
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        /* Results status badge */
        .topbar-results-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .topbar-results-status.ready {
          background: var(--color-nav-active-bg);
          color: var(--color-nav-active-text);
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .topbar-results-status.generating {
          background: rgba(255, 75, 145, 0.06);
          color: var(--color-primary-start);
          border: 1px solid rgba(255, 75, 145, 0.25);
        }

        .topbar-ready-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--color-success);
          box-shadow: 0 0 6px var(--color-success-border);
          flex-shrink: 0;
        }

        @keyframes spinIcon {
          to { transform: rotate(360deg); }
        }
        .topbar-spin {
          animation: spinIcon 0.9s linear infinite;
        }

        /* Dropdown roots */
        .topbar-dropdown-root {
          position: relative;
          flex-shrink: 0;
        }

        /* All Platforms filter pill */
        .topbar-filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-border);
          background: rgba(255, 255, 255, 0.60);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          color: var(--color-text-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
          white-space: nowrap;
        }

        .topbar-filter-pill:hover,
        .topbar-filter-pill.open {
          background: rgba(255, 255, 255, 0.85);
          border-color: var(--color-primary-start);
        }

        /* Export & Share button */
        .topbar-export-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        /* Chevron rotation */
        .topbar-chevron {
          transition: transform 0.2s ease;
          opacity: 0.7;
        }
        .topbar-chevron.flipped { transform: rotate(180deg); opacity: 1; }

        /* Shared dropdown panel */
        .topbar-dropdown-panel {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          min-width: 200px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.06);
          z-index: 200;
          overflow: hidden;
          padding: 4px;
          animation: dropIn 0.12s ease;
        }

        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Filter dropdown item */
        .topbar-dropdown-item {
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

        .topbar-dropdown-item:hover {
          background: var(--color-border);
        }

        .topbar-dropdown-item.active {
          background: var(--color-nav-active-bg);
          color: var(--color-nav-active-text);
          font-weight: 700;
        }

        .dropdown-item-label { flex: 1; }

        .dropdown-item-count {
          font-size: 11px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.07);
          margin-left: 8px;
          flex-shrink: 0;
        }

        .topbar-dropdown-item.active .dropdown-item-count {
          background: rgba(255, 255, 255, 0.20);
        }

        /* Export panel — wider, with icon+text rows */
        .topbar-export-panel {
          min-width: 260px;
        }

        .topbar-export-item {
          gap: 10px;
          padding: 10px 12px;
          align-items: flex-start;
        }

        .export-item-icon {
          margin-top: 1px;
          flex-shrink: 0;
          color: var(--color-text-secondary);
        }

        .export-item-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .export-item-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .export-item-sub {
          font-size: 11px;
          font-weight: 400;
          color: var(--color-text-secondary);
        }

        .topbar-export-divider {
          height: 1px;
          background: var(--color-border);
          margin: 4px 0;
        }

        /* Default right-side controls */
        .cmd-hint-pill {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid rgba(255, 255, 255, 0.40);
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
        }

        .topbar-usage-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: rgba(255, 75, 145, 0.04);
          border: 1px solid rgba(255, 75, 145, 0.20);
          border-radius: var(--radius-pill);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .plan-label {
          text-transform: uppercase;
          font-size: 10.5px;
          letter-spacing: 0.06em;
          color: var(--color-primary-start);
        }

        .usage-divider { color: rgba(0, 0, 0, 0.1); }
        .usage-count   { color: var(--color-text-primary); }

        /* ── Responsive ─────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .app-topbar { padding: 0 var(--space-4); }

          .mobile-menu-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .crumb-section, .crumb-arrow { display: none; }
          .crumb-page { font-size: 15px; }
          .topbar-create-btn { display: none; }

          /* In results mode, collapse some labels */
          .topbar-left { gap: 8px; }

          .topbar-results-status span:last-child { display: none; }
          .topbar-results-status {
            padding: 4px 8px;
            gap: 4px;
          }
          /* Show count on the status dot side only on very small screens */
          .topbar-results-status::after {
            font-size: 11px;
            font-weight: 700;
          }

          .topbar-filter-pill span { display: none; }
          .topbar-filter-pill {
            padding: 6px 10px;
            gap: 0;
          }

          .topbar-export-btn span { display: none; }
          .topbar-export-btn {
            padding: 0 10px;
            gap: 0;
          }

          .topbar-dropdown-panel {
            right: 0;
            min-width: 200px;
          }

          .view-toggle-pill { margin-left: 0; }
          .topbar-edit-inputs-btn span { display: none; }
          .topbar-edit-inputs-btn { padding: 6px 8px; gap: 0; }
        }

        @media (max-width: 480px) {
          .topbar-breadcrumb { display: none; }
          .view-toggle-pill .view-toggle-item span { display: none; }
          .view-toggle-item { padding: 6px 10px; }
        }
      `}</style>
    </header>
  )
}

import { useState, useMemo } from 'react'
import { Sparkles, Download, ArrowLeft, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/app'
import { PostCard } from './PostCard'
import { RefinementChat } from './RefinementChat'
import { PLATFORM_MAP } from '@@config/platforms'
import { generateClientZip } from '../lib/downloadKit'

export function ResultsView() {
  const {
    campaign,
    imageFiles,
    videoFile,
    isGenerating,
    setViewMode,
    activePlatformId,
    setActivePlatformId,
    selectedPlatforms,
    addToast,
  } = useAppStore()

  const [downloadProgress, setDownloadProgress] = useState<string | null>(null)

  const postsList = campaign ? Object.values(campaign.posts) : []
  const completedPosts = postsList.filter(p => p.status === 'done')
  const totalPosts = selectedPlatforms.length || postsList.length

  const handleDownloadAll = async () => {
    if (!campaign?.id) return

    let totalResizes = 0
    for (const post of postsList) {
      const platform = PLATFORM_MAP[post.platformId]
      if (!platform) continue
      if (imageFiles.length > 0 && platform.imageDimensions.length > 0) {
        const imagesToProcess = imageFiles.slice(0, platform.maxImages)
        totalResizes += imagesToProcess.length * platform.imageDimensions.length
      }
    }

    if (totalResizes > 60) {
      addToast('Capping resizes at 60 operations to prevent memory issues.', 'info')
    }

    setDownloadProgress('Starting generation...')
    try {
      const zipBlob = await generateClientZip(
        campaign.id,
        campaign.prompt,
        postsList,
        imageFiles,
        videoFile,
        (msg) => setDownloadProgress(msg)
      )

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'postmaker_kit.zip'
      a.click()

      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)

      addToast('Download started', 'success')
    } catch (err: any) {
      console.error('ZIP generation failed:', err)
      addToast(err?.message || 'Failed to generate download kit.', 'error')
    } finally {
      setDownloadProgress(null)
    }
  }

  const [filterGroup, setFilterGroup] = useState<string>('all')

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: selectedPlatforms.length }
    selectedPlatforms.forEach((id: string) => {
      const p = PLATFORM_MAP[id]
      if (p) {
        counts[p.group] = (counts[p.group] || 0) + 1
      }
    })
    return counts
  }, [selectedPlatforms])

  const filteredPlatforms = useMemo(() => {
    if (filterGroup === 'all') return selectedPlatforms
    return selectedPlatforms.filter((id: string) => PLATFORM_MAP[id]?.group === filterGroup)
  }, [selectedPlatforms, filterGroup])

  return (
    <div className="results-view-layout">
      {/* Header bar */}
      <div className="results-header">
        <div className="results-header-left">
          <button
            type="button"
            className="btn-ghost btn-sm back-to-create-btn"
            onClick={() => setViewMode('create')}
          >
            <ArrowLeft size={14} />
            <span>Edit Inputs</span>
          </button>

          <div className="results-header-info">
            <h2 className="results-title">Generated Content Kit ✨</h2>
            {campaign?.prompt && (
              <p className="results-prompt-snippet truncate">"{campaign.prompt}"</p>
            )}
          </div>
        </div>

        <div className="results-header-right">
          <div className="results-status-badge">
            {isGenerating ? (
              <>
                <Loader2 size={13} className="spin" />
                <span>Generating ({completedPosts.length}/{totalPosts})</span>
              </>
            ) : (
              <span>Ready ({completedPosts.length}/{totalPosts} Completed)</span>
            )}
          </div>

          {completedPosts.length > 0 && campaign?.id && (
            <button
              type="button"
              className="btn btn-primary btn-sm download-kit-btn"
              onClick={handleDownloadAll}
              disabled={!!downloadProgress}
            >
              {downloadProgress ? (
                <>
                  <Loader2 size={13} className="spin" />
                  <span>{downloadProgress}</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>Download Full Kit ({completedPosts.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Bar */}
      {campaign && selectedPlatforms.length > 0 && (
        <div className="platform-filter-wrapper">
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
                  className={`platform-filter-tab ${filterGroup === cat.id ? 'active' : ''}`}
                  onClick={() => setFilterGroup(cat.id)}
                >
                  <span>{cat.label}</span>
                  <span className="tab-count-badge">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main centered cards area */}
      <div className="results-body">
        <div className="results-cards-area">
          {!campaign && (
            <div className="results-empty">
              <div className="results-empty-icon"><Sparkles size={28} /></div>
              <p className="results-empty-title">No generated content yet</p>
              <p className="results-empty-sub">Return to the Create view to write a prompt and select platforms.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setViewMode('create')}
                style={{ marginTop: '8px' }}
              >
                Go to Create Mode
              </button>
            </div>
          )}

          {campaign && (
            <div className="results-cards-grid">
              {filteredPlatforms.map(id => {
                const post = campaign.posts[id]
                if (!post) return null
                return (
                  <PostCard
                    key={id}
                    platformId={id}
                    post={post}
                    campaignId={campaign.id}
                    imageFiles={imageFiles}
                    videoFile={videoFile}
                    onOpenRefinement={() => setActivePlatformId(activePlatformId === id ? null : id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Device Native Refinement Slide-Over Drawer */}
        {activePlatformId && campaign?.id && (
          <RefinementChat
            platformId={activePlatformId}
            campaignId={campaign.id}
            onClose={() => setActivePlatformId(null)}
          />
        )}
      </div>

      <style>{`
        .results-view-layout {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          overflow: hidden;
          background: var(--color-bg);
        }

        .results-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
          gap: 16px;
        }

        .results-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .back-to-create-btn {
          flex-shrink: 0;
        }

        .results-header-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .results-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        .results-prompt-snippet {
          font-size: 12px;
          color: var(--color-text-secondary);
          max-width: 450px;
        }

        .results-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .results-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          background: var(--color-nav-active-bg);
          color: var(--color-nav-active-text);
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(236, 72, 153, 0.2);
        }

        .platform-filter-wrapper {
          padding: 10px 24px 0;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .platform-filter-bar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .platform-filter-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all var(--transition);
          white-space: nowrap;
        }

        .platform-filter-tab:hover {
          color: var(--color-text-primary);
          background: var(--color-border);
        }

        .platform-filter-tab.active {
          color: #ffffff;
          background: var(--color-primary-start);
          border-color: var(--color-primary-start);
        }

        .tab-count-badge {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 99px;
          background: rgba(0,0,0,0.1);
        }

        .results-body {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          position: relative;
        }

        .results-cards-area {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
          padding: 32px 24px;
        }

        .results-empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--color-text-secondary);
        }

        .results-empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary-start);
          margin-bottom: 8px;
        }

        .results-empty-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .results-empty-sub {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .results-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 470px));
          justify-content: center;
          gap: 32px;
          align-items: flex-start;
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .results-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .results-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

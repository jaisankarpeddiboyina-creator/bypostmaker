import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '../store/app'
import { PostCard } from './PostCard'
import { RefinementChat } from './RefinementChat'
import { PLATFORM_MAP } from '@@config/platforms'

export function ResultsView() {
  const {
    campaign,
    imageFiles,
    videoFile,
    activePlatformId,
    setActivePlatformId,
    selectedPlatforms,
    setViewMode,
    resultsFilterGroup,
  } = useAppStore()

  const postsList = campaign ? Object.values(campaign.posts) : []

  // filteredPlatforms now reads from the shared store filter group
  const filteredPlatforms = useMemo(() => {
    if (resultsFilterGroup === 'all') return selectedPlatforms
    return selectedPlatforms.filter((id: string) => PLATFORM_MAP[id]?.group === resultsFilterGroup)
  }, [selectedPlatforms, resultsFilterGroup])

  return (
    <div className="results-view-layout">
      {/* Main scrollable cards area — sits directly under the Topbar */}
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
                style={{ marginTop: '8px' }}
                onClick={() => setViewMode('create')}
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
                    isRefining={activePlatformId === id}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Refinement Chat slide-over */}
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
          text-align: center;
          max-width: 340px;
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

        @media (max-width: 768px) {
          .results-cards-area {
            padding: 16px 12px;
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

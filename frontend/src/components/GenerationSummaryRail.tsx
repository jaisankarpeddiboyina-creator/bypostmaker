import { Sparkles, Edit3, ImageIcon, Video, ShieldCheck, Zap } from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../store/app'
import { PlatformIcon } from './PlatformIcon'

interface GenerationSummaryRailProps {
  onGenerateClick: () => void
}

export function GenerationSummaryRail({ onGenerateClick }: GenerationSummaryRailProps) {
  const {
    prompt,
    selectedPlatforms,
    imageFiles,
    videoFile,
    isGenerating,
    usage,
    user,
  } = useAppStore()

  const canGenerate = prompt.trim().length > 0 && selectedPlatforms.length > 0 && !isGenerating

  return (
    <aside className="summary-rail">
      <div className="summary-rail-card">
        {/* Rail Title */}
        <div className="summary-rail-header">
          <h3 className="summary-rail-title">Generation Summary</h3>
          <span className="summary-badge">Ready</span>
        </div>

        {/* Media Preview Section */}
        <div className="summary-section">
          <span className="summary-label">Uploaded Media</span>
          {imageFiles.length > 0 ? (
            <div className="summary-media-box">
              <div className="summary-media-thumb">
                <img src={URL.createObjectURL(imageFiles[0])} alt="Thumb" />
              </div>
              <div className="summary-media-info">
                <span className="summary-media-title">{imageFiles[0].name}</span>
                <span className="summary-media-sub">Image · {(imageFiles[0].size / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          ) : videoFile ? (
            <div className="summary-media-box">
              <div className="summary-media-thumb video-thumb">
                <Video size={18} />
              </div>
              <div className="summary-media-info">
                <span className="summary-media-title">{videoFile.name}</span>
                <span className="summary-media-sub">Video · {(videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          ) : (
            <div className="summary-empty-box">
              <ImageIcon size={16} />
              <span>No media attached (Text only)</span>
            </div>
          )}
        </div>

        {/* Prompt Preview Section */}
        <div className="summary-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="summary-label">Your Prompt</span>
            <button
              type="button"
              className="summary-edit-btn"
              onClick={() => {
                const el = document.querySelector('.step-prompt-textarea') as HTMLTextAreaElement | null
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el.focus()
                }
              }}
            >
              <Edit3 size={11} />
              <span>Edit</span>
            </button>
          </div>
          <div className="summary-prompt-box">
            {prompt.trim() ? (
              <p className="summary-prompt-text">{prompt}</p>
            ) : (
              <span className="summary-prompt-placeholder">Describe your post concept in Step 2...</span>
            )}
          </div>
        </div>

        {/* Selected Platforms Section (Scales cleanly for 1 to 33 platforms) */}
        <div className="summary-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="summary-label">Selected Platforms ({selectedPlatforms.length})</span>
          </div>

          {selectedPlatforms.length > 0 ? (
            <div className="summary-platforms-grid">
              {selectedPlatforms.map(id => {
                const platform = PLATFORM_MAP[id]
                if (!platform) return null
                return (
                  <div
                    key={id}
                    className="summary-platform-chip"
                    style={{ '--brand-color': platform.brandColor } as React.CSSProperties}
                    title={platform.name}
                  >
                    <PlatformIcon id={id} size={14} />
                    <span className="summary-platform-name">{platform.name}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="summary-empty-box">
              <span>No platforms selected</span>
            </div>
          )}
        </div>

        {/* Credits / Limits Info */}
        <div className="summary-credits-box">
          <div className="credits-left">
            <Zap size={14} className="credits-icon" />
            <span>Generation Usage</span>
          </div>
          <span className="credits-value">
            {user?.plan === 'business' ? 'Unlimited' : `${usage?.remaining ?? 0} remaining`}
          </span>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          className="btn btn-primary summary-cta-btn"
          onClick={onGenerateClick}
          disabled={!canGenerate}
        >
          <Sparkles size={16} />
          <span>
            {isGenerating
              ? 'Generating...'
              : `Generate Posts ${selectedPlatforms.length > 0 ? `(${selectedPlatforms.length})` : ''}`}
          </span>
        </button>

        {/* Security / Reassurance Footer */}
        <div className="summary-rail-footer">
          <ShieldCheck size={13} />
          <span>Your posts are private & secure</span>
        </div>
      </div>

      <style>{`
        .summary-rail {
          width: 320px;
          flex-shrink: 0;
        }

        .summary-rail-card {
          position: sticky;
          top: 20px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: 20px;
          box-shadow: var(--shadow-card);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .summary-rail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--color-border);
        }

        .summary-rail-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .summary-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          background: var(--color-success-bg);
          color: var(--color-success);
          border: 1px solid var(--color-success-border);
        }

        .summary-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .summary-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .summary-media-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
        }

        .summary-media-thumb {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          overflow: hidden;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-media-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .summary-media-thumb.video-thumb {
          color: var(--color-primary-start);
        }

        .summary-media-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .summary-media-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .summary-media-sub {
          font-size: 10px;
          color: var(--color-text-secondary);
        }

        .summary-empty-box {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          background: var(--color-bg);
          border: 1px dashed var(--color-border);
          border-radius: var(--radius);
          font-size: 11.5px;
          color: var(--color-text-muted);
        }

        .summary-edit-btn {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-primary-start);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .summary-edit-btn:hover {
          text-decoration: underline;
        }

        .summary-prompt-box {
          padding: 10px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          max-height: 80px;
          overflow-y: auto;
        }

        .summary-prompt-text {
          font-size: 12px;
          line-height: 1.5;
          color: var(--color-text-primary);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .summary-prompt-placeholder {
          font-size: 11.5px;
          color: var(--color-text-muted);
          font-style: italic;
        }

        /* Scalable Selected Platforms Grid in Summary Rail */
        .summary-platforms-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          max-height: 140px;
          overflow-y: auto;
          padding-right: 2px;
        }

        .summary-platform-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: var(--radius-pill);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .summary-platform-name {
          line-height: 1;
        }

        .summary-credits-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.25);
          border-radius: var(--radius);
          font-size: 12px;
        }

        .credits-left {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          color: #B45309;
        }

        .credits-icon {
          color: #F59E0B;
        }

        .credits-value {
          font-weight: 700;
          color: #B45309;
        }

        .summary-cta-btn {
          width: 100%;
          height: 44px;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
        }

        .summary-rail-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 11px;
          color: var(--color-text-muted);
          margin-top: -4px;
        }

        @media (max-width: 960px) {
          .summary-rail {
            width: 100%;
          }
          .summary-rail-card {
            position: static;
          }
        }
      `}</style>
    </aside>
  )
}

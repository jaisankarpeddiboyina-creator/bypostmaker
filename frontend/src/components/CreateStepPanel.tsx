import { useState, useRef } from 'react'
import {
  Upload, Sparkles, Check, Lock, X, ImageIcon, Video, ChevronDown, ChevronUp, Lightbulb
} from 'lucide-react'
import { PLATFORMS, isPlatformAccessible, FREE_PLATFORM_IDS } from '@@config/platforms'
import type { PlatformTier } from '@@config/platforms'
import { useAppStore } from '../store/app'
import { PlatformIcon } from './PlatformIcon'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'

const VIDEO_MAX_MB = 100

interface CreateStepPanelProps {
  userPlan: PlatformTier
  onLockedClick: (platformName: string) => void
  onGenerateClick: () => void
}

const PROMPT_IDEAS = [
  { label: '🚀 Product Launch', text: 'Launching my new SaaS tool that helps designers export assets 10x faster. Key features include automated batch export, AI color palettes, and Figma plugin integration.' },
  { label: '💡 Thought Leadership', text: '5 key lessons learned after scaling our startup to 10k users without spending a dollar on paid ads. Lesson 1: Build in public from day one.' },
  { label: '📢 Weekly Update', text: 'Weekly product update: We just shipped dark mode, 3x faster page loads, and updated Slack integration. Try it out now!' },
  { label: '🎨 Design Showcase', text: 'Behind the scenes of our new brand redesign. How we simplified our color palette and built a high-performance design system.' },
  { label: '🔥 Customer Story', text: 'How Acme Corp saved 15 hours a week on content creation using PostMaker. Here is the full breakdown of their workflow.' },
]

export function CreateStepPanel({ userPlan, onLockedClick, onGenerateClick }: CreateStepPanelProps) {
  const {
    prompt, setPrompt,
    selectedPlatforms, togglePlatform, setSelectedPlatforms,
    imageFiles, setImageFiles,
    videoFile, setVideoFile,
    isGenerating, addToast
  } = useAppStore()

  const [showAllPlatforms, setShowAllPlatforms] = useState(false)
  const [showPromptIdeas, setShowPromptIdeas] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const file = files[0]
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      addToast('Image file size exceeds the 15MB limit.', 'error')
      e.target.value = ''
      return
    }

    setImageFiles([file])
  }

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
      addToast(`Video too large. Max ${VIDEO_MAX_MB}MB.`, 'error')
      e.target.value = ''
      return
    }
    setVideoFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isGenerating) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    if (file.type.startsWith('image/')) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        addToast('Image file size exceeds 15MB limit.', 'error')
        return
      }
      setImageFiles([file])
    } else if (file.type.startsWith('video/')) {
      if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
        addToast(`Video exceeds ${VIDEO_MAX_MB}MB limit.`, 'error')
        return
      }
      setVideoFile(file)
    } else {
      addToast('Please upload an image or video file.', 'error')
    }
  }

  const handleSelectAll = () => {
    if (isGenerating) return
    const accessibleIds = PLATFORMS
      .filter(p => isPlatformAccessible(p.id, userPlan))
      .map(p => p.id)
    
    // If all accessible are already selected, clear selection, else select all accessible
    const allSelected = accessibleIds.every(id => selectedPlatforms.includes(id))
    if (allSelected) {
      setSelectedPlatforms([])
    } else {
      setSelectedPlatforms(accessibleIds)
    }
  }

  const defaultVisibleCount = 10
  const displayedPlatforms = showAllPlatforms ? PLATFORMS : PLATFORMS.slice(0, defaultVisibleCount)
  const hiddenCount = PLATFORMS.length - defaultVisibleCount

  return (
    <div className={`create-step-panel ${isGenerating ? 'disabled-locked' : ''}`}>
      {/* Inline lock banner if generating */}
      {isGenerating && (
        <div className="lock-banner">
          <Sparkles size={14} className="spin" />
          <span>Generation in progress. Editing inputs is locked until generation completes.</span>
        </div>
      )}

      {/* Header Title */}
      <div className="step-panel-header">
        <div>
          <h2 className="step-panel-title">Create New Post ✨</h2>
          <p className="step-panel-subtitle">AI will generate platform-native posts tailored to your selected channels.</p>
        </div>
      </div>

      {/* STEP 1: Upload Media */}
      <div className="step-card">
        <div className="step-card-header">
          <div className="step-number">1</div>
          <div>
            <h3 className="step-title">Upload Media</h3>
            <p className="step-description">Add an image or video to repurpose across your social channels (Optional)</p>
          </div>
        </div>

        <div className="step-card-body">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
            disabled={isGenerating}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoSelect}
            disabled={isGenerating}
          />

          {imageFiles.length === 0 && !videoFile ? (
            <div
              className={`dropzone ${isDragOver ? 'dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="dropzone-icon">
                <Upload size={22} />
              </div>
              <div className="dropzone-content">
                <p className="dropzone-text">
                  <button type="button" className="dropzone-link" onClick={() => imageInputRef.current?.click()} disabled={isGenerating}>
                    Upload an image
                  </button>
                  {' or '}
                  <button type="button" className="dropzone-link" onClick={() => videoInputRef.current?.click()} disabled={isGenerating}>
                    video file
                  </button>
                </p>
                <p className="dropzone-sub">Drag & drop or click to upload · JPG, PNG, WEBP (15MB) or MP4 (100MB)</p>
              </div>
            </div>
          ) : (
            <div className="media-preview-card">
              {imageFiles.length > 0 && (
                <div className="media-preview-row">
                  <div className="media-preview-thumb">
                    <img src={URL.createObjectURL(imageFiles[0])} alt="Upload preview" />
                  </div>
                  <div className="media-preview-info">
                    <span className="media-preview-name">{imageFiles[0].name}</span>
                    <span className="media-preview-meta">Image · {(imageFiles[0].size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="media-preview-actions">
                    <button className="btn-ghost btn-sm" onClick={() => imageInputRef.current?.click()} disabled={isGenerating}>
                      Change
                    </button>
                    <button className="btn-icon" onClick={() => setImageFiles([])} disabled={isGenerating} title="Remove image">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}

              {videoFile && (
                <div className="media-preview-row">
                  <div className="media-preview-thumb video-thumb">
                    <Video size={24} />
                  </div>
                  <div className="media-preview-info">
                    <span className="media-preview-name">{videoFile.name}</span>
                    <span className="media-preview-meta">Video · {(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="media-preview-actions">
                    <button className="btn-ghost btn-sm" onClick={() => videoInputRef.current?.click()} disabled={isGenerating}>
                      Change
                    </button>
                    <button className="btn-icon" onClick={() => setVideoFile(null)} disabled={isGenerating} title="Remove video">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* STEP 2: Write Your Prompt */}
      <div className="step-card">
        <div className="step-card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div className="step-number">2</div>
            <div>
              <h3 className="step-title">Write Your Prompt</h3>
              <p className="step-description">Describe what you want AI to generate or summarize</p>
            </div>
          </div>
          <button
            type="button"
            className="prompt-ideas-btn"
            onClick={() => setShowPromptIdeas(!showPromptIdeas)}
            disabled={isGenerating}
          >
            <Lightbulb size={13} />
            <span>Prompt Ideas</span>
          </button>
        </div>

        {/* Prompt Ideas Drawer */}
        {showPromptIdeas && (
          <div className="prompt-ideas-box">
            <p className="ideas-title">Click a template to populate:</p>
            <div className="ideas-grid">
              {PROMPT_IDEAS.map((idea, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="idea-chip"
                  onClick={() => {
                    setPrompt(idea.text)
                    setShowPromptIdeas(false)
                  }}
                  disabled={isGenerating}
                >
                  <span className="idea-chip-label">{idea.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="step-card-body">
          <div className="prompt-container">
            <textarea
              className="step-prompt-textarea"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what you want to post about...&#10;&#10;e.g. Launching my new SaaS tool that helps designers export assets 10x faster. Highlight top 3 benefits and include a strong call to action."
              rows={5}
              disabled={isGenerating}
              maxLength={2000}
            />
            <div className="prompt-footer">
              <span className={`prompt-counter ${prompt.length > 1800 ? 'warning' : ''}`}>
                {prompt.length} / 2000
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 3: Select Platforms */}
      <div className="step-card">
        <div className="step-card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div className="step-number">3</div>
            <div>
              <h3 className="step-title">Select Platforms ({selectedPlatforms.length} selected)</h3>
              <p className="step-description">Choose target social networks for platform-native post generation</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={handleSelectAll}
              disabled={isGenerating}
            >
              Select All
            </button>
            {selectedPlatforms.length > 0 && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setSelectedPlatforms([])}
                disabled={isGenerating}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="step-card-body">
          <div className="platform-selection-grid">
            {displayedPlatforms.map(platform => {
              const isSelected = selectedPlatforms.includes(platform.id)
              const isAccessible = isPlatformAccessible(platform.id, userPlan)

              return (
                <button
                  key={platform.id}
                  type="button"
                  className={[
                    'platform-card-item',
                    isSelected ? 'selected' : '',
                    !isAccessible ? 'locked' : ''
                  ].join(' ')}
                  style={{
                    '--platform-brand': platform.brandColor
                  } as React.CSSProperties}
                  onClick={() => {
                    if (isGenerating) return
                    if (!isAccessible) {
                      onLockedClick(platform.name)
                      return
                    }
                    togglePlatform(platform.id)
                  }}
                  disabled={isGenerating}
                >
                  <div className="platform-card-left">
                    <span className="platform-card-icon-wrap">
                      <PlatformIcon id={platform.id} size={18} />
                    </span>
                    <span className="platform-card-name">{platform.name}</span>
                  </div>

                  <div className="platform-card-right">
                    {!isAccessible ? (
                      <span className="platform-card-lock" title="Upgrade required">
                        <Lock size={12} />
                      </span>
                    ) : (
                      <span className={`platform-card-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Show More / Show Less Toggle for full 33 platforms scale */}
          <div className="platform-expand-row">
            <button
              type="button"
              className="platform-expand-btn"
              onClick={() => setShowAllPlatforms(!showAllPlatforms)}
            >
              {showAllPlatforms ? (
                <>
                  <span>Show Less</span>
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  <span>+ Show All 33 Platforms ({hiddenCount} more)</span>
                  <ChevronDown size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .create-step-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
          flex: 1;
          min-width: 0;
          padding-bottom: 32px;
          transition: opacity var(--transition);
        }

        .create-step-panel.disabled-locked {
          opacity: 0.65;
          pointer-events: none;
        }

        .lock-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(236, 72, 153, 0.08);
          border: 1px solid rgba(236, 72, 153, 0.25);
          border-radius: var(--radius-card);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-nav-active-text);
        }

        .step-panel-header {
          margin-bottom: 4px;
        }

        .step-panel-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.03em;
        }

        .step-panel-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        /* Step Card Styling */
        .step-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: 20px 24px;
          box-shadow: var(--shadow-card);
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: border-color var(--transition);
        }

        .step-card:hover {
          border-color: var(--color-border-input);
        }

        .step-card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(247, 37, 133, 0.10);
          color: var(--color-primary-start);
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .step-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
        }

        .step-description {
          font-size: 12.5px;
          color: var(--color-text-secondary);
          margin-top: 1px;
        }

        /* Step 1 Dropzone */
        .dropzone {
          border: 1.5px dashed var(--color-border-input);
          border-radius: var(--radius-card);
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: var(--color-bg);
          transition: all var(--transition);
          cursor: pointer;
        }

        .dropzone.dragover, .dropzone:hover {
          border-color: var(--color-primary-start);
          background: rgba(247, 37, 133, 0.03);
        }

        .dropzone-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-primary-start);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dropzone-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dropzone-text {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .dropzone-link {
          color: var(--color-primary-start);
          background: none;
          border: none;
          font-size: inherit;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
        }

        .dropzone-sub {
          font-size: 11.5px;
          color: var(--color-text-muted);
        }

        .media-preview-card {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: 12px 16px;
        }

        .media-preview-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .media-preview-thumb {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .media-preview-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .media-preview-thumb.video-thumb {
          color: var(--color-primary-start);
        }

        .media-preview-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .media-preview-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-preview-meta {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .media-preview-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Step 2 Prompt Area */
        .prompt-ideas-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          border: 1px solid rgba(247, 37, 133, 0.2);
          background: rgba(247, 37, 133, 0.06);
          color: var(--color-primary-start);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
        }

        .prompt-ideas-btn:hover {
          background: rgba(247, 37, 133, 0.12);
        }

        .prompt-ideas-box {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ideas-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ideas-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .idea-chip {
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition);
        }

        .idea-chip:hover {
          border-color: var(--color-primary-start);
          color: var(--color-primary-start);
        }

        .prompt-container {
          position: relative;
        }

        .step-prompt-textarea {
          width: 100%;
          background: var(--color-bg);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-card);
          padding: 14px 16px;
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-primary);
          line-height: 1.6;
          resize: vertical;
          outline: none;
          transition: border-color var(--transition);
        }

        .step-prompt-textarea:focus {
          border-color: var(--color-primary-start);
          background: var(--color-surface);
        }

        .prompt-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 6px;
        }

        .prompt-counter {
          font-size: 11px;
          font-family: var(--font-mono);
          color: var(--color-text-muted);
        }

        .prompt-counter.warning {
          color: var(--color-error);
        }

        /* Step 3 Platform Grid */
        .platform-selection-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 10px;
        }

        .platform-card-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: var(--radius);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          cursor: pointer;
          transition: all 150ms ease;
          text-align: left;
        }

        .platform-card-item:hover:not(.locked) {
          border-color: var(--color-border-input);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .platform-card-item.selected {
          border-color: var(--platform-brand, var(--color-primary-start));
          background: color-mix(in srgb, var(--platform-brand, var(--color-primary-start)) 8%, var(--color-surface));
        }

        .platform-card-item.locked {
          opacity: 0.5;
          cursor: not-allowed;
          background: var(--color-bg);
        }

        .platform-card-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .platform-card-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .platform-card-name {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .platform-card-right {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          margin-left: 6px;
        }

        .platform-card-checkbox {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1.5px solid var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms ease;
          color: white;
        }

        .platform-card-checkbox.checked {
          background: var(--platform-brand, var(--color-primary-start));
          border-color: var(--platform-brand, var(--color-primary-start));
        }

        .platform-card-lock {
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
        }

        .platform-expand-row {
          display: flex;
          justify-content: center;
          margin-top: 14px;
        }

        .platform-expand-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-border-input);
          background: var(--color-surface);
          color: var(--color-text-secondary);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
        }

        .platform-expand-btn:hover {
          border-color: var(--color-primary-start);
          color: var(--color-primary-start);
        }

        @media (max-width: 640px) {
          .platform-selection-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  )
}

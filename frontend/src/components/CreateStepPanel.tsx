import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Upload, Sparkles, X, Video, Command, Plus, ChevronDown, Image as ImageIcon
} from 'lucide-react'
import { PLATFORMS, isPlatformAccessible } from '@@config/platforms'
import type { PlatformTier, Platform } from '@@config/platforms'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { PlatformIcon } from './PlatformIcon'
import { PlatformsDrawer } from './PlatformsDrawer'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'

const VIDEO_MAX_MB = 100

// Default 6 quick suggestion platform IDs when 0 platforms are selected
const INITIAL_SUGGESTION_IDS = ['instagram', 'x', 'linkedin', 'youtube', 'facebook', 'tiktok']

interface CreateStepPanelProps {
  userPlan: PlatformTier
  onLockedClick: (platformName: string) => void
  onGenerateClick: () => void
}

export function CreateStepPanel({ userPlan, onLockedClick, onGenerateClick }: CreateStepPanelProps) {
  const {
    user,
    prompt, setPrompt,
    selectedPlatforms, togglePlatform, setSelectedPlatforms,
    imageFiles, setImageFiles, addImageFiles, removeImageFile,
    videoFile, setVideoFile,
    isGenerating, addToast,
    useBrandKit, setUseBrandKit,
    openAssetPicker
  } = useAppStore()

  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [brandKitName, setBrandKitName] = useState<string | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  const handleOpenAssetPicker = () => {
    openAssetPicker({
      accept: ['image'],
      onSelect: (file) => {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          addToast(`Image "${file.name}" exceeds the 15MB limit.`, 'error')
        } else {
          addImageFiles([file])
        }
      }
    })
  }

  useEffect(() => {
    api.brandKit.get()
      .then(res => {
        if (res?.brandKit?.name) {
          setBrandKitName(res.brandKit.name)
        }
      })
      .catch(() => {})
  }, [])

  // Close plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut listener: Cmd/Ctrl + Enter to trigger generation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!isGenerating && prompt.trim() && selectedPlatforms.length > 0) {
          e.preventDefault()
          onGenerateClick()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isGenerating, prompt, selectedPlatforms, onGenerateClick])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const validFiles: File[] = []
    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        addToast(`Image "${file.name}" exceeds the 15MB limit.`, 'error')
      } else {
        validFiles.push(file)
      }
    }

    if (validFiles.length > 0) {
      addImageFiles(validFiles)
    }
    e.target.value = ''
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

    const imageDropList: File[] = []
    let hasVideoMatch = false

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          addToast(`Image "${file.name}" exceeds 15MB limit.`, 'error')
        } else {
          imageDropList.push(file)
        }
      } else if (file.type.startsWith('video/') && !hasVideoMatch) {
        if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
          addToast(`Video exceeds ${VIDEO_MAX_MB}MB limit.`, 'error')
        } else {
          setVideoFile(file)
          hasVideoMatch = true
        }
      }
    }

    if (imageDropList.length > 0) {
      addImageFiles(imageDropList)
    }
  }

  // Initial suggestion platforms list (when 0 selected)
  const initialSuggestionPlatforms = useMemo(() => {
    return INITIAL_SUGGESTION_IDS
      .map(id => PLATFORMS.find(p => p.id === id))
      .filter((p): p is Platform => p !== undefined)
  }, [])

  // Active selected platform objects list (when 1+ selected)
  const activeSelectedPlatforms = useMemo(() => {
    return selectedPlatforms
      .map(id => PLATFORMS.find(p => p.id === id))
      .filter((p): p is Platform => p !== undefined)
  }, [selectedPlatforms])

  const handleQuickAdd = (platform: Platform) => {
    if (isGenerating) return
    const isAccessible = isPlatformAccessible(platform.id, userPlan)
    if (!isAccessible) {
      onLockedClick(platform.name)
    } else {
      togglePlatform(platform.id)
    }
  }

  return (
    <div className={`mockup-studio-container ${showDrawer ? 'drawer-open' : ''} ${isGenerating ? 'disabled-locked' : ''}`}>
      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
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

      {/* Studio Banners */}
      {!user && (
        <div className="studio-preview-banner">
          <Sparkles size={14} className="text-accent" />
          <span>Interactive Studio Playground — Explore prompt features & platforms freely. Click Generate when ready to sign in.</span>
        </div>
      )}

      {isGenerating && (
        <div className="studio-lock-banner">
          <Sparkles size={16} className="spin text-primary" />
          <span>Generating multi-platform post kit... Creation panel locked.</span>
        </div>
      )}

      {/* FLOATING UNIFIED PROMPT BAR */}
      <div
        className={`mockup-prompt-bar-card glass-card ${isDragOver ? 'dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="prompt-bar-input-row">
          {/* Plus Action Menu Button */}
          <div className="plus-menu-container" ref={plusMenuRef}>
            <button
              type="button"
              className={`plus-action-btn ${showPlusMenu ? 'active' : ''}`}
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              disabled={isGenerating}
              title="Add media or apply brand kit"
            >
              <Plus size={18} />
            </button>

            {/* Plus Action Popover Menu */}
            {showPlusMenu && (
              <div className="plus-popover-menu glass-card animate-fade-in">
                <div className="popover-section-title">
                  <Sparkles size={12} /> AI & Brand Controls
                </div>

                {/* Brand Kit Toggle */}
                <label className={`popover-item-toggle ${useBrandKit ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={useBrandKit}
                    onChange={e => setUseBrandKit(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Apply Brand Kit {brandKitName ? `(${brandKitName})` : ''}</span>
                </label>

                {/* Media Attachments */}
                <div className="popover-section-title" style={{ marginTop: 10 }}>
                  <Upload size={12} /> Attach Media
                </div>
                <div className="popover-media-actions">
                  <button
                    type="button"
                    className="popover-action-btn"
                    onClick={() => { imageInputRef.current?.click(); setShowPlusMenu(false); }}
                    disabled={isGenerating || imageFiles.length >= 4 || !!videoFile}
                  >
                    <ImageIcon size={13} /> Upload Images ({imageFiles.length}/4)
                  </button>
                  <button
                    type="button"
                    className="popover-action-btn"
                    onClick={() => { handleOpenAssetPicker(); setShowPlusMenu(false); }}
                    disabled={isGenerating || imageFiles.length >= 4 || !!videoFile}
                  >
                    <Sparkles size={13} /> Stock Photos Library
                  </button>
                  <button
                    type="button"
                    className="popover-action-btn"
                    onClick={() => { videoInputRef.current?.click(); setShowPlusMenu(false); }}
                    disabled={isGenerating || !!videoFile || imageFiles.length > 0}
                  >
                    <Video size={13} /> Add Video MP4
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Textarea / Input */}
          <div className="prompt-text-field-container">
            <textarea
              className="mockup-prompt-textarea"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your post, product release, or announcement..."
              rows={2}
              disabled={isGenerating}
              maxLength={2000}
            />
          </div>

          {/* Ctrl K Badge & Generate CTA */}
          <div className="prompt-bar-right-actions">
            <div className="shortcut-pill hide-mobile">
              <Command size={10} />
              <span>K</span>
            </div>

            <button
              type="button"
              className="mockup-generate-btn"
              disabled={isGenerating || !prompt.trim() || selectedPlatforms.length === 0}
              onClick={onGenerateClick}
            >
              <Sparkles size={15} />
              <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
            </button>
          </div>
        </div>

        {/* ATTACHED MEDIA GALLERY */}
        {(imageFiles.length > 0 || videoFile) && (
          <div className="attached-media-strip">
            {imageFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="media-chip-thumb">
                <span className="thumb-badge">#{idx + 1}</span>
                <img src={URL.createObjectURL(file)} alt="" />
                <button
                  type="button"
                  className="thumb-remove"
                  onClick={() => removeImageFile(idx)}
                  disabled={isGenerating}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {videoFile && (
              <div className="media-chip-thumb video-thumb">
                <Video size={16} />
                <span className="thumb-badge">MP4</span>
                <button
                  type="button"
                  className="thumb-remove"
                  onClick={() => setVideoFile(null)}
                  disabled={isGenerating}
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SMART CHIPS ROW DIRECTLY UNDER TEXTAREA */}
      <div className="mockup-platform-chips-row">
        {selectedPlatforms.length === 0 ? (
          /* STATE 1: ZERO PLATFORMS SELECTED (CLEAN SUGGESTIONS) */
          <>
            {initialSuggestionPlatforms.map(platform => (
              <button
                key={platform.id}
                type="button"
                className="quick-suggestion-chip"
                onClick={() => handleQuickAdd(platform)}
                disabled={isGenerating}
                title={`Add ${platform.name}`}
              >
                <PlatformIcon id={platform.id} size={14} />
                <span className="chip-label">{platform.name}</span>
                <Plus size={12} className="chip-plus-icon" />
              </button>
            ))}

            <button
              type="button"
              className="platform-chip-btn more-chip-btn"
              onClick={() => setShowDrawer(!showDrawer)}
              disabled={isGenerating}
            >
              <span>••• All Platforms (33)</span>
              <ChevronDown size={14} />
            </button>
          </>
        ) : (
          /* STATE 2: 1+ PLATFORMS SELECTED (ONLY ACTIVE CHIPS) */
          <>
            {activeSelectedPlatforms.map(platform => (
              <div
                key={platform.id}
                className="selected-platform-chip"
                style={{ '--brand-color': platform.brandColor } as React.CSSProperties}
              >
                <PlatformIcon id={platform.id} size={15} />
                <span className="chip-label">{platform.name}</span>
                <button
                  type="button"
                  className="chip-remove-btn"
                  onClick={() => togglePlatform(platform.id)}
                  disabled={isGenerating}
                  title={`Remove ${platform.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            <button
              type="button"
              className="platform-chip-btn add-more-chip-btn"
              onClick={() => setShowDrawer(!showDrawer)}
              disabled={isGenerating}
            >
              <Plus size={13} />
              <span>Add platform</span>
              <ChevronDown size={13} />
            </button>

            <button
              type="button"
              className="btn-clear-all-chips"
              onClick={() => setSelectedPlatforms([])}
              disabled={isGenerating}
            >
              Clear all ({selectedPlatforms.length})
            </button>
          </>
        )}
      </div>

      {/* RIGHT-SIDE PLATFORMS DRAWER */}
      <PlatformsDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        userPlan={userPlan}
        selectedPlatforms={selectedPlatforms}
        setSelectedPlatforms={setSelectedPlatforms}
        isGenerating={isGenerating}
        onLockedClick={onLockedClick}
      />

      <style>{`
        .mockup-studio-container {
          max-width: 900px;
          margin: auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 20px var(--content-px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Adaptive Stage Shift when Right Drawer Opens */
        .mockup-studio-container.drawer-open {
          margin-right: 440px;
          max-width: calc(100% - 460px);
        }

        .mockup-studio-container.disabled-locked {
          opacity: 0.7;
          pointer-events: none;
        }

        /* FLOATING SEARCH-BAR PROMPT CARD */
        .mockup-prompt-bar-card {
          width: 100%;
          padding: 10px 14px;
          border-radius: var(--radius-pill);
          background: var(--color-surface-solid);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          border: 1px solid var(--color-border);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);
          position: relative;
          z-index: 10;
          transition: all var(--transition);
        }

        .mockup-prompt-bar-card:focus-within {
          border-color: var(--color-primary-start);
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.25), 0 10px 25px rgba(0, 0, 0, 0.12);
        }

        .mockup-prompt-bar-card.dragover {
          border-color: var(--color-primary-start);
          background: rgba(56, 189, 248, 0.10);
        }

        .prompt-bar-input-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }

        .plus-menu-container {
          position: relative;
          flex-shrink: 0;
        }

        .plus-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.30);
          color: var(--color-text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition);
        }

        .plus-action-btn:hover, .plus-action-btn.active {
          background: rgba(255, 255, 255, 0.30);
          border-color: var(--color-primary-start);
          color: var(--color-primary-start);
        }

        .plus-popover-menu {
          position: absolute;
          top: 48px;
          left: 0;
          width: 250px;
          z-index: 100;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: var(--color-surface-solid);
          backdrop-filter: var(--backdrop-blur);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
        }

        .popover-section-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .popover-item-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .popover-media-actions {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .popover-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.20);
          color: var(--color-text-primary);
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition);
        }

        .popover-action-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: var(--color-primary-start);
        }

        .prompt-text-field-container {
          flex: 1;
          display: flex;
          align-items: center;
        }

        .mockup-prompt-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-body);
          font-size: 14.5px;
          color: var(--color-text-primary);
          line-height: 1.5;
          resize: none;
          padding: 4px 0;
        }

        .prompt-bar-right-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .shortcut-pill {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.30);
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
        }

        .mockup-generate-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 22px;
          border-radius: var(--radius-pill);
          border: none;
          background: linear-gradient(135deg, #38BDF8 0%, #818CF8 50%, #C084FC 100%);
          box-shadow: 0 4px 18px rgba(129, 140, 248, 0.45);
          color: #ffffff;
          font-family: var(--font-body);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all var(--transition);
          white-space: nowrap;
        }

        .mockup-generate-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(129, 140, 248, 0.65);
        }

        .mockup-generate-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* ATTACHED MEDIA STRIP */
        .attached-media-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--color-border);
          overflow-x: auto;
        }

        .media-chip-thumb {
          position: relative;
          width: 50px;
          height: 50px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .media-chip-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-thumb {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
          color: var(--color-primary-start);
        }

        .thumb-badge {
          position: absolute;
          top: 2px;
          left: 2px;
          font-size: 9px;
          font-weight: 800;
          background: rgba(0, 0, 0, 0.7);
          color: #ffffff;
          padding: 1px 4px;
          border-radius: 3px;
        }

        .thumb-remove {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.75);
          color: #ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* HORIZONTAL PLATFORM CHIPS ROW DIRECTLY UNDER TEXTAREA */
        .mockup-platform-chips-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          flex-wrap: wrap;
          padding: 4px;
          z-index: 5;
        }

        .quick-suggestion-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          background: var(--color-surface-solid);
          border: 1px dashed var(--color-border);
          color: var(--color-text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .quick-suggestion-chip:hover {
          background: rgba(255, 255, 255, 0.25);
          color: var(--color-text-primary);
          border-color: var(--color-primary-start);
          border-style: solid;
        }

        .chip-plus-icon {
          color: var(--color-text-muted);
        }

        .quick-suggestion-chip:hover .chip-plus-icon {
          color: var(--color-primary-start);
        }

        .selected-platform-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          background: var(--color-surface-solid);
          border: 1px solid var(--brand-color, var(--color-primary-start));
          color: var(--color-text-primary);
          font-size: 12.5px;
          font-weight: 600;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        }

        .chip-label {
          font-size: 12.5px;
        }

        .chip-remove-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 2px;
          border-radius: 50%;
          transition: all 0.15s ease;
        }

        .chip-remove-btn:hover {
          color: var(--color-error);
          background: rgba(239, 68, 68, 0.15);
        }

        .platform-chip-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: var(--radius-pill);
          background: var(--color-surface-solid);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          white-space: nowrap;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .platform-chip-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
        }

        .add-more-chip-btn {
          background: rgba(56, 189, 248, 0.12);
          border-color: rgba(56, 189, 248, 0.35);
          color: var(--color-primary-start);
        }

        .add-more-chip-btn:hover {
          background: rgba(56, 189, 248, 0.25);
        }

        .more-chip-btn {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.35);
        }

        .btn-clear-all-chips {
          background: none;
          border: none;
          color: var(--color-primary-start);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 8px;
        }

        .btn-clear-all-chips:hover {
          text-decoration: underline;
        }

        @media (max-width: 1024px) {
          .mockup-studio-container.drawer-open {
            margin-right: 0;
            max-width: 900px;
          }
        }

        @media (max-width: 768px) {
          .prompt-bar-input-row {
            flex-wrap: wrap;
          }
          .mockup-generate-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}

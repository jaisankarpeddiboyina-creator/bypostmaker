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
import styles from './CreateStepPanel.module.css'

// Utility: compose CSS Module class names (handles falsy values gracefully)
const cx = (...args: (string | false | null | undefined)[]) =>
  args.filter(Boolean).join(' ')

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
    <div className={cx(
      styles['mockup-studio-container'],
      showDrawer && styles['drawer-open'],
      isGenerating && styles['disabled-locked']
    )}>
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
        <div className={styles['studio-preview-banner']}>
          <Sparkles size={14} className="text-accent" />
          <span>Interactive Studio Playground — Explore prompt features & platforms freely. Click Generate when ready to sign in.</span>
        </div>
      )}

      {isGenerating && (
        <div className={styles['studio-lock-banner']}>
          <Sparkles size={16} className="spin text-primary" />
          <span>Generating multi-platform post kit... Creation panel locked.</span>
        </div>
      )}

      {/* FLOATING UNIFIED PROMPT BAR CARD (GEMINI AI STYLE) */}
      <div
        className={cx(
          styles['mockup-prompt-bar-card'],
          'glass-card',
          isDragOver && styles['dragover'],
        )}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* TOP ATTACHED MEDIA PREVIEW ROW (GEMINI CHAT STYLE) */}
        {(imageFiles.length > 0 || videoFile) && (
          <div className={cx(styles['gemini-media-preview-row'], 'animate-fade-in')}>
            {imageFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className={styles['gemini-media-tile']} title={file.name}>
                <img src={URL.createObjectURL(file)} alt={file.name} />
                <button
                  type="button"
                  className={styles['gemini-tile-remove']}
                  onClick={() => removeImageFile(idx)}
                  disabled={isGenerating}
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {videoFile && (
              <div className={cx(styles['gemini-media-tile'], styles['video-tile'])} title={videoFile.name}>
                <Video size={24} className="video-icon" />
                <button
                  type="button"
                  className={styles['gemini-tile-remove']}
                  onClick={() => setVideoFile(null)}
                  disabled={isGenerating}
                  title="Remove video"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className={styles['prompt-bar-input-row']}>
          {/* Plus Action Menu Button */}
          <div className={styles['plus-menu-container']} ref={plusMenuRef}>
            <button
              type="button"
              className={cx(styles['plus-action-btn'], showPlusMenu && styles['active'])}
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              disabled={isGenerating}
              title="Add media or apply brand kit"
            >
              <Plus size={18} />
            </button>

            {/* Plus Action Popover Menu */}
            {showPlusMenu && (
              <div className={cx(styles['plus-popover-menu'], 'glass-card', 'animate-fade-in')}>
                <div className={styles['popover-section-title']}>
                  <Sparkles size={12} /> AI & Brand Controls
                </div>

                {/* Brand Kit Toggle */}
                <label className={cx(styles['popover-item-toggle'], useBrandKit && styles['active'])}>
                  <input
                    type="checkbox"
                    checked={useBrandKit}
                    onChange={e => setUseBrandKit(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Apply Brand Kit {brandKitName ? `(${brandKitName})` : ''}</span>
                </label>

                {/* Media Attachments */}
                <div className={styles['popover-section-title']} style={{ marginTop: 10 }}>
                  <Upload size={12} /> Attach Media
                </div>
                <div className={styles['popover-media-actions']}>
                  <button
                    type="button"
                    className={styles['popover-action-btn']}
                    onClick={() => { imageInputRef.current?.click(); setShowPlusMenu(false); }}
                    disabled={isGenerating || imageFiles.length >= 4 || !!videoFile}
                  >
                    <ImageIcon size={13} /> Upload Images ({imageFiles.length}/4)
                  </button>
                  <button
                    type="button"
                    className={styles['popover-action-btn']}
                    onClick={() => { handleOpenAssetPicker(); setShowPlusMenu(false); }}
                    disabled={isGenerating || imageFiles.length >= 4 || !!videoFile}
                  >
                    <Sparkles size={13} /> Stock Photos Library
                  </button>
                  <button
                    type="button"
                    className={styles['popover-action-btn']}
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
          <div className={styles['prompt-text-field-container']}>
            <textarea
              className={cx(styles['mockup-prompt-textarea'], 'step-prompt-textarea')}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your post, product release, or announcement..."
              rows={2}
              disabled={isGenerating}
              maxLength={2000}
            />
          </div>

          {/* Ctrl K Badge & Generate CTA */}
          <div className={styles['prompt-bar-right-actions']}>
            <div className={styles['shortcut-pill']}>
              <Command size={10} />
              <span>K</span>
            </div>

            <button
              type="button"
              className={styles['mockup-generate-btn']}
              disabled={isGenerating || !prompt.trim() || selectedPlatforms.length === 0}
              onClick={onGenerateClick}
            >
              <Sparkles size={15} />
              <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SMART CHIPS ROW DIRECTLY UNDER TEXTAREA */}
      <div className={styles['mockup-platform-chips-row']}>
        {selectedPlatforms.length === 0 ? (
          /* STATE 1: ZERO PLATFORMS SELECTED (CLEAN SUGGESTIONS) */
          <>
            {initialSuggestionPlatforms.map(platform => (
              <button
                key={platform.id}
                type="button"
                className={styles['quick-suggestion-chip']}
                onClick={() => handleQuickAdd(platform)}
                disabled={isGenerating}
                title={`Add ${platform.name}`}
              >
                <PlatformIcon id={platform.id} size={14} />
                <span className={styles['chip-label']}>{platform.name}</span>
                <Plus size={12} className={styles['chip-plus-icon']} />
              </button>
            ))}

            <button
              type="button"
              className={cx(styles['platform-chip-btn'], styles['more-chip-btn'])}
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
                className={styles['selected-platform-chip']}
                style={{ '--brand-color': platform.brandColor } as React.CSSProperties}
              >
                <PlatformIcon id={platform.id} size={15} />
                <span className={styles['chip-label']}>{platform.name}</span>
                <button
                  type="button"
                  className={styles['chip-remove-btn']}
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
              className={cx(styles['platform-chip-btn'], styles['add-more-chip-btn'])}
              onClick={() => setShowDrawer(!showDrawer)}
              disabled={isGenerating}
            >
              <Plus size={13} />
              <span>Add platform</span>
              <ChevronDown size={13} />
            </button>

            <button
              type="button"
              className={styles['btn-clear-all-chips']}
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
    </div>
  )
}

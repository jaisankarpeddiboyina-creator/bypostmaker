import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Upload, Sparkles, Check, Lock, X, Video, Lightbulb, Command, Plus, CornerDownLeft, Sliders
} from 'lucide-react'
import { PLATFORMS, isPlatformAccessible } from '@@config/platforms'
import type { PlatformTier } from '@@config/platforms'
import { useAppStore } from '../store/app'
import { api } from '../lib/api'
import { PlatformIcon } from './PlatformIcon'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'
import { BREAKPOINT_MOBILE } from '../config/breakpoints'

const VIDEO_MAX_MB = 100

interface CreateStepPanelProps {
  userPlan: PlatformTier
  onLockedClick: (platformName: string) => void
  onGenerateClick: () => void
}

const PROMPT_IDEAS = [
  { label: '🚀 Product Launch', text: 'Launching my new SaaS tool that helps creators export multi-platform social posts 10x faster. Key features include automated formatting, AI brand voices, and instant client ZIP downloads.' },
  { label: '💡 Thought Leadership', text: '5 key lessons learned scaling our startup to 10k users without spending a dollar on paid ads. Lesson 1: Build in public from day one.' },
  { label: '📢 Weekly Feature Update', text: 'Weekly product update: We just shipped dark mode, 3x faster page loads, and updated Slack integration. Try it out now!' },
  { label: '🎨 Design Showcase', text: 'Behind the scenes of our new brand redesign. How we simplified our color palette and built a high-performance design system.' },
  { label: '🔥 Customer Success Story', text: 'How Acme Corp saved 15 hours a week on content creation using PostMaker. Here is the full breakdown of their workflow.' },
]

const TONE_MODES = [
  { id: 'viral', label: '🔥 Viral Hook', prefix: 'Write with maximum engagement and a high-converting hook: ' },
  { id: 'professional', label: '💼 Executive', prefix: 'Write in a polished, authoritative executive tone: ' },
  { id: 'casual', label: '💬 Casual Founder', prefix: 'Write in a warm, authentic, builder-first voice: ' },
  { id: 'technical', label: '⚡ Deep Technical', prefix: 'Write with precise technical depth, zero fluff, and clear architectural insights: ' },
]

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

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showPromptIdeas, setShowPromptIdeas] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedTone, setSelectedTone] = useState<string | null>(null)
  const [brandKitName, setBrandKitName] = useState<string | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

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

  // Grouped platforms filtering
  const filteredPlatforms = useMemo(() => {
    if (categoryFilter === 'all') return PLATFORMS
    return PLATFORMS.filter(p => p.group === categoryFilter)
  }, [categoryFilter])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PLATFORMS.length }
    PLATFORMS.forEach(p => {
      counts[p.group] = (counts[p.group] || 0) + 1
    })
    return counts
  }, [])

  const handleSelectCategoryGroup = (group: string) => {
    if (isGenerating) return
    const groupPlatforms = PLATFORMS
      .filter(p => (group === 'all' ? true : p.group === group) && isPlatformAccessible(p.id, userPlan))
      .map(p => p.id)

    const allGroupSelected = groupPlatforms.every(id => selectedPlatforms.includes(id))
    if (allGroupSelected) {
      setSelectedPlatforms(selectedPlatforms.filter(id => !groupPlatforms.includes(id)))
    } else {
      setSelectedPlatforms(Array.from(new Set([...selectedPlatforms, ...groupPlatforms])))
    }
  }

  const applyToneMode = (toneId: string, prefix: string) => {
    if (selectedTone === toneId) {
      setSelectedTone(null)
      return
    }
    setSelectedTone(toneId)
    if (!prompt.startsWith(prefix)) {
      setPrompt(prefix + prompt.replace(/^(Write with maximum engagement|Write in a polished|Write in a warm|Write with precise technical depth)[^:]*:\s*/i, ''))
    }
  }

  return (
    <div className={`create-studio-container ${isGenerating ? 'disabled-locked' : ''}`}>
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

      {/* Studio Preview Mode Banner */}
      {!user && (
        <div className="studio-preview-banner">
          <Sparkles size={14} className="text-accent" />
          <span>Interactive Studio Playground — Explore prompt features & platforms freely. Click Generate when ready to sign in.</span>
        </div>
      )}

      {/* Generation Lock Banner */}
      {isGenerating && (
        <div className="studio-lock-banner">
          <Sparkles size={16} className="spin text-primary" />
          <span>Generating multi-platform post kit... Creation panel locked.</span>
        </div>
      )}

      {/* LIQUID WATER GLASS PROMPT CARD */}
      <div className="studio-canvas-card glass-card">
        <div className="canvas-header-row">
          <div className="canvas-title-group">
            <h1 className="canvas-heading">What would you like to create?</h1>
            <p className="canvas-sub">Describe your post topic or announcement to generate multi-platform native content</p>
          </div>

          <button
            type="button"
            className="prompt-presets-btn"
            onClick={() => setShowPromptIdeas(!showPromptIdeas)}
            disabled={isGenerating}
          >
            <Lightbulb size={13} />
            <span>Prompt Presets ✨</span>
          </button>
        </div>

        {/* Prompt Ideas Popover */}
        {showPromptIdeas && (
          <div className="prompt-presets-popover animate-fade-in glass-card">
            <div className="presets-header">
              <span>Select a preset to auto-populate prompt</span>
              <button type="button" className="btn-icon-xs" onClick={() => setShowPromptIdeas(false)}>
                <X size={13} />
              </button>
            </div>
            <div className="presets-list">
              {PROMPT_IDEAS.map((idea, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="preset-item-btn"
                  onClick={() => {
                    setPrompt(idea.text)
                    setShowPromptIdeas(false)
                  }}
                  disabled={isGenerating}
                >
                  <span className="preset-item-label">{idea.label}</span>
                  <span className="preset-item-text truncate">{idea.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Textarea */}
        <div className="prompt-textarea-wrapper">
          <textarea
            className="studio-prompt-textarea"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your post topic, product release, or announcement...&#10;&#10;e.g. Launching our new Figma asset export plugin. Highlight top 3 benefits: 10x faster exports, automatic dark mode tokens, and team cloud sync. Include a strong call to action."
            rows={5}
            disabled={isGenerating}
            maxLength={2000}
          />

          {/* Integrated Tone Preset Toolbar & Brand Kit Toggle */}
          <div className="prompt-tone-bar">
            <div className="tone-pills-left">
              <span className="tone-bar-label">
                <Sliders size={12} /> Voice Tone:
              </span>
              <div className="tone-pills-row">
                {TONE_MODES.map(tone => (
                  <button
                    key={tone.id}
                    type="button"
                    className={`tone-pill-btn ${selectedTone === tone.id ? 'active' : ''}`}
                    onClick={() => applyToneMode(tone.id, tone.prefix)}
                    disabled={isGenerating}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apple-grade Brand Kit Toggle Switch */}
            <div className="brand-kit-toggle-group">
              <label
                className={`brand-kit-toggle-switch ${useBrandKit ? 'active' : ''}`}
                title={useBrandKit ? 'AI will inject your active Brand Kit voice & guidelines' : 'Apply Brand Kit rules to AI generation'}
              >
                <input
                  type="checkbox"
                  checked={useBrandKit}
                  onChange={e => setUseBrandKit(e.target.checked)}
                  disabled={isGenerating}
                />
                <span className="switch-track">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label-text">
                  <Sparkles size={12} className={useBrandKit ? 'icon-sparkle-active' : ''} />
                  <span>Apply Brand Kit</span>
                  {brandKitName && (
                    <span className="brand-kit-badge">{brandKitName}</span>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* MEDIA ATTACHMENTS GALLERY & DROPZONE */}
        <div className="media-attachment-section">
          {imageFiles.length > 0 || videoFile ? (
            <div className="media-gallery-container">
              <div className="gallery-header">
                <span className="gallery-title">
                  Attached Media ({imageFiles.length > 0 ? `${imageFiles.length}/4 Images` : '1 Video'})
                </span>
                <button
                  type="button"
                  className="btn-link-sm text-error"
                  onClick={() => { setImageFiles([]); setVideoFile(null); }}
                  disabled={isGenerating}
                >
                  Remove All
                </button>
              </div>

              <div className="media-gallery-grid">
                {/* Image Thumbnails */}
                {imageFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="gallery-thumb-card">
                    <span className="thumb-order-tag">#{idx + 1}</span>
                    <img src={URL.createObjectURL(file)} alt="" />
                    <button
                      type="button"
                      className="thumb-delete-btn"
                      onClick={() => removeImageFile(idx)}
                      disabled={isGenerating}
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* Video Card */}
                {videoFile && (
                  <div className="gallery-thumb-card video-card">
                    <Video size={20} className="text-primary" />
                    <span className="thumb-order-tag">MP4</span>
                    <button
                      type="button"
                      className="thumb-delete-btn"
                      onClick={() => setVideoFile(null)}
                      disabled={isGenerating}
                      title="Remove video"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Add Image Button */}
                {imageFiles.length > 0 && imageFiles.length < 4 && !videoFile && (
                  <button
                    type="button"
                    className="gallery-add-tile"
                    onClick={handleOpenAssetPicker}
                    disabled={isGenerating}
                  >
                    <Plus size={18} />
                    <span>Add Image ({imageFiles.length}/4)</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`dropzone-strip ${isDragOver ? 'dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="dropzone-strip-left">
                <Upload size={15} className="text-muted" />
                <span className="dropzone-strip-text">Attach visual media (Optional)</span>
              </div>
              <div className="dropzone-strip-actions">
                <button
                  type="button"
                  className="btn-attach-pill"
                  onClick={handleOpenAssetPicker}
                  disabled={isGenerating}
                >
                  + Add Images (up to 4)
                </button>
                <button
                  type="button"
                  className="btn-attach-pill"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isGenerating}
                >
                  + Add Video MP4
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Studio Prompt Footer Bar & Primary Action CTA */}
        <div className="canvas-footer-bar">
          <div className="canvas-footer-left">
            <span className={`canvas-char-counter ${prompt.length > 1800 ? 'warning' : ''}`}>
              {prompt.length} / 2000
            </span>
            <span className="canvas-shortcut-hint">
              <Command size={11} /> + Enter
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary generate-main-btn"
            disabled={isGenerating || !prompt.trim() || selectedPlatforms.length === 0}
            onClick={onGenerateClick}
          >
            <Sparkles size={16} />
            <span>Generate Kit ({selectedPlatforms.length} Channels)</span>
            <CornerDownLeft size={14} />
          </button>
        </div>
      </div>

      {/* LIQUID WATER GLASS PLATFORM SELECTOR CARD */}
      <div className="studio-platforms-card glass-card">
        <div className="platforms-card-header">
          <div className="platforms-header-title">
            <h3>Select Target Channels ({selectedPlatforms.length} selected)</h3>
            <p>Generate perfectly tailored, native posts for every network</p>
          </div>

          <div className="platforms-header-actions">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => handleSelectCategoryGroup(categoryFilter)}
              disabled={isGenerating}
            >
              Select All in Category
            </button>
            {selectedPlatforms.length > 0 && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setSelectedPlatforms([])}
                disabled={isGenerating}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="platform-category-tabs">
          {[
            { id: 'all', label: 'All Channels' },
            { id: 'shortform', label: 'Social & Shortform' },
            { id: 'professional', label: 'Professional' },
            { id: 'video', label: 'Video & Media' },
            { id: 'community', label: 'Community' },
            { id: 'longform', label: 'Longform' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`cat-tab-btn ${categoryFilter === tab.id ? 'active' : ''}`}
              onClick={() => setCategoryFilter(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="tab-count-chip">{categoryCounts[tab.id] || 0}</span>
            </button>
          ))}
        </div>

        {/* Platform Grid */}
        <div className="studio-platform-grid">
          {filteredPlatforms.map(platform => {
            const isSelected = selectedPlatforms.includes(platform.id)
            const isAccessible = isPlatformAccessible(platform.id, userPlan)

            return (
              <button
                key={platform.id}
                type="button"
                className={[
                  'studio-platform-pill',
                  isSelected ? 'selected' : '',
                  !isAccessible ? 'locked' : ''
                ].join(' ')}
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
                <div className="pill-left">
                  <PlatformIcon id={platform.id} size={18} />
                  <span className="pill-name">{platform.name}</span>
                </div>

                <div className="pill-right">
                  {!isAccessible ? (
                    <Lock size={12} className="pill-lock-icon" />
                  ) : (
                    <span className={`pill-check ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <style>{`
        .create-studio-container {
          max-width: 920px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-bottom: 60px;
        }

        .create-studio-container.disabled-locked {
          opacity: 0.7;
          pointer-events: none;
        }

        .studio-lock-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.30);
          border-radius: var(--radius-card);
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-primary-start);
        }

        .studio-preview-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(0, 229, 163, 0.08);
          border: 1px solid rgba(0, 229, 163, 0.25);
          border-radius: var(--radius-card);
          color: var(--color-text-primary);
          font-size: 12.5px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        /* Liquid Water Drop Glass Cards */
        .studio-canvas-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
        }

        .canvas-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .canvas-title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .canvas-heading {
          font-size: 22px;
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.03em;
        }

        .canvas-sub {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .prompt-presets-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          border: 1px solid rgba(56, 189, 248, 0.30);
          background: rgba(56, 189, 248, 0.10);
          color: var(--color-primary-start);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
        }

        .prompt-presets-btn:hover {
          background: rgba(56, 189, 248, 0.18);
        }

        .prompt-presets-popover {
          position: absolute;
          top: 60px;
          right: 24px;
          width: 440px;
          max-width: calc(100% - 48px);
          z-index: 50;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: var(--color-surface-solid);
          backdrop-filter: var(--backdrop-blur);
          -webkit-backdrop-filter: var(--backdrop-blur);
          border: 1px solid var(--color-border);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.80);
        }

        .presets-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .btn-icon-xs {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
        }

        .presets-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 240px;
          overflow-y: auto;
        }

        .preset-item-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 8px 12px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--color-border);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition);
        }

        .preset-item-btn:hover {
          border-color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
        }

        .preset-item-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .preset-item-text {
          font-size: 11.5px;
          color: var(--color-text-secondary);
          width: 100%;
        }

        .prompt-textarea-wrapper {
          position: relative;
          background: var(--color-surface-inset);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-inset);
          overflow: hidden;
          transition: border-color var(--transition), box-shadow var(--transition);
        }

        .prompt-textarea-wrapper:focus-within {
          border-color: var(--color-primary-start);
          box-shadow: 0 0 24px rgba(56, 189, 248, 0.30), var(--shadow-inset);
        }

        .studio-prompt-textarea {
          width: 100%;
          background: transparent;
          border: none;
          padding: 16px;
          font-family: var(--font-body);
          font-size: 14.5px;
          color: var(--color-text-primary);
          line-height: 1.6;
          resize: vertical;
          outline: none;
        }

        .prompt-tone-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.25);
          border-top: 1px solid var(--color-border);
          flex-wrap: wrap;
        }

        .tone-pills-left {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow-x: auto;
        }

        .tone-bar-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
          white-space: nowrap;
        }

        .tone-pills-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tone-pill-btn {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid rgba(255, 255, 255, 0.40);
          color: var(--color-text-secondary);
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--transition);
        }

        .tone-pill-btn:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.35);
        }

        .tone-pill-btn.active {
          background: rgba(255, 75, 145, 0.10);
          color: var(--color-primary-start);
          border-color: rgba(255, 75, 145, 0.30);
        }

        .brand-kit-toggle-group {
          display: flex;
          align-items: center;
          margin-left: auto;
        }

        .brand-kit-toggle-switch {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid rgba(255, 255, 255, 0.40);
          cursor: pointer;
          user-select: none;
          transition: all var(--transition);
        }

        .brand-kit-toggle-switch:hover {
          background: rgba(255, 255, 255, 0.35);
          border-color: rgba(255, 255, 255, 0.50);
        }

        .brand-kit-toggle-switch.active {
          background: rgba(0, 229, 163, 0.08);
          border-color: rgba(0, 229, 163, 0.35);
        }

        .brand-kit-toggle-switch input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
          pointer-events: none;
        }

        .switch-track {
          width: 28px;
          height: 16px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.10);
          position: relative;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }

        .brand-kit-toggle-switch.active .switch-track {
          background: var(--accent);
        }

        .switch-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #FFFFFF;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }

        .brand-kit-toggle-switch.active .switch-thumb {
          transform: translateX(12px);
          background: #FFFFFF;
        }

        .switch-label-text {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--text-2);
          white-space: nowrap;
        }

        .brand-kit-toggle-switch.active .switch-label-text {
          color: var(--text-1);
        }

        .icon-sparkle-active {
          color: var(--accent);
        }

        .brand-kit-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(0, 229, 163, 0.15);
          color: var(--accent);
          border: 1px solid rgba(0, 229, 163, 0.25);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* Multi-Image Attachment Gallery */
        .media-attachment-section {
          width: 100%;
        }

        .media-gallery-container {
          background: var(--color-surface-inset);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 12px 14px;
          box-shadow: var(--shadow-inset);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .gallery-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .gallery-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .btn-link-sm {
          background: none;
          border: none;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-link-sm.text-error { color: var(--color-error); }

        .media-gallery-grid {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .gallery-thumb-card {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: #0F172A;
          border: 1px solid var(--color-border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .gallery-thumb-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .gallery-thumb-card.video-card {
          background: var(--color-nav-active-bg);
          border-color: rgba(255, 75, 145, 0.3);
        }

        .thumb-order-tag {
          position: absolute;
          top: 2px;
          left: 2px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          font-size: 9.5px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 4px;
          z-index: 2;
        }

        .thumb-delete-btn {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          transition: background var(--transition);
        }

        .thumb-delete-btn:hover {
          background: var(--color-error);
        }

        .gallery-add-tile {
          width: 120px;
          height: 72px;
          border-radius: var(--radius-sm);
          border: 1.5px dashed var(--color-border-input);
          background: rgba(255, 255, 255, 0.20);
          color: var(--color-primary-start);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all var(--transition);
        }

        .gallery-add-tile:hover {
          border-color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
        }

        .dropzone-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: var(--color-surface-inset);
          border: 1px dashed var(--color-border-input);
          border-radius: var(--radius);
          box-shadow: var(--shadow-inset);
          transition: all var(--transition);
        }

        .dropzone-strip.dragover, .dropzone-strip:hover {
          border-color: var(--color-primary-start);
          background: rgba(255, 75, 145, 0.04);
        }

        .dropzone-strip-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dropzone-strip-text {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .dropzone-strip-actions {
          display: flex;
          gap: 8px;
        }

        .btn-attach-pill {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-primary-start);
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid var(--color-border);
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          cursor: pointer;
          transition: all var(--transition);
        }

        .btn-attach-pill:hover {
          border-color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
        }

        /* Clean Studio Canvas Footer & Primary CTA */
        .canvas-footer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
        }

        .canvas-footer-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .canvas-char-counter {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--color-text-muted);
        }

        .canvas-char-counter.warning { color: var(--color-error); }

        .canvas-shortcut-hint {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          background: rgba(255, 255, 255, 0.20);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .generate-main-btn {
          height: 44px;
          padding: 0 24px;
          font-size: 14.5px;
          font-weight: 800;
        }

        /* Categorized Platform Selector Card */
        .studio-platforms-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .platforms-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .platforms-header-title h3 {
          font-size: 17px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .platforms-header-title p {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        .platforms-header-actions {
          display: flex;
          gap: 8px;
        }

        .platform-category-tabs {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .cat-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--transition);
        }

        .cat-tab-btn.active {
          background: var(--color-nav-active-bg);
          color: var(--color-primary-start);
          border-color: rgba(255, 75, 145, 0.3);
        }

        .tab-count-chip {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.35);
        }

        .studio-platform-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 10px;
        }

        /* Liquid Water Glass Platform Pill */
        .studio-platform-pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          min-height: 44px;
          border-radius: var(--radius-md);
          border: 1px solid rgba(255, 255, 255, 0.40);
          background: rgba(255, 255, 255, 0.20);
          backdrop-filter: blur(14px);
          cursor: pointer;
          transition: all var(--transition);
          text-align: left;
        }

        .studio-platform-pill:hover:not(.locked) {
          border-color: rgba(255, 75, 145, 0.30);
          background: rgba(255, 255, 255, 0.40);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.50), 0 4px 16px rgba(255, 75, 145, 0.08);
          transform: translateY(-2px);
        }

        /* Clean Selected State: Illuminated Sky Blue Rain Glow */
        .studio-platform-pill.selected {
          border-color: rgba(255, 75, 145, 0.50);
          background: rgba(255, 75, 145, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.60), 0 6px 20px rgba(255, 75, 145, 0.15);
        }

        .studio-platform-pill.locked {
          opacity: 0.4;
          cursor: not-allowed;
          background: rgba(255, 255, 255, 0.10);
        }

        .pill-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .pill-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .pill-right { flex-shrink: 0; }

        .pill-check {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 1.5px solid var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0F172A;
          transition: all var(--transition);
        }

        .pill-check.checked {
          background: var(--color-primary-start);
          border-color: var(--color-primary-start);
        }

        .pill-lock-icon { color: var(--color-text-muted); }

        @media (max-width: 640px) {
          .create-studio-container {
            padding-left: 12px;
            padding-right: 12px;
            gap: 16px;
          }
          .studio-canvas-card, .studio-platforms-card {
            padding: 16px;
          }
          .dropzone-strip {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .dropzone-strip-actions {
            width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
          }
          .canvas-footer-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .canvas-footer-left {
            justify-content: space-between;
          }
          .canvas-shortcut-hint {
            display: none;
          }
          .generate-main-btn {
            width: 100%;
            height: 48px;
            justify-content: center;
          }
          .platforms-card-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .platforms-header-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .studio-platform-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 8px;
          }
        }

        @media (max-width: ${BREAKPOINT_MOBILE}) {
          .cat-tab-btn {
            padding: 10px 16px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  )
}

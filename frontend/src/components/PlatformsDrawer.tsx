import { useState, useMemo, useEffect } from 'react'
import { X, Search, Check, Lock } from 'lucide-react'
import { PLATFORMS, isPlatformAccessible } from '@@config/platforms'
import type { PlatformTier, Platform } from '@@config/platforms'
import { PlatformIcon } from './PlatformIcon'

interface PlatformsDrawerProps {
  isOpen: boolean
  onClose: () => void
  userPlan: PlatformTier
  selectedPlatforms: string[]
  setSelectedPlatforms: (ids: string[]) => void
  isGenerating: boolean
  onLockedClick: (platformName: string) => void
}

const CATEGORY_GROUPS: { id: string; title: string; groups: string[] }[] = [
  {
    id: 'social',
    title: 'Social Media',
    groups: ['shortform', 'video'],
  },
  {
    id: 'communities',
    title: 'Communities',
    groups: ['community'],
  },
  {
    id: 'content',
    title: 'Content & Blogging',
    groups: ['longform'],
  },
  {
    id: 'professional',
    title: 'Professional & Product',
    groups: ['professional', 'design', 'audio', 'messaging'],
  },
]

export function PlatformsDrawer({
  isOpen,
  onClose,
  userPlan,
  selectedPlatforms,
  setSelectedPlatforms,
  isGenerating,
  onLockedClick,
}: PlatformsDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  const handleToggle = (platform: Platform) => {
    if (isGenerating) return
    const isAccessible = isPlatformAccessible(platform.id, userPlan)
    if (!isAccessible) {
      onLockedClick(platform.name)
      return
    }

    if (selectedPlatforms.includes(platform.id)) {
      setSelectedPlatforms(selectedPlatforms.filter(id => id !== platform.id))
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform.id])
    }
  }

  const handleSelectAllCategory = (catGroups: string[]) => {
    if (isGenerating) return
    const catPlatforms = PLATFORMS.filter(p => catGroups.includes(p.group))
    const accessibleCatIds = catPlatforms
      .filter(p => isPlatformAccessible(p.id, userPlan))
      .map(p => p.id)

    const isAllSelected = accessibleCatIds.length > 0 && accessibleCatIds.every(id => selectedPlatforms.includes(id))

    if (isAllSelected) {
      setSelectedPlatforms(selectedPlatforms.filter(id => !accessibleCatIds.includes(id)))
    } else {
      const newSelection = Array.from(new Set([...selectedPlatforms, ...accessibleCatIds]))
      setSelectedPlatforms(newSelection)
    }
  }

  const searchFilteredPlatforms = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    return PLATFORMS.filter(
      p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    )
  }, [searchQuery])

  if (!isOpen) return null

  return (
    <div className="drawer-overlay animate-fade-in" onClick={onClose}>
      <div
        className="drawer-panel glass-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <h3 className="drawer-title">All Platforms</h3>
            <p className="drawer-sub">Select platforms to generate content for.</p>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Search Field */}
        <div className="drawer-search-wrapper">
          <Search size={15} className="drawer-search-icon" />
          <input
            type="text"
            className="drawer-search-input"
            placeholder="Search platforms..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="drawer-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* List Content */}
        <div className="drawer-list-container">
          {searchFilteredPlatforms ? (
            /* Search Results */
            <div className="drawer-category-section">
              <div className="category-section-header">
                <span className="category-section-title">
                  Search Results ({searchFilteredPlatforms.length})
                </span>
              </div>
              <div className="drawer-platform-grid">
                {searchFilteredPlatforms.map(platform => (
                  <PlatformRowItem
                    key={platform.id}
                    platform={platform}
                    isSelected={selectedPlatforms.includes(platform.id)}
                    isAccessible={isPlatformAccessible(platform.id, userPlan)}
                    onToggle={() => handleToggle(platform)}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Categorized Sections */
            CATEGORY_GROUPS.map(cat => {
              const catPlatforms = PLATFORMS.filter(p => cat.groups.includes(p.group))
              if (catPlatforms.length === 0) return null

              const accessibleCatIds = catPlatforms
                .filter(p => isPlatformAccessible(p.id, userPlan))
                .map(p => p.id)
              const isAllSelected = accessibleCatIds.length > 0 && accessibleCatIds.every(id => selectedPlatforms.includes(id))

              return (
                <div key={cat.id} className="drawer-category-section">
                  <div className="category-section-header">
                    <span className="category-section-title">
                      {cat.title} ({catPlatforms.length})
                    </span>
                    <button
                      type="button"
                      className="btn-category-select-all"
                      onClick={() => handleSelectAllCategory(cat.groups)}
                    >
                      {isAllSelected ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="drawer-platform-grid">
                    {catPlatforms.map(platform => (
                      <PlatformRowItem
                        key={platform.id}
                        platform={platform}
                        isSelected={selectedPlatforms.includes(platform.id)}
                        isAccessible={isPlatformAccessible(platform.id, userPlan)}
                        onToggle={() => handleToggle(platform)}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Sticky Footer */}
        <div className="drawer-footer">
          <span className="footer-selected-text">
            {selectedPlatforms.length} {selectedPlatforms.length === 1 ? 'selected' : 'selected'}
          </span>
          <button
            type="button"
            className="btn-drawer-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>

      <style>{`
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99999;
          background: rgba(15, 23, 42, 0.15); /* Light transparent tint without heavy blur */
          display: flex;
          justify-content: flex-end;
          pointer-events: auto;
        }

        .drawer-panel {
          width: 440px;
          max-width: 100vw;
          height: 100vh;
          background: var(--color-surface-solid);
          border-left: 1px solid var(--color-border);
          box-shadow: -15px 0 45px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          padding: 24px;
          gap: 16px;
        }

        .drawer-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .drawer-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .drawer-sub {
          font-size: 12.5px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        .drawer-close-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
        }

        .drawer-close-btn:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.15);
        }

        .drawer-search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: var(--color-surface-inset);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-pill);
          padding: 0 12px;
          height: 40px;
        }

        .drawer-search-icon {
          color: var(--color-text-muted);
          margin-right: 8px;
          flex-shrink: 0;
        }

        .drawer-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--color-text-primary);
          font-size: 13.5px;
          font-family: var(--font-body);
        }

        .drawer-search-clear {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
        }

        .drawer-list-container {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-right: 4px;
        }

        .drawer-category-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .category-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 2px;
        }

        .category-section-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .btn-category-select-all {
          background: none;
          border: none;
          color: var(--color-primary-start);
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-category-select-all:hover {
          text-decoration: underline;
        }

        .drawer-platform-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .drawer-platform-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 12px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.20);
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .drawer-platform-item:hover {
          background: rgba(255, 255, 255, 0.20);
          border-color: var(--color-primary-start);
        }

        .drawer-platform-item.selected {
          border-color: var(--brand-color, var(--color-primary-start));
          background: rgba(255, 255, 255, 0.25);
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.15);
        }

        .drawer-platform-item.locked {
          opacity: 0.55;
        }

        .item-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .item-name {
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-checkbox {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1.5px solid var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }

        .item-checkbox.checked {
          background: var(--color-primary-start);
          border-color: var(--color-primary-start);
          color: #ffffff;
        }

        .drawer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
        }

        .footer-selected-text {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .btn-drawer-done {
          padding: 8px 24px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--gradient-primary);
          color: #ffffff;
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(56, 189, 248, 0.35);
        }

        .btn-drawer-done:hover {
          box-shadow: 0 6px 20px rgba(56, 189, 248, 0.50);
        }

        @media (max-width: 768px) {
          .drawer-overlay {
            align-items: flex-end;
            justify-content: center;
          }
          .drawer-panel {
            width: 100%;
            max-width: 100%;
            height: 90dvh;
            border-left: none;
            border-top: 1px solid var(--color-border);
            border-radius: 20px 20px 0 0;
            padding: 20px 16px 16px;
          }
          .drawer-platform-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 480px) {
          .drawer-platform-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function PlatformRowItem({
  platform,
  isSelected,
  isAccessible,
  onToggle,
}: {
  platform: Platform
  isSelected: boolean
  isAccessible: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`drawer-platform-item ${isSelected ? 'selected' : ''} ${!isAccessible ? 'locked' : ''}`}
      style={isSelected ? ({ '--brand-color': platform.brandColor } as React.CSSProperties) : undefined}
      onClick={onToggle}
    >
      <div className="item-left">
        <PlatformIcon id={platform.id} size={16} />
        <span className="item-name">{platform.name}</span>
      </div>

      {!isAccessible ? (
        <Lock size={12} className="text-muted" />
      ) : (
        <span className={`item-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && <Check size={10} strokeWidth={3} />}
        </span>
      )}
    </button>
  )
}

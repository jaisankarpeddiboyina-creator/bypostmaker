import { useState, useMemo } from 'react'
import { X, Check, Lock } from 'lucide-react'
import { PLATFORMS, isPlatformAccessible } from '@@config/platforms'
import type { PlatformTier } from '@@config/platforms'
import { PlatformIcon } from './PlatformIcon'

interface AllPlatformsModalProps {
  isOpen: boolean
  onClose: () => void
  userPlan: PlatformTier
  selectedPlatforms: string[]
  togglePlatform: (id: string) => void
  setSelectedPlatforms: (ids: string[]) => void
  isGenerating: boolean
  onLockedClick: (platformName: string) => void
}

export function AllPlatformsModal({
  isOpen,
  onClose,
  userPlan,
  selectedPlatforms,
  togglePlatform,
  setSelectedPlatforms,
  isGenerating,
  onLockedClick,
}: AllPlatformsModalProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filteredPlatforms = useMemo(() => {
    if (categoryFilter === 'all') return PLATFORMS
    return PLATFORMS.filter(p => p.group === categoryFilter)
  }, [categoryFilter])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PLATFORMS.length }
    PLATFORMS.forEach(p => {
      counts[p.group] = (counts[p.group] || 0) + 1
    })
    return counts
  }, [])

  if (!isOpen) return null

  const handleSelectCategoryGroup = () => {
    if (isGenerating) return
    const groupPlatforms = filteredPlatforms
      .filter(p => isPlatformAccessible(p.id, userPlan))
      .map(p => p.id)

    const allGroupSelected = groupPlatforms.every(id => selectedPlatforms.includes(id))
    if (allGroupSelected) {
      setSelectedPlatforms(selectedPlatforms.filter(id => !groupPlatforms.includes(id)))
    } else {
      setSelectedPlatforms(Array.from(new Set([...selectedPlatforms, ...groupPlatforms])))
    }
  }

  return (
    <div className="all-platforms-modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card all-platforms-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>Select Target Channels ({selectedPlatforms.length} selected)</h3>
            <p>Choose networks to publish platform-native content</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="platform-category-tabs">
          {[
            { id: 'all', label: 'All Channels' },
            { id: 'shortform', label: 'Social & Shortform' },
            { id: 'professional', label: 'Professional' },
            { id: 'video', label: 'Video & Media' },
            { id: 'community', label: 'Community' },
            { id: 'longform', label: 'Longform' },
            { id: 'messaging', label: 'Messaging' },
            { id: 'design', label: 'Design' },
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

        {/* Category Quick Actions */}
        <div className="modal-actions-bar">
          <button
            type="button"
            className="btn-ghost btn-xs"
            onClick={handleSelectCategoryGroup}
            disabled={isGenerating}
          >
            Select All in Category
          </button>
          {selectedPlatforms.length > 0 && (
            <button
              type="button"
              className="btn-ghost btn-xs text-error"
              onClick={() => setSelectedPlatforms([])}
              disabled={isGenerating}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Platform Grid */}
        <div className="modal-platform-grid">
          {filteredPlatforms.map(platform => {
            const isSelected = selectedPlatforms.includes(platform.id)
            const isAccessible = isPlatformAccessible(platform.id, userPlan)

            return (
              <button
                key={platform.id}
                type="button"
                className={`studio-platform-pill ${isSelected ? 'selected' : ''} ${!isAccessible ? 'locked' : ''}`}
                style={isSelected ? ({ '--brand-color': platform.brandColor } as React.CSSProperties) : undefined}
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
        .all-platforms-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99999;
          background: rgba(15, 23, 42, 0.50);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .all-platforms-modal {
          max-width: 780px;
          width: 90%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
          gap: 16px;
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .modal-title-group h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .modal-title-group p {
          font-size: 12.5px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        .modal-close-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
        }

        .modal-close-btn:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.15);
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
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: var(--color-text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--transition);
        }

        .cat-tab-btn:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.25);
        }

        .cat-tab-btn.active {
          background: var(--color-primary-start);
          color: #ffffff;
          border-color: var(--color-primary-start);
        }

        .tab-count-chip {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.20);
        }

        .modal-actions-bar {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .modal-platform-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 10px;
          overflow-y: auto;
          max-height: 480px;
          padding-right: 4px;
        }

        .studio-platform-pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: var(--radius-card);
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .studio-platform-pill:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
        }

        .studio-platform-pill.selected {
          border-color: var(--brand-color, var(--color-primary-start));
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.25);
          background: rgba(255, 255, 255, 0.30);
        }

        .studio-platform-pill.locked {
          opacity: 0.55;
        }

        .pill-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pill-name {
          font-size: 13px;
          font-weight: 600;
        }

        .pill-check {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid var(--color-text-placeholder);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pill-check.checked {
          background: var(--brand-color, var(--color-primary-start));
          border-color: var(--brand-color, var(--color-primary-start));
          color: #ffffff;
        }

        .pill-lock-icon {
          color: var(--color-text-placeholder);
        }
      `}</style>
    </div>
  )
}

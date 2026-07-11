import { useState } from 'react'
import { Lock } from 'lucide-react'
import { PLATFORMS, isPlatformAccessible } from '@@config/platforms'
import type { PlatformTier } from '@@config/platforms'
import { useAppStore } from '../store/app'
import { PlatformIcon } from './PlatformIcon'

// Platform brand colors for glow effect on selection
const PLATFORM_COLORS: Record<string, string> = {
  twitter:      '#1DA1F2',
  threads:      '#ffffff',
  bluesky:      '#0085ff',
  mastodon:     '#6364ff',
  snapchat:     '#FFFC00',
  linkedin:     '#0A66C2',
  facebook:     '#1877F2',
  reddit:       '#FF4500',
  hackernews:   '#FF6600',
  producthunt:  '#DA552F',
  indiehackers: '#0e2150',
  betalist:     '#2980b9',
  discord:      '#5865F2',
  medium:       '#ffffff',
  substack:     '#FF6719',
  quora:        '#B92B27',
  devto:        '#ffffff',
  hashnode:     '#2962FF',
  github:       '#ffffff',
  stackoverflow:'#F48024',
  instagram:    '#E1306C',
  tiktok:       '#69C9D0',
  youtube:      '#FF0000',
  youtubeshorts:'#FF0000',
  pinterest:    '#E60023',
  twitch:       '#9146FF',
  clubhouse:    '#F3E7D1',
  dribbble:     '#EA4C89',
  behance:      '#1769FF',
  telegram:     '#2AABEE',
  slack:        '#4A154B',
  whatsapp:     '#25D366',
  lemon8:       '#FFD700',
}

interface PlatformRailProps {
  userPlan: PlatformTier
  onLockedClick: (platformName: string) => void
}

export function PlatformRail({ userPlan, onLockedClick }: PlatformRailProps) {
  const { selectedPlatforms, togglePlatform } = useAppStore()
  const [tooltip, setTooltip] = useState<{ id: string; label: string } | null>(null)

  // Group platforms for visual separation in the rail
  const groups = [
    { label: 'Short form', ids: ['twitter','threads','bluesky','mastodon','snapchat'] },
    { label: 'Professional', ids: ['linkedin','facebook'] },
    { label: 'Community', ids: ['reddit','hackernews','producthunt','indiehackers','betalist','discord'] },
    { label: 'Long form', ids: ['medium','substack','quora'] },
    { label: 'Dev', ids: ['devto','hashnode','github','stackoverflow'] },
    { label: 'Video', ids: ['instagram','tiktok','youtube','youtubeshorts','pinterest','twitch'] },
    { label: 'Audio', ids: ['clubhouse'] },
    { label: 'Design', ids: ['dribbble','behance'] },
    { label: 'Messaging', ids: ['telegram','slack','whatsapp'] },
    { label: 'Lifestyle', ids: ['lemon8'] },
  ]

  return (
    <div className="platform-rail">
      <div className="platform-rail-scroll">
        {groups.map((group, gi) => (
          <div key={group.label} className="platform-group">
            {gi > 0 && <div className="rail-divider" />}
            {group.ids.map(id => {
              const platform = PLATFORMS.find(p => p.id === id)
              if (!platform) return null

              const isSelected = selectedPlatforms.includes(id)
              const isAccessible = isPlatformAccessible(id, userPlan)
              const color = PLATFORM_COLORS[id] ?? '#7c3aed'

              return (
                <div key={id} className="platform-pill-wrapper">
                  <button
                    className={[
                      'platform-pill',
                      isSelected ? 'selected' : '',
                      !isAccessible ? 'locked' : '',
                    ].join(' ')}
                    style={isSelected ? { '--platform-color': color } as React.CSSProperties : {}}
                    onClick={() => {
                      if (!isAccessible) {
                        onLockedClick(platform.name)
                        return
                      }
                      togglePlatform(id)
                    }}
                    onMouseEnter={() => setTooltip({ id, label: platform.name })}
                    onMouseLeave={() => setTooltip(null)}
                    aria-label={`${platform.name}${!isAccessible ? ' (upgrade required)' : ''}`}
                    aria-pressed={isSelected}
                  >
                    <span className="platform-pill-icon">
                      <PlatformIcon id={id} size={16} />
                    </span>
                    <span className="platform-pill-name">{platform.name}</span>
                    {!isAccessible && (
                      <span className="platform-pill-lock">
                        <Lock size={10} />
                      </span>
                    )}
                  </button>

                  {/* Tooltip */}
                  {tooltip?.id === id && !isAccessible && (
                    <div className="platform-tooltip">
                      Upgrade to a paid plan to unlock this platform
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selection count */}
      {selectedPlatforms.length > 0 && (
        <div className="rail-selection-count">
          {selectedPlatforms.length} selected
          <button
            className="rail-clear"
            onClick={() => useAppStore.getState().setSelectedPlatforms([])}
          >
            Clear
          </button>
        </div>
      )}

      <style>{`
        .platform-rail {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 20px;
          height: 64px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
          position: relative;
        }

        .platform-rail-scroll {
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
          flex: 1;
          padding-bottom: 6px;
        }
        .platform-rail-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .platform-rail-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .platform-rail-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 99px;
        }
        .platform-rail-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--text-4);
        }

        .platform-group {
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }

        .rail-divider {
          width: 1px;
          height: 20px;
          background: var(--border);
          margin: 0 6px;
          flex-shrink: 0;
        }

        .platform-pill-wrapper {
          position: relative;
        }

        .platform-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 99px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-3);
          cursor: pointer;
          transition: all 150ms ease;
          font-size: 12px;
          font-family: var(--font-body);
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .platform-pill:hover:not(.locked) {
          border-color: var(--border-light);
          color: var(--text-1);
          background: var(--card);
        }

        .platform-pill.selected {
          background: color-mix(in srgb, var(--platform-color) 12%, transparent);
          border-color: color-mix(in srgb, var(--platform-color) 40%, transparent);
          color: var(--text-1);
        }

        .platform-pill.locked {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .platform-pill.locked:hover {
          opacity: 0.6;
          border-color: var(--border-light);
          color: var(--text-2);
        }

        .platform-pill-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .platform-pill-name {
          line-height: 1;
        }

        .platform-pill-lock {
          display: flex;
          align-items: center;
          opacity: 0.6;
        }

        .platform-tooltip {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          color: var(--text-2);
          white-space: nowrap;
          z-index: 100;
          pointer-events: none;
        }

        .rail-selection-count {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-3);
          white-space: nowrap;
          flex-shrink: 0;
          padding-left: 12px;
          border-left: 1px solid var(--border);
        }

        .rail-clear {
          background: none;
          border: none;
          color: var(--accent);
          font-size: 12px;
          cursor: pointer;
          font-family: var(--font-body);
          padding: 0;
        }
        .rail-clear:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

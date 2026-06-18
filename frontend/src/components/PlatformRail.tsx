import { useState } from 'react'
import { Lock } from 'lucide-react'
import { PLATFORMS, isPlatformAccessible } from '../config/platforms'
import type { PlatformTier } from '../config/platforms'
import { useAppStore } from '../store/app'

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

// Simple SVG icon components — lightweight, no icon library needed
function PlatformIcon({ id, size = 18 }: { id: string; size?: number }) {
  const icons: Record<string, JSX.Element> = {
    twitter: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    linkedin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    instagram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    github: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </svg>
    ),
  }

  // Default dot icon for platforms without custom SVG
  return icons[id] ?? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.6"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10" fill="white" fontWeight="600">
        {id.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  )
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
                      {platform.tier === 'pro' ? 'Pro' : platform.tier === 'business' ? 'Business' : 'Starter'} plan
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
          scrollbar-width: none;
          flex: 1;
        }
        .platform-rail-scroll::-webkit-scrollbar { display: none; }

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

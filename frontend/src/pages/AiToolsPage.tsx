import { useState } from 'react'
import { Search, ArrowRight } from 'lucide-react'
import { PLATFORMS, type PlatformGroup, type Platform } from '@@config/platforms'
import { PlatformIcon } from '../components/PlatformIcon'
import styles from './AiToolsPage.module.css'

const GROUP_LABELS: Record<PlatformGroup, string> = {
  shortform: 'Social & Shortform',
  professional: 'Professional',
  community: 'Community & Founder',
  longform: 'Longform & Publishing',
  video: 'Video & Reels',
  audio: 'Audio',
  design: 'Design & Creative',
  messaging: 'Messaging',
}

const GROUP_ORDER: PlatformGroup[] = [
  'shortform',
  'professional',
  'community',
  'longform',
  'video',
  'audio',
  'design',
  'messaging',
]

const SUBDOMAIN_ALIASES: Record<string, string> = {
  twitter: 'x',
}

function getSubdomainUrl(platformId: string): string {
  const subdomain = SUBDOMAIN_ALIASES[platformId] || platformId
  if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    const port = window.location.port ? `:${window.location.port}` : ''
    return `http://${subdomain}.localhost${port}`
  }
  return `https://${subdomain}.bypostamaker.com`
}

export default function AiToolsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<'all' | PlatformGroup>('all')

  const filteredPlatforms = PLATFORMS.filter(platform => {
    const matchesSearch = searchQuery.trim() === '' ||
      platform.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      platform.id.toLowerCase().includes(searchQuery.toLowerCase().trim())

    const matchesGroup = selectedGroup === 'all' || platform.group === selectedGroup

    return matchesSearch && matchesGroup
  })

  // Distinct groups present in filtered results
  const activeGroups = GROUP_ORDER.filter(group => {
    return filteredPlatforms.some(p => p.group === group)
  })

  return (
    <div className={styles.pageContainer}>
      <div className={styles.maxContainer}>
        {/* Header Section */}
        <div className={styles.headerSection}>
          <div className={styles.titleRow}>
            <h1 className={styles.mainTitle}>Tools</h1>
            <span className={styles.countBadge}>
              {filteredPlatforms.length} {filteredPlatforms.length === 1 ? 'Tool' : 'Tools'}
            </span>
          </div>
          <p className={styles.subTitle}>
            Create amazing platform-native content for every network. Choose a platform to generate instant posts.
          </p>
        </div>

        {/* Search & Category Filter Section */}
        <div className={styles.controlsSection}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search platforms (e.g. LinkedIn, X / Twitter, Instagram...)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Category Tabs */}
          <div className={styles.tabsRow}>
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`${styles.tabBtn} ${selectedGroup === 'all' ? styles.activeTabBtn : ''}`}
            >
              All
              <span className={styles.countBadge}>{PLATFORMS.length}</span>
            </button>

            {GROUP_ORDER.map(groupKey => {
              const count = PLATFORMS.filter(p => p.group === groupKey).length
              return (
                <button
                  key={groupKey}
                  type="button"
                  onClick={() => setSelectedGroup(groupKey)}
                  className={`${styles.tabBtn} ${selectedGroup === groupKey ? styles.activeTabBtn : ''}`}
                >
                  {GROUP_LABELS[groupKey]}
                  <span className={styles.countBadge}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tools Cards Grid */}
        {filteredPlatforms.length === 0 ? (
          <div className={styles.emptyState}>
            No platforms found matching "{searchQuery}". Try a different search term.
          </div>
        ) : selectedGroup === 'all' && searchQuery.trim() === '' ? (
          /* Render by Category Sections when All is selected */
          activeGroups.map(groupKey => {
            const groupPlatforms = filteredPlatforms.filter(p => p.group === groupKey)
            if (groupPlatforms.length === 0) return null

            return (
              <div key={groupKey} className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>{GROUP_LABELS[groupKey]}</h2>
                  <span className={styles.sectionCount}>({groupPlatforms.length})</span>
                </div>

                <div className={styles.toolsGrid}>
                  {groupPlatforms.map(platform => (
                    <ToolCard key={platform.id} platform={platform} />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          /* Flat Grid for Filtered / Searched View */
          <div className={styles.toolsGrid}>
            {filteredPlatforms.map(platform => (
              <ToolCard key={platform.id} platform={platform} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCard({ platform }: { platform: Platform }) {
  const url = getSubdomainUrl(platform.id)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.toolCard}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardIconBox}>
          <PlatformIcon id={platform.id} size={24} useBrandColor />
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.cardName}>{platform.name}</span>
          <span className={styles.cardGroupLabel}>{GROUP_LABELS[platform.group]}</span>
        </div>
      </div>

      <div className={styles.openBtn}>
        <span>Open</span>
        <ArrowRight size={14} />
      </div>
    </a>
  )
}

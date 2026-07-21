import React from 'react'
import {
  SiX, SiThreads, SiBluesky, SiMastodon, SiSnapchat,
  SiFacebook, SiReddit, SiYcombinator, SiProducthunt, SiIndiehackers,
  SiDiscord, SiMedium, SiSubstack, SiQuora, SiDevdotto,
  SiHashnode, SiGithub, SiStackoverflow, SiInstagram, SiTiktok,
  SiYoutube, SiYoutubeshorts, SiPinterest, SiTwitch, SiClubhouse,
  SiDribbble, SiBehance, SiTelegram, SiWhatsapp
} from '@icons-pack/react-simple-icons'
import { PLATFORM_MAP } from '@@config/platforms'

const ICON_MAP: Record<string, React.ComponentType<{ size?: string | number; color?: string; title?: string }>> = {
  twitter:      SiX,
  threads:      SiThreads,
  bluesky:      SiBluesky,
  mastodon:     SiMastodon,
  snapchat:     SiSnapchat,
  facebook:     SiFacebook,
  reddit:       SiReddit,
  hackernews:   SiYcombinator,
  producthunt:  SiProducthunt,
  indiehackers: SiIndiehackers,
  discord:      SiDiscord,
  medium:       SiMedium,
  substack:     SiSubstack,
  quora:        SiQuora,
  devto:        SiDevdotto,
  hashnode:     SiHashnode,
  github:       SiGithub,
  stackoverflow: SiStackoverflow,
  instagram:    SiInstagram,
  tiktok:       SiTiktok,
  youtube:      SiYoutube,
  youtubeshorts: SiYoutubeshorts,
  pinterest:    SiPinterest,
  twitch:       SiTwitch,
  clubhouse:    SiClubhouse,
  dribbble:     SiDribbble,
  behance:      SiBehance,
  telegram:     SiTelegram,
  whatsapp:     SiWhatsapp,
}

function LinkedInIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

export function PlatformIcon({
  id,
  size = 24,
  color,
  useBrandColor = true,
}: {
  id: string
  size?: number
  color?: string
  useBrandColor?: boolean
}) {
  const brandColor = PLATFORM_MAP[id]?.brandColor ?? '#7c3aed'
  const effectiveColor = color ?? (useBrandColor ? brandColor : 'currentColor')

  if (id === 'linkedin') return <LinkedInIcon size={size} color={effectiveColor} />

  const Icon = ICON_MAP[id]
  if (Icon) return <Icon size={size} color={effectiveColor} title={id} />

  // Fallback for slack, lemon8, betalist — letter in circle
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill={effectiveColor} opacity="0.9" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
        {id.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  )
}

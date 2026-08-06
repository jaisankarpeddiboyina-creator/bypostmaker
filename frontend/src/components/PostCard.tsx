import { lazy, Suspense, memo, useRef, useCallback, useEffect } from 'react'
import type { CardProps } from './cards/types'
import { CardSkeleton, CardGenerating, CardError } from './cards/CardStates'
import { api } from '../lib/api'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore } from '../store/app'

const cardMap: Record<string, React.LazyExoticComponent<React.ComponentType<CardProps>>> = {
  instagram: lazy(() => import('./cards/InstagramCard').then(m => ({ default: m.InstagramCard }))),
  twitter: lazy(() => import('./cards/TwitterCard').then(m => ({ default: m.TwitterCard }))),
  x: lazy(() => import('./cards/TwitterCard').then(m => ({ default: m.TwitterCard }))),
  threads: lazy(() => import('./cards/ThreadsCard').then(m => ({ default: m.ThreadsCard }))),
  linkedin: lazy(() => import('./cards/LinkedInCard').then(m => ({ default: m.LinkedInCard }))),
  reddit: lazy(() => import('./cards/RedditCard').then(m => ({ default: m.RedditCard }))),
  facebook: lazy(() => import('./cards/FacebookCard').then(m => ({ default: m.FacebookCard }))),
  tiktok: lazy(() => import('./cards/TikTokCard').then(m => ({ default: m.TikTokCard }))),
  youtube: lazy(() => import('./cards/YouTubeCard').then(m => ({ default: m.YouTubeCard }))),
  pinterest: lazy(() => import('./cards/PinterestCard').then(m => ({ default: m.PinterestCard }))),
  producthunt: lazy(() => import('./cards/ProductHuntCard').then(m => ({ default: m.ProductHuntCard }))),
  bluesky: lazy(() => import('./cards/BlueskyCard').then(m => ({ default: m.BlueskyCard }))),
  hackernews: lazy(() => import('./cards/HackerNewsCard').then(m => ({ default: m.HackerNewsCard }))),
  medium: lazy(() => import('./cards/MediumCard').then(m => ({ default: m.MediumCard }))),
  devto: lazy(() => import('./cards/DevToCard').then(m => ({ default: m.DevToCard }))),
  mastodon: lazy(() => import('./cards/MastodonCard').then(m => ({ default: m.MastodonCard }))),
  discord: lazy(() => import('./cards/DiscordCard').then(m => ({ default: m.DiscordCard }))),
  slack: lazy(() => import('./cards/SlackCard').then(m => ({ default: m.SlackCard }))),
  telegram: lazy(() => import('./cards/TelegramCard').then(m => ({ default: m.TelegramCard }))),
  github: lazy(() => import('./cards/GitHubCard').then(m => ({ default: m.GitHubCard }))),
  substack: lazy(() => import('./cards/SubstackCard').then(m => ({ default: m.SubstackCard }))),
  indiehackers: lazy(() => import('./cards/IndieHackersCard').then(m => ({ default: m.IndieHackersCard }))),
  whatsapp: lazy(() => import('./cards/WhatsAppCard').then(m => ({ default: m.WhatsAppCard }))),
  dribbble: lazy(() => import('./cards/DribbbleCard').then(m => ({ default: m.DribbbleCard }))),
  stackoverflow: lazy(() => import('./cards/StackOverflowCard').then(m => ({ default: m.StackOverflowCard }))),
  quora: lazy(() => import('./cards/QuoraCard').then(m => ({ default: m.QuoraCard }))),
  hashnode: lazy(() => import('./cards/HashnodeCard').then(m => ({ default: m.HashnodeCard }))),
  youtubeshorts: lazy(() => import('./cards/YouTubeShortsCard').then(m => ({ default: m.YouTubeShortsCard }))),
  twitch: lazy(() => import('./cards/TwitchCard').then(m => ({ default: m.TwitchCard }))),
  snapchat: lazy(() => import('./cards/SnapchatCard').then(m => ({ default: m.SnapchatCard }))),
  lemon8: lazy(() => import('./cards/Lemon8Card').then(m => ({ default: m.Lemon8Card }))),
  betalist: lazy(() => import('./cards/BetaListCard').then(m => ({ default: m.BetaListCard }))),
  behance: lazy(() => import('./cards/BehanceCard').then(m => ({ default: m.BehanceCard }))),
  clubhouse: lazy(() => import('./cards/ClubhouseCard').then(m => ({ default: m.ClubhouseCard }))),
}

const StandardCardLazy = lazy(() => import('./cards/StandardCard').then(m => ({ default: m.StandardCard })))

function CardFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 470,
        height: 220,
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: 14,
        gap: 12,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ height: 16, width: 120, background: '#F1F5F9', borderRadius: 4 }} className="shimmer" />
        <div style={{ height: 16, width: 60, background: '#F1F5F9', borderRadius: 4 }} className="shimmer" />
      </div>
      <div style={{ height: 12, width: '90%', background: '#F1F5F9', borderRadius: 4 }} className="shimmer" />
      <div style={{ height: 12, width: '75%', background: '#F1F5F9', borderRadius: 4 }} className="shimmer" />
      <div style={{ height: 12, width: '50%', background: '#F1F5F9', borderRadius: 4 }} className="shimmer" />
    </div>
  )
}

if (typeof window !== 'undefined' && window.URL && !((window.URL as any).__postmakerPatched)) {
  const originalCreate = window.URL.createObjectURL
  window.URL.createObjectURL = function (obj: any) {
    if (obj && obj.__urlOverride) {
      return obj.__urlOverride
    }
    return originalCreate(obj)
  }
  ;(window.URL as any).__postmakerPatched = true
}

function PostCardBase(props: CardProps) {
  const { updatePost, addToast } = useAppStore()
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  const handleRetry = useCallback(async () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    updatePost(props.platformId, { status: 'generating', content: '', errorMessage: undefined, statusText: 'Retrying...' })

    let active = true
    retryTimeoutRef.current = setTimeout(() => {
      if (active) {
        active = false
        updatePost(props.platformId, { status: 'error', errorMessage: 'Retry timed out.' })
        addToast('Retry timed out', 'error')
      }
    }, 45000)

    try {
      const result = await api.generate.retry(props.campaignId, props.platformId)
      if (active) {
        active = false
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
        updatePost(props.platformId, { content: result.content, status: 'done', statusText: undefined })
      }
    } catch (err: any) {
      if (active) {
        active = false
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
        updatePost(props.platformId, { status: 'error', errorMessage: err.message ?? 'Generation failed' })
      }
    }
  }, [props.platformId, props.campaignId, updatePost, addToast])

  const post = props.post
  const platform = PLATFORM_MAP[props.platformId]
  const brandColor = platform?.brandColor || '#F72585'

  if (post.status === 'pending') {
    return <CardSkeleton statusText={post.statusText} />
  }
  if (post.status === 'generating') {
    return <CardGenerating name={platform?.name ?? props.platformId} statusText={post.statusText} />
  }
  if (post.status === 'error') {
    return (
      <CardError
        name={platform?.name ?? props.platformId}
        message={post.errorMessage ?? 'Generation failed'}
        brandColor={brandColor}
        onRetry={handleRetry}
      />
    )
  }

  const CardComponent = cardMap[props.platformId] || StandardCardLazy

  const imageFiles = props.imageFiles.length > 0
    ? props.imageFiles
    : (props.imageUrls || []).map(url => {
        const blob = new Blob([], { type: 'image/jpeg' }) as any
        blob.__urlOverride = url
        blob.name = 'image.jpg'
        blob.lastModified = Date.now()
        return blob as File
      })

  return (
    <Suspense fallback={<CardFallback />}>
      <CardComponent {...props} imageFiles={imageFiles} />
    </Suspense>
  )
}

export const PostCard = memo(PostCardBase, (prev, next) => {
  return (
    prev.platformId === next.platformId &&
    prev.post.content === next.post.content &&
    prev.post.edited === next.post.edited &&
    prev.post.status === next.post.status &&
    prev.post.statusText === next.post.statusText &&
    prev.post.errorMessage === next.post.errorMessage &&
    prev.campaignId === next.campaignId &&
    prev.imageFiles.length === next.imageFiles.length &&
    prev.videoFile === next.videoFile &&
    (prev.imageUrls || []).join(',') === (next.imageUrls || []).join(',')
  )
})

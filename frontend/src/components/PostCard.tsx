import { InstagramCard } from './cards/InstagramCard'
import { TwitterCard } from './cards/TwitterCard'
import { ThreadsCard } from './cards/ThreadsCard'
import { LinkedInCard } from './cards/LinkedInCard'
import { RedditCard } from './cards/RedditCard'
import { FacebookCard } from './cards/FacebookCard'
import { TikTokCard } from './cards/TikTokCard'
import { YouTubeCard } from './cards/YouTubeCard'
import { PinterestCard } from './cards/PinterestCard'
import { ProductHuntCard } from './cards/ProductHuntCard'
import { BlueskyCard } from './cards/BlueskyCard'
import { HackerNewsCard } from './cards/HackerNewsCard'
import { MediumCard } from './cards/MediumCard'
import { DevToCard } from './cards/DevToCard'
import { MastodonCard } from './cards/MastodonCard'
import { DiscordCard } from './cards/DiscordCard'
import { SlackCard } from './cards/SlackCard'
import { TelegramCard } from './cards/TelegramCard'
import { GitHubCard } from './cards/GitHubCard'
import { SubstackCard } from './cards/SubstackCard'
import { IndieHackersCard } from './cards/IndieHackersCard'
import { WhatsAppCard } from './cards/WhatsAppCard'
import { DribbbleCard } from './cards/DribbbleCard'
import { StackOverflowCard } from './cards/StackOverflowCard'
import { QuoraCard } from './cards/QuoraCard'
import { HashnodeCard } from './cards/HashnodeCard'
import { YouTubeShortsCard } from './cards/YouTubeShortsCard'
import { TwitchCard } from './cards/TwitchCard'
import { SnapchatCard } from './cards/SnapchatCard'
import { Lemon8Card } from './cards/Lemon8Card'
import { BetaListCard } from './cards/BetaListCard'
import { BehanceCard } from './cards/BehanceCard'
import { ClubhouseCard } from './cards/ClubhouseCard'
import { StandardCard } from './cards/StandardCard'
import type { CardProps } from './cards/types'

export function PostCard(props: CardProps) {
  const { platformId } = props

  if (platformId === 'instagram') {
    return <InstagramCard {...props} />
  }

  if (platformId === 'twitter' || platformId === 'x') {
    return <TwitterCard {...props} />
  }

  if (platformId === 'threads') {
    return <ThreadsCard {...props} />
  }

  if (platformId === 'linkedin') {
    return <LinkedInCard {...props} />
  }

  if (platformId === 'reddit') {
    return <RedditCard {...props} />
  }

  if (platformId === 'facebook') {
    return <FacebookCard {...props} />
  }

  if (platformId === 'tiktok') {
    return <TikTokCard {...props} />
  }

  if (platformId === 'youtube') {
    return <YouTubeCard {...props} />
  }

  if (platformId === 'pinterest') {
    return <PinterestCard {...props} />
  }

  if (platformId === 'producthunt') {
    return <ProductHuntCard {...props} />
  }

  if (platformId === 'bluesky') {
    return <BlueskyCard {...props} />
  }

  if (platformId === 'hackernews') {
    return <HackerNewsCard {...props} />
  }

  if (platformId === 'medium') {
    return <MediumCard {...props} />
  }

  if (platformId === 'devto') {
    return <DevToCard {...props} />
  }

  if (platformId === 'mastodon') {
    return <MastodonCard {...props} />
  }

  if (platformId === 'discord') {
    return <DiscordCard {...props} />
  }

  if (platformId === 'slack') {
    return <SlackCard {...props} />
  }

  if (platformId === 'telegram') {
    return <TelegramCard {...props} />
  }

  if (platformId === 'github') {
    return <GitHubCard {...props} />
  }

  if (platformId === 'substack') {
    return <SubstackCard {...props} />
  }

  if (platformId === 'indiehackers') {
    return <IndieHackersCard {...props} />
  }

  if (platformId === 'whatsapp') {
    return <WhatsAppCard {...props} />
  }

  if (platformId === 'dribbble') {
    return <DribbbleCard {...props} />
  }

  if (platformId === 'stackoverflow') {
    return <StackOverflowCard {...props} />
  }

  if (platformId === 'quora') {
    return <QuoraCard {...props} />
  }

  if (platformId === 'hashnode') {
    return <HashnodeCard {...props} />
  }

  if (platformId === 'youtubeshorts') {
    return <YouTubeShortsCard {...props} />
  }

  if (platformId === 'twitch') {
    return <TwitchCard {...props} />
  }

  if (platformId === 'snapchat') {
    return <SnapchatCard {...props} />
  }

  if (platformId === 'lemon8') {
    return <Lemon8Card {...props} />
  }

  if (platformId === 'betalist') {
    return <BetaListCard {...props} />
  }

  if (platformId === 'behance') {
    return <BehanceCard {...props} />
  }

  if (platformId === 'clubhouse') {
    return <ClubhouseCard {...props} />
  }

  return <StandardCard {...props} />
}

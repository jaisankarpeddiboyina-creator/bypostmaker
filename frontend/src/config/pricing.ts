// frontend/src/config/pricing.ts
// Single source of truth for pricing plans.
// Imported by both LandingPage (homepage pricing section) and PricingPage
// (the standalone /pricing route) so the two can never drift out of sync —
// see project history: a prior duplicate JSON-LD block shipped a stale price
// because plan data lived in two places.
//
// generations/platforms counts are derived from TIER_LIMITS (the actual
// server-enforced limits in config/platforms.ts), not hand-typed, so this
// can never silently drift from what the backend actually grants — this
// caught a real bug during review: the free tier was hardcoded as 6
// platforms here but TIER_LIMITS/FREE_PLATFORM_IDS actually grants 7.

import { TIER_LIMITS } from '../../../config/platforms'

export interface PricingPlan {
  key: string
  name: string
  price: { usd: string; inr: string }
  gens: number
  platforms: number
  features: string[]
  featured?: boolean
}

export const PLANS: PricingPlan[] = [
  {
    key: 'free',
    name: 'Free',
    price: { usd: '$0', inr: '₹0' },
    gens: TIER_LIMITS.free.generations,
    platforms: TIER_LIMITS.free.platforms,
    features: [`${TIER_LIMITS.free.generations} generations/month`, `${TIER_LIMITS.free.platforms} platforms`, 'Full content kit download', 'Image resizing (beta)'],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: { usd: '$9', inr: '₹299' },
    gens: TIER_LIMITS.starter.generations,
    platforms: TIER_LIMITS.starter.platforms,
    features: [`${TIER_LIMITS.starter.generations} generations/month`, 'All 30+ platforms', '30-day history', 'AI refinement'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: { usd: '$19', inr: '₹799' },
    gens: TIER_LIMITS.pro.generations,
    platforms: TIER_LIMITS.pro.platforms,
    features: [`${TIER_LIMITS.pro.generations} generations/month`, 'All 30+ platforms', '90-day history', 'Priority generation'],
    featured: true,
  },
  {
    key: 'business',
    name: 'Business',
    price: { usd: '$49', inr: '₹1,999' },
    gens: TIER_LIMITS.business.generations,
    platforms: TIER_LIMITS.business.platforms,
    features: [`${TIER_LIMITS.business.generations.toLocaleString()} generations/month`, 'All 30+ platforms', '1-year history', 'API access (coming soon)'],
  },
]


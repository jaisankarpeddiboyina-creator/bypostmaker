import { create } from 'zustand'
import type { PlatformTier } from '../config/platforms'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  plan: PlatformTier
  plan_status: 'active' | 'cancelled' | 'past_due'
  currency: 'usd' | 'inr'
  role: 'user' | 'beta' | 'admin'
}

export interface UsageInfo {
  generations: number
  periodStart: number
  periodEnd: number
  limit: number
  remaining: number
}

export interface PlatformPost {
  platformId: string
  content: string
  status: 'pending' | 'generating' | 'done' | 'error'
  edited: boolean
  errorMessage?: string
  extraFields?: Record<string, string>
}

export interface Campaign {
  id: string
  prompt: string
  platforms: string[]
  posts: Record<string, PlatformPost>
  videoUrl: string | null
  imageFile: File | null
  videoFile: File | null
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppStore {
  user: User | null
  usage: UsageInfo | null
  setUser: (user: User | null) => void
  setUsage: (usage: UsageInfo | null) => void

  selectedPlatforms: string[]
  togglePlatform: (id: string) => void
  setSelectedPlatforms: (ids: string[]) => void

  prompt: string
  setPrompt: (p: string) => void
  imageFile: File | null
  videoFile: File | null
  setImageFile: (f: File | null) => void
  setVideoFile: (f: File | null) => void

  isGenerating: boolean
  setIsGenerating: (v: boolean) => void
  campaign: Campaign | null
  setCampaign: (c: Campaign | null | ((prev: Campaign | null) => Campaign | null)) => void
  updatePost: (platformId: string, update: Partial<PlatformPost>) => void

  activePlatformId: string | null
  setActivePlatformId: (id: string | null) => void

  toasts: Toast[]
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void

  showUpgradeModal: boolean
  setShowUpgradeModal: (v: boolean) => void
  upgradeReason: string
  setUpgradeReason: (r: string) => void

  currency: 'usd' | 'inr'
  setCurrency: (c: 'usd' | 'inr') => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  usage: null,
  setUser: (user) => set({ user }),
  setUsage: (usage) => set({ usage }),

  selectedPlatforms: ['twitter', 'linkedin', 'instagram'],
  togglePlatform: (id) => {
    const current = get().selectedPlatforms
    set({ selectedPlatforms: current.includes(id) ? current.filter(p => p !== id) : [...current, id] })
  },
  setSelectedPlatforms: (ids) => set({ selectedPlatforms: ids }),

  prompt: '',
  setPrompt: (p) => set({ prompt: p }),
  imageFile: null,
  videoFile: null,
  setImageFile: (f) => set({ imageFile: f }),
  setVideoFile: (f) => set({ videoFile: f }),

  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),
  campaign: null,
  setCampaign: (c) => set(state => ({
    campaign: typeof c === 'function' ? c(state.campaign) : c
  })),
  updatePost: (platformId, update) => {
    const campaign = get().campaign
    if (!campaign) return
    set({
      campaign: {
        ...campaign,
        posts: { ...campaign.posts, [platformId]: { ...campaign.posts[platformId], ...update } },
      },
    })
  },

  activePlatformId: null,
  setActivePlatformId: (id) => set({ activePlatformId: id }),

  toasts: [],
  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  showUpgradeModal: false,
  setShowUpgradeModal: (v) => set({ showUpgradeModal: v }),
  upgradeReason: '',
  setUpgradeReason: (r) => set({ upgradeReason: r }),

  currency: 'usd',
  setCurrency: (c) => set({ currency: c }),
}))

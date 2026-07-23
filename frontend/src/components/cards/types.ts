import type { PlatformPost } from '../../store/app'

export interface CardProps {
  platformId: string
  post: PlatformPost
  campaignId: string
  imageFiles: File[]
  videoFile: File | null
  onOpenRefinement: () => void
}

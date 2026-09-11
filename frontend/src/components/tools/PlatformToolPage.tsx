import { useState, useRef, useEffect } from 'react'
import { Sparkles, Copy, Download, Check, Plus, MoreHorizontal, Send, X, Video } from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { MAX_IMAGE_SIZE_BYTES } from '@@config/limits'
import { useAppStore, type PlatformPost } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { PostCard } from '../PostCard'
import PostMakerLogo from '../PostMakerLogo'
import { api } from '../../lib/api'
import { generateClientZip, sanitize } from '../../lib/downloadKit'

export interface PlatformToolPageProps {
  platformId: string
}

export function PlatformToolPage({ platformId }: PlatformToolPageProps) {
  const platform = PLATFORM_MAP[platformId]
  const {
    user,
    campaign,
    setCampaign,
    updatePost,
    isGenerating,
    setIsGenerating,
    addToast,
    imageFiles,
    addImageFiles,
    removeImageFile,
    videoFile,
    setVideoFile,
  } = useAppStore()

  const [promptText, setPromptText] = useState('')
  const [isRefinement, setIsRefinement] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Seed campaign store context if campaign is null or missing platform post entry
  useEffect(() => {
    if (!platform) return
    const currentCampaign = useAppStore.getState().campaign
    if (!currentCampaign || !currentCampaign.posts[platformId]) {
      const initialPost: PlatformPost = {
        platformId,
        content: '',
        status: 'done',
        edited: false,
      }
      setCampaign({
        id: currentCampaign?.id || '',
        prompt: currentCampaign?.prompt || '',
        platforms: Array.from(new Set([...(currentCampaign?.platforms || []), platformId])),
        posts: { ...(currentCampaign?.posts || {}), [platformId]: initialPost },
        videoUrl: currentCampaign?.videoUrl || null,
        imageFiles: currentCampaign?.imageFiles || [],
        videoFile: currentCampaign?.videoFile || null,
      })
    }
  }, [platformId, platform, setCampaign])

  if (!platform) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 text-red-500 font-medium">
        Platform "{platformId}" not found in platform registry.
      </div>
    )
  }

  const currentPost: PlatformPost = campaign?.posts[platformId] || {
    platformId,
    content: '',
    status: 'done',
    edited: false,
  }

  const campaignId = campaign?.id || ''

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const validFiles: File[] = []
    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        addToast(`Image "${file.name}" exceeds the 15MB limit.`, 'error')
      } else {
        validFiles.push(file)
      }
    }

    if (validFiles.length > 0) {
      addImageFiles(validFiles)
    }
    e.target.value = ''
  }

  const handleCopy = async () => {
    if (!currentPost.content) return
    await navigator.clipboard.writeText(currentPost.content)
    setCopied(true)
    addToast(`${platform.name} post copied`, 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    if (!currentPost.content || downloading) return
    setDownloading(true)
    try {
      const prompt = campaign?.prompt || promptText || 'Generated Post'
      const zipBlob = await generateClientZip(
        campaignId || 'tool-kit',
        prompt,
        [currentPost],
        imageFiles,
        videoFile,
        () => {}
      )
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitize(platform.name)}_kit.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      addToast(`${platform.name} kit downloaded`, 'success')
    } catch (err) {
      console.error('Download failed:', err)
      addToast('Download failed. Try again.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleRefineClick = () => {
    setIsRefinement(true)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }

  const handleGenerateOrRefine = async () => {
    if (!promptText.trim() || isGenerating) return
    setIsGenerating(true)

    if (isRefinement) {
      try {
        updatePost(platformId, { status: 'generating', statusText: 'Refining caption...' })
        const res = await api.refine(campaignId, platformId, promptText.trim(), currentPost.content)
        updatePost(platformId, {
          content: res.content,
          status: 'done',
          edited: true,
          statusText: undefined,
        })
        setPromptText('')
        setIsRefinement(false)
        addToast('Refined post ready', 'success')
      } catch (err: any) {
        console.error('Refinement error:', err)
        updatePost(platformId, {
          status: 'done',
          errorMessage: err.message ?? 'Refinement failed',
        })
        addToast(err.message ?? 'Refinement failed. Try again.', 'error')
      } finally {
        setIsGenerating(false)
      }
    } else {
      // Generation mode (SSE stream)
      try {
        updatePost(platformId, {
          status: 'pending',
          content: '',
          statusText: imageFiles.length > 0 ? 'Uploading image...' : 'Preparing...',
        })

        let uploadedImageKeys: string[] = []

        if (imageFiles.length > 0) {
          try {
            const uploadResults = await Promise.allSettled(
              imageFiles.map(async (file, i) => {
                const { objectKey } = await api.upload.direct(file)
                if (!objectKey) throw new Error(`Upload failed for image #${i + 1}`)
                return objectKey
              })
            )

            const successfulKeys: string[] = []
            let hasError = false
            for (const res of uploadResults) {
              if (res.status === 'fulfilled') {
                successfulKeys.push(res.value)
              } else {
                hasError = true
              }
            }

            if (hasError) {
              if (successfulKeys.length > 0) {
                await api.upload.cleanup(successfulKeys).catch(() => {})
              }
              throw new Error('One or more images failed to upload. Cleaned up transient files.')
            }
            uploadedImageKeys = successfulKeys
          } catch (uploadErr: any) {
            setIsGenerating(false)
            updatePost(platformId, {
              status: 'error',
              errorMessage: uploadErr?.message || 'Image upload failed',
            })
            addToast(uploadErr?.message || 'Image upload failed. Try again.', 'error')
            return
          }
        }

        api.generate.stream(
          promptText.trim(),
          [platformId],
          uploadedImageKeys,
          videoFile,
          (event, data: unknown) => {
            const d = data as Record<string, unknown>
            switch (event) {
              case 'start':
                setCampaign((prev) => (prev ? { ...prev, id: d.campaignId as string } : null))
                break
              case 'init':
                updatePost(platformId, { status: 'generating', statusText: 'Generating caption...' })
                break
              case 'platform':
                updatePost(platformId, {
                  content: d.content as string,
                  status: 'done',
                  statusText: undefined,
                })
                break
              case 'error':
                updatePost(platformId, {
                  status: 'error',
                  errorMessage: d.message as string,
                  statusText: undefined,
                })
                break
              case 'done':
                setIsGenerating(false)
                addToast(`${platform.name} post ready`, 'success')
                setPromptText('')
                break
              case 'fatal':
                setIsGenerating(false)
                updatePost(platformId, {
                  status: 'error',
                  errorMessage: (d.message as string) ?? 'Generation failed',
                  statusText: undefined,
                })
                addToast((d.message as string) ?? 'Generation failed', 'error')
                break
            }
          }
        )
      } catch (err: any) {
        console.error('Generation stream failed:', err)
        setIsGenerating(false)
        updatePost(platformId, {
          status: 'error',
          errorMessage: err.message ?? 'Generation failed',
        })
        addToast('Generation failed. Try again.', 'error')
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Ambient background canvas */}
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 pointer-events-none -z-10" />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-20 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <PostMakerLogo variant="full" size={26} />
        </a>
        <div className="flex items-center gap-3">
          <a
            href="/app"
            className="px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all flex items-center gap-1"
          >
            Open App <span className="text-[10px]">↗</span>
          </a>
          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shadow-xs">
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col items-center gap-6">
        {/* Hidden File Input for Image Upload */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
          disabled={isGenerating}
        />

        {/* Platform Identity */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center">
            <PlatformIcon id={platformId} size={44} useBrandColor />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {platform.name}
          </h1>
        </div>

        {/* Existing Native Platform Card Component */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-[480px]">
            <PostCard
              platformId={platformId}
              post={currentPost}
              campaignId={campaignId}
              imageFiles={imageFiles}
              videoFile={videoFile}
              onOpenRefinement={handleRefineClick}
              isRefining={isRefinement}
            />
          </div>
        </div>

        {/* Char Counter & Share Link Label */}
        {currentPost.content ? (
          <div className="w-full max-w-[480px] flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>
              {platform.charLimit
                ? `${currentPost.content.length} / ${platform.charLimit} chars`
                : `${currentPost.content.length} chars`}
            </span>
            <a
              href={platform.shareUrl(currentPost.content, currentPost.extraFields)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex items-center gap-1 font-semibold transition-opacity hover:opacity-80"
              style={{ color: platform.brandColor }}
            >
              Share to {platform.name} →
            </a>
          </div>
        ) : null}

        {/* Actions Bar */}
        {currentPost.content ? (
          <div className="flex items-center gap-2.5 flex-wrap justify-center mt-1">
            <button
              type="button"
              onClick={handleRefineClick}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} className="text-pink-500" />
              Refine with AI
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              {downloading ? 'Downloading...' : 'Download'}
            </button>
            <button
              type="button"
              onClick={() => addToast('More options coming soon', 'info')}
              className="p-2 rounded-full text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all flex items-center justify-center cursor-pointer"
              title="More options"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        ) : null}

        {/* Floating Composer Bar */}
        <div className="w-full max-w-[540px] mt-2">
          {/* Attached Media Thumbnail Preview Row */}
          {(imageFiles.length > 0 || videoFile) && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-x-auto">
              {imageFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                  <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImageFile(idx)}
                    disabled={isGenerating}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {videoFile && (
                <div className="relative group w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                  <Video size={20} className="text-slate-500" />
                  <button
                    type="button"
                    onClick={() => setVideoFile(null)}
                    disabled={isGenerating}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Remove video"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pill Composer Input Container */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 shadow-md px-3 py-2 flex items-center gap-2 transition-all focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20">
            {/* Attachment "+" Button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isGenerating}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
              title="Add image/video attachment"
            >
              <Plus size={18} />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={
                isRefinement
                  ? `Make changes or refine...`
                  : `Type your post here...`
              }
              rows={1}
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerateOrRefine()
                }
              }}
              className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100 px-2 py-1.5 resize-none max-h-24 font-sans leading-relaxed"
            />

            {/* Send / Paperplane Icon & Generate Button */}
            <div className="flex items-center gap-2 shrink-0">
              <Send size={16} className="text-slate-400 hidden sm:block" />
              <button
                type="button"
                onClick={handleGenerateOrRefine}
                disabled={isGenerating || !promptText.trim()}
                className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Sparkles size={15} />
                {isGenerating ? 'Working...' : isRefinement ? 'Refine' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Tagline */}
        <footer className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium space-y-0.5">
          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">PostMaker</p>
          <p>Post once. Be everywhere.</p>
        </footer>
      </main>
    </div>
  )
}


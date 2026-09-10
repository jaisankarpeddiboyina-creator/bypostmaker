import { useState, useRef, useEffect } from 'react'
import { Sparkles, Copy, Download, Check, Plus } from 'lucide-react'
import { PLATFORM_MAP } from '@@config/platforms'
import { useAppStore, type PlatformPost } from '../../store/app'
import { PlatformIcon } from '../PlatformIcon'
import { PostCard } from '../PostCard'
import { api } from '../../lib/api'
import { generateClientZip, sanitize } from '../../lib/downloadKit'

export interface PlatformToolPageProps {
  platformId: string
}

export function PlatformToolPage({ platformId }: PlatformToolPageProps) {
  const platform = PLATFORM_MAP[platformId]
  const {
    campaign,
    setCampaign,
    updatePost,
    isGenerating,
    setIsGenerating,
    addToast,
  } = useAppStore()

  const [promptText, setPromptText] = useState('')
  const [isRefinement, setIsRefinement] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
  const imageFiles = campaign?.imageFiles || []
  const videoFile = campaign?.videoFile || null

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

        api.generate.stream(
          promptText.trim(),
          [platformId],
          null,
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 flex flex-col items-center gap-6">
        {/* Platform Identity */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800">
            <PlatformIcon id={platformId} size={36} useBrandColor />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {platform.name}
          </h1>
        </div>

        {/* Existing Native Platform Card Component */}
        <div className="w-full">
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

        {/* Char Counter & Share Link Label */}
        {currentPost.content ? (
          <div className="w-full flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>
              {platform.charLimit
                ? `${currentPost.content.length} / ${platform.charLimit} chars`
                : `${currentPost.content.length} chars`}
            </span>
            <a
              href={platform.shareUrl(currentPost.content, currentPost.extraFields)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex items-center gap-1 font-semibold"
              style={{ color: platform.brandColor }}
            >
              Share to {platform.name} →
            </a>
          </div>
        ) : null}

        {/* Actions Bar */}
        {currentPost.content ? (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={handleRefineClick}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} />
              Refine with AI
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-slate-700 dark:text-slate-200"
            >
              <Download size={14} />
              {downloading ? 'Downloading...' : 'Download Kit'}
            </button>
          </div>
        ) : null}

        {/* Composer Input Area */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder={
              isRefinement
                ? `Make changes or refine your ${platform.name} post...`
                : `Type your ${platform.name} post prompt here...`
            }
            rows={3}
            className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100 font-sans"
          />
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <button
              type="button"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Attachments"
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              onClick={handleGenerateOrRefine}
              disabled={isGenerating || !promptText.trim()}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              {isGenerating ? 'Working...' : isRefinement ? 'Refine' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Footer Tagline */}
        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
          <p>PostMaker — Post once. Be everywhere.</p>
        </div>
      </main>
    </div>
  )
}

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
import styles from './PlatformToolPage.module.css'

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
    <div className={styles.pageContainer}>
      {/* Ambient background canvas */}
      <div className={styles.bgCanvas} />

      {/* Top Navigation Header */}
      <header className={styles.topHeader}>
        <a href="/" className={styles.headerLogoLink}>
          <PostMakerLogo variant="full" size={26} />
        </a>
        <div className={styles.headerRight}>
          <a href="/app" className={styles.openAppBtn}>
            Open App <span style={{ fontSize: 10 }}>↗</span>
          </a>
          <div className={styles.userAvatar}>
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* Hidden File Input for Image Upload */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          className={styles.hiddenFileInput}
          onChange={handleImageSelect}
          disabled={isGenerating}
        />

        {/* Platform Identity */}
        <div className={styles.platformHero}>
          <div className={styles.platformIconBadge}>
            <PlatformIcon id={platformId} size={44} useBrandColor />
          </div>
          <h1 className={styles.platformTitle}>
            {platform.name}
          </h1>
        </div>

        {/* Existing Native Platform Card Component */}
        <div className={styles.cardWrapper}>
          <div className={styles.cardContainer}>
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
          <div className={styles.metaRow}>
            <span>
              {platform.charLimit
                ? `${currentPost.content.length} / ${platform.charLimit} chars`
                : `${currentPost.content.length} chars`}
            </span>
            <a
              href={platform.shareUrl(currentPost.content, currentPost.extraFields)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.shareLink}
              style={{ color: platform.brandColor }}
            >
              Share to {platform.name} →
            </a>
          </div>
        ) : null}

        {/* Actions Bar */}
        {currentPost.content ? (
          <div className={styles.actionsBar}>
            <button
              type="button"
              onClick={handleRefineClick}
              className={styles.actionPillBtn}
            >
              <Sparkles size={14} style={{ color: '#F72585' }} />
              Refine with AI
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={styles.actionPillBtn}
            >
              {copied ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={styles.actionPillBtn}
            >
              <Download size={14} />
              {downloading ? 'Downloading...' : 'Download'}
            </button>
            <button
              type="button"
              onClick={() => addToast('More options coming soon', 'info')}
              className={styles.actionIconBtn}
              title="More options"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        ) : null}

        {/* Floating Composer Bar */}
        <div className={styles.composerSection}>
          {/* Attached Media Thumbnail Preview Row */}
          {(imageFiles.length > 0 || videoFile) && (
            <div className={styles.attachedMediaRow}>
              {imageFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className={styles.attachedTile}>
                  <img src={URL.createObjectURL(file)} alt={file.name} />
                  <button
                    type="button"
                    onClick={() => removeImageFile(idx)}
                    disabled={isGenerating}
                    className={styles.attachedRemoveBtn}
                    title="Remove image"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {videoFile && (
                <div className={styles.attachedTile} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' }}>
                  <Video size={20} style={{ color: '#38BDF8' }} />
                  <button
                    type="button"
                    onClick={() => setVideoFile(null)}
                    disabled={isGenerating}
                    className={styles.attachedRemoveBtn}
                    title="Remove video"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pill Composer Input Container */}
          <div className={styles.composerCard}>
            {/* Attachment "+" Button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isGenerating}
              className={styles.attachmentPlusBtn}
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
              className={styles.composerTextarea}
            />

            {/* Send / Paperplane Icon & Generate Button */}
            <div className={styles.composerRightActions}>
              <Send size={16} className={styles.sendIcon} />
              <button
                type="button"
                onClick={handleGenerateOrRefine}
                disabled={isGenerating || !promptText.trim()}
                className={styles.generateCtaBtn}
              >
                <Sparkles size={15} />
                {isGenerating ? 'Working...' : isRefinement ? 'Refine' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Tagline */}
        <footer className={styles.footer}>
          <p className={styles.footerBrand}>PostMaker</p>
          <p>Post once. Be everywhere.</p>
        </footer>
      </main>
    </div>
  )
}



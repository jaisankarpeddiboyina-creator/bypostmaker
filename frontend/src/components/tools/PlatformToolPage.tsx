import { useState, useRef, useEffect } from 'react'
import { Sparkles, Copy, Download, Check, Plus, MoreHorizontal, X, Video, Upload, Image as ImageIcon } from 'lucide-react'
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

function getRootAppUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    const port = window.location.port ? `:${window.location.port}` : ''
    return `http://localhost${port}`
  }
  return 'https://bypostamaker.com'
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
    useBrandKit,
    setUseBrandKit,
    openAssetPicker,
  } = useAppStore()

  const [promptText, setPromptText] = useState('')
  const [isRefinement, setIsRefinement] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [brandKitName, setBrandKitName] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  // BUG FIX: Initialize a fresh empty draft campaign post with status: 'done' on page mount
  useEffect(() => {
    if (!platform) return
    const initialPost: PlatformPost = {
      platformId,
      content: '',
      status: 'done',
      edited: false,
    }
    setCampaign({
      id: '',
      prompt: '',
      platforms: [platformId],
      posts: { [platformId]: initialPost },
      videoUrl: null,
      imageFiles: [],
      videoFile: null,
    })
  }, [platformId, platform, setCampaign])

  // Fetch brand kit name if user has one configured
  useEffect(() => {
    api.brandKit.get()
      .then(res => {
        if (res?.brandKit?.name) {
          setBrandKitName(res.brandKit.name)
        }
      })
      .catch(() => {})
  }, [])

  // Close plus action popover menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      addToast('Video exceeds 100MB limit.', 'error')
      e.target.value = ''
      return
    }
    setVideoFile(file)
    e.target.value = ''
  }

  const handleOpenAssetPicker = () => {
    openAssetPicker({
      accept: ['image'],
      onSelect: (file) => {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          addToast(`Image "${file.name}" exceeds the 15MB limit.`, 'error')
        } else {
          addImageFiles([file])
        }
      }
    })
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

  const rootUrl = getRootAppUrl()

  return (
    <div className={styles.pageContainer}>
      {/* Ambient background canvas */}
      <div className={styles.bgCanvas} />

      {/* Top Navigation Header */}
      <header className={styles.topHeader}>
        <a href={`${rootUrl}/`} className={styles.headerLogoLink}>
          <PostMakerLogo variant="full" size={26} />
        </a>
        <div className={styles.headerRight}>
          <a href={`${rootUrl}/app`} className={styles.openAppBtn}>
            Open App <span style={{ fontSize: 10 }}>↗</span>
          </a>
          <div className={styles.userAvatar}>
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* Hidden File Inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          className={styles.hiddenFileInput}
          onChange={handleImageSelect}
          disabled={isGenerating}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          className={styles.hiddenFileInput}
          onChange={handleVideoSelect}
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
            {/* Attachment "+" Button & Dropdown Menu */}
            <div className={styles.plusMenuContainer} ref={plusMenuRef}>
              <button
                type="button"
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                disabled={isGenerating}
                className={`${styles.attachmentPlusBtn} ${showPlusMenu ? styles.active : ''}`}
                title="Add media or apply brand kit"
              >
                <Plus size={18} />
              </button>

              {/* Plus Action Popover Menu */}
              {showPlusMenu && (
                <div className={styles.plusPopoverMenu}>
                  <div className={styles.popoverSectionTitle}>
                    <Sparkles size={12} /> AI & Brand Controls
                  </div>

                  {/* Brand Kit Toggle */}
                  <label className={`${styles.popoverItemToggle} ${useBrandKit ? styles.active : ''}`}>
                    <input
                      type="checkbox"
                      checked={useBrandKit}
                      onChange={e => setUseBrandKit(e.target.checked)}
                      disabled={isGenerating}
                    />
                    <span>Apply Brand Kit {brandKitName ? `(${brandKitName})` : ''}</span>
                  </label>

                  {/* Media Attachments */}
                  <div className={styles.popoverSectionTitle} style={{ marginTop: 10 }}>
                    <Upload size={12} /> Attach Media
                  </div>
                  <div className={styles.popoverMediaActions}>
                    <button
                      type="button"
                      className={styles.popoverActionBtn}
                      onClick={() => { imageInputRef.current?.click(); setShowPlusMenu(false); }}
                      disabled={isGenerating || imageFiles.length >= 4 || !!videoFile}
                    >
                      <ImageIcon size={13} /> Upload Images ({imageFiles.length}/4)
                    </button>
                    <button
                      type="button"
                      className={styles.popoverActionBtn}
                      onClick={() => { handleOpenAssetPicker(); setShowPlusMenu(false); }}
                      disabled={isGenerating || imageFiles.length >= 4 || !!videoFile}
                    >
                      <Sparkles size={13} /> Stock Photos Library
                    </button>
                    <button
                      type="button"
                      className={styles.popoverActionBtn}
                      onClick={() => { videoInputRef.current?.click(); setShowPlusMenu(false); }}
                      disabled={isGenerating || !!videoFile || imageFiles.length > 0}
                    >
                      <Video size={13} /> Add Video MP4
                    </button>
                  </div>
                </div>
              )}
            </div>

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

            {/* Generate Button */}
            <div className={styles.composerRightActions}>
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

        {/* Footer with Legal Links & Branding */}
        <footer className={styles.footer}>
          <a href={`${rootUrl}/`} className={styles.footerLogoLink}>
            <PostMakerLogo variant="full" size={22} />
          </a>
          <div className={styles.footerLinks}>
            <a href={`${rootUrl}/tools`}>Post Generators</a>
            <a href={`${rootUrl}/vs`}>Compare</a>
            <a href={`${rootUrl}/for`}>Use Cases</a>
            <a href={`${rootUrl}/privacy`}>Privacy</a>
            <a href={`${rootUrl}/terms`}>Terms</a>
            <a href={`${rootUrl}/refund`}>Refund Policy</a>
            <a href={`${rootUrl}/cookies`}>Cookies</a>
            <a href={`${rootUrl}/blog`}>Blog</a>
            <a href="mailto:support@bypostamaker.com">Support</a>
            <a href={`${rootUrl}/contact`}>Contact</a>
          </div>
          <p className={styles.footerTagline}>Post once. Be everywhere.</p>
          <p className={styles.footerCopy}>© {new Date().getFullYear()} PostMaker. All rights reserved.</p>
        </footer>
      </main>
    </div>
  )
}



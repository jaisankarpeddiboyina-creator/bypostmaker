import { useState, useRef, useCallback, useEffect } from 'react'
import { Sparkles, X, Download, Loader2, ImageIcon, Video } from 'lucide-react'
import { useAppStore } from '../store/app'
import { PlatformRail } from '../components/PlatformRail'
import { PostCard } from '../components/PostCard'
import { RefinementChat } from '../components/RefinementChat'
import { api } from '../lib/api'
import { PLATFORM_MAP } from '@@config/platforms'
import { generateClientZip } from '../lib/downloadKit'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'

const VIDEO_MAX_MB = 100

export default function AppPage() {
  const {
    user, usage,
    prompt, setPrompt,
    selectedPlatforms,
    imageFiles, setImageFiles,
    videoFile, setVideoFile,
    isGenerating, setIsGenerating,
    campaign, setCampaign,
    updatePost,
    activePlatformId, setActivePlatformId,
    addToast,
    setShowUpgradeModal, setUpgradeReason,
  } = useAppStore()

  const [downloadProgress, setDownloadProgress] = useState<string | null>(null)
  const [generationStatus, setGenerationStatus] = useState<string>('Generating…')

  const abortRef = useRef<AbortController | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const slowVisionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (slowVisionTimeoutRef.current) {
      clearTimeout(slowVisionTimeoutRef.current)
      slowVisionTimeoutRef.current = null
    }
    if (failsafeTimeoutRef.current) {
      clearTimeout(failsafeTimeoutRef.current)
      failsafeTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (slowVisionTimeoutRef.current) clearTimeout(slowVisionTimeoutRef.current)
      if (failsafeTimeoutRef.current) clearTimeout(failsafeTimeoutRef.current)
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { addToast('Enter a prompt first', 'error'); return }
    if (selectedPlatforms.length === 0) { addToast('Select at least one platform', 'error'); return }

    if (usage && usage.limit !== -1 && usage.remaining === 0) {
      setUpgradeReason("You've hit your monthly generation limit.")
      setShowUpgradeModal(true)
      return
    }

    clearTimers()
    setIsGenerating(true)
    setGenerationStatus(imageFiles.length > 0 ? 'Uploading image...' : 'Generating captions...')

    // Pre-initialize campaign state with "Uploading image..." status
    const initialPosts = Object.fromEntries(
      selectedPlatforms.map(id => [id, {
        platformId: id,
        content: '',
        status: 'pending' as const,
        edited: false,
        statusText: imageFiles.length > 0 ? 'Uploading image...' : 'Preparing...',
      }])
    )

    setCampaign({
      id: '', prompt: prompt.trim(), platforms: selectedPlatforms,
      posts: initialPosts, videoUrl: null, imageFiles, videoFile,
    })

    let uploadedImageKey: string | null = null

    if (imageFiles.length > 0) {
      try {
        const file = imageFiles[0]
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          throw new Error('Image file size exceeds the 15MB limit.')
        }

        const { uploadUrl, objectKey } = await api.upload.presign(file.type, file.size)

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        if (!uploadRes.ok) throw new Error('Upload failed')
        uploadedImageKey = objectKey
      } catch (err: any) {
        setIsGenerating(false)
        clearTimers()
        addToast(err?.message || 'Image upload failed. Please try again.', 'error')
        setCampaign(null)
        return
      }
    }

    // Set failsafe timer (45 seconds)
    failsafeTimeoutRef.current = setTimeout(() => {
      abortRef.current?.abort()
      setIsGenerating(false)
      clearTimers()
      addToast('This is taking longer than expected — you can try again', 'error')
      
      // Update all pending/generating cards to error state
      selectedPlatforms.forEach(id => {
        const post = useAppStore.getState().campaign?.posts[id]
        if (post?.status === 'generating' || post?.status === 'pending') {
          updatePost(id, {
            status: 'error',
            errorMessage: 'Request timed out.',
          })
        }
      })
    }, 45000)

    abortRef.current = api.generate.stream(
      prompt.trim(), selectedPlatforms, uploadedImageKey, videoFile,
      (event, data: unknown) => {
        const d = data as Record<string, unknown>
        switch (event) {
          case 'start':
            setCampaign(prev => prev ? { ...prev, id: d.campaignId as string } : null)
            break

          case 'init':
            // Mark all as generating
            setCampaign(prev => {
              if (!prev) return null
              const posts = { ...prev.posts }
              for (const id of selectedPlatforms) {
                posts[id] = { 
                  ...posts[id], 
                  status: 'generating',
                  statusText: 'Generating caption...',
                }
              }
              return { ...prev, posts }
            })
            setGenerationStatus('Generating captions...')
            break

          case 'vision':
            if (slowVisionTimeoutRef.current) {
              clearTimeout(slowVisionTimeoutRef.current)
            }
            
            setCampaign(prev => {
              if (!prev) return null
              const posts = { ...prev.posts }
              for (const id of selectedPlatforms) {
                posts[id] = { ...posts[id], statusText: 'Analyzing image...' }
              }
              return { ...prev, posts }
            })
            setGenerationStatus('Analyzing image...')

            // Set 7-second timer for slow vision message
            slowVisionTimeoutRef.current = setTimeout(() => {
              setGenerationStatus('Analyzing image (slow)...')
              selectedPlatforms.forEach(id => {
                const post = useAppStore.getState().campaign?.posts[id]
                if (post?.status === 'generating' || post?.status === 'pending') {
                  updatePost(id, {
                    statusText: 'Still analyzing image, this can take up to 20 seconds...',
                  })
                }
              })
            }, 7000)
            break

          case 'platform':
            if (slowVisionTimeoutRef.current) {
              clearTimeout(slowVisionTimeoutRef.current)
              slowVisionTimeoutRef.current = null
            }
            updatePost(d.platformId as string, { content: d.content as string, status: 'done', statusText: undefined })
            break

          case 'error':
            updatePost(d.platformId as string, {
              status: 'error', errorMessage: d.message as string, statusText: undefined,
            })
            break

          case 'done':
            setIsGenerating(false)
            clearTimers()
            addToast('Content kit ready', 'success')
            break

          case 'fatal':
            setIsGenerating(false)
            clearTimers()
            addToast((d.message as string) ?? 'Generation failed', 'error')
            selectedPlatforms.forEach(id => {
              const post = useAppStore.getState().campaign?.posts[id]
              if (post?.status === 'generating' || post?.status === 'pending') {
                updatePost(id, { status: 'error', errorMessage: 'Generation failed', statusText: undefined })
              }
            })
            break
        }
      }
    )
  }, [prompt, selectedPlatforms, imageFiles, videoFile, usage, clearTimers, addToast, setCampaign, updatePost, setUpgradeReason, setShowUpgradeModal])

  const handleStop = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
    addToast('Stopped. Partial results saved.', 'info')
  }

  const handleDownloadAll = async () => {
    if (!campaign?.id) return

    // Calculate total operations for warning
    let totalResizes = 0
    const postsList = Object.values(campaign.posts)
    for (const post of postsList) {
      const platform = PLATFORM_MAP[post.platformId]
      if (!platform) continue
      if (imageFiles.length > 0 && platform.imageDimensions.length > 0) {
        const imagesToProcess = imageFiles.slice(0, platform.maxImages)
        totalResizes += imagesToProcess.length * platform.imageDimensions.length
      }
    }

    if (totalResizes > 60) {
      addToast('Capping resizes at 60 operations to prevent memory issues.', 'info')
    }

    setDownloadProgress('Starting generation...')
    try {
      const zipBlob = await generateClientZip(
        campaign.id,
        campaign.prompt,
        postsList,
        imageFiles,
        videoFile,
        (msg) => setDownloadProgress(msg)
      )

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'postmaker_kit.zip'
      a.click()

      // Memory cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)

      addToast('Download started', 'success')
    } catch (err: any) {
      console.error('ZIP generation failed:', err)
      addToast(err?.message || 'Failed to generate download kit. Select fewer platforms or smaller files.', 'error')
    } finally {
      setDownloadProgress(null)
    }
  }

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
      addToast(`Video too large. Max ${VIDEO_MAX_MB}MB.`, 'error')
      e.target.value = ''
      return
    }
    setVideoFile(file)
  }

  const handleLockedPlatform = (name: string) => {
    setUpgradeReason(`${name} is available on higher plans.`)
    setShowUpgradeModal(true)
  }

  const completedPosts = Object.values(campaign?.posts ?? {}).filter(p => p.status === 'done')

  return (
    <div className="app-layout">
      <PlatformRail userPlan={user?.plan ?? 'free'} onLockedClick={handleLockedPlatform} />

      <div className="app-body">
        {/* Input panel */}
        <div className="input-panel">
          <div className="input-panel-inner">
            <div className="input-header">
              <h2 className="input-logo">Post<span>Maker</span></h2>
              {user && (
                <div className="input-usage">
                  {user.plan === 'business' ? 'Unlimited' : `${usage?.remaining ?? 0} left`}
                </div>
              )}
            </div>

            <div className="prompt-wrapper">
              <textarea
                className="prompt-textarea"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={`Describe what you want to post about...\n\ne.g. Launching my new SaaS tool that helps designers export assets 10x faster`}
                rows={6}
                disabled={isGenerating}
                maxLength={2000}
              />
              <div className="prompt-meta">
                <span className="prompt-count">{prompt.length}/2000</span>
              </div>
            </div>

            <div className="media-row">
              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files ?? [])
                  const imageSupportedPlatforms = selectedPlatforms
                    .map(id => PLATFORM_MAP[id])
                    .filter(p => p && p.maxImages > 0)
                  
                  if (imageSupportedPlatforms.length === 0) {
                    setImageFiles([])
                    addToast('None of the selected platforms support images', 'error')
                    e.target.value = ''
                    return
                  }
                  
                  const maxAllowed = Math.max(...imageSupportedPlatforms.map(p => p.maxImages))
                  const cappedArray = files.slice(0, maxAllowed)
                  setImageFiles(cappedArray)
                }} />
              <button className={`media-btn ${imageFiles.length > 0 ? 'active' : ''}`}
                onClick={() => imageInputRef.current?.click()} disabled={isGenerating}
                title="Add one image for AI to analyze (JPEG, PNG, WEBP, or GIF · max 15MB)">
                <ImageIcon size={14} />
                {imageFiles.length > 1
                  ? `${imageFiles.length} images`
                  : imageFiles.length === 1
                  ? imageFiles[0].name.slice(0, 14) + '…'
                  : 'Add image'}
              </button>
              {imageFiles.length > 0 && (
                <button className="media-clear" onClick={() => {
                  setImageFiles([])
                  if (imageInputRef.current) imageInputRef.current.value = ''
                }} title="Remove image">
                  <X size={12} />
                </button>
              )}

              <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }}
                onChange={handleVideoSelect} />
              <button className={`media-btn ${videoFile ? 'active' : ''}`}
                onClick={() => videoInputRef.current?.click()} disabled={isGenerating}>
                <Video size={14} />
                {videoFile ? videoFile.name.slice(0, 14) + '…' : 'Add video'}
              </button>
              {videoFile && (
                <button className="media-clear" onClick={() => setVideoFile(null)} title="Remove video">
                  <X size={12} />
                </button>
              )}
            </div>

            {!isGenerating ? (
              <button className="btn btn-primary generate-btn" onClick={handleGenerate}
                disabled={!prompt.trim() || selectedPlatforms.length === 0}>
                <Sparkles size={15} />
                Generate {selectedPlatforms.length > 0 ? `(${selectedPlatforms.length})` : ''}
              </button>
            ) : (
              <button className="btn btn-primary generate-btn" disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
                <Loader2 size={15} className="spin" />
                {generationStatus}
              </button>
            )}

            {selectedPlatforms.length === 0 && (
              <p className="input-hint">↑ Select platforms from the bar above</p>
            )}

            {completedPosts.length > 0 && !isGenerating && campaign?.id && (
              <button className="btn btn-ghost download-all-btn" onClick={handleDownloadAll} disabled={!!downloadProgress}>
                {downloadProgress ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    <span style={{ marginLeft: '6px' }}>{downloadProgress}</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span style={{ marginLeft: '6px' }}>Download full kit ({completedPosts.length} platforms)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Cards area */}
        <div className="cards-area">
          {!campaign && (
            <div className="cards-empty">
              <div className="cards-empty-icon"><Sparkles size={28} /></div>
              <p className="cards-empty-title">Your content kit appears here</p>
              <p className="cards-empty-sub">Select platforms, write your prompt, hit Generate</p>
            </div>
          )}
          {campaign && (
            <div className="cards-grid">
              {selectedPlatforms.map(id => {
                const post = campaign.posts[id]
                if (!post) return null
                return (
                  <PostCard
                    key={id}
                    platformId={id}
                    post={post}
                    campaignId={campaign.id}
                    imageFiles={imageFiles}
                    videoFile={videoFile}
                    onOpenRefinement={() => setActivePlatformId(activePlatformId === id ? null : id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {activePlatformId && campaign?.id && (
          <RefinementChat
            platformId={activePlatformId}
            campaignId={campaign.id}
            onClose={() => setActivePlatformId(null)}
          />
        )}
      </div>


      <style>{`
        .app-layout { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
        .app-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
        .input-panel { width: 360px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--surface); overflow-y: auto; }
        .input-panel-inner { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; }
        .input-header { display: flex; align-items: center; justify-content: space-between; }
        .input-logo { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--text-1); letter-spacing: -0.04em; }
        .input-logo span { color: var(--accent); }
        .input-usage { font-size: 11px; color: var(--text-3); background: var(--card); border: 1px solid var(--border); border-radius: 99px; padding: 3px 10px; }
        .prompt-wrapper { position: relative; }
        .prompt-textarea { width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; font-family: var(--font-body); font-size: 14px; color: var(--text-1); line-height: 1.6; resize: none; transition: border-color var(--transition); }
        .prompt-textarea:focus { outline: none; border-color: var(--accent); }
        .prompt-textarea::placeholder { color: var(--text-4); white-space: pre-line; }
        .prompt-meta { display: flex; justify-content: flex-end; margin-top: 4px; }
        .prompt-count { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); }
        .media-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .media-btn { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: var(--radius); border: 1px dashed var(--border); background: transparent; color: var(--text-3); font-size: 12px; cursor: pointer; font-family: var(--font-body); transition: all var(--transition); }
        .media-btn:hover:not(:disabled) { border-style: solid; border-color: var(--border-light); color: var(--text-1); }
        .media-btn.active { border-style: solid; border-color: var(--accent); color: var(--accent); }
        .media-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .media-clear { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: none; color: var(--text-3); cursor: pointer; border-radius: 4px; margin-left: -2px; }
        .media-clear:hover { color: var(--error); }
        .generate-btn { width: 100%; height: 44px; font-size: 14px; font-weight: 600; justify-content: center; }
        .input-hint { font-size: 12px; color: var(--text-3); text-align: center; }
        .download-all-btn { width: 100%; height: 40px; justify-content: center; font-size: 13px; }
        .cards-area { flex: 1; min-width: 0; overflow: auto; padding: 20px; display: flex; align-items: flex-start; }
        .cards-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-3); height: 100%; }
        .cards-empty-icon { width: 60px; height: 60px; border-radius: 16px; background: var(--card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-4); }
        .cards-empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
        .cards-empty-sub { font-size: 13px; color: var(--text-3); }
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 340px)); gap: 14px; align-items: flex-start; width: 100%; padding-bottom: 4px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        @media (max-width: 900px) {
          .app-body { flex-direction: column; overflow: auto; }
          .input-panel { width: 100%; max-height: none; border-right: none; border-bottom: 1px solid var(--border); overflow: visible; }
          .cards-area { overflow: visible; }
          .cards-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

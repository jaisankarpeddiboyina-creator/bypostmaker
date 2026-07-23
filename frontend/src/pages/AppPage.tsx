import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/app'
import { CreateStepPanel } from '../components/CreateStepPanel'
import { GenerationSummaryRail } from '../components/GenerationSummaryRail'
import { ResultsView } from '../components/ResultsView'
import { api } from '../lib/api'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'

export default function AppPage() {
  const {
    user, usage,
    prompt,
    selectedPlatforms,
    imageFiles,
    videoFile,
    setIsGenerating,
    setCampaign,
    updatePost,
    addToast,
    setShowUpgradeModal, setUpgradeReason,
    viewMode, setViewMode,
  } = useAppStore()

  const abortRef = useRef<AbortController | null>(null)
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
    // Auto-switch to Results view when generation starts
    setViewMode('results')

    // Pre-initialize campaign state with "Uploading image..." / "Preparing..." status
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

    let uploadedImageKeys: string[] = []

    if (imageFiles.length > 0) {
      try {
        const totalSize = imageFiles.reduce((sum, f) => sum + f.size, 0)
        if (totalSize > 30 * 1024 * 1024) {
          throw new Error('Total combined image size exceeds 30MB limit.')
        }

        const { items } = await api.upload.presignBatch(
          imageFiles.map(f => ({ contentType: f.type, contentLength: f.size }))
        )

        const uploadResults = await Promise.allSettled(
          items.map(async (item, i) => {
            const res = await fetch(item.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': imageFiles[i].type },
              body: imageFiles[i],
            })
            if (!res.ok) throw new Error(`Upload failed for image #${i + 1}`)
            return item.objectKey
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
      } catch (err: any) {
        setIsGenerating(false)
        clearTimers()
        addToast(err?.message || 'Image upload failed. Please try again.', 'error')
        setCampaign(null)
        setViewMode('create')
        return
      }
    }

    // Set failsafe timer (45 seconds)
    failsafeTimeoutRef.current = setTimeout(() => {
      abortRef.current?.abort()
      setIsGenerating(false)
      clearTimers()
      addToast('This is taking longer than expected — you can try again', 'error')

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
      prompt.trim(), selectedPlatforms, uploadedImageKeys, videoFile,
      (event, data: unknown) => {
        const d = data as Record<string, unknown>
        switch (event) {
          case 'start':
            setCampaign(prev => prev ? { ...prev, id: d.campaignId as string } : null)
            break

          case 'init':
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

            slowVisionTimeoutRef.current = setTimeout(() => {
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
  }, [prompt, selectedPlatforms, imageFiles, videoFile, usage, clearTimers, addToast, setCampaign, updatePost, setUpgradeReason, setShowUpgradeModal, setIsGenerating, setViewMode])

  const handleLockedPlatform = (name: string) => {
    setUpgradeReason(`${name} is available on higher plans.`)
    setShowUpgradeModal(true)
  }

  return (
    <div className="app-layout">
      <div className="app-body">
        {viewMode === 'create' ? (
          <div className="create-view-wrapper">
            <CreateStepPanel
              userPlan={user?.plan ?? 'free'}
              onLockedClick={handleLockedPlatform}
              onGenerateClick={handleGenerate}
            />
            <GenerationSummaryRail onGenerateClick={handleGenerate} />
          </div>
        ) : (
          <ResultsView />
        )}
      </div>

      <style>{`
        .app-layout {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .app-body {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .create-view-wrapper {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 24px var(--content-px);
          gap: 28px;
        }

        @media (max-width: 960px) {
          .create-view-wrapper {
            flex-direction: column;
            gap: 20px;
            padding: 16px;
          }
        }
      `}</style>
    </div>
  )
}

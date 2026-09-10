import { useState, useEffect } from 'react'
import { X, Loader2, Archive, FileText } from 'lucide-react'
import { useAppStore } from '../store/app'
import { generateClientZip, generateClientPdf, sanitizeFilename } from '../lib/downloadKit'
import styles from './ExportModal.module.css'

const cx = (...args: (string | false | null | undefined)[]) =>
  args.filter(Boolean).join(' ')

export function ExportModal() {
  const { exportPayload, closeExport, addToast } = useAppStore()
  
  const [filename, setFilename] = useState('')
  const [format, setFormat] = useState<'zip' | 'pdf'>('zip')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')

  // Prefill filename when payload changes
  useEffect(() => {
    if (exportPayload) {
      setFilename(exportPayload.defaultFilename)
      setFormat('zip')
      setIsGenerating(false)
      setProgressMsg('')
    }
  }, [exportPayload])

  if (!exportPayload) return null

  const handleDownload = async () => {
    let cleanName = sanitizeFilename(filename)
    if (!cleanName) {
      cleanName = exportPayload.defaultFilename
    }

    setIsGenerating(true)
    setProgressMsg('Starting export process...')

    try {
      if (format === 'zip') {
        const zipBlob = await generateClientZip(
          exportPayload.campaignId,
          exportPayload.prompt,
          exportPayload.posts,
          exportPayload.imageFiles,
          exportPayload.videoFile,
          (msg) => setProgressMsg(msg)
        )

        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${cleanName}.zip`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        
        addToast('ZIP kit download started', 'success')
      } else {
        const pdfBlob = await generateClientPdf(
          exportPayload.campaignId,
          exportPayload.prompt,
          exportPayload.posts,
          exportPayload.imageFiles,
          exportPayload.videoFile,
          (msg) => setProgressMsg(msg)
        )

        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${cleanName}.pdf`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)

        addToast('PDF kit download started', 'success')
      }
      closeExport()
    } catch (err: any) {
      console.error('Export generation failed:', err)
      addToast(err?.message || 'Failed to generate kit.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // Allow typing freely but sanitize restricted characters and limit length
    setFilename(val.replace(/[\\/:*?"<>|]/g, '').slice(0, 100))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isGenerating) {
      closeExport()
    }
    if (e.key === 'Enter' && !isGenerating && filename.trim()) {
      handleDownload()
    }
  }

  const previewName = sanitizeFilename(filename) || exportPayload.defaultFilename

  return (
    <div
      className={styles['modal-overlay']}
      onClick={() => !isGenerating && closeExport()}
    >
      <div
        className={cx('glass-card', styles['export-modal'])}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className={styles['export-modal-header']}>
          <div className={styles['export-header-title-block']}>
            <h2 className={styles['export-modal-title']}>Export Content Kit</h2>
            <p className={styles['export-modal-subtitle']}>Package your social posts and creative assets</p>
          </div>
          <button 
            type="button" 
            className={styles['close-export-btn']}
            onClick={closeExport} 
            disabled={isGenerating}
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filename Input Section */}
        <div className={styles['export-modal-field']}>
          <label className={styles['export-field-label']} htmlFor="export-filename">Filename</label>
          <div className={styles['export-input-wrapper']}>
            <input
              id="export-filename"
              className={styles['export-text-input']}
              type="text"
              placeholder={exportPayload.defaultFilename}
              value={filename}
              onChange={handleFilenameChange}
              disabled={isGenerating}
              maxLength={100}
              autoFocus
            />
          </div>
          <p className={styles['export-filename-preview']}>
            Will download as: <span className={styles['preview-filename-text']}>{previewName}.{format}</span>
          </p>
        </div>

        {/* Format Selector Section */}
        <div className={styles['export-modal-field']}>
          <label className={styles['export-field-label']}>Choose Format</label>
          <div className={styles['format-toggle-container']}>
            <button
              type="button"
              className={cx(
                styles['format-toggle-btn'],
                format === 'zip' && styles['active']
              )}
              onClick={() => setFormat('zip')}
              disabled={isGenerating}
              aria-pressed={format === 'zip'}
            >
              <Archive size={15} />
              <span>ZIP Archive</span>
            </button>
            
            <button
              type="button"
              className={cx(
                styles['format-toggle-btn'],
                format === 'pdf' && styles['active']
              )}
              onClick={() => setFormat('pdf')}
              disabled={isGenerating}
              aria-pressed={format === 'pdf'}
            >
              <FileText size={15} />
              <span>PDF Document</span>
            </button>
          </div>
        </div>

        {/* Progress Message */}
        {isGenerating && (
          <div className={styles['export-progress-container']}>
            <Loader2 size={16} className={cx('spin', styles['progress-spinner'])} />
            <p className={styles['export-progress-text']}>{progressMsg}</p>
          </div>
        )}

        {/* Actions Footer */}
        <div className={styles['export-modal-footer']}>
          <button
            type="button"
            className={cx('btn', 'btn-ghost', styles['cancel-export-btn'])}
            onClick={closeExport}
            disabled={isGenerating}
          >
            Cancel
          </button>
          
          <button
            type="button"
            className={cx('btn', 'btn-primary', styles['start-export-btn'])}
            onClick={handleDownload}
            disabled={isGenerating || !filename.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="spin animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <span>Download Kit</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

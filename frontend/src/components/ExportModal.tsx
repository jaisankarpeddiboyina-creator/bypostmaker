import { useState, useEffect } from 'react'
import { X, Loader2, Archive, FileText } from 'lucide-react'
import { useAppStore } from '../store/app'
import { generateClientZip, generateClientPdf, sanitizeFilename } from '../lib/downloadKit'

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
    // We allow typing freely but restrict/sanitize when updating filename state
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
    <div className="modal-overlay" onClick={() => !isGenerating && closeExport()}>
      <div className="modal export-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        
        {/* Header */}
        <div className="export-modal-header">
          <div className="export-header-title-block">
            <h2 className="export-modal-title">Export Content Kit</h2>
            <p className="export-modal-subtitle">Package your social posts and creative assets</p>
          </div>
          <button 
            type="button" 
            className="btn-icon close-export-btn" 
            onClick={closeExport} 
            disabled={isGenerating}
          >
            <X size={16} />
          </button>
        </div>

        {/* Filename Input Section */}
        <div className="export-modal-field">
          <label className="export-field-label" htmlFor="export-filename">Filename</label>
          <div className="export-input-wrapper">
            <input
              id="export-filename"
              className="export-text-input"
              type="text"
              placeholder={exportPayload.defaultFilename}
              value={filename}
              onChange={handleFilenameChange}
              disabled={isGenerating}
              maxLength={100}
              autoFocus
            />
          </div>
          <p className="export-filename-preview">
            Will download as: <span className="preview-filename-text">{previewName}.{format}</span>
          </p>
        </div>

        {/* Format Selector Section */}
        <div className="export-modal-field">
          <label className="export-field-label">Choose Format</label>
          <div className="format-toggle-container">
            <button
              type="button"
              className={`format-toggle-btn ${format === 'zip' ? 'active' : ''}`}
              onClick={() => setFormat('zip')}
              disabled={isGenerating}
            >
              <Archive size={15} />
              <span>ZIP Archive</span>
            </button>
            
            <button
              type="button"
              className={`format-toggle-btn ${format === 'pdf' ? 'active' : ''}`}
              onClick={() => setFormat('pdf')}
              disabled={isGenerating}
            >
              <FileText size={15} />
              <span>PDF Document</span>
            </button>
          </div>
        </div>

        {/* Progress Message */}
        {isGenerating && (
          <div className="export-progress-container">
            <Loader2 size={16} className="spin progress-spinner" />
            <p className="export-progress-text">{progressMsg}</p>
          </div>
        )}

        {/* Actions Footer */}
        <div className="export-modal-footer">
          <button
            type="button"
            className="btn btn-ghost cancel-export-btn"
            onClick={closeExport}
            disabled={isGenerating}
          >
            Cancel
          </button>
          
          <button
            type="button"
            className="btn btn-primary start-export-btn"
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

        {/* Component-Specific Liquid Glass Styles */}
        <style>{`
          .export-modal {
            max-width: 460px;
            padding: 24px;
            background: var(--color-surface);
            backdrop-filter: var(--backdrop-blur);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-card);
            box-shadow: var(--shadow-modal);
            color: var(--color-text-primary);
          }

          .export-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
          }

          .export-modal-title {
            font-family: var(--font-display);
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: var(--color-text-primary);
          }

          .export-modal-subtitle {
            font-size: 13px;
            color: var(--color-text-secondary);
            margin-top: 4px;
          }

          .export-modal-field {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
          }

          .export-field-label {
            font-size: 12px;
            font-weight: 700;
            color: var(--color-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .export-input-wrapper {
            position: relative;
            background: var(--color-surface-inset);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-input);
            transition: border-color var(--transition);
          }

          .export-input-wrapper:focus-within {
            border-color: var(--color-border-hover);
            box-shadow: 0 0 0 1px var(--color-border-hover);
          }

          .export-text-input {
            width: 100%;
            padding: 12px 16px;
            background: transparent;
            border: none;
            outline: none;
            color: var(--color-text-primary);
            font-family: var(--font-body);
            font-size: 14px;
          }

          .export-text-input::placeholder {
            color: var(--color-text-placeholder);
          }

          .export-filename-preview {
            font-size: 12px;
            color: var(--color-text-muted);
            padding-left: 4px;
          }

          .preview-filename-text {
            color: var(--color-primary-start);
            font-family: var(--font-mono);
            font-weight: 600;
          }

          .format-toggle-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            background: var(--color-surface-inset);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-input);
            padding: 4px;
          }

          .format-toggle-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            background: transparent;
            border: none;
            border-radius: var(--radius);
            color: var(--color-text-secondary);
            font-family: var(--font-body);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all var(--transition);
          }

          .format-toggle-btn:hover:not(:disabled) {
            color: var(--color-text-primary);
            background: rgba(255, 255, 255, 0.05);
          }

          .format-toggle-btn.active {
            background: var(--color-surface-glass);
            border: 1px solid var(--color-border-glass);
            color: var(--color-text-primary);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }

          .format-toggle-btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
          }

          .export-progress-container {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(56, 189, 248, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: var(--radius);
            padding: 12px 16px;
            margin-bottom: 20px;
            animation: fadeIn 0.2s ease-out;
          }

          .progress-spinner {
            color: var(--color-primary-start);
            flex-shrink: 0;
          }

          .export-progress-text {
            font-size: 13px;
            color: var(--color-text-secondary);
            line-height: 1.4;
          }

          .export-modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 8px;
          }

          .cancel-export-btn, .start-export-btn {
            min-width: 100px;
            justify-content: center;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

      </div>
    </div>
  )
}

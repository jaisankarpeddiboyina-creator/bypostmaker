import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Image as ImageIcon,
  Sparkles,
  Palette,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  RefreshCw,
  Zap,
  Sliders,
  Eye,
  Type,
  Layers
} from 'lucide-react'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'

export default function ThumbnailMakerPage() {
  const [searchParams] = useSearchParams()
  const { addToast } = useAppStore()

  const [prompt, setPrompt] = useState(searchParams.get('prompt') || '')
  const [title, setTitle] = useState(searchParams.get('prompt') || '')
  const [platform, setPlatform] = useState('YouTube (16:9)')
  const [useBrandKit, setUseBrandKit] = useState(true)

  const [generating, setGenerating] = useState(false)
  const [concepts, setConcepts] = useState<any[]>([])
  const [brandKitApplied, setBrandKitApplied] = useState(false)
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)

  // Handle Generate Thumbnail
  const handleGenerate = async () => {
    if (!prompt.trim() && !title.trim()) {
      addToast('Please enter a prompt or thumbnail title', 'error')
      return
    }

    setGenerating(true)
    try {
      const res = await api.thumbnail.generate(prompt, title, platform)
      if (res.ok) {
        setConcepts(res.concepts)
        setBrandKitApplied(res.brandKitApplied)
        setRemainingCredits(res.remainingCredits)
        addToast('Thumbnail concepts generated with evaluation scores!', 'success')
      }
    } catch (err: any) {
      addToast(err.message || 'Thumbnail generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="thumbnail-container">
      {/* Header */}
      <div className="thumbnail-header">
        <div className="tool-badge">
          <ImageIcon size={16} />
          <span>AI Studio Tool</span>
        </div>
        <h1>AI Thumbnail Maker</h1>
        <p className="tool-subtext">Generate high-converting, brand-aligned social thumbnails with scored visual concept evaluations.</p>
      </div>

      <div className="thumbnail-layout">
        {/* Left Form Column */}
        <div className="form-column">
          <div className="card-box">
            <h3>Thumbnail Brief</h3>

            <div className="form-group">
              <label>Thumbnail Headline Text</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 5 PRODUCTIVITY HACKS THAT ACTUALLY WORK"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Visual Prompt / Concept Context</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Energetic creator pointing at 5 growth charts, bright lighting"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Platform Aspect Ratio</label>
              <select
                className="form-control"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="YouTube (16:9)">YouTube (16:9 Widescreen)</option>
                <option value="Instagram Post (1:1)">Instagram / LinkedIn (1:1 Square)</option>
                <option value="Instagram Reel / Short (9:16)">Reels / Shorts / TikTok (9:16 Vertical)</option>
                <option value="X / Twitter (16:9)">X / Twitter Header (16:9)</option>
              </select>
            </div>

            {/* Brand Kit Toggle */}
            <div className="brand-kit-toggle-card">
              <div className="toggle-info">
                <Palette size={18} style={{ color: 'var(--color-primary-start)' }} />
                <div>
                  <span className="toggle-title">Apply Brand Kit Settings</span>
                  <span className="toggle-sub">Use saved logos, primary/secondary colors, and typography</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={useBrandKit}
                onChange={(e) => setUseBrandKit(e.target.checked)}
                className="custom-checkbox"
              />
            </div>

            <button
              className="btn btn-primary generate-btn"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Generating Concepts & Evaluation...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Thumbnail Concepts</span>
                </>
              )}
            </button>

            {remainingCredits !== null && (
              <p className="credits-info">
                ⚡ Remaining Generation Credits: {remainingCredits === -1 ? 'Unlimited' : remainingCredits}
              </p>
            )}
          </div>
        </div>

        {/* Right Concepts & Evaluation Column */}
        <div className="concepts-column">
          {concepts.length === 0 && !generating && (
            <div className="empty-concepts-card">
              <ImageIcon size={48} className="empty-icon" />
              <h3>No Concepts Generated Yet</h3>
              <p>Enter a headline title and prompt on the left to generate 3 ranked thumbnail concept options with evaluation scores.</p>
            </div>
          )}

          {generating && (
            <div className="empty-concepts-card">
              <RefreshCw size={36} className="spin-icon" />
              <h3>Analyzing Brand & Generating Concepts...</h3>
              <p>Evaluating layout hierarchy, contrast scores, and readability rules.</p>
            </div>
          )}

          {concepts.length > 0 && !generating && (
            <div className="concepts-list">
              <div className="concepts-header-row">
                <h2>Generated Thumbnail Concepts</h2>
                {brandKitApplied && (
                  <span className="badge badge-starter">
                    <Palette size={12} /> Brand Kit Applied
                  </span>
                )}
              </div>

              {concepts.map((concept, idx) => (
                <div key={concept.id || idx} className="concept-card">
                  {/* Concept Header */}
                  <div className="concept-card-top">
                    <div>
                      <span className="concept-num">Concept #{idx + 1}</span>
                      <h3 className="concept-title">{concept.title}</h3>
                    </div>
                    <div className="score-badge">
                      <span className="score-val">{concept.evaluation?.overallScore ?? 92}</span>
                      <span className="score-label">Score</span>
                    </div>
                  </div>

                  {/* Thumbnail Visual Preview */}
                  <div className="thumbnail-preview-frame">
                    <div
                      className="preview-canvas"
                      style={{
                        background: concept.colors?.background || 'var(--gradient-primary)',
                      }}
                    >
                      <div className="canvas-content">
                        <div
                          className="preview-headline"
                          style={{
                            color: concept.colors?.text || '#FFFFFF',
                            fontFamily: 'var(--font-display)',
                          }}
                        >
                          {concept.headlineText || title || 'THUMBNAIL HEADLINE'}
                        </div>
                        <div
                          className="preview-accent-pill"
                          style={{
                            background: concept.colors?.accent || 'var(--color-primary-start)',
                            color: '#FFFFFF',
                          }}
                        >
                          {concept.composition || 'High Impact Design'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Evaluation Score Metrics Breakdown */}
                  <div className="evaluation-box">
                    <div className="eval-row">
                      <div className="eval-metric">
                        <span className="metric-label">Contrast Score</span>
                        <div className="metric-bar-bg">
                          <div
                            className="metric-bar-fill"
                            style={{ width: `${concept.evaluation?.contrastScore ?? 90}%` }}
                          />
                        </div>
                        <span className="metric-num">{concept.evaluation?.contrastScore ?? 90}%</span>
                      </div>

                      <div className="eval-metric">
                        <span className="metric-label">Readability</span>
                        <div className="metric-bar-bg">
                          <div
                            className="metric-bar-fill"
                            style={{ width: `${concept.evaluation?.readabilityScore ?? 94}%` }}
                          />
                        </div>
                        <span className="metric-num">{concept.evaluation?.readabilityScore ?? 94}%</span>
                      </div>

                      <div className="eval-metric">
                        <span className="metric-label">Subject Visibility</span>
                        <div className="metric-bar-bg">
                          <div
                            className="metric-bar-fill"
                            style={{ width: `${concept.evaluation?.subjectVisibilityScore ?? 91}%` }}
                          />
                        </div>
                        <span className="metric-num">{concept.evaluation?.subjectVisibilityScore ?? 91}%</span>
                      </div>
                    </div>

                    {/* Feedback Items */}
                    {concept.evaluation?.feedback && (
                      <div className="feedback-list">
                        {concept.evaluation.feedback.map((f: string, i: number) => (
                          <div key={i} className="feedback-item">
                            <CheckCircle2 size={14} className="check-icon" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .thumbnail-container {
          padding: var(--space-6) var(--content-px);
          max-width: 1240px;
          margin: 0 auto;
          overflow-y: auto;
          height: 100%;
        }

        .thumbnail-header {
          margin-bottom: var(--space-6);
        }

        .tool-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          background: var(--color-nav-active-bg);
          color: var(--color-primary-start);
          font-size: 13px;
          font-weight: 700;
          margin-bottom: var(--space-2);
        }

        .thumbnail-header h1 {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .tool-subtext {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin-top: 4px;
        }

        .thumbnail-layout {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: var(--space-6);
        }

        .card-box {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          box-shadow: var(--shadow-card);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .card-box h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: var(--space-2);
        }

        .brand-kit-toggle-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-input);
        }

        .toggle-info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .toggle-title {
          font-size: 13px;
          font-weight: 700;
          display: block;
        }

        .toggle-sub {
          font-size: 11px;
          color: var(--color-text-secondary);
          display: block;
        }

        .custom-checkbox {
          width: 18px;
          height: 18px;
          accent-color: var(--color-primary-start);
          cursor: pointer;
        }

        .generate-btn {
          width: 100%;
          justify-content: center;
          height: 44px;
          font-size: 14px;
          margin-top: var(--space-2);
        }

        .credits-info {
          font-size: 12px;
          color: var(--color-text-secondary);
          text-align: center;
        }

        /* Right Concepts Column */
        .empty-concepts-card {
          background: var(--color-surface);
          border: 1px dashed var(--color-border-input);
          border-radius: var(--radius-card);
          padding: var(--space-12) var(--space-6);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .empty-icon {
          color: var(--color-text-muted);
          margin-bottom: var(--space-4);
        }

        .spin-icon {
          animation: spin 1s linear infinite;
          color: var(--color-primary-start);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .concepts-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-5);
        }

        .concepts-header-row h2 {
          font-size: 20px;
          font-weight: 700;
        }

        .concepts-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .concept-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          box-shadow: var(--shadow-card);
        }

        .concept-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }

        .concept-num {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-primary-start);
          text-transform: uppercase;
        }

        .concept-title {
          font-size: 18px;
          font-weight: 700;
        }

        .score-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--color-nav-active-bg);
          border: 1.5px solid var(--color-primary-start);
        }

        .score-val {
          font-size: 18px;
          font-weight: 800;
          color: var(--color-primary-start);
          line-height: 1;
        }

        .score-label {
          font-size: 9px;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
        }

        .thumbnail-preview-frame {
          border-radius: var(--radius);
          overflow: hidden;
          margin-bottom: var(--space-5);
        }

        .preview-canvas {
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          text-align: center;
        }

        .canvas-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
        }

        .preview-headline {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.02em;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }

        .preview-accent-pill {
          padding: 6px 16px;
          border-radius: var(--radius-pill);
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .evaluation-box {
          background: var(--color-bg);
          border-radius: var(--radius);
          padding: var(--space-4);
        }

        .eval-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
          margin-bottom: var(--space-3);
        }

        .eval-metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .metric-bar-bg {
          height: 6px;
          background: var(--color-border);
          border-radius: 3px;
          overflow: hidden;
        }

        .metric-bar-fill {
          height: 100%;
          background: var(--gradient-primary-h);
          border-radius: 3px;
        }

        .metric-num {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .feedback-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          padding-top: var(--space-2);
          border-top: 1px solid var(--color-border);
        }

        .feedback-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .check-icon {
          color: var(--color-success);
        }

        @media (max-width: 992px) {
          .thumbnail-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

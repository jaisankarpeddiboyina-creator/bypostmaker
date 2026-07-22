import { useState, useEffect } from 'react'
import {
  Palette,
  Upload,
  Check,
  Plus,
  Type,
  Volume2,
  Share2,
  Sparkles,
  Layout,
  ExternalLink,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Globe
} from 'lucide-react'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'

export default function BrandKitPage() {
  const { addToast } = useAppStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'logos' | 'colors' | 'fonts' | 'voice' | 'social'>('overview')
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Brand Kit State
  const [brandName, setBrandName] = useState('Your Brand')
  const [logoKey, setLogoKey] = useState<string | null>(null)
  const [colors, setColors] = useState({
    primary: '#F72585',
    secondary: '#9333EA',
    accent: '#00E5A3',
    dark: '#0F172A',
    gray: '#64748B',
    light: '#F8FAFC',
  })
  const [fonts, setFonts] = useState({
    heading: { family: 'Plus Jakarta Sans', weight: '700' },
    body: { family: 'Plus Jakarta Sans', weight: '400' },
    accent: { family: 'Great Vibes', weight: '400' },
  })
  const [voice, setVoice] = useState({
    tone: 'Friendly, Confident',
    language: 'English (US)',
    dos: 'Use positive words, short sentences, emojis',
    donts: 'Avoid complex jargon, negative words',
  })
  const [socialLinks, setSocialLinks] = useState({
    instagram: 'https://instagram.com/yourbrand',
    facebook: 'https://facebook.com/yourbrand',
    twitter: 'https://x.com/yourbrand',
    linkedin: 'https://linkedin.com/company/yourbrand',
    website: 'https://yourbrand.com',
  })

  // Load Brand Kit on mount
  useEffect(() => {
    api.brandKit.get()
      .then(({ brandKit }) => {
        if (brandKit) {
          if (brandKit.name) setBrandName(brandKit.name)
          if (brandKit.logo_object_key) setLogoKey(brandKit.logo_object_key)
          if (brandKit.colors) setColors(brandKit.colors)
          if (brandKit.fonts) setFonts(brandKit.fonts)
          if (brandKit.voice) setVoice(brandKit.voice)
          if (brandKit.social_links) setSocialLinks(brandKit.social_links)
        }
      })
      .catch((err) => {
        console.error('Failed to load brand kit:', err)
      })
  }, [])

  // Handle Save Brand Kit
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.brandKit.save({
        name: brandName,
        logo_object_key: logoKey,
        colors,
        fonts,
        voice,
        social_links: socialLinks,
      })
      addToast('Brand Kit saved successfully!', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to save Brand Kit', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle Presigned R2 Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      addToast('Only JPG, PNG, WEBP, and GIF images are allowed.', 'error')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      addToast('File size exceeds 15MB limit.', 'error')
      return
    }

    setUploadingLogo(true)
    try {
      const { uploadUrl, objectKey } = await api.upload.presign(file.type, file.size)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!putRes.ok) throw new Error('Upload to storage failed')

      setLogoKey(objectKey)
      addToast('Brand logo uploaded successfully!', 'success')
    } catch (err: any) {
      addToast(err.message || 'Logo upload failed', 'error')
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <div className="brand-kit-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Brand Kit</h1>
          <p className="page-subtext">Manage your brand identity and ensure consistent content across all tools.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Brand Kit ✨'}
        </button>
      </div>

      {/* Active Brand Card Banner */}
      <div className="brand-card-banner">
        <div className="brand-avatar-badge">
          {brandName.slice(0, 2).toUpperCase()}
        </div>
        <div className="brand-details">
          <div className="brand-title-row">
            <input
              type="text"
              className="brand-name-input"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
            <span className="badge badge-pro">Default</span>
            <span className="badge badge-starter">Active Brand</span>
          </div>
          <p className="brand-id-subtext">Used automatically in AI Studio and content generation tools</p>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="brand-tabs-wrapper">
        <div className="brand-tabs">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'logos', label: 'Logos' },
            { id: 'colors', label: 'Colors' },
            { id: 'fonts', label: 'Fonts' },
            { id: 'voice', label: 'Voice & Tone' },
            { id: 'social', label: 'Social Links' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="brand-content-grid">
        {/* Left Column — Detailed Sections */}
        <div className="brand-main-column">
          {/* LOGOS SECTION */}
          {(activeTab === 'overview' || activeTab === 'logos') && (
            <div className="card-section">
              <div className="section-header">
                <h3>Logos & Icons</h3>
                <span className="section-action">View All →</span>
              </div>
              <div className="logos-grid">
                <div className="logo-box">
                  <div className="logo-preview-area">
                    {logoKey ? (
                      <div className="uploaded-logo-preview">
                        <Palette size={32} style={{ color: colors.primary }} />
                        <span className="logo-key-tag">Uploaded Logo</span>
                      </div>
                    ) : (
                      <div className="logo-placeholder">
                        <span style={{ color: colors.primary, fontWeight: 800, fontSize: 22 }}>
                          {brandName}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="logo-meta">
                    <span className="logo-title">Primary Logo</span>
                    <span className="logo-size">512 × 512</span>
                  </div>
                </div>

                <div className="logo-box">
                  <div className="logo-preview-area dark-bg">
                    <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 22 }}>
                      {brandName}
                    </span>
                  </div>
                  <div className="logo-meta">
                    <span className="logo-title">Dark Logo</span>
                    <span className="logo-size">512 × 512</span>
                  </div>
                </div>

                <div className="logo-box">
                  <div className="logo-preview-area">
                    <div className="logo-icon-pill" style={{ background: colors.primary, color: '#FFF' }}>
                      {brandName.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="logo-meta">
                    <span className="logo-title">Icon / Favicon</span>
                    <span className="logo-size">256 × 256</span>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <label className="upload-dropzone">
                <input type="file" accept="image/*" onChange={handleLogoUpload} hidden />
                <Upload size={18} style={{ color: 'var(--color-primary-start)' }} />
                <span>{uploadingLogo ? 'Uploading to R2 Storage...' : '+ Upload New Logo (PNG, SVG, JPG max 15MB)'}</span>
              </label>
            </div>
          )}

          {/* BRAND COLORS SECTION */}
          {(activeTab === 'overview' || activeTab === 'colors') && (
            <div className="card-section">
              <div className="section-header">
                <h3>Brand Colors</h3>
                <span className="section-action">View All →</span>
              </div>
              <div className="colors-grid">
                {[
                  { key: 'primary', label: 'Primary', value: colors.primary },
                  { key: 'secondary', label: 'Secondary', value: colors.secondary },
                  { key: 'accent', label: 'Accent', value: colors.accent },
                  { key: 'dark', label: 'Dark', value: colors.dark },
                  { key: 'gray', label: 'Gray', value: colors.gray },
                  { key: 'light', label: 'Light', value: colors.light },
                ].map((c) => (
                  <div key={c.key} className="color-swatch-box">
                    <div
                      className="swatch-preview"
                      style={{ background: c.value, border: c.key === 'light' ? '1px solid #E5E7EB' : 'none' }}
                    />
                    <div className="swatch-info">
                      <span className="swatch-label">{c.label}</span>
                      <div className="swatch-input-row">
                        <input
                          type="color"
                          value={c.value}
                          onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })}
                          className="color-picker-input"
                        />
                        <span className="swatch-hex">{c.value.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TYPOGRAPHY SECTION */}
          {(activeTab === 'overview' || activeTab === 'fonts') && (
            <div className="card-section">
              <div className="section-header">
                <h3>Typography Rules</h3>
              </div>
              <div className="typography-list">
                <div className="font-item">
                  <div className="font-sample" style={{ fontFamily: fonts.heading.family, fontWeight: fonts.heading.weight }}>
                    Aa Heading
                  </div>
                  <div className="font-info">
                    <span className="font-family">{fonts.heading.family}</span>
                    <span className="badge badge-pro">Heading</span>
                    <span className="font-weight">Weight: {fonts.heading.weight}</span>
                  </div>
                </div>

                <div className="font-item">
                  <div className="font-sample" style={{ fontFamily: fonts.body.family, fontWeight: fonts.body.weight }}>
                    Aa Body
                  </div>
                  <div className="font-info">
                    <span className="font-family">{fonts.body.family}</span>
                    <span className="badge badge-starter">Body</span>
                    <span className="font-weight">Weight: {fonts.body.weight}</span>
                  </div>
                </div>

                <div className="font-item">
                  <div className="font-sample" style={{ fontFamily: fonts.accent.family, fontSize: 24 }}>
                    Aa Accent
                  </div>
                  <div className="font-info">
                    <span className="font-family">{fonts.accent.family}</span>
                    <span className="badge badge-business">Accent</span>
                    <span className="font-weight">Weight: {fonts.accent.weight}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VOICE & TONE SECTION */}
          {(activeTab === 'overview' || activeTab === 'voice') && (
            <div className="card-section">
              <div className="section-header">
                <h3>Voice & Tone Guidelines</h3>
              </div>
              <div className="voice-form">
                <div className="form-group">
                  <label>Brand Voice & Tone</label>
                  <input
                    type="text"
                    value={voice.tone}
                    onChange={(e) => setVoice({ ...voice, tone: e.target.value })}
                    className="form-control"
                    placeholder="e.g. Friendly, Confident, Professional"
                  />
                </div>
                <div className="form-group">
                  <label>Language & Locale</label>
                  <input
                    type="text"
                    value={voice.language}
                    onChange={(e) => setVoice({ ...voice, language: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Do's (Copywriting Guidelines)</label>
                  <textarea
                    value={voice.dos}
                    onChange={(e) => setVoice({ ...voice, dos: e.target.value })}
                    className="form-control"
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label>Don'ts (Avoid Words / Phrasing)</label>
                  <textarea
                    value={voice.donts}
                    onChange={(e) => setVoice({ ...voice, donts: e.target.value })}
                    className="form-control"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SOCIAL LINKS SECTION */}
          {(activeTab === 'overview' || activeTab === 'social') && (
            <div className="card-section">
              <div className="section-header">
                <h3>Social Profiles & Links</h3>
              </div>
              <div className="social-links-form">
                {[
                  { key: 'instagram', label: 'Instagram', icon: Instagram },
                  { key: 'facebook', label: 'Facebook', icon: Facebook },
                  { key: 'twitter', label: 'X (Twitter)', icon: Twitter },
                  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
                  { key: 'website', label: 'Website', icon: Globe },
                ].map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.key} className="social-input-row">
                      <div className="social-label-box">
                        <Icon size={16} />
                        <span>{s.label}</span>
                      </div>
                      <input
                        type="text"
                        value={(socialLinks as any)[s.key] || ''}
                        onChange={(e) => setSocialLinks({ ...socialLinks, [s.key]: e.target.value })}
                        className="form-control"
                        placeholder={`https://${s.key}.com/yourbrand`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Column — Brand Usage & Tip Card */}
        <div className="brand-side-column">
          <div className="card-section usage-card">
            <h3>Brand Usage</h3>
            <div className="donut-chart-mock">
              <div className="donut-center">
                <span className="donut-number">128</span>
                <span className="donut-label">Generations</span>
              </div>
            </div>
            <div className="usage-legend">
              <div className="legend-item"><span className="dot" style={{ background: colors.primary }} /> Default Brand (62%)</div>
              <div className="legend-item"><span className="dot" style={{ background: colors.secondary }} /> Custom Style (28%)</div>
              <div className="legend-item"><span className="dot" style={{ background: colors.accent }} /> Others (10%)</div>
            </div>
          </div>

          <div className="card-section tip-card">
            <div className="tip-icon"><Sparkles size={20} /></div>
            <h4>Keep your brand consistent</h4>
            <p>Your saved Brand Kit is automatically referenced by AI Studio tools and post generation pipelines.</p>
          </div>
        </div>
      </div>

      <style>{`
        .brand-kit-container {
          padding: var(--space-6) var(--content-px);
          max-width: 1240px;
          margin: 0 auto;
          overflow-y: auto;
          height: 100%;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-6);
        }

        .page-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .page-subtext {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin-top: 4px;
        }

        /* Banner Card */
        .brand-card-banner {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-4) var(--space-6);
          display: flex;
          align-items: center;
          gap: var(--space-4);
          box-shadow: var(--shadow-card);
          margin-bottom: var(--space-6);
        }

        .brand-avatar-badge {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: var(--gradient-primary);
          color: #FFF;
          font-weight: 800;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .brand-details {
          flex: 1;
        }

        .brand-title-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .brand-name-input {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          border: 1px transparent;
          background: transparent;
          color: var(--color-text-primary);
          border-radius: var(--radius-sm);
          padding: 2px 6px;
        }

        .brand-name-input:focus {
          background: var(--color-bg);
          border-color: var(--color-border-input);
          outline: none;
        }

        .brand-id-subtext {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        /* Tabs */
        .brand-tabs-wrapper {
          border-bottom: 1px solid var(--color-border);
          margin-bottom: var(--space-6);
        }

        .brand-tabs {
          display: flex;
          gap: var(--space-4);
          overflow-x: auto;
        }

        .tab-btn {
          padding: var(--space-3) var(--space-2);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition);
          white-space: nowrap;
        }

        .tab-btn.active {
          color: var(--color-primary-start);
          border-bottom-color: var(--color-primary-start);
        }

        /* Main Layout Grid */
        .brand-content-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: var(--space-6);
        }

        .brand-main-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .card-section {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          box-shadow: var(--shadow-card);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-5);
        }

        .section-header h3 {
          font-size: 16px;
          font-weight: 700;
        }

        .section-action {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-primary-start);
          cursor: pointer;
        }

        /* Logos Grid */
        .logos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .logo-box {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .logo-preview-area {
          height: 140px;
          background: #F9FAFB;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-preview-area.dark-bg {
          background: #0F172A;
        }

        .logo-icon-pill {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 20px;
        }

        .logo-meta {
          padding: var(--space-3);
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
        }

        .logo-title {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .logo-size {
          color: var(--color-text-muted);
        }

        .upload-dropzone {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-4);
          border: 1.5px dashed var(--color-primary-start);
          border-radius: var(--radius);
          background: rgba(247, 37, 133, 0.03);
          color: var(--color-primary-start);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
        }

        .upload-dropzone:hover {
          background: rgba(247, 37, 133, 0.08);
        }

        /* Swatches Grid */
        .colors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--space-4);
        }

        .color-swatch-box {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .swatch-preview {
          height: 80px;
        }

        .swatch-info {
          padding: var(--space-3);
          background: var(--color-surface);
        }

        .swatch-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          display: block;
          margin-bottom: 4px;
        }

        .swatch-input-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .color-picker-input {
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          padding: 0;
        }

        .swatch-hex {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        /* Typography */
        .typography-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .font-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
        }

        .font-sample {
          font-size: 20px;
          color: var(--color-text-primary);
        }

        .font-info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-size: 13px;
        }

        .font-weight {
          color: var(--color-text-muted);
        }

        /* Form Controls */
        .voice-form, .social-links-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .form-control {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-input);
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-primary);
          background: var(--color-surface);
          transition: all var(--transition);
        }

        .form-control:focus {
          border-color: var(--color-primary-start);
          outline: none;
        }

        .social-input-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .social-label-box {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 130px;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
          flex-shrink: 0;
        }

        /* Right Rail */
        .brand-side-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .donut-chart-mock {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: conic-gradient(#F72585 0% 62%, #9333EA 62% 90%, #00E5A3 90% 100%);
          margin: var(--space-4) auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .donut-center {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: var(--color-surface);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .donut-number {
          font-size: 22px;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .donut-label {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .usage-legend {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .legend-item .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .tip-card {
          background: linear-gradient(135deg, var(--color-upgrade-start), var(--color-upgrade-end));
          border-color: rgba(236, 72, 153, 0.2);
        }

        .tip-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--color-nav-active-bg);
          color: var(--color-primary-start);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-3);
        }

        .tip-card h4 {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .tip-card p {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        @media (max-width: 992px) {
          .brand-content-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

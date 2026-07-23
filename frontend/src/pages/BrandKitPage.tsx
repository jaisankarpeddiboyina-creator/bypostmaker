import { useState, useEffect, useRef } from 'react'
import {
  Palette,
  Upload,
  Check,
  Plus,
  Type,
  Volume2,
  Share2,
  Sparkles,
  ExternalLink,
  Download,
  Trash2,
  FileText,
  Target,
  Briefcase,
  Search,
  X,
  AlertTriangle,
  Copy,
  Layers,
  RefreshCw,
  Sliders,
  Image as ImageIcon
} from 'lucide-react'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'
import { PLATFORMS, PLATFORM_MAP } from '@@config/platforms'
import { PlatformIcon } from '../components/PlatformIcon'

interface PlatformLinkItem {
  platform_id: string
  url: string
}

export default function BrandKitPage() {
  const { addToast } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'visuals' | 'positioning' | 'voice' | 'platforms'>('overview')

  // UI States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogoType, setUploadingLogoType] = useState<'primary' | 'dark' | 'icon' | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Instant Local Blob Previews for selected image files
  const [primaryLogoPreview, setPrimaryLogoPreview] = useState<string | null>(null)
  const [darkLogoPreview, setDarkLogoPreview] = useState<string | null>(null)
  const [iconLogoPreview, setIconLogoPreview] = useState<string | null>(null)

  // Modals
  const [showPlatformModal, setShowPlatformModal] = useState(false)
  const [platformSearch, setPlatformSearch] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importCandidate, setImportCandidate] = useState<any>(null)

  // Brand Kit State
  const [brandName, setBrandName] = useState('Your Brand')
  const [logoKey, setLogoKey] = useState<string | null>(null)
  const [logoDarkKey, setLogoDarkKey] = useState<string | null>(null)
  const [logoIconKey, setLogoIconKey] = useState<string | null>(null)

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

  const [platformLinks, setPlatformLinks] = useState<PlatformLinkItem[]>([])
  const [productsServices, setProductsServices] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [brandGuidelines, setBrandGuidelines] = useState('')

  // Load Brand Kit on mount
  useEffect(() => {
    setLoading(true)
    api.brandKit.get()
      .then(({ brandKit }) => {
        if (brandKit) {
          if (brandKit.name) setBrandName(brandKit.name)
          if (brandKit.logo_object_key) setLogoKey(brandKit.logo_object_key)
          if (brandKit.logo_dark_key) setLogoDarkKey(brandKit.logo_dark_key)
          if (brandKit.logo_icon_key) setLogoIconKey(brandKit.logo_icon_key)
          if (brandKit.colors) setColors(brandKit.colors)
          if (brandKit.fonts) setFonts(brandKit.fonts)
          if (brandKit.voice) setVoice(brandKit.voice)
          if (Array.isArray(brandKit.platform_links)) setPlatformLinks(brandKit.platform_links)
          if (brandKit.products_services) setProductsServices(brandKit.products_services)
          if (brandKit.target_audience) setTargetAudience(brandKit.target_audience)
          if (brandKit.competitors) setCompetitors(brandKit.competitors)
          if (brandKit.brand_guidelines) setBrandGuidelines(brandKit.brand_guidelines)
        }
      })
      .catch((err) => {
        console.error('Failed to load brand kit:', err)
        addToast('Failed to load brand kit data', 'error')
      })
      .finally(() => {
        setLoading(false)
        setIsDirty(false)
      })
  }, [])

  // Dynamic Google Fonts Loader: Injects font stylesheets whenever heading, body, or accent family changes
  useEffect(() => {
    const families = [fonts.heading?.family, fonts.body?.family, fonts.accent?.family].filter(Boolean)
    families.forEach((fontName) => {
      if (!fontName) return
      const cleanName = fontName.trim()
      const fontId = `gfont-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link')
        link.id = fontId
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cleanName)}:wght@400;600;700;800&display=swap`
        document.head.appendChild(link)
      }
    })
  }, [fonts.heading?.family, fonts.body?.family, fonts.accent?.family])

  // Helper to resolve image URL for key or local preview blob
  const getLogoSrc = (previewBlob: string | null, key: string | null): string | null => {
    if (previewBlob) return previewBlob
    if (key) return `/api/brand-kit?assetKey=${encodeURIComponent(key)}`
    return null
  }

  const primarySrc = getLogoSrc(primaryLogoPreview, logoKey)
  const darkSrc = getLogoSrc(darkLogoPreview, logoDarkKey)
  const iconSrc = getLogoSrc(iconLogoPreview, logoIconKey)

  // Hero logo image (prefers primary, then icon, then dark)
  const heroLogoSrc = primarySrc || iconSrc || darkSrc

  // Brand strength / completeness metric (0-100%)
  const calculateCompleteness = () => {
    let score = 0
    let total = 9

    if (brandName && brandName.trim() !== 'Your Brand' && brandName.trim() !== '') score++
    if (logoKey || logoDarkKey || logoIconKey || primaryLogoPreview || darkLogoPreview || iconLogoPreview) score++
    if (colors.primary && colors.secondary) score++
    if (voice.tone && voice.tone.trim() !== '') score++
    if (voice.dos && voice.dos.trim() !== '') score++
    if (platformLinks.length > 0) score++
    if (productsServices && productsServices.trim() !== '') score++
    if (targetAudience && targetAudience.trim() !== '') score++
    if (brandGuidelines && brandGuidelines.trim() !== '') score++

    return Math.round((score / total) * 100)
  }

  const completenessScore = calculateCompleteness()

  // Save Brand Kit
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.brandKit.save({
        name: brandName,
        logo_object_key: logoKey,
        logo_dark_key: logoDarkKey,
        logo_icon_key: logoIconKey,
        colors,
        fonts,
        voice,
        platform_links: platformLinks,
        products_services: productsServices,
        target_audience: targetAudience,
        competitors,
        brand_guidelines: brandGuidelines,
      })
      addToast('Brand Kit saved successfully!', 'success')
      setIsDirty(false)
    } catch (err: any) {
      addToast(err.message || 'Failed to save Brand Kit', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Presigned Logo Upload handler for 3 logo types
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'primary' | 'dark' | 'icon') => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      addToast('Only JPG, PNG, WEBP, GIF, and SVG images are allowed.', 'error')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      addToast('File size exceeds 15MB limit.', 'error')
      return
    }

    // Create instant local blob preview URL
    const localBlobUrl = URL.createObjectURL(file)
    if (type === 'primary') setPrimaryLogoPreview(localBlobUrl)
    if (type === 'dark') setDarkLogoPreview(localBlobUrl)
    if (type === 'icon') setIconLogoPreview(localBlobUrl)

    setUploadingLogoType(type)
    try {
      const { uploadUrl, objectKey } = await api.upload.presign(file.type, file.size)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!putRes.ok) throw new Error('Upload to storage failed')

      if (type === 'primary') setLogoKey(objectKey)
      if (type === 'dark') setLogoDarkKey(objectKey)
      if (type === 'icon') setLogoIconKey(objectKey)

      setIsDirty(true)
      addToast(`${type.charAt(0).toUpperCase() + type.slice(1)} logo uploaded!`, 'success')
    } catch (err: any) {
      addToast(err.message || 'Logo upload failed', 'error')
    } finally {
      setUploadingLogoType(null)
      e.target.value = ''
    }
  }

  // Clear / Remove Logo
  const handleRemoveLogo = (type: 'primary' | 'dark' | 'icon') => {
    if (type === 'primary') {
      setPrimaryLogoPreview(null)
      setLogoKey(null)
    } else if (type === 'dark') {
      setDarkLogoPreview(null)
      setLogoDarkKey(null)
    } else if (type === 'icon') {
      setIconLogoPreview(null)
      setLogoIconKey(null)
    }
    setIsDirty(true)
    addToast(`Removed ${type} logo.`, 'info')
  }

  // Add platform link
  const handleAddPlatform = (platformId: string) => {
    if (platformLinks.some((p) => p.platform_id === platformId)) {
      addToast('Platform link already added.', 'error')
      return
    }
    const newLinks = [...platformLinks, { platform_id: platformId, url: '' }]
    setPlatformLinks(newLinks)
    setIsDirty(true)
    setShowPlatformModal(false)
  }

  // Update platform link URL
  const handleUpdatePlatformUrl = (platformId: string, url: string) => {
    setPlatformLinks(
      platformLinks.map((item) => (item.platform_id === platformId ? { ...item, url } : item))
    )
    setIsDirty(true)
  }

  // Remove platform link
  const handleRemovePlatform = (platformId: string) => {
    setPlatformLinks(platformLinks.filter((item) => item.platform_id !== platformId))
    setIsDirty(true)
  }

  // Export JSON
  const handleExportJson = () => {
    const data = {
      name: brandName,
      colors,
      fonts,
      voice,
      platform_links: platformLinks,
      products_services: productsServices,
      target_audience: targetAudience,
      competitors,
      brand_guidelines: brandGuidelines,
      logo_object_key: logoKey,
      logo_dark_key: logoDarkKey,
      logo_icon_key: logoIconKey,
      exported_at: new Date().toISOString(),
      version: '1.0',
    }

    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `brand-kit-${(brandName || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addToast('Brand Kit JSON exported!', 'success')
  }

  // Import JSON File Trigger
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string
        const parsed = JSON.parse(text)

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON file format')
        }

        setImportCandidate(parsed)
        setShowImportModal(true)
      } catch (err: any) {
        addToast('Failed to parse JSON file. Ensure it is valid Brand Kit JSON.', 'error')
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!importCandidate) return

    try {
      if (importCandidate.name) setBrandName(importCandidate.name)
      if (importCandidate.colors) setColors({ ...colors, ...importCandidate.colors })
      if (importCandidate.fonts) setFonts({ ...fonts, ...importCandidate.fonts })
      if (importCandidate.voice) setVoice({ ...voice, ...importCandidate.voice })
      if (Array.isArray(importCandidate.platform_links)) setPlatformLinks(importCandidate.platform_links)
      if (importCandidate.products_services) setProductsServices(importCandidate.products_services)
      if (importCandidate.target_audience) setTargetAudience(importCandidate.target_audience)
      if (importCandidate.competitors) setCompetitors(importCandidate.competitors)
      if (importCandidate.brand_guidelines) setBrandGuidelines(importCandidate.brand_guidelines)
      if (importCandidate.logo_object_key) setLogoKey(importCandidate.logo_object_key)
      if (importCandidate.logo_dark_key) setLogoDarkKey(importCandidate.logo_dark_key)
      if (importCandidate.logo_icon_key) setLogoIconKey(importCandidate.logo_icon_key)

      // Auto save after import
      await api.brandKit.save({
        name: importCandidate.name || brandName,
        colors: importCandidate.colors || colors,
        fonts: importCandidate.fonts || fonts,
        voice: importCandidate.voice || voice,
        platform_links: importCandidate.platform_links || platformLinks,
        products_services: importCandidate.products_services || productsServices,
        target_audience: importCandidate.target_audience || targetAudience,
        competitors: importCandidate.competitors || competitors,
        brand_guidelines: importCandidate.brand_guidelines || brandGuidelines,
        logo_object_key: importCandidate.logo_object_key || logoKey,
        logo_dark_key: importCandidate.logo_dark_key || logoDarkKey,
        logo_icon_key: importCandidate.logo_icon_key || logoIconKey,
      })

      addToast('Brand Kit imported and applied!', 'success')
      setShowImportModal(false)
      setImportCandidate(null)
      setIsDirty(false)
    } catch (err: any) {
      addToast(err.message || 'Failed to save imported Brand Kit', 'error')
    }
  }

  // Execute Delete
  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await api.brandKit.delete()

      // Clear all state and previews
      setPrimaryLogoPreview(null)
      setDarkLogoPreview(null)
      setIconLogoPreview(null)
      setBrandName('Your Brand')
      setLogoKey(null)
      setLogoDarkKey(null)
      setLogoIconKey(null)

      setColors({
        primary: '#F72585',
        secondary: '#9333EA',
        accent: '#00E5A3',
        dark: '#0F172A',
        gray: '#64748B',
        light: '#F8FAFC',
      })
      setFonts({
        heading: { family: 'Plus Jakarta Sans', weight: '700' },
        body: { family: 'Plus Jakarta Sans', weight: '400' },
        accent: { family: 'Great Vibes', weight: '400' },
      })
      setVoice({
        tone: '',
        language: 'English (US)',
        dos: '',
        donts: '',
      })
      setPlatformLinks([])
      setProductsServices('')
      setTargetAudience('')
      setCompetitors('')
      setBrandGuidelines('')

      setIsDirty(false)
      setShowDeleteModal(false)
      addToast('Brand Kit deleted and reset to empty state.', 'info')
    } catch (err: any) {
      addToast(err.message || 'Failed to delete Brand Kit', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Copy hex code helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    addToast(`Copied ${text} to clipboard!`, 'success')
  }

  // Filtered platforms for Platform Link Picker Modal
  const availablePlatforms = PLATFORMS.filter(
    (p) =>
      !platformLinks.some((link) => link.platform_id === p.id) &&
      (p.name.toLowerCase().includes(platformSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(platformSearch.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="brand-kit-loading">
        <RefreshCw className="spin-icon" size={32} style={{ color: 'var(--color-primary-start)' }} />
        <span>Loading Brand Kit...</span>
      </div>
    )
  }

  return (
    <div className="brand-kit-container">
      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleImportFileChange}
        style={{ display: 'none' }}
      />

      {/* Top Action Header */}
      <div className="page-header">
        <div>
          <div className="header-title-row">
            <h1 className="page-title">Brand Kit</h1>
            {isDirty && <span className="badge badge-unsaved">Unsaved Changes</span>}
          </div>
          <p className="page-subtext">
            Define your core brand identity, guidelines, and social links to power your AI generation.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn btn-ghost btn-sm" onClick={handleExportJson} title="Export Brand Kit as JSON">
            <Download size={15} />
            <span className="hide-mobile">Export</span>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import Brand Kit from JSON"
          >
            <Upload size={15} />
            <span className="hide-mobile">Import</span>
          </button>
          <button
            className="btn btn-ghost btn-sm btn-danger-ghost"
            onClick={() => setShowDeleteModal(true)}
            title="Delete Brand Kit"
          >
            <Trash2 size={15} />
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes ✨'}
          </button>
        </div>
      </div>

      {/* Executive Hero Banner */}
      <div className="brand-hero-card">
        <div className="hero-left-section">
          <div className="brand-avatar-badge" style={{ background: colors.primary }}>
            {heroLogoSrc ? (
              <img src={heroLogoSrc} alt="Brand Logo Preview" className="hero-avatar-img" />
            ) : (
              (brandName || 'YB').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="brand-header-info">
            <div className="brand-name-edit-row">
              <input
                type="text"
                className="brand-name-input"
                value={brandName}
                onChange={(e) => {
                  setBrandName(e.target.value)
                  setIsDirty(true)
                }}
                placeholder="Enter Brand Name"
              />
              <span className="badge badge-pro">Single Active Brand</span>
            </div>
            <p className="brand-subtitle">
              Referenced automatically across all post generation models & templates.
            </p>
          </div>
        </div>

        {/* Completeness Meter */}
        <div className="hero-completeness-box">
          <div className="completeness-header">
            <span className="completeness-label">Brand Completeness</span>
            <span className="completeness-score">{completenessScore}%</span>
          </div>
          <div className="completeness-track">
            <div
              className="completeness-fill"
              style={{
                width: `${completenessScore}%`,
                background: colors.primary || 'var(--gradient-primary)',
              }}
            />
          </div>
          <span className="completeness-subtext">
            {completenessScore < 100
              ? 'Complete all fields for best AI generation results.'
              : 'Your brand profile is 100% complete!'}
          </span>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="brand-tabs-wrapper">
        <div className="brand-tabs">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'visuals', label: 'Visual Identity', icon: Palette },
            { id: 'positioning', label: 'Market & Audience', icon: Target },
            { id: 'voice', label: 'Voice & Guidelines', icon: Volume2 },
            { id: 'platforms', label: 'Platform Links', icon: Share2, count: platformLinks.length },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="tab-badge">{tab.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="brand-content-grid">
        {/* Main Column */}
        <div className="brand-main-column">
          {/* SECTION: VISUAL IDENTITY (Logos, Colors, Typography) */}
          {(activeTab === 'overview' || activeTab === 'visuals') && (
            <>
              {/* Logos Card */}
              <div className="card-section">
                <div className="section-header">
                  <div>
                    <h3>Brand Logos & Favicons</h3>
                    <p className="section-subtext">Upload assets used in media templates and visual posts.</p>
                  </div>
                </div>

                <div className="logos-grid">
                  {/* Primary Logo */}
                  <div className="logo-box">
                    <div className="logo-preview-area">
                      {primarySrc ? (
                        <div className="logo-image-wrapper">
                          <img src={primarySrc} alt="Primary Logo" className="logo-preview-img" />
                          <button
                            className="remove-logo-btn"
                            onClick={() => handleRemoveLogo('primary')}
                            title="Remove primary logo"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="logo-placeholder-text" style={{ color: colors.primary }}>
                          {brandName || 'Primary Logo'}
                        </span>
                      )}
                    </div>
                    <div className="logo-meta">
                      <div>
                        <span className="logo-title">Primary Logo</span>
                        <span className="logo-size">Light / Universal</span>
                      </div>
                      <label className="logo-upload-btn">
                        <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'primary')} hidden />
                        {uploadingLogoType === 'primary' ? '...' : <Upload size={14} />}
                      </label>
                    </div>
                  </div>

                  {/* Dark Logo */}
                  <div className="logo-box">
                    <div className="logo-preview-area dark-bg">
                      {darkSrc ? (
                        <div className="logo-image-wrapper">
                          <img src={darkSrc} alt="Dark Logo" className="logo-preview-img" />
                          <button
                            className="remove-logo-btn"
                            onClick={() => handleRemoveLogo('dark')}
                            title="Remove dark logo"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="logo-placeholder-text" style={{ color: '#FFFFFF' }}>
                          {brandName || 'Dark Logo'}
                        </span>
                      )}
                    </div>
                    <div className="logo-meta">
                      <div>
                        <span className="logo-title">Dark Mode Logo</span>
                        <span className="logo-size">Dark Surfaces</span>
                      </div>
                      <label className="logo-upload-btn">
                        <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'dark')} hidden />
                        {uploadingLogoType === 'dark' ? '...' : <Upload size={14} />}
                      </label>
                    </div>
                  </div>

                  {/* Icon / Favicon */}
                  <div className="logo-box">
                    <div className="logo-preview-area">
                      {iconSrc ? (
                        <div className="logo-image-wrapper">
                          <img src={iconSrc} alt="App Icon" className="logo-preview-img icon-fit" />
                          <button
                            className="remove-logo-btn"
                            onClick={() => handleRemoveLogo('icon')}
                            title="Remove icon logo"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="logo-icon-pill" style={{ background: colors.primary, color: '#FFF' }}>
                          {(brandName || 'B').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="logo-meta">
                      <div>
                        <span className="logo-title">App Icon / Favicon</span>
                        <span className="logo-size">Square 1:1</span>
                      </div>
                      <label className="logo-upload-btn">
                        <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'icon')} hidden />
                        {uploadingLogoType === 'icon' ? '...' : <Upload size={14} />}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colors Card */}
              <div className="card-section">
                <div className="section-header">
                  <div>
                    <h3>Brand Color System</h3>
                    <p className="section-subtext">Click color pickers or type hex codes to update palette live.</p>
                  </div>
                </div>

                <div className="colors-grid">
                  {[
                    { key: 'primary', label: 'Primary Brand', value: colors.primary },
                    { key: 'secondary', label: 'Secondary Accent', value: colors.secondary },
                    { key: 'accent', label: 'Vibrant Accent', value: colors.accent },
                    { key: 'dark', label: 'Dark Surface', value: colors.dark },
                    { key: 'gray', label: 'Muted Gray', value: colors.gray },
                    { key: 'light', label: 'Light Surface', value: colors.light },
                  ].map((c) => (
                    <div key={c.key} className="color-swatch-card">
                      <div
                        className="swatch-header-preview"
                        style={{
                          background: c.value,
                          border: c.key === 'light' ? '1px solid var(--color-border)' : 'none',
                        }}
                      >
                        <button
                          className="copy-hex-btn"
                          onClick={() => copyToClipboard(c.value)}
                          title="Copy Hex Code"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <div className="swatch-body">
                        <span className="swatch-title">{c.label}</span>
                        <div className="swatch-controls">
                          <input
                            type="color"
                            value={c.value.startsWith('#') && c.value.length === 7 ? c.value : '#000000'}
                            onChange={(e) => {
                              setColors({ ...colors, [c.key]: e.target.value })
                              setIsDirty(true)
                            }}
                            className="color-picker-bubble"
                          />
                          <input
                            type="text"
                            value={c.value}
                            onChange={(e) => {
                              setColors({ ...colors, [c.key]: e.target.value })
                              setIsDirty(true)
                            }}
                            className="hex-text-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography Rules */}
              <div className="card-section">
                <div className="section-header">
                  <div>
                    <h3>Typography Guidelines</h3>
                    <p className="section-subtext">Specify Heading, Body, and Accent font families with live renders.</p>
                  </div>
                </div>

                <div className="typography-grid">
                  {/* Heading Font */}
                  <div className="font-card">
                    <div className="font-card-header">
                      <span className="badge badge-pro">Heading Font</span>
                      <input
                        type="text"
                        className="font-family-input"
                        value={fonts.heading.family}
                        onChange={(e) => {
                          setFonts({ ...fonts, heading: { ...fonts.heading, family: e.target.value } })
                          setIsDirty(true)
                        }}
                        placeholder="Heading Font Family"
                      />
                    </div>
                    <div
                      className="font-preview-box"
                      style={{
                        fontFamily: `'${fonts.heading.family}', sans-serif`,
                        fontWeight: fonts.heading.weight || '700',
                      }}
                    >
                      The quick brown fox jumps over the lazy dog.
                    </div>
                  </div>

                  {/* Body Font */}
                  <div className="font-card">
                    <div className="font-card-header">
                      <span className="badge badge-starter">Body Font</span>
                      <input
                        type="text"
                        className="font-family-input"
                        value={fonts.body.family}
                        onChange={(e) => {
                          setFonts({ ...fonts, body: { ...fonts.body, family: e.target.value } })
                          setIsDirty(true)
                        }}
                        placeholder="Body Font Family"
                      />
                    </div>
                    <div
                      className="font-preview-box"
                      style={{
                        fontFamily: `'${fonts.body.family}', sans-serif`,
                        fontWeight: fonts.body.weight || '400',
                      }}
                    >
                      Clear, readable typography ensures your message lands perfectly on social feeds.
                    </div>
                  </div>

                  {/* Accent Font */}
                  <div className="font-card">
                    <div className="font-card-header">
                      <span className="badge badge-business">Accent Font</span>
                      <input
                        type="text"
                        className="font-family-input"
                        value={fonts.accent.family}
                        onChange={(e) => {
                          setFonts({ ...fonts, accent: { ...fonts.accent, family: e.target.value } })
                          setIsDirty(true)
                        }}
                        placeholder="Accent Font Family"
                      />
                    </div>
                    <div
                      className="font-preview-box"
                      style={{
                        fontFamily: `'${fonts.accent.family}', cursive, sans-serif`,
                        fontWeight: fonts.accent.weight || '400',
                        fontSize: '22px',
                      }}
                    >
                      Elegant accent typography for badges, quotes, and highlights.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SECTION: POSITIONING & MARKET (Products/Services, Audience, Competitors) */}
          {(activeTab === 'overview' || activeTab === 'positioning') && (
            <div className="card-section">
              <div className="section-header">
                <div>
                  <h3>Market & Strategic Positioning</h3>
                  <p className="section-subtext">
                    Provide context on your product line, ideal customers, and competitive space.
                  </p>
                </div>
              </div>

              <div className="positioning-form">
                {/* Products & Services */}
                <div className="form-group">
                  <label className="form-label">
                    <Briefcase size={15} style={{ color: 'var(--color-primary-start)' }} />
                    <span>Products & Services</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={productsServices}
                    onChange={(e) => {
                      setProductsServices(e.target.value)
                      setIsDirty(true)
                    }}
                    placeholder="e.g. AI Content Generator SaaS, Social Media Scheduling tool, Pro Creator subscription plans..."
                  />
                </div>

                {/* Target Audience */}
                <div className="form-group">
                  <label className="form-label">
                    <Target size={15} style={{ color: 'var(--color-primary-start)' }} />
                    <span>Target Audience & ICP</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={targetAudience}
                    onChange={(e) => {
                      setTargetAudience(e.target.value)
                      setIsDirty(true)
                    }}
                    placeholder="e.g. Founders, Solopreneurs, Marketing Leads, Content Creators managing multi-platform growth..."
                  />
                </div>

                {/* Competitors */}
                <div className="form-group">
                  <label className="form-label">
                    <Sliders size={15} style={{ color: 'var(--color-primary-start)' }} />
                    <span>Key Competitors & Alternatives</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={competitors}
                    onChange={(e) => {
                      setCompetitors(e.target.value)
                      setIsDirty(true)
                    }}
                    placeholder="e.g. Buffer, Hootsuite, Jasper AI, Copy.ai..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION: VOICE & GUIDELINES */}
          {(activeTab === 'overview' || activeTab === 'voice') && (
            <div className="card-section">
              <div className="section-header">
                <div>
                  <h3>Voice & Brand Guidelines</h3>
                  <p className="section-subtext">Formulate tone rules, language preferences, and style instructions.</p>
                </div>
              </div>

              <div className="voice-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Brand Tone of Voice</label>
                    <input
                      type="text"
                      className="form-control"
                      value={voice.tone}
                      onChange={(e) => {
                        setVoice({ ...voice, tone: e.target.value })
                        setIsDirty(true)
                      }}
                      placeholder="e.g. Confident, Authoritative, Witty, High-signal"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primary Language & Locale</label>
                    <input
                      type="text"
                      className="form-control"
                      value={voice.language}
                      onChange={(e) => {
                        setVoice({ ...voice, language: e.target.value })
                        setIsDirty(true)
                      }}
                      placeholder="English (US)"
                    />
                  </div>
                </div>

                {/* Copywriting Do's */}
                <div className="form-group">
                  <label className="form-label text-success-label">
                    <Check size={14} />
                    <span>Copywriting Do's (Positive Rules)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={voice.dos}
                    onChange={(e) => {
                      setVoice({ ...voice, dos: e.target.value })
                      setIsDirty(true)
                    }}
                    placeholder="e.g. Use strong action verbs, keep hooks punchy under 10 words, add relevant emojis..."
                  />
                </div>

                {/* Copywriting Don'ts */}
                <div className="form-group">
                  <label className="form-label text-error-label">
                    <X size={14} />
                    <span>Copywriting Don'ts (Avoid List)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={voice.donts}
                    onChange={(e) => {
                      setVoice({ ...voice, donts: e.target.value })
                      setIsDirty(true)
                    }}
                    placeholder="e.g. Never use corporate jargon, avoid 'excited to share', no passive voice..."
                  />
                </div>

                {/* Free-form Brand Guidelines */}
                <div className="form-group">
                  <label className="form-label">
                    <FileText size={15} style={{ color: 'var(--color-primary-start)' }} />
                    <span>Comprehensive Brand Guidelines (Free-form)</span>
                  </label>
                  <textarea
                    className="form-control mono-font"
                    rows={5}
                    value={brandGuidelines}
                    onChange={(e) => {
                      setBrandGuidelines(e.target.value)
                      setIsDirty(true)
                    }}
                    placeholder="Write or paste any custom style rules, editorial guidelines, capitalization rules, or brand instructions here..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION: PLATFORM LINKS & PRESENCE */}
          {(activeTab === 'overview' || activeTab === 'platforms') && (
            <div className="card-section">
              <div className="section-header">
                <div>
                  <h3>Platform Profiles & Social Links</h3>
                  <p className="section-subtext">
                    Add social profile URLs for every platform supported by PostMaker ({PLATFORMS.length} available).
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPlatformModal(true)}>
                  <Plus size={15} />
                  <span>Add Platform Link</span>
                </button>
              </div>

              {platformLinks.length === 0 ? (
                <div className="empty-platform-box">
                  <Share2 size={32} style={{ color: 'var(--color-text-muted)', marginBottom: 8 }} />
                  <h4>No Platform Links Added</h4>
                  <p>Link your social media profiles to embed handles and CTAs into generated posts.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowPlatformModal(true)} style={{ marginTop: 12 }}>
                    <Plus size={14} />
                    <span>Select & Add Platform</span>
                  </button>
                </div>
              ) : (
                <div className="platform-links-list">
                  {platformLinks.map((link) => {
                    const platformObj = PLATFORM_MAP[link.platform_id]
                    return (
                      <div key={link.platform_id} className="platform-link-row">
                        <div className="platform-link-meta">
                          <PlatformIcon id={link.platform_id} size={22} useBrandColor={true} />
                          <span className="platform-name-tag">
                            {platformObj ? platformObj.name : link.platform_id}
                          </span>
                        </div>

                        <div className="platform-link-input-wrap">
                          <input
                            type="text"
                            className="form-control platform-url-input"
                            value={link.url}
                            onChange={(e) => handleUpdatePlatformUrl(link.platform_id, e.target.value)}
                            placeholder={`https://${link.platform_id}.com/yourbrand`}
                          />
                          {link.url && (
                            <a
                              href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-icon"
                              title="Test link"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleRemovePlatform(link.platform_id)}
                            title="Remove platform link"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="brand-side-column">
          {/* Quick Summary Card */}
          <div className="card-section side-summary-card">
            <h3>Brand Overview</h3>
            <div className="summary-stat-list">
              <div className="stat-row">
                <span className="stat-label">Active Name</span>
                <span className="stat-value">{brandName || 'Untitled'}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Primary Color</span>
                <div className="stat-color-pill">
                  <span className="swatch-dot" style={{ background: colors.primary }} />
                  <span>{colors.primary}</span>
                </div>
              </div>
              <div className="stat-row">
                <span className="stat-label">Platform Links</span>
                <span className="stat-badge">{platformLinks.length} active</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Heading Font</span>
                <span className="stat-value" style={{ fontFamily: `'${fonts.heading.family}', sans-serif` }}>
                  {fonts.heading.family}
                </span>
              </div>
            </div>
          </div>

          {/* Guidelines Tips Card */}
          <div className="card-section tip-card">
            <div className="tip-icon">
              <Sparkles size={20} />
            </div>
            <h4>Automatic AI Context</h4>
            <p>
              When you generate posts for X, LinkedIn, Instagram, or Reddit, PostMaker injects your saved tone, guidelines, and social handles into Stage 2 prompt generation automatically.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL 1: PLATFORM PICKER MODAL */}
      {showPlatformModal && (
        <div className="modal-overlay" onClick={() => setShowPlatformModal(false)}>
          <div className="modal platform-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Platform</h3>
              <button className="btn-icon" onClick={() => setShowPlatformModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-search-box">
              <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                className="modal-search-input"
                placeholder="Search platforms (e.g. LinkedIn, Twitter, YouTube...)"
                value={platformSearch}
                onChange={(e) => setPlatformSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="platform-picker-grid">
              {availablePlatforms.map((p) => (
                <button key={p.id} className="platform-picker-item" onClick={() => handleAddPlatform(p.id)}>
                  <PlatformIcon id={p.id} size={22} useBrandColor={true} />
                  <span className="platform-item-name">{p.name}</span>
                  <span className="platform-item-group">{p.group}</span>
                </button>
              ))}

              {availablePlatforms.length === 0 && (
                <div className="no-platforms-found">
                  <span>No matching platforms found or all platforms already added.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: IMPORT PREVIEW MODAL */}
      {showImportModal && importCandidate && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Brand Kit JSON</h3>
              <button className="btn-icon" onClick={() => setShowImportModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="import-preview-body">
              <p className="import-intro">Review the details from the imported file before applying:</p>

              <div className="import-preview-details">
                <div className="import-detail-row">
                  <strong>Brand Name:</strong> {importCandidate.name || 'Not specified'}
                </div>
                <div className="import-detail-row">
                  <strong>Primary Color:</strong>{' '}
                  <span className="swatch-dot" style={{ background: importCandidate.colors?.primary || '#F72585' }} />{' '}
                  {importCandidate.colors?.primary || '#F72585'}
                </div>
                <div className="import-detail-row">
                  <strong>Tone of Voice:</strong> {importCandidate.voice?.tone || 'Not specified'}
                </div>
                <div className="import-detail-row">
                  <strong>Platform Links:</strong> {Array.isArray(importCandidate.platform_links) ? importCandidate.platform_links.length : 0} links
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowImportModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleConfirmImport}>
                  Confirm & Apply Import ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal modal-danger" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-danger-title">
                <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
                <h3>Delete Brand Kit?</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowDeleteModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="delete-modal-body">
              <p>
                Are you sure you want to delete your Brand Kit? This action will permanently remove your saved brand configuration and reset your page to an empty state.
              </p>
              <p className="delete-warning-subtext">This action cannot be undone.</p>

              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-danger-solid" onClick={handleConfirmDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Yes, Delete Brand Kit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGE SCOPED STYLES (VANILLA CSS TOKENS ONLY) */}
      <style>{`
        .brand-kit-container {
          padding: var(--space-6) var(--content-px);
          max-width: 1280px;
          margin: 0 auto;
          overflow-y: auto;
          height: 100%;
        }

        .brand-kit-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 60vh;
          gap: var(--space-4);
          color: var(--color-text-secondary);
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .header-title-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
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

        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .badge-unsaved {
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border: 1px solid var(--color-warning-border);
          font-size: 11px;
        }

        .btn-danger-ghost {
          color: var(--color-error);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .btn-danger-ghost:hover {
          background: var(--color-error-bg);
          border-color: var(--color-error);
        }

        .btn-danger-solid {
          background: var(--color-error);
          box-shadow: none;
        }
        .btn-danger-solid:hover {
          filter: brightness(1.1);
        }

        /* Hero Banner Card */
        .brand-hero-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-6);
          box-shadow: var(--shadow-card);
          margin-bottom: var(--space-6);
        }

        .hero-left-section {
          display: flex;
          align-items: center;
          gap: var(--space-5);
          flex: 1;
        }

        .brand-avatar-badge {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          color: #FFF;
          font-weight: 800;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .hero-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .brand-header-info {
          flex: 1;
        }

        .brand-name-edit-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .brand-name-input {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          border: 1.5px solid transparent;
          background: transparent;
          color: var(--color-text-primary);
          border-radius: var(--radius-sm);
          padding: 2px 6px;
          transition: all var(--transition);
        }

        .brand-name-input:focus {
          background: var(--color-bg);
          border-color: var(--color-border-input);
          outline: none;
        }

        .brand-subtitle {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: 4px;
        }

        .hero-completeness-box {
          width: 280px;
          padding: var(--space-4);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
        }

        .completeness-header {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .completeness-score {
          color: var(--color-primary-start);
        }

        .completeness-track {
          height: 6px;
          background: var(--color-border-input);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 6px;
        }

        .completeness-fill {
          height: 100%;
          transition: width 300ms ease;
        }

        .completeness-subtext {
          font-size: 11px;
          color: var(--color-text-muted);
          display: block;
        }

        /* Tabs */
        .brand-tabs-wrapper {
          border-bottom: 1px solid var(--color-border);
          margin-bottom: var(--space-6);
        }

        .brand-tabs {
          display: flex;
          gap: var(--space-5);
          overflow-x: auto;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) 4px;
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

        .tab-btn:hover {
          color: var(--color-text-primary);
        }

        .tab-btn.active {
          color: var(--color-primary-start);
          border-bottom-color: var(--color-primary-start);
        }

        .tab-badge {
          background: var(--color-nav-active-bg);
          color: var(--color-primary-start);
          font-size: 11px;
          padding: 2px 6px;
          border-radius: var(--radius-pill);
          font-weight: 700;
        }

        /* Content Grid */
        .brand-content-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
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
          font-size: 17px;
          font-weight: 700;
        }

        .section-subtext {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }

        /* Logos Grid */
        .logos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: var(--space-4);
        }

        .logo-box {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .logo-preview-area {
          height: 120px;
          background: var(--color-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: var(--space-2);
        }

        .logo-preview-area.dark-bg {
          background: #0F172A;
        }

        .logo-image-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .logo-preview-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .logo-preview-img.icon-fit {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
        }

        .remove-logo-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          color: #FFF;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity var(--transition);
        }
        .remove-logo-btn:hover { opacity: 1; background: var(--color-error); }

        .logo-placeholder-text {
          font-weight: 800;
          font-size: 18px;
        }

        .logo-icon-pill {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
        }

        .logo-meta {
          padding: var(--space-3);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
        }

        .logo-title {
          font-size: 12px;
          font-weight: 700;
          display: block;
        }

        .logo-size {
          font-size: 11px;
          color: var(--color-text-muted);
        }

        .logo-upload-btn {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background: var(--color-bg);
          border: 1px solid var(--color-border-input);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: all var(--transition);
        }

        .logo-upload-btn:hover {
          border-color: var(--color-primary-start);
          color: var(--color-primary-start);
        }

        /* Swatches */
        .colors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--space-4);
        }

        .color-swatch-card {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .swatch-header-preview {
          height: 70px;
          position: relative;
          display: flex;
          justify-content: flex-end;
          padding: 6px;
        }

        .copy-hex-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: rgba(255,255,255,0.85);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #1A1A1A;
          opacity: 0.8;
          transition: opacity var(--transition);
        }
        .copy-hex-btn:hover { opacity: 1; }

        .swatch-body {
          padding: var(--space-3);
          background: var(--color-surface);
        }

        .swatch-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          display: block;
          margin-bottom: 6px;
        }

        .swatch-controls {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .color-picker-bubble {
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          padding: 0;
          background: transparent;
        }

        .hex-text-input {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          width: 100%;
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-sm);
          padding: 4px 6px;
          color: var(--color-text-primary);
        }

        /* Typography */
        .typography-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--space-4);
        }

        .font-card {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-4);
        }

        .font-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .font-family-input {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-sm);
          padding: 4px 8px;
          width: 140px;
        }

        .font-preview-box {
          font-size: 15px;
          color: var(--color-text-primary);
          padding: var(--space-3);
          background: var(--color-bg);
          border-radius: var(--radius-sm);
          line-height: 1.4;
          min-height: 70px;
          word-break: break-word;
        }

        /* Form Controls */
        .positioning-form, .voice-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .text-success-label { color: var(--color-success); }
        .text-error-label   { color: var(--color-error); }

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

        .form-control.mono-font {
          font-family: var(--font-mono);
          font-size: 13px;
        }

        .form-control:focus {
          border-color: var(--color-primary-start);
          outline: none;
        }

        /* Platform Links */
        .empty-platform-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
          border: 1.5px dashed var(--color-border-input);
          border-radius: var(--radius);
          text-align: center;
        }

        .platform-links-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .platform-link-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-3) var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-surface);
        }

        .platform-link-meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          min-width: 140px;
        }

        .platform-name-tag {
          font-size: 14px;
          font-weight: 700;
        }

        .platform-link-input-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }

        .platform-url-input {
          font-family: var(--font-mono);
          font-size: 13px;
        }

        .btn-icon-danger {
          color: var(--color-text-muted);
        }
        .btn-icon-danger:hover {
          color: var(--color-error);
          background: var(--color-error-bg);
        }

        /* Sidebar Column */
        .brand-side-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .side-summary-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: var(--space-4);
        }

        .summary-stat-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--color-border);
        }
        .stat-row:last-child { border-bottom: none; }

        .stat-label { color: var(--color-text-secondary); }
        .stat-value { font-weight: 600; }

        .stat-color-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
        }

        .swatch-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .stat-badge {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-primary-start);
        }

        .tip-card {
          background: var(--color-upgrade-start);
          border-color: rgba(247, 37, 133, 0.15);
        }

        .tip-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--gradient-primary);
          color: #FFF;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-3);
        }

        .tip-card h4 {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .tip-card p {
          font-size: 13px;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        /* Platform Picker Modal */
        .platform-picker-modal {
          max-width: 580px;
          width: 92vw;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }

        .modal-header-danger-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .modal-search-box {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: 8px 12px;
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-input);
          margin-bottom: var(--space-4);
        }

        .modal-search-input {
          border: none;
          outline: none;
          width: 100%;
          font-family: var(--font-body);
          font-size: 14px;
        }

        .platform-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: var(--space-2);
          max-height: 340px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .platform-picker-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-surface);
          cursor: pointer;
          transition: all var(--transition);
          text-align: left;
        }

        .platform-picker-item:hover {
          border-color: var(--color-primary-start);
          background: var(--color-nav-active-bg);
        }

        .platform-item-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .platform-item-group {
          font-size: 11px;
          color: var(--color-text-muted);
          text-transform: capitalize;
        }

        .no-platforms-found {
          grid-column: 1 / -1;
          padding: var(--space-6);
          text-align: center;
          font-size: 13px;
          color: var(--color-text-muted);
        }

        /* Import / Delete Modals */
        .import-preview-body, .delete-modal-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .import-preview-details {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .delete-warning-subtext {
          color: var(--color-error);
          font-weight: 600;
          font-size: 13px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          margin-top: var(--space-4);
        }

        /* Responsive Breakpoints */
        @media (max-width: 990px) {
          .brand-hero-card {
            flex-direction: column;
            align-items: stretch;
          }
          .hero-completeness-box {
            width: 100%;
          }
          .brand-content-grid {
            grid-template-columns: 1fr;
          }
          .typography-grid, .form-row-2 {
            grid-template-columns: 1fr;
          }
          .hide-mobile {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }
          .header-actions {
            width: 100%;
            justify-content: space-between;
          }
          .platform-link-row {
            flex-direction: column;
            align-items: stretch;
          }
          .platform-link-meta {
            margin-bottom: 4px;
          }
          .platform-picker-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  )
}

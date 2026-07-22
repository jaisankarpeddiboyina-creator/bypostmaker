import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Search,
  Send,
  Paperclip,
  Palette,
  BookOpen,
  Edit3,
  Image as ImageIcon,
  Video,
  Scissors,
  Wand2,
  Mic,
  Hash,
  FileText,
  TrendingUp,
  ArrowRight,
  Zap
} from 'lucide-react'
import { STUDIO_TOOLS, type StudioTool } from '../../../config/tools'


export default function StudioPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [chatPrompt, setChatPrompt] = useState('')

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'content', label: 'Content' },
    { id: 'image', label: 'Image' },
    { id: 'video', label: 'Video' },
    { id: 'design', label: 'Design' },
    { id: 'edit', label: 'Edit' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'utility', label: 'Utility' },
  ]

  const filteredTools = STUDIO_TOOLS.filter((tool) => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'Image':
        return ImageIcon
      case 'Edit3':
        return Edit3
      case 'Video':
        return Video
      case 'Scissors':
        return Scissors
      case 'Wand2':
        return Wand2
      case 'Mic':
        return Mic
      case 'Hash':
        return Hash
      case 'Palette':
        return Palette
      default:
        return Sparkles
    }
  }

  const handleToolClick = (tool: StudioTool) => {
    if (tool.route) {
      navigate(tool.route)
    }
  }

  return (
    <div className="studio-container">
      {/* Top Banner Header */}
      <div className="studio-header">
        <div className="header-badge">
          <Sparkles size={16} style={{ color: 'var(--color-primary-start)' }} />
          <span>AI Studio Hub</span>
        </div>
        <h1 className="studio-title">Chat with AI. Create <span className="gradient-text">anything.</span></h1>
        <p className="studio-subtext">Ask me to write, design, edit, plan, research or create content with your Brand Kit.</p>

        {/* Studio Interactive Prompt Input Box */}
        <div className="studio-prompt-box">
          <input
            type="text"
            className="prompt-input"
            placeholder='e.g. "Create a viral YouTube thumbnail for productivity hacks"'
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && chatPrompt.trim()) {
                navigate(`/app/studio/thumbnail?prompt=${encodeURIComponent(chatPrompt)}`)
              }
            }}
          />
          <div className="prompt-actions-row">
            <div className="chip-actions">
              <button className="prompt-chip" onClick={() => navigate('/app/brand-kit')}>
                <Palette size={14} />
                <span>Brand Kit</span>
              </button>
              <button className="prompt-chip" onClick={() => navigate('/app/create')}>
                <BookOpen size={14} />
                <span>Templates</span>
              </button>
            </div>
            <button
              className="btn btn-primary send-btn"
              onClick={() => {
                if (chatPrompt.trim()) {
                  navigate(`/app/studio/thumbnail?prompt=${encodeURIComponent(chatPrompt)}`)
                }
              }}
            >
              <span>Send</span>
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="quick-suggestions">
          <button className="suggestion-pill" onClick={() => navigate('/app/studio/thumbnail')}>
            🎬 Design YouTube thumbnail
          </button>
          <button className="suggestion-pill" onClick={() => navigate('/app/create')}>
            📷 Create Instagram post
          </button>
          <button className="suggestion-pill" onClick={() => navigate('/app/create')}>
            💼 Write a LinkedIn article
          </button>
        </div>
      </div>

      {/* Category Filter Chips & Search Bar */}
      <div className="filter-section">
        <div className="category-chips">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`cat-chip ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="studio-search-input"
            placeholder="Search AI tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Powerful AI Tools Grid */}
      <div className="tools-section">
        <div className="section-title-row">
          <h2>Powerful AI Tools</h2>
          <span className="total-count">{filteredTools.length} Tools Available</span>
        </div>

        <div className="tools-grid">
          {filteredTools.map((tool) => {
            const Icon = getToolIcon(tool.iconName)
            return (
              <div
                key={tool.id}
                className="tool-card"
                onClick={() => handleToolClick(tool)}
              >
                <div className="tool-card-header">
                  <div className="tool-icon-box">
                    <Icon size={22} />
                  </div>
                  {tool.badge && (
                    <span className={`badge ${tool.badge === 'Popular' ? 'badge-pro' : 'badge-starter'}`}>
                      {tool.badge}
                    </span>
                  )}
                </div>

                <h3 className="tool-name">{tool.name}</h3>
                <p className="tool-desc">{tool.description}</p>

                <div className="tool-card-footer">
                  <span className="launch-text">Open Tool</span>
                  <ArrowRight size={14} className="arrow-icon" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .studio-container {
          padding: var(--space-6) var(--content-px);
          max-width: 1240px;
          margin: 0 auto;
          overflow-y: auto;
          height: 100%;
        }

        .studio-header {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-8);
          margin-bottom: var(--space-6);
          box-shadow: var(--shadow-card);
          position: relative;
        }

        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          background: var(--color-nav-active-bg);
          color: var(--color-primary-start);
          font-size: 13px;
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .studio-title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: var(--space-2);
        }

        .gradient-text {
          background: var(--gradient-primary-h);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .studio-subtext {
          font-size: 15px;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-6);
        }

        /* Studio Prompt Box */
        .studio-prompt-box {
          border: 1.5px solid var(--color-border-input);
          border-radius: var(--radius-card);
          padding: var(--space-4);
          background: var(--color-bg);
          transition: all var(--transition);
        }

        .studio-prompt-box:focus-within {
          border-color: var(--color-primary-start);
          box-shadow: 0 0 0 3px rgba(247, 37, 133, 0.1);
        }

        .prompt-input {
          width: 100%;
          border: none;
          background: transparent;
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-text-primary);
          outline: none;
          margin-bottom: var(--space-3);
        }

        .prompt-actions-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .chip-actions {
          display: flex;
          gap: var(--space-2);
        }

        .prompt-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-pill);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition);
        }

        .prompt-chip:hover {
          border-color: var(--color-primary-start);
          color: var(--color-primary-start);
        }

        .send-btn {
          height: 36px;
          padding: 0 var(--space-4);
          font-size: 13px;
        }

        /* Suggestions */
        .quick-suggestions {
          display: flex;
          gap: var(--space-2);
          margin-top: var(--space-4);
          flex-wrap: wrap;
        }

        .suggestion-pill {
          padding: 6px 14px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-pill);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition);
        }

        .suggestion-pill:hover {
          background: var(--color-surface);
          color: var(--color-primary-start);
          border-color: var(--color-primary-start);
        }

        /* Filter Section */
        .filter-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-6);
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .category-chips {
          display: flex;
          gap: var(--space-2);
          overflow-x: auto;
        }

        .cat-chip {
          padding: 8px 16px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-pill);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition);
          white-space: nowrap;
        }

        .cat-chip.active {
          background: var(--gradient-primary);
          color: #FFF;
          border-color: transparent;
        }

        .search-wrapper {
          position: relative;
          min-width: 240px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
        }

        .studio-search-input {
          width: 100%;
          padding: 8px 14px 8px 38px;
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-pill);
          font-size: 13px;
          background: var(--color-surface);
          outline: none;
        }

        /* Tools Section */
        .section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }

        .section-title-row h2 {
          font-size: 20px;
          font-weight: 700;
        }

        .total-count {
          font-size: 13px;
          color: var(--color-text-muted);
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-5);
        }

        .tool-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          box-shadow: var(--shadow-card);
          cursor: pointer;
          transition: all var(--transition);
          display: flex;
          flex-direction: column;
        }

        .tool-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-card-hover);
          border-color: var(--color-primary-start);
        }

        .tool-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }

        .tool-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--color-nav-active-bg);
          color: var(--color-primary-start);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tool-name {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .tool-desc {
          font-size: 13px;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin-bottom: var(--space-5);
          flex: 1;
        }

        .tool-card-footer {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-primary-start);
        }

        .tool-card:hover .arrow-icon {
          transform: translateX(4px);
        }

        .arrow-icon {
          transition: transform var(--transition);
        }

        @media (max-width: 768px) {
          .filter-section {
            flex-direction: column;
            align-items: stretch;
          }
          .search-wrapper {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

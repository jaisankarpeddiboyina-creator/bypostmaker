import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ImageOff,
  Download,
  Loader2
} from 'lucide-react'
import { generateClientZip } from '../lib/downloadKit'
import { api } from '../lib/api'
import { useAppStore } from '../store/app'
import { PLATFORM_MAP } from '@@config/platforms'
interface HistoryCampaign {
  id: string
  prompt: string
  platforms: string[]
  has_image: number
  image_key: string | null
  image_fetch_url: string | null
  has_video: number
  status: string
  generated_count: number
  created_at: number
  posts: Array<{
    platform_id: string
    content: string
    edited: number
  }>
}
export default function HistoryPage() {
  const {
    addToast,
    setPrompt,
    setSelectedPlatforms
  } = useAppStore()
  const navigate = useNavigate()
  const [campaigns,setCampaigns] =
    useState<HistoryCampaign[]>([])
  const [pagination,setPagination] =
    useState({
      page:1,
      total:0,
      pages:1
    })
  const [loading,setLoading] =
    useState(true)
  const [expandedId,setExpandedId] =
    useState<string | null>(null)
  const [copiedKey,setCopiedKey] =
    useState<string | null>(null)
  const [downloadId,setDownloadId] =
    useState<string | null>(null)
  const load = async(page = 1)=>{
    setLoading(true)
    try{
      const res = await api.history.list(page)
      setCampaigns(res.campaigns)
      setPagination({
        page,
        total:res.pagination.total,
        pages:res.pagination.pages
      })
    }catch(error){
      console.error(error)
      addToast(
        'Failed to load history',
        'error'
      )
    }
    finally{
      setLoading(false)
    }
  }
  useEffect(()=>{
    load(1)
  }, [])
  const handleCopyPost = async(
    content:string,
    key:string
  )=>{
    await navigator.clipboard.writeText(content)
    setCopiedKey(key)
    setTimeout(()=>{
      setCopiedKey(null)
    },2000)
  }
  const handleReuse = (
    campaign:HistoryCampaign
  )=>{
    setPrompt(
      campaign.prompt
    )
    setSelectedPlatforms(
      campaign.platforms
    )
    addToast(
      'Prompt loaded. Re-upload any media if needed.',
      'info'
    )
    navigate('/app')
  }
  const handleDownloadKit = async(
    campaign:HistoryCampaign
  )=>{
    try{
      setDownloadId(
        campaign.id
      )
      const postsList =
        campaign.posts.map(post=>({
          platformId:post.platform_id,
          content:post.content,
          edited:Boolean(post.edited)
        }))
      const zipBlob =
        await generateClientZip(
          campaign.id,
          campaign.prompt,
          postsList,
          [],
          null,
          ()=>{}
        )
      const url =
        URL.createObjectURL(zipBlob)
      const link =
        document.createElement('a')
      link.href=url
      link.download =
        `postmaker_${campaign.id}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(()=>{
        URL.revokeObjectURL(url)
      },1000)
      addToast(
        'Download started',
        'success'
      )
    }
    catch(error){
      console.error(
        "Download failed:",
        error
      )
      addToast(
        'Failed to download kit',
        'error'
      )
    }
    finally{
      setDownloadId(null)
    }
  }
  const formatDate = (
    unix:number
  )=>{
    const d =
      new Date(unix * 1000)
    return d.toLocaleDateString(
      undefined,
      {
        month:'short',
        day:'numeric',
        year:'numeric'
      }
    )
  }
  return (
  <div className="history-page">
    <div className="history-inner">
      <div className="history-header">
        <h1 className="history-title">
          History
        </h1>
        <p className="history-sub">
          {pagination.total} campaigns
        </p>
      </div>
      {loading && (
        <div className="history-loading">
          {[...Array(5)].map((_,i)=>(
            <div
              key={i}
              className="history-skeleton"
            />
          ))}
        </div>
      )}
      {!loading && campaigns.length === 0 && (
        <div className="history-empty">
          <Clock size={32}/>
          <p>
            No campaigns yet
          </p>
          <button
            className="btn btn-primary"
            onClick={()=>navigate('/app')}
          >
            Create your first kit →
          </button>
        </div>
      )}
      {!loading && campaigns.map(c=>(
        <div
          key={c.id}
          className="history-card"
        >
          {/* HEADER */}
          <div
            className="history-card-header"
            onClick={()=>{
              setExpandedId(
                expandedId === c.id
                ? null
                : c.id
              )
            }}
          >
            <div className="history-card-meta">
              <span className="history-card-date">
                {formatDate(c.created_at)}
              </span>
              <span className="history-card-count">
                {c.generated_count} platforms
              </span>
              {c.has_video ? (
                <span className="history-tag">
                  Video
                </span>
              ):null}
              {c.has_image ? (
                <span className="history-tag">
                  Image
                </span>
              ):null}
            </div>
            <p className="history-card-prompt">
              {c.prompt}
            </p>
            <div className="history-card-platforms">
              {c.platforms.slice(0,8).map(id=>(
                <span
                  key={id}
                  className="history-platform-pill"
                >
                  {
                    PLATFORM_MAP[id]?.name
                    ?? id
                  }
                </span>
              ))}
              {c.platforms.length > 8 && (
                <span className="history-platform-more">
                  +{c.platforms.length-8} more
                </span>
              )}
            </div>
            {/* BUTTON AREA */}
            <div
              className="history-card-actions"
              onClick={(e)=>
                e.stopPropagation()
              }
            >
              <button
                className="btn btn-ghost history-reuse-btn"
                onClick={()=>handleReuse(c)}
              >
                <RefreshCw size={13}/>
                Re-use prompt
              </button>
              <button
                className="btn btn-ghost history-download-btn"
                onClick={()=>handleDownloadKit(c)}
                disabled={
                  downloadId === c.id
                }
              >
                {
                  downloadId === c.id
                  ?
                  (
                    <>
                      <Loader2
                        size={13}
                        className="spin"
                      />
                      Downloading...
                    </>
                  )
                  :
                  (
                    <>
                      <Download size={13}/>
                      Download Kit
                    </>
                  )
                }
              </button>
            </div>
          </div>
          {/* EXPANDED POSTS */}
          {
            expandedId === c.id && (
              <div className="history-posts">
                {
                  c.has_image === 1 && (
                    <div className="history-image-preview">
                      {
                        c.image_fetch_url
                        ?
                        (
                          <img
                            src={c.image_fetch_url}
                            alt="Campaign image"
                            className="history-img"
                            loading="lazy"
                          />
                        )
                        :
                        (
                          <div className="history-img-expired">
                            <ImageOff size={16}/>
                            <span>
                              Image expired
                            </span>
                          </div>
                        )
                      }
                    </div>
                  )
                }
                {
                  c.posts.map(post=>(
                    <div
                      key={post.platform_id}
                      className="history-post"
                    >
                      <div className="history-post-header">
                        <span className="history-post-platform">
                          {
                            PLATFORM_MAP[post.platform_id]?.name
                            ??
                            post.platform_id
                          }
                        </span>
                        {
                          post.edited
                          ?
                          <span className="history-post-edited">
                            edited
                          </span>
                          :
                          null
                        }
                        <button
                          className="btn-icon history-copy-btn"
                          onClick={()=>handleCopyPost(
                            post.content,
                            `${c.id}:${post.platform_id}`
                          )}
                        >
                          {
                            copiedKey ===
                            `${c.id}:${post.platform_id}`
                            ?
                            <Check size={13}/>
                            :
                            <Copy size={13}/>
                          }
                        </button>
                      </div>
                      <p className="history-post-content">
                        {post.content}
                      </p>
                    </div>
                  ))
                }
              </div>
            )
          }
        </div>
      ))}
      {/* PAGINATION */}
      {
        pagination.pages > 1 && (
          <div className="history-pagination">
            <button
              className="btn btn-ghost"
              onClick={()=>
                load(pagination.page-1)
              }
              disabled={
                pagination.page===1
              }
            >
              <ChevronLeft size={14}/>
              Prev
            </button>
            <span className="history-page-info">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              className="btn btn-ghost"
              onClick={()=>
                load(pagination.page+1)
              }
              disabled={
                pagination.page===pagination.pages
              }
            >
              Next
              <ChevronRight size={14}/>
            </button>
          </div>
        )
      }
    </div>
        <style>{`
      .history-page {
        height:100%;
        overflow-y:auto;
        padding:32px 24px;
      }
      .history-inner {
        max-width:800px;
        margin:0 auto;
        display:flex;
        flex-direction:column;
        gap:16px;
      }
      .history-header {
        margin-bottom:8px;
      }
      .history-title {
        font-family:var(--font-display);
        font-size:28px;
        font-weight:700;
        color:var(--text-1);
        letter-spacing:-0.03em;
      }
      .history-sub {
        font-size:13px;
        color:var(--text-3);
        margin-top:4px;
      }
      .history-loading {
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .history-skeleton {
  height:80px;
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  animation:shimmer 1.5s infinite;

  background:
    linear-gradient(
      90deg,
      var(--border) 25%,
      var(--border-light) 50%,
      var(--border) 75%
    );

  background-size:200% 100%;
}
      @keyframes shimmer {
        from {
          background-position:-200% 0;
        }
        to {
          background-position:200% 0;
        }
      }
      .history-empty {
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:16px;
        padding:80px 0;
        color:var(--text-3);
      }
      .history-card {
        background:var(--card);
        border:1px solid var(--border);
        border-radius:var(--radius-lg);
        overflow:hidden;
        transition:border-color var(--transition);
      }
      .history-card:hover {
        border-color:var(--border-light);
      }
      .history-card-header {
        padding:18px 20px;
        cursor:pointer;
        display:flex;
        flex-direction:column;
        gap:8px;
        }
      .history-card-meta {
        display:flex;
        align-items:center;
        gap:10px;
      }
      .history-card-date {
        font-size:12px;
        color:var(--text-3);
      }
      .history-card-count {
        font-size:11px;
        background:var(--surface);
        border:1px solid var(--border);
        border-radius:99px;
        padding:1px 8px;
        color:var(--text-3);
      }
      .history-tag {
        font-size:11px;
        background:var(--accent-subtle);
        border:1px solid rgba(124,58,237,.2);
        border-radius:99px;
        padding:1px 8px;
        color:var(--accent);
      }
      .history-card-prompt {
        font-size:15px;
        font-weight:500;
        color:var(--text-1);
        line-height:1.5;
      }
      .history-card-platforms {
        display:flex;
        flex-wrap:wrap;
        gap:4px;
      }
      .history-platform-pill {
        font-size:11px;
        padding:2px 8px;
        border:1px solid var(--border);
        border-radius:99px;
        color:var(--text-3);
      }
      .history-platform-more {
        font-size:11px;
        color:var(--text-3);
        padding:2px 4px;
      }
      .history-card-actions {
        display:flex;
        gap:8px;
      }
      .history-reuse-btn {
        height:30px;
        font-size:12px;
      }
      .history-posts {
        border-top:1px solid var(--border);
        display:flex;
        flex-direction:column;
        }
      .history-post {
        padding:14px 20px;
        border-bottom:1px solid var(--border);
        }
      .history-post:last-child {
        border-bottom:none;
      }
      .history-post-header {
        display:flex;
        align-items:center;
        gap:8px;
        margin-bottom:8px;
      }
      .history-post-platform {
        font-size:11px;
        font-weight:600;
        color:var(--text-3);
        text-transform:uppercase;
        letter-spacing:.06em;
      }
      .history-post-edited {
        font-size:10px;
        color:var(--accent);
        background:var(--accent-subtle);
        padding:1px 6px;
        border-radius:99px;
      }
      .history-copy-btn {
        margin-left:auto;
      }
      .history-post-content {
        font-family:var(--font-mono);
        font-size:12px;
        line-height:1.7;
        color:var(--text-2);
        white-space:pre-wrap;
        word-break:break-word;
      }
      .history-pagination {
        display:flex;
        align-items:center;
        justify-content:center;
        gap:16px;
        padding:16px 0;
      }
      .history-page-info {
        font-size:13px;
        color:var(--text-3);
      }
      .history-image-preview {
        padding:12px 20px 0;
      }
      .history-img {
        width:100%;
        max-height:200px;
        object-fit:cover;
        border-radius:var(--radius);
        display:block;
      }
      .history-img-expired {
        display:flex;
        align-items:center;
        gap:6px;
        font-size:12px;
        color:var(--text-3);
        padding:8px 0;
      }
    `}</style>
  </div>
)
}
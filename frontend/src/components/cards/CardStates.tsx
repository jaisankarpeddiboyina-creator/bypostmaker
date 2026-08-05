import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

export function CardSkeleton({ statusText }: { statusText?: string }) {
  return (
    <div style={{
      width: '100%', maxWidth: 470, margin: '0 auto',
      background: '#ffffff', border: '1px solid #E2E8F0',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    }}>
      {/* Fake header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <div className="shimmer" style={{ height: 12, width: 100, background: '#E2E8F0' }} />
        {statusText && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{statusText}</span>}
      </div>
      {/* Fake body */}
      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <div className="shimmer" style={{ width: 32, height: 32, borderRadius: '50%', background: '#E2E8F0', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="shimmer" style={{ height: 10, width: '55%', background: '#E2E8F0' }} />
            <div className="shimmer" style={{ height: 9, width: '35%', background: '#E2E8F0' }} />
          </div>
        </div>
        <div className="shimmer" style={{ height: 10, width: '100%', background: '#E2E8F0' }} />
        <div className="shimmer" style={{ height: 10, width: '85%', background: '#E2E8F0' }} />
        <div className="shimmer" style={{ height: 10, width: '65%', background: '#E2E8F0' }} />
      </div>
      {/* Fake footer */}
      <div style={{ padding: '8px 12px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <div className="shimmer" style={{ height: 9, width: 60, background: '#E2E8F0' }} />
      </div>
      <style>{`
        @keyframes cardShimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%) !important;
          background-size: 800px 100% !important;
          animation: cardShimmer 1.6s infinite linear !important;
        }
      `}</style>
    </div>
  )
}

export function CardGenerating({ name, statusText }: { name: string; statusText?: string }) {
  return (
    <div style={{
      width: '100%', maxWidth: 470, margin: '0 auto',
      background: '#ffffff', border: '1px solid #E2E8F0',
      borderTop: '3px solid #38BDF8',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(56,189,248,0.12)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F0F9FF', borderBottom: '1px solid #BAE6FD' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0284C7', letterSpacing: '0.04em' }}>{name.toUpperCase()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#0284C7', fontWeight: 600 }}>
            {statusText || 'Generating...'}
          </span>
        </div>
      </div>
      {/* Animated dots + shimmer body */}
      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="gen-dot" style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === 1 ? '#0284C7' : '#38BDF8',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
          <span style={{ fontSize: 12, color: '#64748B', marginLeft: 4 }}>Writing caption…</span>
        </div>
        <div style={{ height: 10, width: '90%', background: '#EFF6FF', borderRadius: 4 }} />
        <div style={{ height: 10, width: '72%', background: '#EFF6FF', borderRadius: 4 }} />
        <div style={{ height: 10, width: '55%', background: '#EFF6FF', borderRadius: 4 }} />
      </div>
      {/* Footer */}
      <div style={{ padding: '8px 12px', background: '#F0F9FF', borderTop: '1px solid #BAE6FD' }}>
        <div style={{ height: 9, width: 50, background: '#BAE6FD', borderRadius: 4 }} />
      </div>
    </div>
  )
}

export function CardError({ name, message, brandColor, onRetry }: {
  name: string
  message: string
  brandColor?: string
  onRetry?: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const handleClick = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    await onRetry()
    setRetrying(false)
  }

  return (
    <div style={{
      width: '100%', maxWidth: 470, margin: '0 auto',
      background: '#ffffff', border: '1px solid #E2E8F0',
      borderTop: `3px solid ${brandColor ?? '#F43F5E'}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    }}>
      <div style={{ padding: '8px 12px', background: '#FFF1F2', borderBottom: '1px solid #FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: brandColor ?? '#F43F5E', letterSpacing: '0.04em' }}>{name.toUpperCase()}</span>
        <span style={{ fontSize: 11, color: '#F43F5E', fontWeight: 600 }}>Failed</span>
      </div>
      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#F43F5E' }} />
          <span>{message}</span>
        </div>
        {onRetry && (
          <button
            onClick={handleClick}
            disabled={retrying}
            style={{
              alignSelf: 'flex-start', padding: '5px 14px', borderRadius: 20,
              background: 'transparent', border: `1.5px solid ${brandColor ?? '#F43F5E'}`,
              color: brandColor ?? '#F43F5E', fontSize: 12, fontWeight: 700,
              cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.5 : 1,
              transition: 'all 120ms ease',
            }}
          >
            {retrying ? 'Retrying…' : 'Try again'}
          </button>
        )}
      </div>
    </div>
  )
}

import React from 'react'

interface PostMakerLogoProps {
  variant?: 'full' | 'icon' | 'wordmark'
  size?: number
  className?: string
  animated?: boolean
}

export default function PostMakerLogo({
  variant = 'full',
  size = 28,
  className = '',
  animated = false,
}: PostMakerLogoProps) {
  const iconWidth = Math.round(size * (34 / 28))
  const totalHeight = size

  return (
    <div
      className={`postmaker-logo-root ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      {(variant === 'full' || variant === 'icon') && (
        <svg
          width={iconWidth}
          height={totalHeight}
          viewBox="0 0 34 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, overflow: 'visible' }}
        >
          <defs>
            {/* Primary Pink-Violet Gradient */}
            <linearGradient id="pmlGradientPrimary" x1="0" y1="0" x2="34" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF4B91" />
              <stop offset="50%" stopColor="#F72585" />
              <stop offset="100%" stopColor="#7209B7" />
            </linearGradient>

            {/* Accent Beacon Gradient */}
            <linearGradient id="pmlGradientAccent" x1="20" y1="2" x2="32" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF4B91" />
              <stop offset="100%" stopColor="#F72585" />
            </linearGradient>

            {/* Glowing Backdrop Filter Shadow */}
            <filter id="pmlGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Glass Card Emblem Frame */}
          <rect
            x="0.5"
            y="0.5"
            width="33"
            height="27"
            rx="7.5"
            fill="rgba(255, 255, 255, 0.25)"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="1"
          />

          {/* Inner Light Specular Rim Highlight */}
          <rect
            x="1.5"
            y="1.5"
            width="31"
            height="25"
            rx="6.5"
            fill="none"
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth="0.75"
            opacity="0.6"
          />

          {/* Stylized Broadcast Layer 1 — Post Card Base Stack */}
          <path
            d="M7 8.5C7 7.67157 7.67157 7 8.5 7H17.5C18.3284 7 19 7.67157 19 8.5V19.5C19 20.3284 18.3284 21 17.5 21H8.5C7.67157 21 7 20.3284 7 19.5V8.5Z"
            fill="url(#pmlGradientPrimary)"
            filter="url(#pmlGlow)"
          />

          {/* Stylized Broadcast Layer 2 — Overlapping "P" Loop */}
          <path
            d="M12 7.5H19.5C22.5376 7.5 25 9.96243 25 13C25 16.0376 22.5376 18.5 19.5 18.5H12V7.5Z"
            fill="#FF4B91"
            opacity="0.85"
          />
          <path
            d="M12 11H18.5C19.8807 11 21 12.1193 21 13.5C21 14.8807 19.8807 16 18.5 16H12V11Z"
            fill="#FFFFFF"
          />

          {/* Multi-Platform Broadcast Sparkle Beacon */}
          <circle
            cx="25.5"
            cy="7.5"
            r="3.5"
            fill="url(#pmlGradientAccent)"
            className={animated ? 'pml-animated-beacon' : ''}
          />
          <circle
            cx="25.5"
            cy="7.5"
            r="1.5"
            fill="#F8FAFC"
          />
        </svg>
      )}

      {(variant === 'full' || variant === 'wordmark') && (
        <span
          className="postmaker-wordmark"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: `${size * 0.72}px`,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'var(--color-text-primary, #F8FAFC)',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Post
          <span
            style={{
              background: 'linear-gradient(135deg, #FF4B91 0%, #7209B7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginLeft: '1px',
            }}
          >
            Maker
          </span>
        </span>
      )}
    </div>
  )
}

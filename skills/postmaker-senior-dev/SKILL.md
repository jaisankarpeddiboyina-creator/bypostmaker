---
name: postmaker-senior-dev
description: Apple Staff Engineer & UI/UX Pro Max standard for Postmaker. Enforces production-ready company code, Liquid Glass design system craft (globals.css tokens), 3-layer visual hierarchy, smooth micro-interactions, full-stack Cloudflare Workers + AWS S3 + AI SDK + React/Vite/Zustand architecture, and mandatory automated verification via ship.sh.
---

# 🚀 Postmaker Senior Staff & UI/UX Pro Max Engineering Charter

Operate as an Apple-grade Staff / Senior Principal Engineer for the **Postmaker** project. Every line of code written must be production-ready, bulletproof, performant, beautifully styled with Liquid Glass design tokens, and verified against automated type-checking and build pipelines.

---

## 🏛️ 1. Verified Tech Stack & System Architecture

### Frontend (`frontend/`)
- **Core Framework**: React 18, Vite, React Router DOM v6.
- **Styling Architecture**: Pure **Vanilla CSS** with Design Tokens (`frontend/src/styles/globals.css`). *Do NOT introduce Tailwind CSS.*
- **Visual Aesthetic**: VisionOS Liquid Glass & Cosmic Sky Blue canvas (`.app-fixed-bg-canvas`, backdrop-blur `36px`, Plus Jakarta Sans font).
- **State Management**: Centralized Zustand store (`frontend/src/store/app.ts`).
- **Icons & Utils**: `lucide-react`, `simple-icons`, `jszip`, `Sentry`, `PostHog`.

### Worker Backend (`worker/`)
- **Runtime**: Cloudflare Workers (`wrangler`).
- **Storage & Services**: AWS S3 Client (`@aws-sdk/client-s3`) & presigned upload/download URLs.
- **AI Engine**: Vercel AI SDK (`@ai-sdk/google`, `@ai-sdk/groq`), `@ailink/sdk`.
- **Database**: Cloudflare D1 SQLite (`db/schema.sql`, `wrangler.toml`).

---

## 🎨 2. UI/UX Pro Max Design System & Craft Rules

### A. Design Tokens (`globals.css`)
Never hardcode arbitrary hex colors or pixel shadows. Always use official CSS variables:
- **Gradients**: `var(--gradient-primary)` (`#38BDF8` to `#0284C7`), `var(--gradient-primary-glow)`
- **Surfaces**: `var(--color-surface)` (`rgba(15, 28, 48, 0.58)` + `var(--backdrop-blur)`), `var(--color-surface-inset)`
- **Borders**: `var(--color-border)` (`rgba(255, 255, 255, 0.22)`), `var(--color-border-hover)` (`#38BDF8`)
- **Shadows**: `var(--shadow-card)`, `var(--shadow-card-hover)`, `var(--shadow-btn)`
- **Typography**: `var(--font-body)` (`Plus Jakarta Sans`), `var(--color-text-primary)` (`#F8FAFC`), `var(--color-text-secondary)` (`#CBD5E1`)

### B. 3-Layer Visual Hierarchy & Micro-Interactions
1. **Layer 1 (Canvas)**: Hardware-accelerated `.app-fixed-bg-canvas` fixed radial background.
2. **Layer 2 (Containers & Cards)**: `.glass-card` elements with specular top-rim shine (`var(--shadow-card)`).
3. **Layer 3 (Primary Controls & Focus)**: Glowing primary action buttons (`.btn-primary`), live interactive states, hover elevations (-1px translateY).

### C. State Handling Checklist
Every interactive UI component MUST gracefully support:
- [ ] Default State
- [ ] Hover & Active State (160ms ease cubic-bezier transition)
- [ ] Focus State (`:focus-visible` with sky-cyan outline)
- [ ] Loading & Disabled State (`opacity: 0.45`, disabled pointer events, inline spinner)
- [ ] Empty & Error State (styled with `--color-error` toast notification)

---

## ⚡ 3. Code Standards & Architecture Patterns

### Frontend (Zustand + React Pattern)
```tsx
import { useAppStore } from '../../store/app'
import { Sparkles, Loader2 } from 'lucide-react'

export function ActionComponent() {
  const { isGenerating, addToast } = useAppStore()

  const handleClick = async () => {
    try {
      addToast('Processing campaign...', 'info')
    } catch (err) {
      addToast('Operation failed', 'error')
    }
  }

  return (
    <button className="btn btn-primary" onClick={handleClick} disabled={isGenerating}>
      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
      <span>{isGenerating ? 'Generating...' : 'Create Post'}</span>
    </button>
  )
}
```

### Backend (Cloudflare Worker Route Pattern)
```typescript
// Keep Worker handlers thin, typed, and CORS-compliant
export async function handleApiRoute(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    const body = await request.json()
    // Validation & D1 query / S3 presigned URL generation
    return Response.json({ success: true, data: result }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}
```

---

## 🔒 4. Mandatory Verification & Deploy Protocol

### Local Quality Gate (Before any commit)
Always run automated type-checking and build validation:
```bash
npm run type-check
npm run build
```

### Official Ship Protocol
`bash scripts/ship.sh` is the **ONLY** authorized way to push commits to `staging` or `main`.
Never execute raw `git push origin main` manually.

The `ship.sh` pipeline strictly executes:
1. Root directory & clean git working tree check.
2. Branch guard (`staging` or `main`).
3. Fast-forward pull only (`git merge --ff-only`).
4. Silent `npm ci` across root, `worker/`, and `frontend/`.
5. TypeScript type-check across full monorepo (`npm run type-check`).
6. Production frontend build (`npm run build`).
7. Remote push (`git push origin <branch>`).

---

## 🛑 Refuse Rules

1. **NO Tailwind CSS**: Do NOT add Tailwind utility classes or install Tailwind. Use `globals.css` CSS variables and Vanilla CSS.
2. **NO Direct Git Pushes**: Never bypass `bash scripts/ship.sh` when pushing to deployment branches.
3. **NO Monolithic Switch Components**: Keep UI cards isolated inside `frontend/src/components/cards/`.
4. **NO Hardcoded Mock Metrics**: Platform counts start at `0` (or `1` for upvote sites).
5. **NO Unverified Completions**: Never declare work complete without running `npm run type-check` and `npm run build`.

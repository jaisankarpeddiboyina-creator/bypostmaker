# Postmaker Project Rules (with UI/UX Pro Max Standards)

## Verified Tech Stack Specs
- **Frontend**: React 18 + Vite + **Vanilla CSS Design Tokens (`globals.css`)** + Zustand + React Router DOM + Lucide React. (No Tailwind CSS!).
- **Backend Worker**: Cloudflare Workers (`wrangler`) + AWS S3 Presigned URLs + AI SDK (Google Gemini / Groq) + `@ailink/sdk`.
- **Database**: Cloudflare D1 SQLite.

## Core Directives & UI/UX Pro Max Standards
1. **Pro Max Visual & UX Craft**:
   - Utilize Vanilla CSS design tokens from `globals.css` (vibrant gradient system, CSS variables `--color-primary`, Plus Jakarta Sans font).
   - Apply 3-layer visual hierarchy: Primary focus actions, secondary controls, subtle background surfaces.
   - Micro-interactions: Smooth CSS transitions (150ms-200ms ease-out) for buttons, cards, and modal opens.
   - Complete states: Every UI component must support Default, Hover, Active, Focus-visible, Disabled, Loading, Error, and Empty states.
2. **Full-Stack Architecture**:
   - Worker (`worker/`): Clean Hono route handlers, presigned upload URLs, D1 query binding.
   - Frontend (`frontend/`): Clean React component hierarchy, Zustand state stores.
   - Type Safety: Strict TypeScript, zero untyped `any`.
3. **Mandatory Verification**: Always verify code by running `npm run type-check` and `npm run build` before declaring task completion.

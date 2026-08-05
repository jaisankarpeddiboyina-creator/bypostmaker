---
id: DOC-2026-006
title: PostMaker Vanilla CSS Design Tokens & Craft Standard
category: UI/UX
status: Stable
owner: Lead Design Engineer
created_at: 2026-07-31
last_updated: 2026-07-31
version: 1.0.0
breaking_changes: No
migration_needed: No
compatible_since: v1.0.0
deprecated_since: N/A
---

# PostMaker Vanilla CSS Design Tokens & Craft Standard

## Documentation Relationships

- **Depends On**:
  - [DOC-2026-001: System Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/architecture/system-overview.md)
- **Used By**:
  - All React Components ([`frontend/src/components/`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/frontend/src/components))

---

## AI Context & Guardrails

> [!IMPORTANT]
> **Strict Operational Invariants for AI Agents**

- **Purpose**: Authoritative specification for PostMaker's UI design token system, typography, animations, and component state requirements.
- **Styling Architecture**: **Vanilla CSS exclusively**. All variables declared in [`frontend/src/styles/globals.css`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/frontend/src/styles/globals.css).
- **Font System**: Plus Jakarta Sans (`font-family: 'Plus Jakarta Sans', sans-serif`).
- **DO NOT CHANGE**: **Do NOT introduce Tailwind CSS**. Do NOT write hardcoded inline hex colors when CSS custom variables exist (`var(--color-primary)`).

---

## Complete 8 Component States Matrix

Every interactive component (buttons, cards, inputs, dropdowns) MUST implement all 8 states cleanly:

```mermaid
stateDiagram-v2
    [*] --> Default
    Default --> Hover : mouseenter
    Hover --> Active : mousedown
    Active --> Focus : tab / keyboard
    Default --> Disabled : disabled prop
    Default --> Loading : async trigger
    Loading --> Error : promise rejection
    Default --> Empty : zero items payload
```

| State Name | Visual Requirement | Implementation Guidance |
| :--- | :--- | :--- |
| **1. Default** | Surface gradient, `--color-text-main` | CSS custom variable tokens |
| **2. Hover** | Elevate surface, `transform: translateY(-1px)`, smooth 150ms transition | `:hover` pseudo class |
| **3. Active** | Scale down, `transform: scale(0.98)` | `:active` pseudo class |
| **4. Focus-Visible** | 2px focus ring (`var(--color-primary)`), `outline-offset: 2px` | `:focus-visible` pseudo class |
| **5. Disabled** | `opacity: 0.5`, `cursor: not-allowed` | `:disabled`, `aria-disabled="true"` |
| **6. Loading** | Spinner icon, interactive disabled | Lucide `Loader2` spinning |
| **7. Error** | Red border (`var(--color-danger)`), error helper text | `aria-invalid="true"` |
| **8. Empty** | Illustration / empty placeholder text, action button | Empty state card component |

---

## Core CSS Tokens Reference

```css
:root {
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-bg-dark: #0f172a;
  --color-surface-card: #1e293b;
  --color-text-main: #f8fafc;
  --color-text-muted: #94a3b8;
  --color-danger: #ef4444;

  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
}
```

---

## Evidence & Verification

| Claim / Behavior | Evidence Source | Verification Link / Code | Verified By | Last Verified |
| :--- | :--- | :--- | :--- | :--- |
| Design tokens defined in globals.css | CSS stylesheet | [`frontend/src/styles/globals.css#L1-L60`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/frontend/src/styles/globals.css#L1-L60) | Lead Designer | 2026-07-31 |

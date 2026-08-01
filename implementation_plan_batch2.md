# Implementation Plan — Batch 2 Responsive Fixes (In-App Pages)

This plan details the specific CSS/JSX changes proposed to resolve mobile/tablet layout issues on core in-app authenticated pages.

---

## Technical Clarifications

### 1. Promo "None" Placeholder & Mobile Gating
To avoid rendering an awkward empty `Actions: ` label on mobile for inactive promos without introducing a layout-specific "None" text placeholder, we will add an `:empty` pseudo-class rule to the global CSS stacking styles. 

If a cell contains no child elements (e.g., when the deactivate button is not rendered), the cell will hide completely on mobile. On desktop, it will continue to render as an empty column cell as originally designed.

### 2. `.promo-create-form` Desktop Sizing (1280px Viewport)
On a 1280px desktop viewport, both the current flexbox layout and the proposed grid layout render the form fields horizontally in a single row. The visual difference is purely a change from static pixel widths to responsive ratios:

| Field | Current Flex Layout | Proposed Grid Layout (`1fr 2fr 1fr 1fr auto`) |
| :--- | :--- | :--- |
| **CODE** | Default input width (~150px) | `1fr` (approx. 170px) |
| **Description** | `flex: 2` (stretches to fill) | `2fr` (approx. 340px) |
| **Discount %** | Fixed `100px` | `1fr` (approx. 170px) |
| **Max uses** | Fixed `120px` | `1fr` (approx. 170px) |
| **Create Button** | Auto | Auto |

This transition removes brittle, hardcoded layout limits and scales input widths proportionally to the page container.

### 3. Preserving Full Actions in Users Table
The full untruncated Actions cell diff for the users table is included below. It preserves the Role selector, Plan selector, and the Enable/Disable toggle button exactly as currently structured, only wrapping them in the `.responsive-stacked-grid` styling.

---

## Proposed Changes

### [Global Design System / CSS Styles]

#### [MODIFY] [globals.css](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/styles/globals.css)
* **File Path**: [globals.css](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/styles/globals.css)
* **Proposed CSS additions**:
```css
/* Reusable Apple-grade Responsive Stacked Grid Helpers */
@media (max-width: 768px) {
  .responsive-stacked-grid {
    grid-template-columns: 1fr !important;
    padding: 16px !important;
    gap: 12px !important;
  }
  .responsive-stacked-grid-header {
    display: none !important;
  }
  .responsive-stacked-grid [data-label]::before {
    content: attr(data-label) ": ";
    font-weight: 700;
    color: var(--color-primary-start);
    margin-right: 8px;
    min-width: 100px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-block;
  }
  /* Hide stacked empty cells on mobile (e.g. inactive promo actions) */
  .responsive-stacked-grid [data-label]:empty {
    display: none !important;
  }
}
```

---

### [Admin Page]

#### [MODIFY] [AdminPage.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/pages/AdminPage.tsx)
* **File Path**: [AdminPage.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/pages/AdminPage.tsx)
* **Route**: `/admin`
* **Imports**: Add `import { BREAKPOINT_MOBILE } from '../config/breakpoints'` at the top.

##### Selector 1: `.admin-table-header` and `.admin-table-row`
* **Current CSS**:
```css
.admin-table-header { display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr 2.2fr; gap: 12px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-bottom: 1px solid var(--color-border); font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; }
.admin-table-row { display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr 2.2fr; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); align-items: center; }
```
* **Proposed CSS fix**:
```css
@media (max-width: ${BREAKPOINT_MOBILE}) {
  .admin-table-row > div, .admin-table-row > span {
    display: flex;
    align-items: center;
  }
}
```

##### Selector 2: `.admin-tabs`
* **Current CSS**:
```css
.admin-tabs { display: flex; background: rgba(0,0,0,0.3); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 3px; gap: 2px; }
```
* **Proposed CSS fix**:
```css
@media (max-width: ${BREAKPOINT_MOBILE}) {
  .admin-tabs {
    overflow-x: auto;
    white-space: nowrap;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }
  .admin-tab {
    flex-shrink: 0;
  }
}
```

##### Selector 3: `.stat-grid`
* **Current CSS**:
```css
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; }
```
* **Proposed CSS fix**:
```css
@media (max-width: ${BREAKPOINT_MOBILE}) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

##### Selector 4: `.promo-create` form layout
* **Current CSS**:
Inline styling `style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}`.
* **Proposed CSS fix**:
```css
.promo-create-form {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr auto;
  gap: 12px;
  align-items: end;
}
@media (max-width: ${BREAKPOINT_MOBILE}) {
  .promo-create-form {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .promo-create-form .promo-input {
    width: 100% !important;
  }
}
```

##### Proposed JSX Diff (Data-Label Wiring):
```diff
@@ -415,9 +415,9 @@
             <div className="admin-table">
-              <div className="admin-table-header">
+              <div className="admin-table-header responsive-stacked-grid-header">
                 <span>User</span><span>Plan</span><span>Role</span><span>Status</span><span>Actions</span>
               </div>
               {users.map(u => (
-                <div key={u.id} className="admin-table-row">
+                <div key={u.id} className="admin-table-row responsive-stacked-grid">
                   <div>
                     <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{u.name}</div>
                     <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email}</div>
                   </div>
-                  <span className={`badge badge-${u.plan}`}>{u.plan}</span>
-                  <span style={{ fontSize: 12, color: 'var(--text-2)', textTransform: 'capitalize' }}>{u.role}</span>
-                  <span style={{ fontSize: 12, color: u.disabled ? 'var(--error)' : 'var(--success)' }}>
+                  <span className={`badge badge-${u.plan}`} data-label="Plan">{u.plan}</span>
+                  <span style={{ fontSize: 12, color: 'var(--text-2)', textTransform: 'capitalize' }} data-label="Role">{u.role}</span>
+                  <span style={{ fontSize: 12, color: u.disabled ? 'var(--error)' : 'var(--success)' }} data-label="Status">
                     {u.disabled ? 'Disabled' : 'Active'}
                   </span>
-                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
-                    <select className="admin-select"
-                      value={u.role}
-                      onChange={e => updateUser(u.id, { role: e.target.value })}>
-                      <option value="user">User</option>
-                      <option value="beta">Beta</option>
-                      <option value="admin">Admin</option>
-                    </select>
-                    <select className="admin-select"
-                      value={u.plan}
-                      onChange={e => updateUser(u.id, { plan: e.target.value })}>
-                      {['free','starter','pro','business'].map(p => (
-                        <option key={p} value={p}>{p}</option>
-                      ))}
-                    </select>
-                    <button className="btn-icon-xs"
-                      onClick={() => updateUser(u.id, { disabled: !u.disabled })}
-                      title={u.disabled ? 'Enable' : 'Disable'}>
-                      {u.disabled ? '✓' : '✕'}
-                    </button>
-                  </div>
+                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} data-label="Actions">
+                    <select className="admin-select"
+                      value={u.role}
+                      onChange={e => updateUser(u.id, { role: e.target.value })}>
+                      <option value="user">User</option>
+                      <option value="beta">Beta</option>
+                      <option value="admin">Admin</option>
+                    </select>
+                    <select className="admin-select"
+                      value={u.plan}
+                      onChange={e => updateUser(u.id, { plan: e.target.value })}>
+                      {['free','starter','pro','business'].map(p => (
+                        <option key={p} value={p}>{p}</option>
+                      ))}
+                    </select>
+                    <button className="btn-icon-xs"
+                      onClick={() => updateUser(u.id, { disabled: !u.disabled })}
+                      title={u.disabled ? 'Enable' : 'Disable'}>
+                      {u.disabled ? '✓' : '✕'}
+                    </button>
+                  </div>
                 </div>
               ))}
             </div>
@@ -500,5 +500,5 @@
-                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
+                <div className="promo-create-form">
                   <input className="promo-input" placeholder="CODE" value={newPromo.code}
                     onChange={e => setNewPromo(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                   <input className="promo-input" placeholder="Description" value={newPromo.description}
                     onChange={e => setNewPromo(p => ({ ...p, description: e.target.value }))}
                     style={{ flex: 2 }} />
                   <input className="promo-input" type="number" placeholder="Discount %" value={newPromo.discount_pct}
                     onChange={e => setNewPromo(p => ({ ...p, discount_pct: parseInt(e.target.value) || 0 }))}
                     style={{ width: 100 }} />
                   <input className="promo-input" type="number" placeholder="Max uses (∞)" value={newPromo.max_uses}
                     onChange={e => setNewPromo(p => ({ ...p, max_uses: e.target.value }))}
                     style={{ width: 120 }} />
                   <button className="btn btn-primary btn-sm" onClick={createPromo}>Create Code</button>
                 </div>
@@ -567,9 +567,9 @@
             <div className="admin-table">
-              <div className="admin-table-header">
+              <div className="admin-table-header responsive-stacked-grid-header">
                 <span>Code</span><span>Description</span><span>Discount</span><span>Uses</span><span>Status</span><span></span>
               </div>
               {promos.map(p => (
-                <div key={p.code} className="admin-table-row">
+                <div key={p.code} className="admin-table-row responsive-stacked-grid">
-                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-start)' }}>{p.code}</span>
+                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-start)' }} data-label="Code">{p.code}</span>
-                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{p.description}</span>
+                  <span style={{ fontSize: 13, color: 'var(--text-2)' }} data-label="Description">{p.description}</span>
-                  <span style={{ fontSize: 13, color: 'var(--color-primary-start)', fontWeight: 600 }}>{p.discount_pct}% off</span>
+                  <span style={{ fontSize: 13, color: 'var(--color-primary-start)', fontWeight: 600 }} data-label="Discount">{p.discount_pct}% off</span>
-                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
+                  <span style={{ fontSize: 12, color: 'var(--text-3)' }} data-label="Uses">
                     {p.uses}{p.max_uses ? `/${p.max_uses}` : ''}
                   </span>
-                  <span style={{ fontSize: 12, color: p.active ? 'var(--success)' : 'var(--text-4)' }}>
+                  <span style={{ fontSize: 12, color: p.active ? 'var(--success)' : 'var(--text-4)' }} data-label="Status">
                     {p.active ? 'Active' : 'Inactive'}
                   </span>
-                  {p.active === 1 && (
-                    <button className="btn-icon-xs" onClick={() => deactivatePromo(p.code)} title="Deactivate">✕</button>
-                  )}
+                  <div data-label="Actions">
+                    {p.active === 1 && (
+                      <button className="btn-icon-xs" onClick={() => deactivatePromo(p.code)} title="Deactivate">✕</button>
+                    )}
+                  </div>
                 </div>
               ))}
             </div>
```

---

### [CreateStepPanel Component]

#### [MODIFY] [CreateStepPanel.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/components/CreateStepPanel.tsx)
* **File Path**: [CreateStepPanel.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/components/CreateStepPanel.tsx)
* **Imports**: Add `import { BREAKPOINT_MOBILE } from '../config/breakpoints'` at the top.

##### Selector 1: `.tone-pills-row`
* **Proposed CSS fix**:
```css
.tone-pills-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
```

##### Selector 2: `.cat-tab-btn`
* **Proposed CSS fix** (under `BREAKPOINT_MOBILE`):
```css
@media (max-width: ${BREAKPOINT_MOBILE}) {
  .cat-tab-btn {
    padding: 10px 16px;
    font-size: 13px;
  }
}
```

---

### [Brand Kit Page]

#### [MODIFY] [BrandKitPage.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/pages/BrandKitPage.tsx)
* **File Path**: [BrandKitPage.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/pages/BrandKitPage.tsx)
* **Route**: `/app/brand-kit`
* **Imports**: Add `import { BREAKPOINT_MOBILE } from '../config/breakpoints'` at line 30.

##### Selector 1: `.tab-btn` (under `.brand-tabs`)
* **Proposed CSS fix** (under `BREAKPOINT_MOBILE`):
```css
@media (max-width: ${BREAKPOINT_MOBILE}) {
  .tab-btn {
    padding: var(--space-3) var(--space-4); /* Increases horizontal padding to enlarge tap target area */
  }
}
```

---

### [History Page]

#### [MODIFY] [HistoryPage.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/pages/HistoryPage.tsx)
* **File Path**: [HistoryPage.tsx](file:///C:/Users/DELL/OneDrive/Desktop/Postmaker/project/bypostmaker/frontend/src/pages/HistoryPage.tsx)
* **Route**: `/app/history`
* **Imports**: Add `import { BREAKPOINT_MOBILE } from '../config/breakpoints'` at line 21.

##### Selector 1: `.gen-stepper-group .btn-icon`
* **Proposed CSS fix** (under `BREAKPOINT_MOBILE`):
```css
@media (max-width: ${BREAKPOINT_MOBILE}) {
  .gen-stepper-group .btn-icon {
    width: 44px;
    height: 44px;
  }
}
```

---

## Verification Plan

### Automated Checks
* Run `npm run type-check` across the workspace to verify zero compilation or import regressions.
* Run `npm run build` to verify production assets bundle successfully.

---

## Confirmed File-Scope Checklist

Only the following 5 files will be modified in this batch:
1. `frontend/src/styles/globals.css` *(Adding responsive helper classes)*
2. `frontend/src/pages/AdminPage.tsx` *(Restructuring lists, tabs, metrics, and forms)*
3. `frontend/src/components/CreateStepPanel.tsx` *(Wrapping tone pills and enlarging category tabs)*
4. `frontend/src/pages/BrandKitPage.tsx` *(Enlarging tab buttons touch target)*
5. `frontend/src/pages/HistoryPage.tsx` *(Enlarging stepper chevron button touch target)*

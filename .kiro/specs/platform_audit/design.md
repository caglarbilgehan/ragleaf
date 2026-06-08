# Ragleaf Platform Admin UI/UX & Feature Audit - Design Specification

## 1. CSS & Layout Architectural Fixes

### A. Removing Double Scrollbars
Instead of setting `h-screen` or `min-h-screen` in child pages, they should automatically expand to fill the layout space.
- Remove `h-screen` and `min-h-screen` from `ModelsPage.tsx`, `EmbeddingModelsPage.tsx`, etc.
- In `DashboardLayout.tsx`, wrap the `children` container inside a flex container that handles page height appropriately.

```typescript
// Before (in ModelsPage.tsx):
<div className="flex h-screen bg-dark-700/50">

// After:
<div className="flex min-h-[calc(100vh-8rem)] bg-dark-700/50 rounded-xl overflow-hidden border border-white/[0.06]">
```

### B. Standardizing Contrast & Text Colors
Replace all occurrences of `text-gray-600` on dark background with `text-gray-400` or `text-gray-500` to comply with contrast requirements.
- Standardize on:
  - Primary text: `text-gray-100`
  - Secondary text / Labels: `text-gray-400`
  - De-emphasized text: `text-gray-500`

### C. Replacing Global Wildcard Border Rule
In `index.css`:
```css
/* Before */
* {
  @apply border-white/[0.06];
}

/* After: target layout components directly */
div, header, footer, nav, aside, section, main, table, tr, td, th, input, select, textarea, button {
  border-color: rgba(255, 255, 255, 0.06);
}
```

## 2. Feature Enhancements
- **Global Search Component**: Connect the top search bar to a query handler, navigating users to relevant pages based on key matches (e.g. searching for a tenant or assistant).
- **Theme Polish**: Refine card borders and shadows using modern, subtle gradients and clean shadows:
  - Replace `shadow-orange-100` with `shadow-[0_4px_20px_rgba(249,115,22,0.15)]` (subtle orange glow in dark mode).

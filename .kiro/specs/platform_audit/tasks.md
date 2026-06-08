# Ragleaf Platform Admin UI/UX & Feature Audit - Tasks

## Phase 1: Layout, Contrast & CSS Fixes
- [ ] Remove `h-screen` and `min-h-screen` from page wrappers inside the layout (e.g. `ModelsPage.tsx`, `EmbeddingModelsPage.tsx`).
- [ ] Fix low contrast label text (`text-gray-600` -> `text-gray-400`/`text-gray-500`) in `ModelsPage.tsx` and other pages.
- [ ] Replace global wildcard border rule (`*`) in `index.css` with clean tag-specific styles or helper classes.
- [ ] Replace inappropriate shadow classes (e.g., `shadow-orange-100`) with dark-theme friendly glows.

## Phase 2: Feature & Usability Upgrades
- [ ] Link search bar in `DashboardLayout.tsx` to page routing/filtering or add search functionality.
- [ ] Standardize and translate UI terminology to Turkish to maintain localization consistency.
- [ ] Add subtle micro-animations for status tags and active sidebars.

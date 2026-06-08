# Ragleaf Platform Admin UI/UX & Feature Audit - Requirements

## 1. Goal
Evaluate the multi-tenant administration panel (`platform`) for visual styling defects, layout bugs (e.g., dual scrollbars, low contrast, viewport overflow), missing features, and draft a plan to implement these improvements in structured phases.

## 2. Identified UI/UX & CSS Flaws

### A. Visual & Styling Bugs
- **Nested Full-Screen Containers (`h-screen` / `min-h-screen`)**:
  - Pages like [ModelsPage.tsx](file:///home/cserver/ragleaf/platform/src/pages/ModelsPage.tsx), [EmbeddingModelsPage.tsx](file:///home/cserver/ragleaf/platform/src/pages/embedding/EmbeddingModelsPage.tsx) use `h-screen` or `min-h-screen` inside the main scrollable layout of [DashboardLayout.tsx](file:///home/cserver/ragleaf/platform/src/components/layout/DashboardLayout.tsx). This causes double-scrollbars and breaks layout structure.
- **Low Contrast Elements**:
  - Labels such as `<span className="text-gray-600">` are used against `#12121a` (dark-800) background cards. This fails accessibility guidelines and makes text unreadable.
- **Global Border Style Overkill**:
  - In `index.css`, `* { @apply border-white/[0.06]; }` applies border styles globally to all HTML elements. This introduces layout overhead and makes custom styling of tables, lists, and inputs difficult.
- **Shadow and Color Harmonization**:
  - Hardcoded shadow values like `shadow-orange-100` are used in dark theme settings, which looks out of place or invisible.

### B. Functional Gaps
- **Static Search Bar**:
  - The main search input in the top header is visual-only and does not trigger searches.
- **Mixed Localization**:
  - Turkish UI text mixes with English titles (e.g., "AI Providers", "Tenantlar", "Free", "Enterprise").
- **Theme Controls**:
  - Lack of a dark/light mode toggle.

## 3. Scope of Improvements
- **Phase 1: Layout & Contrast Fixes**: Remove nested screen classes, fix low contrast, replace global border selector.
- **Phase 2: Functional Polish**: Implement global search capability, clean up multi-language UI terms.

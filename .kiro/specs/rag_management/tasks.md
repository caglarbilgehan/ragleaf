# RAG & LLM Configuration Separation - Tasks

- [ ] Implement `LLMConfigPage.tsx` based on model configuration fields from `AIConfigPage.tsx`.
- [ ] Implement `RAGConfigPage.tsx` based on RAG configuration fields from `AIConfigPage.tsx`.
- [ ] Update `DashboardLayout.tsx` navigation configuration:
  - Remove `AI Yapılandırma` from "Sistem"
  - Add `LLM Yapılandırması` to "LLM Yönetimi"
  - Add `RAG Yönetimi` header and `RAG Ayarları` to the sidebar
- [ ] Update `App.tsx` router configuration to map new routes and import new pages.
- [ ] Update `Dashboard.tsx` to redirect to `/admin/llm-config` instead of `/admin/ai-config`.
- [ ] Remove `AIConfigPage.tsx`.
- [ ] Verify build with `npm run build` in the `platform` workspace.

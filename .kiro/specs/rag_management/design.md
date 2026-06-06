# RAG & LLM Configuration Separation - Design

## 1. Directory Structure Changes
- **New Files**:
  - `platform/src/pages/admin/LLMConfigPage.tsx`
  - `platform/src/pages/admin/RAGConfigPage.tsx`
- **Modified Files**:
  - `platform/src/components/layout/DashboardLayout.tsx`
  - `platform/src/App.tsx`
  - `platform/src/pages/Dashboard.tsx`
- **Deleted Files**:
  - `platform/src/pages/admin/AIConfigPage.tsx`

## 2. API Interaction
Both pages interact with:
- `GET /admin/ai-provider-config/global-config`
- `PUT /admin/ai-provider-config/global-config`

### LLMConfigPage save request payload:
```json
{
  "model_config_data": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 1024,
    "top_p": 0.9
  }
}
```

### RAGConfigPage save request payload:
```json
{
  "rag_config": {
    "top_k": 5,
    "similarity_threshold": 0.3,
    "search_method": "hybrid",
    "include_sources": true,
    "max_context_chars": 4000
  }
}
```

## 3. UI/UX Design System
We will use:
- Dark theme styling (matching existing platform theme: card backgrounds, borders, text colors, etc.).
- Beautiful badges showing saving state, validation warnings, or changes.
- Responsive flex layout with responsive grids.
- Clear descriptions and icons from Lucide-react: `Cpu`, `Database`, `Search`, `Settings`, `Zap`, `RefreshCw`, `Save`, `Info`, `CheckCircle`.

# RAG & LLM Configuration Separation - Requirements

## 1. Goal
Separate the global AI configuration into two separate screens: RAG Management and LLM Configuration. Relocate them under their respective sidebar headers to clean up the navigation hierarchy.

## 2. Functional Requirements
### LLM Configuration
- Manage global LLM settings: provider, model ID, temperature, max tokens, top-p.
- Fetches from `/admin/ai-provider-config/global-config`.
- Saves to `/admin/ai-provider-config/global-config` sending only `model_config_data`.
- Display current active configuration details.

### RAG Configuration
- Manage global RAG settings: top-k, similarity threshold, search method, max context characters, include sources.
- Fetches from `/admin/ai-provider-config/global-config`.
- Saves to `/admin/ai-provider-config/global-config` sending only `rag_config`.
- Display current active RAG configuration details.

## 3. Sidebar Navigation Changes
- Remove "AI Yapılandırma" from under "Sistem".
- Add "LLM Yapılandırması" under "LLM Yönetimi".
- Create new group "RAG Yönetimi".
- Add "RAG Ayarları" under "RAG Yönetimi".

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

// User Types
export interface User {
  id: number;
  email: string;
  name?: string;
  surname?: string;
  full_name?: string;
  is_admin: boolean;
  is_active: boolean;
  is_superadmin?: boolean;
  default_org_id?: number | null;
  departments?: string[];  // Department assignments for RAG filtering
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Document Types
export interface Document {
  id: number;
  doc_number?: number;  // Auto-incrementing document number (0001, 0002, ...)
  folder_name: string;
  name: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  status: 'uploading' | 'uploaded' | 'processing' | 'processed' | 'enriched' | 'indexing' | 'indexed' | 'error';

  // Processing info
  processing_stage?: string;
  processing_progress: number;
  processing_details?: string;
  processing_logs?: Array<{ timestamp: string; level: string; message: string }>;

  // Metadata
  total_pages?: number;
  total_chunks?: number;
  ocr_completed: boolean;
  vector_indexed: boolean;
  chunking_completed?: boolean;
  embedding_completed?: boolean;

  // Multi-language support
  language?: string;
  doc_metadata?: Record<string, any>;

  // Timestamps (created_at is now required)
  created_at: string;
  updated_at?: string;
  processed_at?: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

// Model Configuration Types
export interface ModelConfig {
  id: number;
  name: string;
  provider: string;
  model_name: string;
  description?: string | null;

  // LLM Parameters
  num_ctx?: number;
  num_predict?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;

  // RAG Parameters
  max_context_chars?: number;
  rag_top_k?: number;
  chunk_size?: number;
  chunk_overlap?: number;

  // System Parameters
  timeout_seconds?: number;
  stream_enabled?: boolean;
  providers?: string; // JSON string of provider configurations

  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface ModelConfigCreate {
  name: string;
  provider: string;
  model_name: string;
  description?: string;

  // LLM Parameters
  num_ctx?: number;
  num_predict?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;

  // RAG Parameters
  max_context_chars?: number;
  rag_top_k?: number;
  chunk_size?: number;
  chunk_overlap?: number;

  // System Parameters
  timeout_seconds?: number;
  stream_enabled?: boolean;
  providers?: string; // JSON string of provider configurations

  is_active?: boolean;
  is_default?: boolean;
}

export interface ModelConfigUpdate {
  name?: string;
  provider?: string;
  model_name?: string;
  description?: string;

  // LLM Parameters
  num_ctx?: number;
  num_predict?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;

  // RAG Parameters
  max_context_chars?: number;
  rag_top_k?: number;
  chunk_size?: number;
  chunk_overlap?: number;

  // System Parameters
  timeout_seconds?: number;
  stream_enabled?: boolean;
  providers?: string; // JSON string of provider configurations

  is_active?: boolean;
  is_default?: boolean;
}

// Vector Index Types
export interface VectorIndex {
  id: number;
  document_id: number;
  index_name: string;
  index_type: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  total_chunks: number;
  created_at: string;
}

export interface VectorIndexCreate {
  document_id: number;
  index_name: string;
  index_type?: string;
  embedding_model?: string;
  chunk_size?: number;
  chunk_overlap?: number;
}

// System Statistics Types
export interface SystemStats {
  documents: {
    total: number;
    processed: number;
    failed: number;
    processing: number;
  };
  vector_indexes: {
    total: number;
  };
  users: {
    total: number;
    active: number;
    admins: number;
  };
  models: {
    total: number;
    active: number;
  };
  storage: {
    total_bytes: number;
    total_mb: number;
  };
  tenants?: {
    total: number;
    active: number;
    suspended: number;
    by_plan: Record<string, number>;
  };
  agents?: {
    total: number;
    active: number;
  };
  conversations?: {
    total: number;
    total_messages: number;
  };
  appointments?: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  ai_services?: {
    total: number;
    active: number;
    available?: number;
    by_provider?: Array<{
      provider: string;
      display_name: string;
      total: number;
      active: number;
      services?: Array<{
        name: string;
        is_active: boolean;
      }>;
    }>;
  };
  memory?: {
    total: number;
    available: number;
    percent: number;
    used: number;
    free: number;
    used_percent?: number;
    available_gb?: number;
    total_gb?: number;
  };
  cpu_percent?: number;
  disk?: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
}

// Provider Types (HuggingFace-based)
export interface ProviderInfo {
  name: string;
  display_name: string;
  is_default: boolean;
  supports_tools: boolean;
  api_url: string;
  description: string;
}

// UI State Types
export interface LoadingState {
  [key: string]: boolean;
}

export interface ErrorState {
  [key: string]: string | null;
}

// Reset and Reprocess Types
export interface ResetOptions {
  chunks: boolean;
  chunk_enrichments: boolean;
  doc_enrichments: boolean;
  images: boolean;
  ocr_texts: boolean;
}

export interface ReprocessOptions {
  extract_text: boolean;
  extract_images: boolean;
  run_ocr: boolean;
  chunking_strategy?: 'paragraph' | 'fixed_size' | 'semantic' | null;
  chunk_size?: number;
  chunk_overlap?: number;
  ocr_languages?: string;
}

export interface ResetAndReprocessRequest {
  reset_level: 'indexing' | 'processing' | 'all';
  reset_options?: ResetOptions;
  reprocess_options?: ReprocessOptions;
  auto_process: boolean;
  auto_index: boolean;
}

export interface ResetAndReprocessResponse {
  success: boolean;
  operation_id: string;
  document_id: number;
  estimated_time_seconds: number;
  message: string;
  steps: string[];
}

export interface ProgressUpdate {
  operation_id: string;
  document_id: number;
  stage: 'resetting' | 'processing' | 'indexing' | 'completed' | 'error';
  progress: number;
  details: string;
  elapsed_seconds: number;
  estimated_remaining_seconds: number;
  error?: string;
}

export interface ContactRequest {
  id: number;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: 'pending' | 'resolved';
  created_at: string;
  updated_at?: string;
}


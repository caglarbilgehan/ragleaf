import axios, { AxiosResponse } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  User,
  Document,
  DocumentListResponse,
  ModelConfig,
  ModelConfigCreate,
  ModelConfigUpdate,
  VectorIndex,
  VectorIndexCreate,
  SystemStats,
  ProviderInfo,
  ResetAndReprocessRequest,
  ResetAndReprocessResponse,
} from '@/types';

// API Base Configuration
export function getApiBaseUrl(): string {
  // Check if we have environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Origin-based routing
  const origin = window.location.origin;

  // Production domains -> Production API
  if (origin.includes('ragleaf.com')) {
    return 'https://api.ragleaf.com';
  }

  // Development fallback (localhost)
  return 'http://localhost:1306';
}

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ragleaf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ragleaf_token');
      localStorage.removeItem('ragleaf_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  // Test connection
  testConnection: async (): Promise<any> => {
    try {
      const response = await api.get('/healthz');
      console.log('Backend connection test successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      throw error;
    }
  },

  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      console.log('Attempting login with:', { email: credentials.email });
      const response: AxiosResponse<LoginResponse> = await api.post('/auth/login', {
        email: credentials.email,
        password: credentials.password
      });
      console.log('Login successful - Full response:', response.data);
      console.log('User object:', response.data.user);
      console.log('User is_admin:', response.data.user?.is_admin);
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response: AxiosResponse<User> = await api.get('/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    localStorage.removeItem('ragleaf_token');
    localStorage.removeItem('ragleaf_user');
  },
};

// Admin API
export const adminApi = {
  // System Statistics
  getStats: async (): Promise<SystemStats> => {
    const response: AxiosResponse<SystemStats> = await api.get('/admin/dashboard/stats');
    return response.data;
  },

  // Document Management
  getDocuments: async (params?: { skip?: number; limit?: number; status?: string }): Promise<DocumentListResponse> => {
    const response: AxiosResponse<DocumentListResponse> = await api.get('/admin/documents', { params });
    return response.data;
  },

  uploadDocument: async (file: File, name?: string): Promise<{ message: string; document_id: number; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) {
      formData.append('name', name);
    }

    const response = await api.post('/admin/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  batchUploadDocuments: async (files: File[], metadata?: any): Promise<{
    message: string;
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      filename: string;
      success: boolean;
      document_id?: number;
      folder_name?: string;
      error?: string;
    }>;
  }> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await api.post('/admin/documents/batch-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  processDocument: async (documentId: number): Promise<{ message: string; document_id: number; status: string }> => {
    const response = await api.post(`/admin/documents/${documentId}/process`);
    return response.data;
  },

  // New Pipeline API - Index document (generate embeddings)
  indexDocument: async (documentId: number, batchSize: number = 32): Promise<{
    success: boolean;
    document_id: number;
    status: string;
    message: string;
    details?: {
      chunks_indexed: number;
      duration_seconds: number;
      errors: string[];
    };
  }> => {
    const response = await api.post(`/admin/documents/${documentId}/index`, { batch_size: batchSize });
    return response.data;
  },

  // New Pipeline API - Reindex document (clear and regenerate embeddings)
  reindexDocument: async (documentId: number, batchSize: number = 32): Promise<{
    success: boolean;
    document_id: number;
    status: string;
    message: string;
    details?: {
      chunks_indexed: number;
      duration_seconds: number;
      errors: string[];
    };
  }> => {
    const response = await api.post(`/admin/documents/${documentId}/reindex`, { batch_size: batchSize });
    return response.data;
  },

  // New Pipeline API - Get pipeline status
  getPipelineStatus: async (documentId: number): Promise<{
    document_id: number;
    document_name: string;
    status: string;
    processing_stage: string | null;
    processing_progress: number | null;
    processing_details: string | null;
    vector_indexed: boolean;
    statistics: {
      total_chunks: number;
      indexed_chunks: number;
      enriched_chunks: number;
      indexing_percentage: number;
    };
    available_actions: {
      can_process: boolean;
      can_index: boolean;
      can_reindex: boolean;
    };
    timestamps: {
      created_at: string | null;
      updated_at: string | null;
      processed_at: string | null;
    };
  }> => {
    const response = await api.get(`/admin/documents/${documentId}/pipeline-status`);
    return response.data;
  },

  reprocessDocument: async (
    documentId: number, 
    options?: { reextract_images?: boolean; rerun_image_ocr?: boolean; preserve_enrichments?: boolean }
  ): Promise<{ message: string; document_id: number; status: string; mode: string }> => {
    const response = await api.post(`/admin/documents/${documentId}/reprocess`, options || {});
    return response.data;
  },

  getDocumentProgress: async (documentId: number): Promise<{
    document_id: number;
    status: string;
    processing_stage: string | null;
    processing_progress: number;
    processing_details: string | null;
    processing_logs: Array<{
      timestamp: string;
      level: string;
      stage: string;
      progress: number;
      message: string;
    }>;
    is_processing: boolean;
    system_stats?: {
      memory?: {
        percent: number;
        used: number;
        total: number;
      };
      cpu?: {
        percent: number;
      };
    };
    updated_at: string | null;
  }> => {
    const response = await api.get(`/admin/documents/${documentId}/progress`);
    return response.data;
  },

  pauseDocumentProcessing: async (documentId: number): Promise<{ message: string }> => {
    const response = await api.post(`/admin/documents/${documentId}/pause`);
    return response.data;
  },

  resumeDocumentProcessing: async (documentId: number): Promise<{ message: string }> => {
    const response = await api.post(`/admin/documents/${documentId}/resume`);
    return response.data;
  },

  cancelDocumentProcessing: async (documentId: number): Promise<{ message: string }> => {
    const response = await api.post(`/admin/documents/${documentId}/cancel`);
    return response.data;
  },

  deleteDocument: async (documentId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/documents/${documentId}`);
    return response.data;
  },

  resetDocument: async (documentId: number): Promise<{ message: string; document_id: number; reset_items: string[] }> => {
    const response = await api.post(`/admin/documents/${documentId}/reset`);
    return response.data;
  },

  // Advanced Reset and Reprocess
  resetAndReprocess: async (
    documentId: number,
    request: {
      reset_level: 'indexing' | 'processing' | 'all';
      reset_options?: {
        chunks: boolean;
        chunk_enrichments: boolean;
        doc_enrichments: boolean;
        images: boolean;
        ocr_texts: boolean;
      };
      reprocess_options?: {
        extract_text: boolean;
        extract_images: boolean;
        run_ocr: boolean;
        chunking_strategy?: 'paragraph' | 'fixed_size' | 'semantic' | null;
        chunk_size?: number;
        chunk_overlap?: number;
        ocr_languages?: string;
      };
      auto_process: boolean;
      auto_index: boolean;
    }
  ): Promise<{
    success: boolean;
    operation_id: string;
    document_id: number;
    estimated_time_seconds: number;
    message: string;
    steps: string[];
  }> => {
    const response = await api.post(`/admin/documents/${documentId}/reset-and-reprocess`, request);
    return response.data;
  },

  bulkResetAndReprocess: async (
    request: {
      document_ids: number[];
      reset_level: 'indexing' | 'processing' | 'all';
      reset_options?: {
        chunks: boolean;
        chunk_enrichments: boolean;
        doc_enrichments: boolean;
        images: boolean;
        ocr_texts: boolean;
      };
      reprocess_options?: {
        extract_text: boolean;
        extract_images: boolean;
        run_ocr: boolean;
        chunking_strategy?: 'paragraph' | 'fixed_size' | 'semantic' | null;
        chunk_size?: number;
        chunk_overlap?: number;
        ocr_languages?: string;
      };
      auto_process: boolean;
      auto_index: boolean;
    }
  ): Promise<{
    message: string;
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      document_id: number;
      success: boolean;
      operation_id?: string;
      estimated_time_seconds?: number;
      error?: string;
    }>;
  }> => {
    const response = await api.post('/admin/documents/bulk-reset-and-reprocess', request);
    return response.data;
  },

  bulkResetDocuments: async (): Promise<{
    message: string;
    total_documents: number;
    successful: number;
    failed: number;
    details: Array<{
      document_id: number;
      name: string;
      success: boolean;
      items_reset?: string[];
      error?: string;
    }>;
  }> => {
    const response = await api.post('/admin/documents/bulk-reset');
    return response.data;
  },

  // Model Management
  getModels: async (): Promise<ModelConfig[]> => {
    const response: AxiosResponse<ModelConfig[]> = await api.get('/admin/models');
    return response.data;
  },

  createModel: async (modelData: ModelConfigCreate): Promise<ModelConfig> => {
    const response: AxiosResponse<ModelConfig> = await api.post('/admin/models', modelData);
    return response.data;
  },

  updateModel: async (modelId: number, modelData: ModelConfigUpdate): Promise<ModelConfig> => {
    const response: AxiosResponse<ModelConfig> = await api.put(`/admin/models/${modelId}`, modelData);
    return response.data;
  },

  getModel: async (modelId: number): Promise<ModelConfig> => {
    const response: AxiosResponse<ModelConfig> = await api.get(`/admin/models/${modelId}`);
    return response.data;
  },

  deleteModel: async (modelId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/models/${modelId}`);
    return response.data;
  },

  // Vector Index Management
  getVectorIndexes: async (): Promise<VectorIndex[]> => {
    const response: AxiosResponse<VectorIndex[]> = await api.get('/admin/vector-indexes');
    return response.data;
  },

  createVectorIndex: async (indexData: VectorIndexCreate): Promise<VectorIndex> => {
    const response: AxiosResponse<VectorIndex> = await api.post('/admin/vector-indexes', indexData);
    return response.data;
  },

  rebuildVectorIndex: async (indexId: number): Promise<{ message: string; index_id: number; total_chunks: number }> => {
    const response = await api.post(`/admin/vector-indexes/${indexId}/rebuild`);
    return response.data;
  },

  deleteVectorIndex: async (indexId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/vector-indexes/${indexId}`);
    return response.data;
  },

  // AI Service Integration (HuggingFace-based providers only)

  getHuggingFaceModels: async (): Promise<any> => {
    const response = await api.get('/admin/huggingface/models/popular');
    return response.data;
  },

  checkHuggingFaceHealth: async (): Promise<any> => {
    const response = await api.get('/admin/huggingface/health');
    return response.data;
  },

  configureHuggingFaceModel: async (modelData: any): Promise<any> => {
    const response = await api.post('/admin/huggingface/models/configure', modelData);
    return response.data;
  },

  testHuggingFaceModel: async (modelName: string): Promise<any> => {
    const response = await api.get(`/admin/huggingface/models/test/${encodeURIComponent(modelName)}`);
    return response.data;
  },

  // User Management
  getUsers: async (): Promise<User[]> => {
    const response: AxiosResponse<User[]> = await api.get('/admin/users');
    return response.data;
  },

  getUser: async (id: number): Promise<User> => {
    const response: AxiosResponse<User> = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  createUser: async (userData: any): Promise<User> => {
    const response: AxiosResponse<User> = await api.post('/admin/users', userData);
    return response.data;
  },

  updateUser: async (id: number, userData: any): Promise<User> => {
    const response: AxiosResponse<User> = await api.put(`/admin/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  // Document Content
  getDocumentContent: async (documentId: number): Promise<any> => {
    const response = await api.get(`/admin/documents/${documentId}/content`);
    return response.data;
  },

  // Model Providers
  getModelProviders: async (modelId: string): Promise<any> => {
    const response = await api.get(`/chatui/model-providers/${encodeURIComponent(modelId)}`);
    return response.data;
  },

  // ========================================
  // Hybrid Vector Store APIs
  // ========================================

  // Vector Store Status & Health
  getVectorStoreStatus: async (): Promise<any> => {
    const response = await api.get('/api/admin/vectorstore/status');
    return response.data;
  },

  getVectorStoreHealth: async (): Promise<any> => {
    const response = await api.get('/api/admin/vectorstore/health');
    return response.data;
  },

  getVectorStoreStats: async (): Promise<any> => {
    const response = await api.get('/api/admin/vectorstore/stats');
    return response.data;
  },

  // Bulk Ingest (Multi-file upload to hybrid stores)
  bulkIngestDocuments: async (files: File[], metadata?: any): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await api.post('/api/ingest/documents/ingest', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // FAISS Rebuild
  rebuildFAISSIndex: async (): Promise<any> => {
    const response = await api.post('/api/ingest/documents/rebuild-faiss');
    return response.data;
  },

  rebuildFAISSIndexAdmin: async (): Promise<any> => {
    const response = await api.post('/api/admin/vectorstore/rebuild-faiss');
    return response.data;
  },

  // RAG Query (for testing)
  queryRAG: async (queryData: {
    question: string;
    top_k?: number;
    chroma_weight?: number;
    faiss_weight?: number;
    enable_reranking?: boolean;
    reranker_top_k?: number;
  }): Promise<any> => {
    const response = await api.post('/api/query/rag', queryData);
    return response.data;
  },

  // Query Status
  getQueryStatus: async (): Promise<any> => {
    const response = await api.get('/api/query/status');
    return response.data;
  },

  // ========================================
  // Vector Store Settings APIs
  // ========================================

  // Get current vector store settings
  getVectorStoreSettings: async (): Promise<any> => {
    const response = await api.get('/api/admin/settings/vectorstore');
    return response.data;
  },

  // Update vector store settings
  updateVectorStoreSettings: async (settings: any): Promise<any> => {
    const response = await api.put('/api/admin/settings/vectorstore', settings);
    return response.data;
  },

  // Reset settings to defaults
  resetVectorStoreSettings: async (): Promise<any> => {
    const response = await api.post('/api/admin/settings/vectorstore/reset');
    return response.data;
  },

  // Get available embedding models
  getEmbeddingModels: async (): Promise<any> => {
    const response = await api.get('/api/admin/settings/embedding-models');
    return response.data;
  },

  // Get available reranker models
  getRerankerModels: async (): Promise<any> => {
    const response = await api.get('/api/admin/settings/reranker-models');
    return response.data;
  },

  // Test an embedding model
  testEmbeddingModel: async (modelId: string): Promise<any> => {
    const response = await api.post('/api/admin/settings/embedding-models/test', null, {
      params: { model_id: modelId }
    });
    return response.data;
  },

  // Stuck Document Management
  getStuckDocuments: async (): Promise<any> => {
    const response = await api.get('/admin/documents/stuck');
    return response.data;
  },

  resetStuckDocument: async (documentId: number): Promise<any> => {
    const response = await api.post(`/admin/documents/${documentId}/reset`);
    return response.data;
  },
};

export default api;

/**
 * Embedding Models API Service
 * Handles all API calls for embedding model management
 */

import api from './api';

const API_PREFIX = '/api/admin/embedding-models';

// Types
export interface EmbeddingModel {
  id: number;
  model_id: string;
  display_name: string;
  description: string | null;
  dimension: number;
  max_sequence_length: number;
  size_mb: number | null;
  deployment_type: 'local' | 'remote';
  api_endpoint: string | null;
  requires_api_key: boolean;
  api_key_env_var: string | null;
  multilingual: boolean;
  performance_tier: 'fast' | 'balanced' | 'best';
  is_active: boolean;
  is_default: boolean;
  is_downloaded: boolean;
  provider: string;
  model_family: string | null;
  created_at: string;
  updated_at: string | null;
  last_used: string | null;
}

export interface EmbeddingModelListResponse {
  models: EmbeddingModel[];
  total: number;
  active_count: number;
  default_model_id: string | null;
}

export interface ModelInfoResponse {
  id: number;
  model_id: string;
  display_name: string;
  description: string | null;
  dimension: number;
  deployment_type: string;
  is_default: boolean;
  is_active: boolean;
  is_downloaded: boolean;
  provider_info: {
    model_id: string;
    provider: string;
    deployment_type: string;
    dimension: number;
    device: string;
    is_loaded: boolean;
  };
  usage_stats: {
    documents_using_model: number;
    last_used: string | null;
  };
}

export interface StatsOverview {
  models: {
    total: number;
    active: number;
    local: number;
    remote: number;
    default: string | null;
  };
  documents: {
    total: number;
    with_embedding: number;
    without_embedding: number;
  };
}

export interface ChangeModelResponse {
  success: boolean;
  message: string;
  requires_reindex: boolean;
  affected_documents: number;
  old_model: string | null;
  new_model: string;
  reset_performed: boolean;
  requires_confirmation: boolean;
}

export interface ModelCompatibilityCheck {
  compatible: boolean;
  requires_reset: boolean;
  reason: string;
  old_model: {
    model_id: string;
    dimension: number;
    display_name: string;
  } | null;
  new_model: {
    model_id: string;
    dimension: number;
    display_name: string;
  } | null;
}

export interface TestEncodeResponse {
  success: boolean;
  model_id: string;
  text: string;
  embedding_shape: number[];
  embedding_dimension: number;
  elapsed_time_ms: number;
  sample_values: number[];
}

// API Functions

/**
 * List all embedding models
 */
export const listEmbeddingModels = async (
  activeOnly: boolean = false,
  deploymentType?: 'local' | 'remote'
): Promise<EmbeddingModelListResponse> => {
  const params: any = {};
  if (activeOnly) params.active_only = true;
  if (deploymentType) params.deployment_type = deploymentType;

  const response = await api.get(`${API_PREFIX}/`, { params });
  return response.data;
};

/**
 * Get detailed model information
 */
export const getModelInfo = async (modelId: string): Promise<ModelInfoResponse> => {
  const response = await api.get(`${API_PREFIX}/${encodeURIComponent(modelId)}`);
  return response.data;
};

/**
 * Get statistics overview
 */
export const getStatsOverview = async (): Promise<StatsOverview> => {
  const response = await api.get(`${API_PREFIX}/stats/overview`);
  return response.data;
};

/**
 * Check model compatibility before changing
 */
export const checkModelCompatibility = async (modelId: string): Promise<ModelCompatibilityCheck> => {
  const response = await api.post(`${API_PREFIX}/check-compatibility`, null, {
    params: { model_id: modelId }
  });
  return response.data;
};

/**
 * Set default model
 * @param modelId - Model ID to set as default
 * @param autoReset - Automatically reset vectors if incompatible (default: true)
 * @param forceReset - Force reset even if compatible (default: false)
 */
export const setDefaultModel = async (
  modelId: string,
  autoReset: boolean = true,
  forceReset: boolean = false
): Promise<ChangeModelResponse> => {
  const response = await api.post(`${API_PREFIX}/set-default`, {
    model_id: modelId,
    auto_reset: autoReset,
    force_reset: forceReset
  });
  return response.data;
};

/**
 * Test encoding with a model
 */
export const testEncode = async (
  modelId: string,
  text: string = 'Test embedding'
): Promise<TestEncodeResponse> => {
  const response = await api.post(`${API_PREFIX}/test-encode`, null, {
    params: { model_id: modelId, text },
  });
  return response.data;
};

/**
 * Update model configuration
 */
export const updateModel = async (
  modelId: string,
  data: {
    display_name?: string;
    description?: string;
    is_active?: boolean;
    is_default?: boolean;
  }
): Promise<EmbeddingModel> => {
  const response = await api.patch(`${API_PREFIX}/${encodeURIComponent(modelId)}`, data);
  return response.data;
};

/**
 * Create new embedding model
 */
export const createModel = async (data: {
  model_id: string;
  display_name: string;
  description?: string;
  dimension: number;
  max_sequence_length?: number;
  size_mb?: number;
  deployment_type: 'local' | 'remote';
  api_endpoint?: string;
  requires_api_key?: boolean;
  api_key_env_var?: string;
  multilingual?: boolean;
  performance_tier?: 'fast' | 'balanced' | 'best';
  provider?: string;
  model_family?: string;
}): Promise<EmbeddingModel> => {
  const response = await api.post(`${API_PREFIX}/`, data);
  return response.data;
};

/**
 * Delete embedding model
 */
export const deleteModel = async (modelId: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`${API_PREFIX}/${encodeURIComponent(modelId)}`);
  return response.data;
};

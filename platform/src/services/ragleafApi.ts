// platform/src/services/ragleafApi.ts
// Ragleaf Platform API client

import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: string;
  max_agents: number;
  max_documents: number;
  max_queries_per_month: number;
  is_active: boolean;
  created_at: string;
  agent_count?: number;
  document_count?: number;
  member_count?: number;
}

export interface Agent {
  id: number;
  public_id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  system_prompt: string | null;
  welcome_message: string | null;
  personality: Record<string, any> | null;
  model_config_data: Record<string, any> | null;
  rag_config: Record<string, any> | null;
  appearance: Record<string, any> | null;
  allowed_domains: string[] | null;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  is_active: boolean;
  is_public: boolean;
  total_conversations: number;
  total_messages: number;
  document_count?: number;
  created_at: string;
  updated_at: string | null;
}

export interface AgentAPIKey {
  id: number;
  name: string;
  key_prefix: string;
  key_type: string;
  is_active: boolean;
  total_requests: number;
  last_used_at: string | null;
  created_at: string;
  raw_key?: string;
}

export interface KnowledgeBaseDocument {
  id: number;
  name: string;
  file_type: string;
  status: string;
  total_chunks: number | null;
  vector_indexed: boolean;
  created_at: string | null;
}

// ============================================================================
// Organization API
// ============================================================================

export const organizationApi = {
  list: async (): Promise<Organization[]> => {
    const res = await api.get('/api/organizations');
    return res.data;
  },
  
  getCurrent: async (): Promise<Organization> => {
    const res = await api.get('/api/organizations/current');
    return res.data;
  },
  
  create: async (data: { name: string; slug?: string }): Promise<Organization> => {
    const res = await api.post('/api/organizations', data);
    return res.data;
  },

  update: async (data: Partial<Organization>): Promise<Organization> => {
    const res = await api.put('/api/organizations/current', data);
    return res.data;
  },
};

// ============================================================================
// Agent API
// ============================================================================

export const agentApi = {
  list: async (): Promise<Agent[]> => {
    const res = await api.get('/api/agents');
    return res.data;
  },
  
  get: async (id: number): Promise<Agent> => {
    const res = await api.get(`/api/agents/${id}`);
    return res.data;
  },
  
  create: async (data: Partial<Agent>): Promise<Agent> => {
    const res = await api.post('/api/agents', data);
    return res.data;
  },
  
  update: async (id: number, data: Partial<Agent>): Promise<Agent> => {
    const res = await api.put(`/api/agents/${id}`, data);
    return res.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/agents/${id}`);
  },

  // Knowledge Base
  getKnowledgeBase: async (id: number): Promise<{ documents: KnowledgeBaseDocument[]; total: number }> => {
    const res = await api.get(`/api/agents/${id}/knowledge`);
    return res.data;
  },
  
  addDocuments: async (id: number, documentIds: number[]): Promise<any> => {
    const res = await api.post(`/api/agents/${id}/knowledge`, { document_ids: documentIds });
    return res.data;
  },
  
  removeDocument: async (agentId: number, docId: number): Promise<void> => {
    await api.delete(`/api/agents/${agentId}/knowledge/${docId}`);
  },

  // API Keys
  listApiKeys: async (id: number): Promise<AgentAPIKey[]> => {
    const res = await api.get(`/api/agents/${id}/api-keys`);
    return res.data;
  },
  
  createApiKey: async (id: number, data: { name: string; key_type: string }): Promise<AgentAPIKey> => {
    const res = await api.post(`/api/agents/${id}/api-keys`, data);
    return res.data;
  },
  
  revokeApiKey: async (agentId: number, keyId: number): Promise<void> => {
    await api.delete(`/api/agents/${agentId}/api-keys/${keyId}`);
  },
};

// ============================================================================
// Template API (Sektörel Şablonlar)
// ============================================================================

export interface TemplateConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'phone' | 'tag_list' | 'schedule' | 'number';
  required?: boolean;
  placeholder?: string;
  suggestions?: string[];
  default?: any;
}

export interface AgentTemplate {
  id: number;
  slug: string;
  category: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_featured: boolean;
  preview_questions: string[] | null;
  config_schema: TemplateConfigField[];
  default_system_prompt?: string;
  default_welcome_message?: string | null;
  default_personality?: Record<string, any> | null;
  default_appearance?: Record<string, any> | null;
}

export interface CreateFromTemplateRequest {
  template_slug: string;
  config_data: Record<string, any>;
  agent_name?: string;
}

export const templateApi = {
  list: async (category?: string): Promise<AgentTemplate[]> => {
    const params = category ? `?category=${category}` : '';
    const res = await api.get(`/api/templates${params}`);
    return res.data;
  },

  get: async (slug: string): Promise<AgentTemplate> => {
    const res = await api.get(`/api/templates/${slug}`);
    return res.data;
  },

  createFromTemplate: async (data: CreateFromTemplateRequest): Promise<Agent & { api_key?: string }> => {
    const res = await api.post('/api/agents/from-template', data);
    return res.data;
  },
};

// ============================================================================
// Appointment API (Randevu Yönetimi)
// ============================================================================

export interface Appointment {
  id: number;
  public_id: string;
  organization_id: number;
  agent_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_notes: string | null;
  service_type: string | null;
  service_details: Record<string, any> | null;
  appointment_date: string;
  appointment_end: string | null;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  cancelled_reason: string | null;
  sync_status: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface AppointmentStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  today: number;
  this_week: number;
}

export const appointmentApi = {
  list: async (params?: {
    status?: string;
    agent_id?: number;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<Appointment[]> => {
    const res = await api.get('/api/appointments', { params });
    return res.data;
  },

  get: async (publicId: string): Promise<Appointment> => {
    const res = await api.get(`/api/appointments/${publicId}`);
    return res.data;
  },

  updateStatus: async (publicId: string, status: string, reason?: string): Promise<Appointment> => {
    const res = await api.patch(`/api/appointments/${publicId}/status`, {
      status,
      cancelled_reason: reason,
    });
    return res.data;
  },

  update: async (publicId: string, data: Partial<Appointment>): Promise<Appointment> => {
    const res = await api.put(`/api/appointments/${publicId}`, data);
    return res.data;
  },

  delete: async (publicId: string): Promise<void> => {
    await api.delete(`/api/appointments/${publicId}`);
  },

  stats: async (): Promise<AppointmentStats> => {
    const res = await api.get('/api/appointments/stats/summary');
    return res.data;
  },
};

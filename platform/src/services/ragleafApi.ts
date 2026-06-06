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
  ragleaf_leaves: number;
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

export interface AgentDocument {
  id: number;
  name: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: string;
  processing_stage: string | null;
  processing_progress: number;
  total_chunks: number | null;
  vector_indexed: boolean;
  language: string;
  created_at: string | null;
  processed_at: string | null;
  shared_agent_count: number;
  is_shared: boolean;
  linked_at: string | null;
}

export interface DocumentQualityInfo {
  score: number;
  tier: string;
  suggestions: string[];
}

export interface DocumentLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  stage: string;
  progress: number;
  message: string;
}

export interface SystemHealthStatus {
  database: boolean;
  ocr: boolean;
  embedding: boolean;
}

export interface DocumentDetailsResponse {
  document_id: number;
  name: string;
  original_filename: string;
  status: string;
  file_type: string;
  file_size: number;
  total_chunks: number | null;
  processing_stage: string | null;
  processing_progress: number;
  quality: DocumentQualityInfo;
  logs: DocumentLogEntry[];
  system_health: SystemHealthStatus;
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

  // Agent Document Management (GÖREV-11)
  listDocuments: async (agentId: number): Promise<{ agent_id: number; agent_name: string; documents: AgentDocument[]; total: number }> => {
    const res = await api.get(`/api/agents/${agentId}/documents`);
    return res.data;
  },

  uploadDocument: async (agentId: number, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/api/agents/${agentId}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteDocument: async (agentId: number, docId: number, removeOnly: boolean = false): Promise<any> => {
    const res = await api.delete(`/api/agents/${agentId}/documents/${docId}`, {
      params: { remove_only: removeOnly },
    });
    return res.data;
  },

  processDocument: async (agentId: number, docId: number): Promise<any> => {
    const res = await api.post(`/api/agents/${agentId}/documents/${docId}/process`);
    return res.data;
  },

  shareDocument: async (agentId: number, docId: number, targetAgentId: number): Promise<any> => {
    const res = await api.post(`/api/agents/${agentId}/documents/${docId}/share`, null, {
      params: { target_agent_id: targetAgentId },
    });
    return res.data;
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

  getDocumentDetails: async (agentId: number, docId: number): Promise<DocumentDetailsResponse> => {
    const res = await api.get(`/api/agents/${agentId}/documents/${docId}/details`);
    return res.data;
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
  sort_order?: number;
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

// ============================================================================
// Calendar Integration API
// ============================================================================

export interface CalendarIntegrationItem {
  id: number;
  provider: string;
  name: string;
  calendar_id: string | null;
  sync_enabled: boolean;
  sync_direction: string;
  last_sync_at: string | null;
  sync_error: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ICalFeedInfo {
  feed_url: string;
  instructions: {
    google_calendar: string;
    apple_calendar: string;
    outlook: string;
  };
}

export const calendarApi = {
  listIntegrations: async (): Promise<CalendarIntegrationItem[]> => {
    const res = await api.get('/api/calendar/integrations');
    return res.data;
  },

  removeIntegration: async (id: number): Promise<void> => {
    await api.delete(`/api/calendar/integrations/${id}`);
  },

  startGoogleAuth: async (): Promise<{ auth_url: string }> => {
    const res = await api.get('/api/calendar/google/auth');
    return res.data;
  },

  getFeedUrl: async (): Promise<ICalFeedInfo> => {
    const res = await api.get('/api/calendar/feed-url');
    return res.data;
  },
};

// ============================================================================
// Admin Tenant Management API
// ============================================================================

export interface TenantListItem {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: string;
  is_active: boolean;
  is_system: boolean;
  allow_admin_doc_access: boolean;
  max_agents: number;
  max_documents: number;
  created_at: string;
  user_count: number;
  agent_count: number;
  document_count: number;
  appointment_count: number;
}

export interface TenantStats {
  total_tenants: number;
  active_tenants: number;
  inactive_tenants: number;
  total_agents: number;
  total_appointments: number;
  plan_distribution: Record<string, number>;
}

export const adminTenantApi = {
  list: async (params?: { search?: string; plan?: string }): Promise<TenantListItem[]> => {
    const res = await api.get('/api/admin/tenants', { params });
    return res.data;
  },

  stats: async (): Promise<TenantStats> => {
    const res = await api.get('/api/admin/tenants/stats');
    return res.data;
  },

  get: async (id: number): Promise<TenantListItem> => {
    const res = await api.get(`/api/admin/tenants/${id}`);
    return res.data;
  },

  update: async (id: number, data: Record<string, any>): Promise<void> => {
    await api.patch(`/api/admin/tenants/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/admin/tenants/${id}`);
  },

  getUsers: async (id: number): Promise<any> => {
    const res = await api.get(`/api/admin/tenants/${id}/users`);
    return res.data;
  },

  getAgents: async (id: number): Promise<any> => {
    const res = await api.get(`/api/admin/tenants/${id}/agents`);
    return res.data;
  },

  getDocuments: async (id: number): Promise<any> => {
    const res = await api.get(`/api/admin/tenants/${id}/documents`);
    return res.data;
  },

  getAppointments: async (id: number): Promise<any> => {
    const res = await api.get(`/api/admin/tenants/${id}/appointments`);
    return res.data;
  },

  uploadDocumentToAgent: async (tenantId: number, agentId: number, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/api/admin/tenants/${tenantId}/agents/${agentId}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

// ============================================================================
// Plan Management API (GÖREV-24)
// ============================================================================

export interface Plan {
  id: number;
  key: string;
  name: string;
  price: number;
  billing_cycle: string;
  max_agents: number;
  max_documents: number;
  max_queries_per_month: number;
  max_storage_mb: number;
  is_active: boolean;
}

export const adminPlanApi = {
  list: async (): Promise<Plan[]> => {
    const res = await api.get('/api/admin/plans');
    return res.data;
  },

  update: async (id: number, data: Partial<Omit<Plan, 'id' | 'key'>>): Promise<Plan> => {
    const res = await api.put(`/api/admin/plans/${id}`, data);
    return res.data;
  },
};

// ============================================================================
// AI Writer API (Otonom İçerik Üretimi)
// ============================================================================

export interface WriterArticle {
  id: number;
  public_id: string;
  organization_id: number;
  agent_id: number | null;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  keywords: string[];
  outline: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'published';
  mode: 'autonomous' | 'semi-autonomous';
  publishing_platform: 'nextjs' | 'wordpress' | 'ghost';
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  extra_data?: Record<string, any> | null;
}

export interface ArticleCreateRequest {
  topic: string;
  keywords: string[];
  language: string;
  agent_id?: number | null;
  mode: 'autonomous' | 'semi-autonomous';
  publishing_platform: 'nextjs' | 'wordpress' | 'ghost';
}

export interface ArticleUpdateRequest {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  keywords?: string[];
  outline?: string[];
  status?: 'draft' | 'pending_review' | 'approved' | 'published';
  mode?: 'autonomous' | 'semi-autonomous';
  publishing_platform?: 'nextjs' | 'wordpress' | 'ghost';
  scheduled_at?: string | null;
}

export const writerApi = {
  list: async (params?: { status?: string; agent_id?: number }): Promise<WriterArticle[]> => {
    const res = await api.get('/api/writer/articles', { params });
    return res.data;
  },

  get: async (publicId: string): Promise<WriterArticle> => {
    const res = await api.get(`/api/writer/articles/${publicId}`);
    return res.data;
  },

  generate: async (data: ArticleCreateRequest): Promise<WriterArticle> => {
    const res = await api.post('/api/writer/generate', data);
    return res.data;
  },

  update: async (publicId: string, data: ArticleUpdateRequest): Promise<WriterArticle> => {
    const res = await api.put(`/api/writer/articles/${publicId}`, data);
    return res.data;
  },

  publish: async (publicId: string): Promise<WriterArticle> => {
    const res = await api.post(`/api/writer/articles/${publicId}/publish`);
    return res.data;
  },

  delete: async (publicId: string): Promise<void> => {
    await api.delete(`/api/writer/articles/${publicId}`);
  },
};



// platform/src/services/backupApi.ts
/**
 * Backup API Service
 * Handles all backup-related API calls
 */
import api from './api';

// Types
export interface BackupInfo {
  filename: string;
  size_bytes: number;
  size_formatted: string;
  created_at: string;
}

export interface BackupResult {
  success: boolean;
  filename?: string;
  size_bytes?: number;
  duration_ms: number;
  error?: string;
}

export interface BackupLog {
  id: string;
  operation: string;
  status: string;
  filename?: string;
  details?: string;
  timestamp: string;
}

export interface BackupListResponse {
  backups: BackupInfo[];
  total: number;
}

export interface BackupLogsResponse {
  logs: BackupLog[];
  total: number;
}

export interface BackupMetadata {
  version?: string;
  created_at?: string;
  system_info?: {
    app_version?: string;
    database?: string;
  };
  metadata?: {
    user_count?: number;
    settings_count?: number;
    provider_count?: number;
    token_count?: number;
    embedding_model_count?: number;
    llm_model_count?: number;
  };
}

// API Functions
export const backupApi = {
  /**
   * Create a new backup
   */
  createBackup: async (): Promise<BackupResult> => {
    const response = await api.post<BackupResult>('/api/backups/create');
    return response.data;
  },

  /**
   * List all backups
   */
  listBackups: async (): Promise<BackupListResponse> => {
    const response = await api.get<BackupListResponse>('/api/backups/list');
    return response.data;
  },

  /**
   * Download a backup file
   */
  downloadBackup: async (filename: string): Promise<void> => {
    const response = await api.get(`/api/backups/${filename}/download`, {
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Get backup metadata
   */
  getBackupMetadata: async (filename: string): Promise<BackupMetadata> => {
    const response = await api.get<BackupMetadata>(`/api/backups/${filename}/metadata`);
    return response.data;
  },

  /**
   * Delete a backup
   */
  deleteBackup: async (filename: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>(`/api/backups/${filename}`);
    return response.data;
  },

  /**
   * Get backup logs
   */
  getBackupLogs: async (limit: number = 50): Promise<BackupLogsResponse> => {
    const response = await api.get<BackupLogsResponse>('/api/backups/logs', {
      params: { limit },
    });
    return response.data;
  },
};

export default backupApi;

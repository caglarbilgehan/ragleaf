import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';

interface AgentSummary {
  id: number;
  name: string;
  public_id: string;
}

interface AgentDocument {
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

interface DocumentDetailsResponse {
  document_id: number;
  name: string;
  original_filename: string;
  status: string;
  file_type: string;
  file_size: number;
  total_chunks: number | null;
  processing_stage: string | null;
  processing_progress: number;
  quality: {
    score: number;
    tier: string;
    suggestions: string[];
  };
  logs: {
    timestamp: string;
    level: 'info' | 'warning' | 'error' | 'success';
    stage: string;
    progress: number;
    message: string;
  }[];
  system_health: {
    database: boolean;
    ocr: boolean;
    embedding: boolean;
  };
}

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileTypeIcon(fileType: string): string {
  switch (fileType?.toLowerCase()) {
    case 'pdf': return '📕';
    case 'docx': return '📘';
    case 'txt': return '📄';
    case 'md': return '📝';
    default: return '📄';
  }
}

function getStatusConfig(status: string, t: (key: string) => string) {
  switch (status) {
    case 'indexed':
      return { label: t('docs.status.indexed'), color: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20', icon: '✅', animate: false };
    case 'enriched':
      return { label: t('docs.status.enriched'), color: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20', icon: '📘', animate: false };
    case 'processed':
      return { label: t('docs.status.processed'), color: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20', icon: '📄', animate: false };
    case 'processing':
      return { label: t('docs.status.processing'), color: 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20', icon: '⏳', animate: true };
    case 'indexing':
      return { label: t('docs.status.indexing'), color: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20', icon: '⏳', animate: true };
    case 'error':
      return { label: t('docs.status.error'), color: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20', icon: '❌', animate: false };
    case 'uploaded':
      return { label: t('docs.status.uploaded'), color: 'bg-dark-600 text-gray-300 ring-1 ring-white/[0.06]', icon: '📤', animate: false };
    default:
      return { label: status, color: 'bg-dark-600 text-gray-400', icon: '📁', animate: false };
  }
}

export default function TenantDocuments() {
  const { t, language } = useTranslation();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Details Modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [detailsData, setDetailsData] = useState<DocumentDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadDetails = async (docId: number) => {
    if (!selectedAgentId) return;
    setSelectedDocId(docId);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    setDetailsData(null);
    try {
      const data = await fetchAPI<DocumentDetailsResponse>(`/api/agents/${selectedAgentId}/documents/${docId}/details`);
      setDetailsData(data);
    } catch (err: any) {
      showNotification('error', t('docs.toast_details_error').replace('{error}', err.message));
      setDetailsModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchAPI<AgentSummary[]>('/api/org/agents')
      .then((data) => {
        setAgents(data);
        if (data.length > 0) setSelectedAgentId(data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!selectedAgentId) return;
    setRefreshing(true);
    try {
      const data = await fetchAPI<{ documents: AgentDocument[] }>(`/api/agents/${selectedAgentId}/documents`);
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setRefreshing(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (documents.some((doc) => doc.status === 'processing' || doc.status === 'indexing')) {
      refreshIntervalRef.current = setInterval(loadDocuments, 3000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [documents, loadDocuments]);

  const handleUpload = async (files: FileList) => {
    if (!selectedAgentId || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (const file of Array.from(files)) {
      setUploadStatus(t('docs.toast_uploading_file').replace('{name}', file.name));
      try {
        const token = localStorage.getItem('ragleaf_token');
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/api/agents/${selectedAgentId}/documents/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          successCount++;
        } else {
          const err = await res.json().catch(() => ({}));
          console.error(`Upload failed for ${file.name}:`, err);
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }
    setUploading(false);
    setUploadStatus('');
    if (successCount > 0 && failCount === 0) {
      showNotification('success', t('docs.toast_upload_success').replace('{count}', String(successCount)));
    } else if (successCount > 0 && failCount > 0) {
      showNotification('info', t('docs.toast_upload_warning').replace('{success}', String(successCount)).replace('{fail}', String(failCount)));
    } else {
      showNotification('error', t('docs.toast_upload_failed'));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    loadDocuments();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleUpload(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleDelete = async (docId: number, docName: string) => {
    if (!selectedAgentId) return;
    if (confirm(t('docs.confirm_delete').replace('{name}', docName))) {
      try {
        await fetchAPI(`/api/agents/${selectedAgentId}/documents/${docId}`, { method: 'DELETE' });
        showNotification('success', t('docs.toast_delete_success').replace('{name}', docName));
        loadDocuments();
      } catch (err: any) {
        showNotification('error', t('docs.toast_delete_error').replace('{error}', err.message));
      }
    }
  };

  const handleProcess = async (docId: number, docName: string) => {
    if (!selectedAgentId) return;
    try {
      await fetchAPI(`/api/agents/${selectedAgentId}/documents/${docId}/process`, {
        method: 'POST',
      });
      showNotification('success', t('docs.toast_process_started').replace('{name}', docName));
      loadDocuments();
    } catch (err: any) {
      showNotification('error', t('docs.toast_process_error').replace('{error}', err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <span>📁</span>
          <span className="text-primary-500">AI</span>assistant / {language === 'tr' ? 'Dokümanlar' : 'Documents'}
        </h1>
        <p className="text-gray-400 mt-1">{t('docs.subtitle')}</p>
      </div>

      {notification && (
        <div className={`rounded-xl p-4 border transition-all ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : notification.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          <p className="font-medium text-sm">{notification.text}</p>
        </div>
      )}

      {agents.length === 0 ? (
        <div className="bg-dark-800/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-10 text-center shadow-[0_8px_30px_rgb(0,0,0,0.3)] max-w-lg mx-auto my-8">
          <div className="w-16 h-16 bg-primary-500/10 text-primary-400 rounded-full flex items-center justify-center mx-auto mb-5 border border-primary-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <span className="text-3xl animate-pulse">🤖</span>
          </div>
          <h3 className="text-lg font-bold text-gray-100 mb-2">{t('docs.no_agents_title')}</h3>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            {t('docs.no_agents_desc')}
          </p>
          <a
            href="/agents"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition text-sm shadow-[0_4px_15px_rgba(34,197,94,0.2)] hover:shadow-[0_4px_20px_rgba(34,197,94,0.3)] hover:scale-[1.02]"
          >
            {t('docs.btn_create_first')}
          </a>
        </div>
      ) : (
        <>
          {/* Agent Selector */}
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5">
            <label className="block text-sm font-medium text-gray-300 mb-2">🤖 {t('docs.target_agent')}</label>
            <select
              value={selectedAgentId || ''}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              className="w-full border border-white/[0.1] bg-dark-900 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Upload Area */}
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">📤 {t('docs.upload_title')}</h2>
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-primary-500 bg-primary-500/10 scale-[1.01]'
                  : 'border-white/[0.1] hover:border-primary-500/50 hover:bg-dark-700/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mb-3" />
                  <p className="text-gray-300 font-medium">{uploadStatus || t('ui.loading')}</p>
                </div>
              ) : (
                <>
                  <p className="text-4xl mb-3">📁</p>
                  <p className="text-base font-medium text-gray-300">
                    {t('docs.drag_drop_click')}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {t('docs.upload_limits')}
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Document List */}
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-200">
                📚 {t('docs.kb_docs')}
                <span className="ml-2 text-sm font-normal text-gray-400">({t('docs.count_suffix').replace('{count}', String(documents.length))})</span>
              </h2>
              <button
                onClick={loadDocuments}
                className="text-sm text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1"
                disabled={refreshing}
              >
                <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                {t('docs.btn_refresh')}
              </button>
            </div>

            {refreshing && documents.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p className="text-4xl mb-3">📭</p>
                <p>{t('docs.no_docs_yet')}</p>
                <p className="text-sm mt-1">{t('docs.no_docs_hint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-dark-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('docs.th_doc')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('docs.th_size')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('docs.th_status')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('docs.th_chunks')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('docs.th_date')}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('docs.th_action')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-dark-800/60 divide-y divide-white/[0.04]">
                    {documents.map((doc) => {
                      const statusCfg = getStatusConfig(doc.status, t);
                      return (
                        <tr key={doc.id} className="hover:bg-dark-700/50 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{getFileTypeIcon(doc.file_type)}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-100 truncate max-w-[220px]" title={doc.name}>
                                  {doc.name}
                                </p>
                                <p className="text-xs text-gray-400 truncate max-w-[220px]" title={doc.original_filename}>
                                  {doc.original_filename}
                                </p>
                                {doc.is_shared && (
                                  <span className="inline-flex items-center text-[10px] font-semibold text-purple-400 bg-purple-500/10 ring-1 ring-purple-500/20 px-1.5 py-0.5 rounded mt-0.5">
                                    🔗 {doc.shared_agent_count} {language === 'tr' ? 'asistan' : 'assistants'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-400">{formatFileSize(doc.file_size)}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                              <span className={statusCfg.animate ? 'animate-pulse' : ''}>{statusCfg.icon}</span>
                              {statusCfg.label}
                            </span>
                            {(doc.status === 'processing' || doc.status === 'indexing') && doc.processing_progress > 0 && (
                              <div className="mt-1.5 w-24 bg-dark-500 rounded-full h-1.5">
                                <div
                                  className="bg-primary-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${doc.processing_progress}%` }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-400">
                            {doc.total_chunks != null ? doc.total_chunks : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-400">
                            {doc.created_at
                              ? new Date(doc.created_at).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex justify-end gap-2">
                              {(doc.status === 'uploaded' || doc.status === 'error') && (
                                <button
                                  onClick={() => handleProcess(doc.id, doc.name)}
                                  className="text-xs font-medium text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/20 px-2.5 py-1.5 rounded-lg border border-primary-500/20 transition"
                                  title={t('docs.btn_process')}
                                >
                                  ⚙️ {t('docs.btn_process')}
                                </button>
                              )}
                              <button
                                onClick={() => loadDetails(doc.id)}
                                className="text-xs font-medium text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/20 px-2.5 py-1.5 rounded-lg border border-primary-500/20 transition"
                                title={t('docs.btn_details')}
                              >
                                📊 {t('docs.btn_details')}
                              </button>
                              <button
                                onClick={() => handleDelete(doc.id, doc.name)}
                                className="text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg border border-red-500/20 transition"
                                title={t('ui.delete')}
                                disabled={doc.status === 'processing' || doc.status === 'indexing'}
                              >
                                🗑️ {t('ui.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-dark-800/60 backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 bg-primary-500/10 text-primary-400 rounded-lg flex items-center justify-center flex-shrink-0 border border-primary-500/20">
              <span className="text-xl">💡</span>
            </div>
            <div className="space-y-1.5 flex-1">
              <h4 className="text-sm font-bold text-gray-200">{t('docs.info_title')}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">{t('docs.info_desc_1')}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{t('docs.info_desc_2')}</p>
            </div>
          </div>
        </>
      )}

      {/* Details Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
          <div className="bg-dark-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-white/[0.06]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-dark-700/50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {detailsData ? getFileTypeIcon(detailsData.file_type) : '📄'}
                </span>
                <div>
                  <h3 className="font-bold text-gray-100 text-lg">
                    {detailsData ? detailsData.name : t('ui.loading')}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {detailsData ? detailsData.original_filename : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="text-gray-400 hover:text-gray-300 hover:bg-dark-600 p-2 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
                  <p className="text-sm text-gray-400 font-medium">{t('docs.modal_loading_desc')}</p>
                </div>
              ) : detailsData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Quality & Services */}
                  <div className="space-y-6">
                    {/* Quality Score Card */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5">
                      <h4 className="font-semibold text-gray-200 text-sm mb-4 flex items-center gap-1.5">
                        📊 {t('docs.modal_quality_score')}
                      </h4>
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            {/* Track circle */}
                            <circle
                              cx="56"
                              cy="56"
                              r="44"
                              className="stroke-white/[0.06]"
                              strokeWidth="8"
                              fill="transparent"
                            />
                            {/* Progress circle */}
                            <circle
                              cx="56"
                              cy="56"
                              r="44"
                              className={`transition-all duration-500 ease-out ${
                                detailsData.quality.score >= 85 ? 'stroke-emerald-500' :
                                detailsData.quality.score >= 60 ? 'stroke-blue-500' :
                                detailsData.quality.score >= 30 ? 'stroke-amber-500' :
                                'stroke-rose-500'
                              }`}
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray={276.4}
                              strokeDashoffset={276.4 - (detailsData.quality.score / 100) * 276.4}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute text-center">
                            <span className={`text-2xl font-bold ${
                              detailsData.quality.score >= 85 ? 'text-emerald-400' :
                              detailsData.quality.score >= 60 ? 'text-blue-400' :
                              detailsData.quality.score >= 30 ? 'text-amber-400' :
                              'text-rose-400'
                            }`}>
                              {detailsData.quality.score}
                            </span>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase">
                              {detailsData.quality.tier}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Suggestions list */}
                      <div className="mt-5 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">{t('docs.modal_suggestions_title')}</p>
                        {detailsData.quality.suggestions.length > 0 ? (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {detailsData.quality.suggestions.map((sug, idx) => (
                              <div key={idx} className="flex gap-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-amber-300">
                                <span className="flex-shrink-0">⚠️</span>
                                <span>{sug}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-300">
                            <span className="flex-shrink-0">✨</span>
                            <span>{t('docs.modal_suggestions_optimum')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* System Health Card */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5">
                      <h4 className="font-semibold text-gray-200 text-sm mb-3.5 flex items-center gap-1.5">
                        ⚙️ {t('docs.modal_services_status')}
                      </h4>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-white/[0.06] text-center transition-all ${
                          detailsData.system_health.database
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                          <span className="text-xl mb-1">{detailsData.system_health.database ? '🟢' : '🔴'}</span>
                          <span className="text-xs font-semibold text-gray-300">{t('docs.service_db')}</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">{detailsData.system_health.database ? (language === 'tr' ? 'Aktif' : 'Active') : (language === 'tr' ? 'Hata' : 'Error')}</span>
                        </div>
                        <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-white/[0.06] text-center transition-all ${
                          detailsData.system_health.ocr
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                          <span className="text-xl mb-1">{detailsData.system_health.ocr ? '🟢' : '🔴'}</span>
                          <span className="text-xs font-semibold text-gray-300">{t('docs.service_ocr')}</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">{detailsData.system_health.ocr ? (language === 'tr' ? 'Aktif' : 'Active') : (language === 'tr' ? 'Pasif' : 'Inactive')}</span>
                        </div>
                        <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-white/[0.06] text-center transition-all ${
                          detailsData.system_health.embedding
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                          <span className="text-xl mb-1">{detailsData.system_health.embedding ? '🟢' : '🔴'}</span>
                          <span className="text-xs font-semibold text-gray-300">{t('docs.service_vector')}</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">{detailsData.system_health.embedding ? (language === 'tr' ? 'Aktif' : 'Active') : (language === 'tr' ? 'Hata' : 'Error')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Processing Logs Timeline */}
                  <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 flex flex-col">
                    <h4 className="font-semibold text-gray-200 text-sm mb-4 flex items-center gap-1.5 flex-shrink-0">
                      📜 {t('docs.modal_timeline_title')}
                    </h4>
                    <div className="flex-1 overflow-y-auto max-h-[42vh] pr-1.5 space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-dark-600">
                      {detailsData.logs && detailsData.logs.length > 0 ? (
                        detailsData.logs.map((log, idx) => {
                          let dotColor = 'bg-blue-500 ring-blue-500/20';
                          if (log.level === 'success') dotColor = 'bg-emerald-500 ring-emerald-500/20';
                          if (log.level === 'warning') dotColor = 'bg-amber-500 ring-amber-500/20';
                          if (log.level === 'error') dotColor = 'bg-rose-500 ring-rose-500/20';

                          return (
                            <div key={idx} className="flex gap-4 relative">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${dotColor} ring-4 z-10 flex-shrink-0 text-white text-[10px] font-bold`}>
                                {log.level === 'success' ? '✓' : log.level === 'error' ? '✗' : '!'}
                              </div>
                              <div className="flex-1 bg-dark-700/50 border border-white/[0.06] rounded-xl p-3">
                                <div className="flex justify-between items-center gap-2 mb-1">
                                  <span className="font-bold text-xs text-gray-200 uppercase tracking-wider">{log.stage}</span>
                                  <span className="text-[10px] text-gray-400">
                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed font-medium">{log.message}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-8">{t('docs.modal_no_logs')}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-12">{t('docs.modal_load_error')}</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-dark-700/50 border-t border-white/[0.06] flex justify-end">
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 bg-dark-500 hover:bg-dark-400 text-gray-200 rounded-xl text-sm font-semibold transition"
              >
                {t('ui.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

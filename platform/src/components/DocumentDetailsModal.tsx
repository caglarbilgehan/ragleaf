import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, AlertCircle, FileText, Database, BarChart3, Eye, ScrollText, RefreshCw, ChevronLeft, ChevronRight, Layers, File, Download, ExternalLink, History } from 'lucide-react';
import type { Document } from '@/types';
import { getApiBaseUrl } from '@/services/api';
import DocumentSummarySection from './DocumentSummarySection';
import DocumentProgressBar from './DocumentProgressBar';
import EditHistoryPanel from './EditHistoryPanel';

interface DocumentDetailsModalProps {
  document: Document;
  onClose: () => void;
}

interface DocumentStats {
  total_chunks: number;
  total_pages: number;
  avg_chunk_size: number;
  total_characters: number;
  total_words: number;
  ocr_images_count: number;
  processing_time_seconds: number;
  index_file_size: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface ProcessingLogs {
  logs: LogEntry[];
  error_message: string | null;
  processing_stage: string | null;
  processing_progress: number;
  total_logs: number;
}

interface DocumentPreview {
  content: string;
  content_source: string;
  has_content: boolean;
  preview_available: boolean;
  pagination: {
    current_page: number;
    total_pages: number;
    page_size: number;
    total_characters: number;
  };
}

interface DocumentChunk {
  index: number;
  content: string;
  metadata: Record<string, any>;
  char_count: number;
}

export default function DocumentDetailsModal({
  document,
  onClose,
}: DocumentDetailsModalProps) {
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [logs, setLogs] = useState<ProcessingLogs | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [chunksTotal, setChunksTotal] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [chunksPage, setChunksPage] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'chunks' | 'original'>('text');
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Auto-switch to logs tab if document has error
  const isErrorStatus = document.status === 'error';
  const [activeTab, setActiveTab] = useState<'details' | 'logs' | 'preview' | 'history'>(
    isErrorStatus ? 'logs' : 'details'
  );

  useEffect(() => {
    loadDocumentStats();
    loadDocumentLogs();
  }, [document.id]);

  // Load preview when tab changes to preview
  useEffect(() => {
    if (activeTab === 'preview') {
      if (viewMode === 'text') {
        loadDocumentPreview(previewPage);
      } else if (viewMode === 'chunks') {
        loadDocumentChunks(chunksPage);
      } else if (viewMode === 'original') {
        loadOriginalFile();
      }
    }
  }, [activeTab, viewMode]);

  const loadOriginalFile = async () => {
    try {
      setPreviewLoading(true);
      const token = localStorage.getItem('ragleaf_token');
      // Get the file URL from the backend
      const url = `${getApiBaseUrl()}/admin/documents/${document.id}/file`;
      setOriginalFileUrl(url);
    } catch (error) {
      console.error('Error loading original file:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const getFileViewerContent = () => {
    const fileType = document.file_type?.toLowerCase();
    const token = localStorage.getItem('ragleaf_token');
    const fileUrl = `${getApiBaseUrl()}/admin/documents/${document.id}/file?token=${token}`;

    if (fileType === 'pdf') {
      return (
        <div className="w-full h-[600px] bg-dark-600 rounded-lg overflow-hidden">
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title="PDF Viewer"
          />
        </div>
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileType || '')) {
      return (
        <div className="flex items-center justify-center bg-dark-600 rounded-lg p-4">
          <img
            src={fileUrl}
            alt={document.name}
            className="max-w-full max-h-[600px] object-contain rounded shadow-lg"
          />
        </div>
      );
    } else if (['txt', 'md', 'json', 'xml', 'csv', 'html', 'css', 'js', 'py'].includes(fileType || '')) {
      return (
        <div className="bg-dark-700/50 rounded-lg p-4">
          <iframe
            src={fileUrl}
            className="w-full h-[500px] border border-white/[0.06] rounded bg-dark-800/60 font-mono text-sm"
            title="Text Viewer"
          />
        </div>
      );
    } else {
      // For unsupported file types, show download option
      return (
        <div className="text-center py-12 bg-dark-700/50 rounded-lg">
          <File className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">
            Bu dosya türü ({fileType?.toUpperCase()}) tarayıcıda önizlenemez.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Dosyayı indirerek görüntüleyebilirsiniz.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href={fileUrl}
              download={document.original_filename}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Dosyayı İndir
            </a>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-dark-400 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Yeni Sekmede Aç
            </a>
          </div>
        </div>
      );
    }
  };

  const loadDocumentPreview = async (page: number) => {
    try {
      setPreviewLoading(true);
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(
        `${getApiBaseUrl()}/admin/documents/${document.id}/preview?page=${page}&page_size=5000`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreview(data);
        setPreviewPage(page);
      }
    } catch (error) {
      console.error('Error loading document preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadDocumentChunks = async (skip: number) => {
    try {
      setPreviewLoading(true);
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(
        `${getApiBaseUrl()}/admin/documents/${document.id}/chunks?skip=${skip}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setChunks(data.chunks);
        setChunksTotal(data.pagination.total);
        setChunksPage(skip);
      }
    } catch (error) {
      console.error('Error loading document chunks:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadDocumentLogs = async () => {
    try {
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/logs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error loading document logs:', error);
    }
  };

  const loadDocumentStats = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        // Fallback to calculated stats if API not available
        const calculatedStats: DocumentStats = {
          total_chunks: document.total_chunks || 0,
          total_pages: document.total_pages || Math.ceil((document.file_size / 1024) / 50), // Estimate: ~50KB per page
          avg_chunk_size: document.total_chunks ? Math.round(document.file_size / document.total_chunks) : 0,
          total_characters: document.total_chunks ? document.total_chunks * 500 : 0, // Estimate: ~500 chars per chunk
          total_words: document.total_chunks ? document.total_chunks * 75 : 0, // Estimate: ~75 words per chunk
          ocr_images_count: document.ocr_completed ? Math.ceil(document.file_size / (1024 * 1024)) : 0, // Estimate: 1 image per MB
          processing_time_seconds: 0, // Will be calculated from timestamps
          index_file_size: document.vector_indexed ? Math.round(document.file_size * 0.1) : 0 // Estimate: 10% of original
        };

        // Calculate processing time if we have timestamps
        if (document.created_at && document.processed_at) {
          const startTime = new Date(document.created_at).getTime();
          const endTime = new Date(document.processed_at).getTime();
          calculatedStats.processing_time_seconds = Math.round((endTime - startTime) / 1000);
        }

        setStats(calculatedStats);
      }
    } catch (error) {
      console.error('Error loading document stats:', error);
      // Use basic fallback stats
      setStats({
        total_chunks: document.total_chunks || 0,
        total_pages: document.total_pages || 0,
        avg_chunk_size: document.total_chunks ? Math.round(document.file_size / document.total_chunks) : 0,
        total_characters: 0,
        total_words: 0,
        ocr_images_count: 0,
        processing_time_seconds: 0,
        index_file_size: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('tr-TR').format(num);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 !mt-0 !mb-0" style={{ marginTop: '0 !important', marginBottom: '0 !important', top: '0', left: '0', right: '0', bottom: '0' }}>
      <div className="h-screen w-full bg-dark-800/60 flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                Döküman Detayları
              </h3>
              <p className="text-sm text-gray-500">{document.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Tab Buttons */}
            <div className="flex bg-dark-600 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'details'
                    ? 'bg-dark-800/60 text-blue-600 '
                    : 'text-gray-600 hover:text-gray-100'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-1" />
                Detaylar
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'logs'
                    ? 'bg-dark-800/60 text-blue-600 '
                    : 'text-gray-600 hover:text-gray-100'
                }`}
              >
                <ScrollText className="h-4 w-4 inline mr-1" />
                İşleme Logları
                {logs && logs.total_logs > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {logs.total_logs}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-dark-800/60 text-blue-600 '
                    : 'text-gray-600 hover:text-gray-100'
                }`}
              >
                <Eye className="h-4 w-4 inline mr-1" />
                Önizleme
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'history'
                    ? 'bg-dark-800/60 text-blue-600 '
                    : 'text-gray-600 hover:text-gray-100'
                }`}
              >
                <History className="h-4 w-4 inline mr-1" />
                Düzenleme Geçmişi
              </button>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-8 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : activeTab === 'preview' ? (
            /* Preview Tab Content */
            <div className="space-y-4">
              {/* View Mode Toggle */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex bg-dark-600 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('original')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'original'
                        ? 'bg-dark-800/60 text-blue-600 '
                        : 'text-gray-600 hover:text-gray-100'
                    }`}
                  >
                    <File className="h-4 w-4 inline mr-1" />
                    Orijinal Dosya
                  </button>
                  <button
                    onClick={() => setViewMode('text')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'text'
                        ? 'bg-dark-800/60 text-blue-600 '
                        : 'text-gray-600 hover:text-gray-100'
                    }`}
                  >
                    <FileText className="h-4 w-4 inline mr-1" />
                    Tam Metin
                  </button>
                  <button
                    onClick={() => setViewMode('chunks')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'chunks'
                        ? 'bg-dark-800/60 text-blue-600 '
                        : 'text-gray-600 hover:text-gray-100'
                    }`}
                  >
                    <Layers className="h-4 w-4 inline mr-1" />
                    Chunk'lar
                  </button>
                </div>
                
                {/* Pagination Info */}
                {viewMode === 'text' && preview && (
                  <div className="text-sm text-gray-500">
                    Sayfa {preview.pagination.current_page} / {preview.pagination.total_pages}
                    <span className="ml-2 text-gray-400">
                      ({formatNumber(preview.pagination.total_characters)} karakter)
                    </span>
                  </div>
                )}
                {viewMode === 'chunks' && (
                  <div className="text-sm text-gray-500">
                    Chunk {chunksPage + 1}-{Math.min(chunksPage + 10, chunksTotal)} / {chunksTotal}
                  </div>
                )}
                {viewMode === 'original' && (
                  <div className="text-sm text-gray-500">
                    {document.original_filename} ({(document.file_size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Content Area */}
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : viewMode === 'original' ? (
                /* Original File View */
                <div className="space-y-4">
                  {getFileViewerContent()}
                </div>
              ) : viewMode === 'text' ? (
                /* Text View */
                <div className="space-y-4">
                  {preview?.has_content ? (
                    <>
                      <div className="bg-dark-700/50 rounded-lg p-4 text-sm text-gray-500 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Kaynak: {preview.content_source === 'extracted_text' ? 'Çıkarılmış Metin' : 
                                 preview.content_source === 'chunks' ? 'Chunk Birleşimi' : 
                                 preview.content_source === 'original_file' ? 'Orijinal Dosya' : 'Bilinmiyor'}
                      </div>
                      <div className="bg-dark-800/60 border border-white/[0.06] rounded-lg p-6 max-h-[500px] overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono leading-relaxed">
                          {preview.content}
                        </pre>
                      </div>
                      {/* Pagination Controls */}
                      {preview.pagination.total_pages > 1 && (
                        <div className="flex items-center justify-center gap-4">
                          <button
                            onClick={() => loadDocumentPreview(previewPage - 1)}
                            disabled={previewPage <= 1}
                            className="btn btn-sm btn-secondary disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Önceki
                          </button>
                          <span className="text-sm text-gray-600">
                            Sayfa {previewPage} / {preview.pagination.total_pages}
                          </span>
                          <button
                            onClick={() => loadDocumentPreview(previewPage + 1)}
                            disabled={previewPage >= preview.pagination.total_pages}
                            className="btn btn-sm btn-secondary disabled:opacity-50"
                          >
                            Sonraki
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Bu döküman için önizleme mevcut değil.</p>
                      <p className="text-sm mt-2">Döküman henüz işlenmemiş olabilir.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Chunks View */
                <div className="space-y-4">
                  {chunks.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {chunks.map((chunk, idx) => (
                          <div key={chunk.index} className="bg-dark-800/60 border border-white/[0.06] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                Chunk #{chunk.index + 1}
                              </span>
                              <span className="text-xs text-gray-400">
                                {chunk.char_count} karakter
                              </span>
                            </div>
                            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono leading-relaxed max-h-40 overflow-y-auto">
                              {chunk.content}
                            </pre>
                          </div>
                        ))}
                      </div>
                      {/* Chunks Pagination */}
                      {chunksTotal > 10 && (
                        <div className="flex items-center justify-center gap-4">
                          <button
                            onClick={() => loadDocumentChunks(Math.max(0, chunksPage - 10))}
                            disabled={chunksPage <= 0}
                            className="btn btn-sm btn-secondary disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Önceki 10
                          </button>
                          <span className="text-sm text-gray-600">
                            {chunksPage + 1}-{Math.min(chunksPage + 10, chunksTotal)} / {chunksTotal}
                          </span>
                          <button
                            onClick={() => loadDocumentChunks(chunksPage + 10)}
                            disabled={chunksPage + 10 >= chunksTotal}
                            className="btn btn-sm btn-secondary disabled:opacity-50"
                          >
                            Sonraki 10
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Bu döküman için chunk verisi mevcut değil.</p>
                      <p className="text-sm mt-2">Döküman henüz işlenmemiş olabilir.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'logs' ? (
            /* Logs Tab Content */
            <div className="space-y-4">
              {/* Error Message if failed/error */}
              {isErrorStatus && (logs?.error_message || document.processing_details) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800">Hata Mesajı</h4>
                      <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap break-words">
                        {logs?.error_message || document.processing_details}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Progress */}
              {logs && (
                <div className="bg-dark-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">İşleme Durumu</span>
                    <span className="text-sm text-gray-500">{logs.processing_stage || 'Bilinmiyor'}</span>
                  </div>
                  <div className="w-full bg-dark-500 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        isErrorStatus ? 'bg-red-500' :
                        document.status === 'processed' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${logs.processing_progress}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-1">{logs.processing_progress}%</div>
                </div>
              )}

              {/* Logs List */}
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">İşleme Logları</h4>
                  <button
                    onClick={loadDocumentLogs}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Logları yenile"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                {logs && logs.logs.length > 0 ? (
                  <div className="space-y-1 font-mono text-xs">
                    {logs.logs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex items-start py-1 border-b border-gray-800 ${
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warning' ? 'text-yellow-400' :
                          log.level === 'success' ? 'text-green-400' :
                          'text-gray-300'
                        }`}
                      >
                        <span className="text-gray-500 mr-2 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('tr-TR') : '--:--:--'}
                        </span>
                        <span className={`mr-2 px-1 rounded text-xs ${
                          log.level === 'error' ? 'bg-red-900 text-red-300' :
                          log.level === 'warning' ? 'bg-yellow-900 text-yellow-300' :
                          log.level === 'success' ? 'bg-green-900 text-green-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {log.level?.toUpperCase() || 'INFO'}
                        </span>
                        <span className="flex-1">{log.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Henüz log kaydı yok</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'history' ? (
            /* History Tab Content */
            <div className="space-y-4">
              <EditHistoryPanel 
                documentId={document.id} 
                onRevert={() => {
                  loadDocumentStats();
                  loadDocumentLogs();
                }}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error Alert for Failed Documents */}
              {isErrorStatus && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-6 w-6 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-800 text-lg">İşleme Başarısız</h4>
                      <p className="text-sm text-red-700 mt-1">
                        {logs?.error_message || document.processing_details || 'Döküman işlenirken bir hata oluştu.'}
                      </p>
                      <button
                        onClick={() => setActiveTab('logs')}
                        className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium flex items-center"
                      >
                        <ScrollText className="h-4 w-4 mr-1" />
                        Detaylı logları görüntüle →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Status for Processing Documents - Real-time SSE */}
              {document.status === 'processing' && (
                <DocumentProgressBar
                  documentId={document.id}
                  onComplete={() => {
                    // Reload stats when processing completes
                    loadDocumentStats();
                    loadDocumentLogs();
                  }}
                  onError={(error) => {
                    console.error('Processing error:', error);
                    loadDocumentLogs();
                  }}
                  showLogs={true}
                  compact={false}
                />
              )}

              {/* Basic Info Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Document Info */}
                <div className="bg-dark-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-100 mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Döküman Bilgileri
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Dosya Adı:</span>
                      <span className="font-medium text-right">{document.original_filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Dosya Boyutu:</span>
                      <span className="font-medium">{formatFileSize(document.file_size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Dosya Türü:</span>
                      <span className="font-medium uppercase">{document.file_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Toplam Sayfa:</span>
                      <span className="font-medium">{stats?.total_pages || 'Hesaplanıyor...'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Yüklenme Tarihi:</span>
                      <span className="font-medium">
                        {new Date(document.created_at).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">İşlenme Tarihi:</span>
                      <span className="font-medium">
                        {document.processed_at 
                           ? new Date(document.processed_at).toLocaleString('tr-TR')
                           : 'Henüz işlenmedi'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Processing Info */}
                <div className="bg-dark-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-100 mb-3 flex items-center">
                    <Database className="h-4 w-4 mr-2" />
                    İşleme Detayları
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Toplam Chunk:</span>
                      <span className="font-medium">{stats?.total_chunks || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ortalama Chunk Boyutu:</span>
                      <span className="font-medium">{formatFileSize(stats?.avg_chunk_size || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Toplam Karakter:</span>
                      <span className="font-medium">{formatNumber(stats?.total_characters || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Toplam Kelime:</span>
                      <span className="font-medium">{formatNumber(stats?.total_words || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">OCR İşlenen Görsel:</span>
                      <span className="font-medium">{stats?.ocr_images_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">İşleme Süresi:</span>
                      <span className="font-medium">{formatDuration(stats?.processing_time_seconds || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-dark-800/60 border border-white/[0.06] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-400">OCR Durumu</p>
                      <p className={`text-lg font-semibold ${document.ocr_completed ? 'text-green-400' : 'text-red-400'}`}>
                        {document.ocr_completed ? 'Tamamlandı' : 'Bekliyor'}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      document.ocr_completed ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      {document.ocr_completed ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800/60 border border-white/[0.06] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-400">Vector İndeks</p>
                      <p className={`text-lg font-semibold ${document.vector_indexed ? 'text-green-400' : 'text-red-400'}`}>
                        {document.vector_indexed ? 'İndekslendi' : 'Bekliyor'}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      document.vector_indexed ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      {document.vector_indexed ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800/60 border border-white/[0.06] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-400">Genel Durum</p>
                      <p className={`text-lg font-semibold ${
                        document.status === 'processed' ? 'text-green-400' :
                        document.status === 'processing' ? 'text-yellow-400' :
                        isErrorStatus ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {document.status === 'processed' ? 'İşlendi' :
                         document.status === 'processing' ? 'İşleniyor' :
                         isErrorStatus ? 'Başarısız' : 'Bekliyor'}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      document.status === 'processed' ? 'bg-green-500/10' :
                      document.status === 'processing' ? 'bg-yellow-500/10' :
                      isErrorStatus ? 'bg-red-500/10' : 'bg-dark-600'
                    }`}>
                      {document.status === 'processed' && <CheckCircle className="h-5 w-5 text-green-400" />}
                      {document.status === 'processing' && <Clock className="h-5 w-5 text-yellow-400" />}
                      {isErrorStatus && <AlertCircle className="h-5 w-5 text-red-400" />}
                      {!['processed', 'processing', 'error'].includes(document.status) && <Eye className="h-5 w-5 text-gray-400" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-white/[0.06] rounded-lg p-6">
                <h4 className="font-medium text-gray-100 mb-4 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Embedding İstatistikleri
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">{stats?.total_chunks || 0}</div>
                    <div className="text-sm text-gray-400 mt-1">Toplam Chunk</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">
                      {stats?.avg_chunk_size ? formatFileSize(stats.avg_chunk_size).split(' ')[0] : '0'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Ort. Chunk Boyutu</div>
                    <div className="text-xs text-gray-500">{stats?.avg_chunk_size ? formatFileSize(stats.avg_chunk_size).split(' ')[1] : 'B'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-400">
                      {document.vector_indexed ? '100%' : '0%'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">İndeksleme Oranı</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-400">
                      {stats?.total_pages || 0}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Sayfa Sayısı</div>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {document.processing_details && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-400 mb-2">İşleme Detayları</h4>
                  <p className="text-sm text-gray-300">{document.processing_details}</p>
                </div>
              )}

              {/* Document Summary Section */}
              {document.status === 'processed' && (
                <DocumentSummarySection 
                  documentId={document.id} 
                  documentName={document.name} 
                />
              )}
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-white/[0.06] bg-dark-700/50 mt-auto">
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-md hover:bg-dark-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Upload,
  FileText,
  Eye,
  Trash2,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  List,
  Edit2,
  Database,
  Zap,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/services/api';
import type { Document, DocumentListResponse } from '@/types';
import DocumentProgressModal from '@/components/DocumentProgressModal';
import DocumentDetailsModal from '@/components/DocumentDetailsModal';
import DocumentEditModal from '@/components/DocumentEditModal';
import UploadModal from '@/components/UploadModal';
import ReprocessModal, { ReprocessOptions } from '@/components/ReprocessModal';
import ResetModal from '@/components/ResetModal';
import ProgressModal from '@/components/ProgressModal';

export default function DocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtering & Sorting State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const [sortBy, setSortBy] = useState<'created_at' | 'name'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedDocumentForProgress, setSelectedDocumentForProgress] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [showDocumentDetails, setShowDocumentDetails] = useState(false);
  const [selectedDocumentForDetails, setSelectedDocumentForDetails] = useState<Document | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDocumentForEdit, setSelectedDocumentForEdit] = useState<Document | null>(null);
  
  // Reprocess modal state
  const [showReprocessModal, setShowReprocessModal] = useState(false);
  const [selectedDocumentForReprocess, setSelectedDocumentForReprocess] = useState<{ id: number; name: string } | null>(null);

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedDocumentForReset, setSelectedDocumentForReset] = useState<{ id: number; name: string } | null>(null);
  
  // Progress modal state (for reset/reprocess operations)
  const [showOperationProgress, setShowOperationProgress] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [operationDocumentName, setOperationDocumentName] = useState<string>('');

  // Bulk actions state
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProcessingStatus, setBulkProcessingStatus] = useState<string>('');
  const [bulkProcessingPaused, setBulkProcessingPaused] = useState(false);
  const [currentProcessingDocId, setCurrentProcessingDocId] = useState<number | null>(null);
  const [isBulkResetting, setIsBulkResetting] = useState(false);
  const [bulkResetStatus, setBulkResetStatus] = useState<string>('');

  // Use ref for cancellation flag
  const bulkProcessingCancelledRef = useRef(false);

  const queryClient = useQueryClient();

  // Fetch documents with filters and sorting
  const { data: documentsData, isLoading } = useQuery<DocumentListResponse>(
    ['documents', searchTerm, statusFilter, sortBy, sortOrder, categoryFilter, departmentFilter],
    () => adminApi.getDocuments({
      skip: 0,
      limit: 1000,
      status: statusFilter || undefined,
      // @ts-ignore - API types need update but backend supports it
      sort_by: sortBy,
      order: sortOrder,
      category: categoryFilter || undefined,
      department: departmentFilter || undefined
    }),
    {
      refetchInterval: 2000, // Refresh every 2 seconds
    }
  );

  const hasActiveProcessing = documentsData?.documents.some(d => d.status === 'processing') || false;

  // Process mutation
  const processMutation = useMutation(
    (documentId: number) => adminApi.processDocument(documentId),
    {
      onSuccess: () => {
        toast.success('Döküman işleme başlatıldı!');
        queryClient.invalidateQueries('documents');
      },
    }
  );

  // Reprocess mutation with options
  const reprocessMutation = useMutation(
    ({ documentId, options }: { documentId: number; options?: ReprocessOptions }) => 
      adminApi.reprocessDocument(documentId, options),
    {
      onSuccess: () => {
        toast.success('Yeniden işleme kuyruğa alındı');
        queryClient.invalidateQueries('documents');
      },
    }
  );

  // Delete mutation
  const deleteMutation = useMutation(
    (documentId: number) => adminApi.deleteDocument(documentId),
    {
      onSuccess: () => {
        toast.success('Döküman başarıyla silindi!');
        queryClient.invalidateQueries('documents');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Silme sırasında hata oluştu');
      },
    }
  );

  // Reset mutation
  const resetMutation = useMutation(
    (documentId: number) => adminApi.resetDocument(documentId),
    {
      onSuccess: () => {
        toast.success('Döküman sıfırlandı!');
        queryClient.invalidateQueries('documents');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Sıfırlama sırasında hata oluştu');
      },
    }
  );

  // Index mutation (new pipeline)
  const indexMutation = useMutation(
    (documentId: number) => adminApi.indexDocument(documentId),
    {
      onSuccess: (data) => {
        toast.success(`İndeksleme tamamlandı! ${data.details?.chunks_indexed || 0} chunk indekslendi.`);
        queryClient.invalidateQueries('documents');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'İndeksleme sırasında hata oluştu');
      },
    }
  );

  // Reindex mutation (new pipeline)
  const reindexMutation = useMutation(
    (documentId: number) => adminApi.reindexDocument(documentId),
    {
      onSuccess: (data) => {
        toast.success(`Yeniden indeksleme tamamlandı! ${data.details?.chunks_indexed || 0} chunk indekslendi.`);
        queryClient.invalidateQueries('documents');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Yeniden indeksleme sırasında hata oluştu');
      },
    }
  );

  // Event Handlers
  const handleProcess = (documentId: number, documentName: string) => {
    setSelectedDocumentForProgress({ id: documentId, name: documentName });
    setShowProgressModal(true);
    processMutation.mutate(documentId, {
      onError: (error: any) => {
        setShowProgressModal(false);
        setSelectedDocumentForProgress(null);
        toast.error(error.response?.data?.detail || 'Hata oluştu');
      }
    });
  };

  // Index document (generate embeddings from enriched content)
  const handleIndex = (documentId: number, documentName: string) => {
    if (window.confirm(`"${documentName}" dökümanını indekslemek istiyor musunuz? Bu işlem embedding'leri oluşturacak.`)) {
      toast.loading('İndeksleniyor...', { id: `index-${documentId}` });
      indexMutation.mutate(documentId, {
        onSettled: () => {
          toast.dismiss(`index-${documentId}`);
        }
      });
    }
  };

  // Reindex document (clear and regenerate embeddings)
  const handleReindex = (documentId: number, documentName: string) => {
    if (window.confirm(`"${documentName}" dökümanını yeniden indekslemek istiyor musunuz? Mevcut embedding'ler silinip yeniden oluşturulacak.`)) {
      toast.loading('Yeniden indeksleniyor...', { id: `reindex-${documentId}` });
      reindexMutation.mutate(documentId, {
        onSettled: () => {
          toast.dismiss(`reindex-${documentId}`);
        }
      });
    }
  };

  const handleViewProgress = (documentId: number, documentName: string) => {
    setSelectedDocumentForProgress({ id: documentId, name: documentName });
    setShowProgressModal(true);
  };

  const handleReprocess = (documentId: number, documentName: string) => {
    setSelectedDocumentForReprocess({ id: documentId, name: documentName });
    setShowReprocessModal(true);
  };

  const handleReprocessConfirm = (options: ReprocessOptions) => {
    if (!selectedDocumentForReprocess) return;
    
    setShowReprocessModal(false);
    setSelectedDocumentForProgress(selectedDocumentForReprocess);
    setShowProgressModal(true);
    
    reprocessMutation.mutate(
      { documentId: selectedDocumentForReprocess.id, options },
      {
        onError: (error: any) => {
          setShowProgressModal(false);
          setSelectedDocumentForProgress(null);
          toast.error(error.response?.data?.detail || 'Hata oluştu');
        }
      }
    );
    
    setSelectedDocumentForReprocess(null);
  };

  const handleDelete = (documentId: number, documentName: string) => {
    if (window.confirm(`"${documentName}" adlı dökümanı silmek istediğinizden emin misiniz?`)) {
      deleteMutation.mutate(documentId);
    }
  };

  const handleReset = (documentId: number, documentName: string) => {
    setSelectedDocumentForReset({ id: documentId, name: documentName });
    setShowResetModal(true);
  };

  const handleResetConfirm = async (request: any) => {
    if (!selectedDocumentForReset) return;
    
    try {
      const response = await adminApi.resetAndReprocess(selectedDocumentForReset.id, request);
      
      toast.success('Sıfırlama ve yeniden işleme başlatıldı!');
      
      // Show progress modal
      setOperationId(response.operation_id);
      setOperationDocumentName(selectedDocumentForReset.name);
      setShowResetModal(false);
      setShowOperationProgress(true);
      setSelectedDocumentForReset(null);
      
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Hata oluştu');
    }
  };

  // Bulk Handlers (Simplified for brevity, reusing existing logic)
  const handleBulkProcess = async () => { /* Reuse existing logic */
    // Logic is same as before, ensuring we use state
    if (!documentsData) return;
    const uploadedDocs = documentsData.documents.filter(d => d.status === 'uploaded');
    if (uploadedDocs.length === 0) { toast.error('İşlenecek döküman yok'); return; }
    if (!confirm(`${uploadedDocs.length} döküman işlenecek?`)) return;

    setIsBulkProcessing(true);
    setBulkProcessingPaused(false);
    bulkProcessingCancelledRef.current = false;

    let processed = 0;
    for (const doc of uploadedDocs) {
      if (bulkProcessingCancelledRef.current) break;
      while (bulkProcessingPaused && !bulkProcessingCancelledRef.current) { await new Promise(r => setTimeout(r, 500)); }

      try {
        setCurrentProcessingDocId(doc.id);
        setBulkProcessingStatus(`İşleniyor: ${doc.name}`);
        await adminApi.processDocument(doc.id);
        queryClient.invalidateQueries('documents');
        // Optimistic wait
        await new Promise(r => setTimeout(r, 2000));
        processed++;
      } catch (e) { console.error(e); }
    }
    setIsBulkProcessing(false);
    setBulkProcessingStatus('');
    setCurrentProcessingDocId(null);
    toast.success('Toplu işlem tamamlandı');
  };

  const handleBulkReprocess = async () => {
    if (!documentsData) return;
    const items = documentsData.documents.filter(d => d.status === 'processed');
    if (items.length === 0) { toast.error('İşlenecek yok'); return; }
    if (!confirm('Tümü yeniden işlensin mi?')) return;

    setIsBulkProcessing(true);
    for (const doc of items) {
      if (bulkProcessingCancelledRef.current) break;
      try {
        setCurrentProcessingDocId(doc.id);
        setBulkProcessingStatus(`Yeniden işleniyor: ${doc.name}`);
        await adminApi.reprocessDocument(doc.id);
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) { }
    }
    setIsBulkProcessing(false);
    setBulkProcessingStatus('');
    toast.success('Tamamlandı');
  }

  const handleBulkReset = async () => {
    // Simplification of previous logic
    if (!documentsData) return;
    const items = documentsData.documents.filter(d => ['processed', 'error', 'processing'].includes(d.status));
    if (items.length === 0) return;
    if (!confirm('Sıfırlansın mı?')) return;

    setIsBulkResetting(true);
    for (const doc of items) {
      try {
        setBulkResetStatus(`Sıfırlanıyor: ${doc.name}`);
        await adminApi.resetDocument(doc.id);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) { }
    }
    setIsBulkResetting(false);
    setBulkResetStatus('');
    queryClient.invalidateQueries('documents');
    toast.success('Sıfırlama tamamlandı');
  }

  // Helper for Status Icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'indexed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'enriched': return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'processed': return <CheckCircle className="h-5 w-5 text-yellow-500" />;
      case 'processing': return <Clock className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'indexing': return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'indexed': return 'İndekslenmiş';
      case 'enriched': return 'Zenginleştirilmiş';
      case 'processed': return 'İşlenmiş';
      case 'processing': return 'İşleniyor';
      case 'indexing': return 'İndeksleniyor';
      case 'error': return 'Hatalı';
      case 'uploaded': return 'Yüklenmiş';
      default: return status;
    }
  };

  // Helper for Status Badge Color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'indexed': return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'enriched': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'processed': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'processing': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'indexing': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'error': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'uploaded': return 'bg-dark-600 text-gray-300 border border-white/[0.06]';
      default: return 'bg-dark-600 text-gray-300 border border-white/[0.06]';
    }
  };

  return (
    <div className="space-y-6">
      <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />

      {showProgressModal && selectedDocumentForProgress && (
        <DocumentProgressModal
          isOpen={showProgressModal}
          onClose={() => setShowProgressModal(false)}
          documentId={selectedDocumentForProgress.id}
          documentName={selectedDocumentForProgress.name}
        />
      )}

      {showDocumentDetails && selectedDocumentForDetails && (
        <DocumentDetailsModal
          onClose={() => setShowDocumentDetails(false)}
          document={selectedDocumentForDetails}
        />
      )}

      {showEditModal && selectedDocumentForEdit && (
        <DocumentEditModal
          document={selectedDocumentForEdit}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDocumentForEdit(null);
          }}
        />
      )}

      {/* Reprocess Modal */}
      {showReprocessModal && selectedDocumentForReprocess && (
        <ReprocessModal
          documentId={selectedDocumentForReprocess.id}
          documentName={selectedDocumentForReprocess.name}
          onClose={() => {
            setShowReprocessModal(false);
            setSelectedDocumentForReprocess(null);
          }}
          onConfirm={handleReprocessConfirm}
          isLoading={reprocessMutation.isLoading}
        />
      )}

      {/* Reset Modal */}
      {showResetModal && selectedDocumentForReset && (
        <ResetModal
          documentId={selectedDocumentForReset.id}
          documentName={selectedDocumentForReset.name}
          onClose={() => {
            setShowResetModal(false);
            setSelectedDocumentForReset(null);
          }}
          onConfirm={handleResetConfirm}
        />
      )}

      {/* Operation Progress Modal (SSE) */}
      {showOperationProgress && operationId && (
        <ProgressModal
          operationId={operationId}
          documentName={operationDocumentName}
          onClose={() => {
            setShowOperationProgress(false);
            setOperationId(null);
            queryClient.invalidateQueries('documents');
          }}
          onComplete={() => {
            queryClient.invalidateQueries('documents');
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Döküman Yükle & Yönet</h1>
          <p className="text-gray-400">Dökümanlarınızı kolayca yükleyip metadata (kategori, etiket) ekleyebilirsiniz.</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn btn-primary btn-lg shadow-lg flex items-center justify-center gap-2"
        >
          <Upload className="h-5 w-5" />
          Yeni Döküman Yükle
        </button>
      </div>

      {/* Filters & Controls */}
      <div className="bg-dark-800/60 rounded-lg  border border-white/[0.06] p-4">
        <div className="flex flex-col gap-4">

          {/* Top Row: Search & Status */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Döküman ara (İsim)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <div className="md:w-48 relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input pl-10 w-full appearance-none"
              >
                <option value="">Tüm Durumlar</option>
                <option value="uploaded">Yüklenmiş</option>
                <option value="processing">İşleniyor</option>
                <option value="processed">İşlenmiş</option>
                <option value="enriched">Zenginleştirilmiş</option>
                <option value="indexing">İndeksleniyor</option>
                <option value="indexed">İndekslenmiş</option>
                <option value="error">Hatalı</option>
              </select>
            </div>
          </div>

          {/* Bottom Row: Metadata Filter & Sorting */}
          <div className="flex flex-col md:flex-row gap-4 pt-3 border-t border-white/[0.06]">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Kategori Filtrele"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input w-full md:w-1/3 text-sm"
              />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="input w-full md:w-1/3 text-sm"
              >
                <option value="">Tüm Departmanlar</option>
                <option value="Teknik Servis">Teknik Servis</option>
                <option value="Proje">Proje</option>
                <option value="Uygulama">Uygulama</option>
                <option value="Arge">Arge</option>
                <option value="Satış">Satış</option>
                <option value="Muhasebe">Muhasebe</option>
                <option value="Müşteri Hizmetleri">Müşteri Hizmetleri</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-dark-700/50 rounded-lg p-1 border border-white/[0.06]">
                <span className="text-xs font-medium text-gray-400 px-2">Sırala:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer"
                >
                  <option value="created_at">Tarih</option>
                  <option value="name">İsim</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1 hover:bg-dark-800/60 rounded  transition-all"
                  title={sortOrder === 'asc' ? 'Artan' : 'Azalan'}
                >
                  <ArrowUpDown className={`h-4 w-4 text-gray-400 transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bulk Actions Bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button onClick={handleBulkProcess} className="btn btn-sm btn-primary whitespace-nowrap" disabled={isBulkProcessing}>
          <Play className="h-3 w-3 mr-1" /> Tümünü İşle
        </button>
        <button onClick={handleBulkReprocess} className="btn btn-sm btn-secondary whitespace-nowrap" disabled={isBulkProcessing}>
          <RefreshCw className="h-3 w-3 mr-1" /> Tümünü Yeniden İşle
        </button>
        <button onClick={handleBulkReset} className="btn btn-sm btn-warning whitespace-nowrap" disabled={isBulkResetting}>
          <AlertCircle className="h-3 w-3 mr-1" /> Tümünü Sıfırla
        </button>
        {isBulkProcessing && (
          <button onClick={() => setBulkProcessingPaused(!bulkProcessingPaused)} className="btn btn-sm btn-warning">
            {bulkProcessingPaused ? 'Devam Et' : 'Duraklat'}
          </button>
        )}
        {(isBulkProcessing || isBulkResetting) && (
          <button onClick={() => bulkProcessingCancelledRef.current = true} className="btn btn-sm btn-danger">
            İptal
          </button>
        )}
      </div>

      {(isBulkProcessing || isBulkResetting) && (
        <div className="bg-blue-500/10 text-blue-400 p-3 rounded-md text-sm mb-4 border border-blue-500/20 flex items-center">
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          {bulkProcessingStatus || bulkResetStatus}
        </div>
      )}

      {/* Document List */}
      <div className="bg-dark-800/60 rounded-lg  border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/[0.04]">
            <thead className="bg-dark-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Döküman</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Dil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-dark-800/60 divide-y divide-white/[0.04]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    </div>
                  </td>
                </tr>
              ) : documentsData?.documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Döküman bulunamadı. Yeni bir döküman yükleyin.
                  </td>
                </tr>
              ) : (
                documentsData?.documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-dark-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-100">{doc.name}</div>
                          <div className="text-xs text-gray-400">{doc.original_filename}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* Document Language Display */}
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {doc.language === 'tr' ? '🇹🇷' :
                            doc.language === 'en' ? '🇬🇧' :
                              doc.language === 'de' ? '🇩🇪' :
                                doc.language === 'fr' ? '🇫🇷' :
                                  doc.language === 'es' ? '🇪🇸' : '🌐'}
                        </span>
                        <span className="text-sm text-gray-300">
                          {doc.language === 'tr' ? 'Türkçe' :
                            doc.language === 'en' ? 'İngilizce' :
                              doc.language === 'de' ? 'Almanca' :
                                doc.language === 'fr' ? 'Fransızca' :
                                  doc.language === 'es' ? 'İspanyolca' :
                                    doc.language?.toUpperCase() || 'TR'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(doc.status)}
                        <span className="ml-2 text-sm text-gray-300">{getStatusText(doc.status)}</span>
                      </div>
                      {/* Processor Status Mini Badges */}
                      <div className="flex mt-1 space-x-1">
                        <span className={`w-2 h-2 rounded-full ${doc.ocr_completed ? 'bg-green-500' : 'bg-dark-500'}`} title="OCR"></span>
                        <span className={`w-2 h-2 rounded-full ${doc.chunking_completed ? 'bg-green-500' : 'bg-dark-500'}`} title="Chunking"></span>
                        <span className={`w-2 h-2 rounded-full ${doc.embedding_completed ? 'bg-green-500' : 'bg-dark-500'}`} title="Embedding"></span>
                        <span className={`w-2 h-2 rounded-full ${doc.vector_indexed ? 'bg-green-500' : 'bg-dark-500'}`} title="Vector DB"></span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString('tr-TR')}
                      <div className="text-xs">{new Date(doc.created_at).toLocaleTimeString('tr-TR')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {/* Process button - for uploaded documents */}
                        {doc.status === 'uploaded' && (
                          <button onClick={() => handleProcess(doc.id, doc.name)} className="text-primary-400 hover:text-primary-300" title="İşle">
                            <Play className="h-5 w-5" />
                          </button>
                        )}
                        {/* Progress/Details button - for processing/processed/error */}
                        {(doc.status === 'processing' || doc.status === 'processed' || doc.status === 'error') && (
                          <button onClick={() => handleViewProgress(doc.id, doc.name)} className="text-blue-400 hover:text-blue-300 font-medium" title="İlerleme Durumu / Detay">
                            <Eye className="h-5 w-5" />
                          </button>
                        )}
                        {/* Index button - for processed/enriched documents */}
                        {(doc.status === 'processed' || doc.status === 'enriched') && (
                          <button 
                            onClick={() => handleIndex(doc.id, doc.name)} 
                            className="text-green-400 hover:text-green-300 font-medium" 
                            title="İndeksle (Embedding Oluştur)"
                            disabled={indexMutation.isLoading}
                          >
                            <Database className="h-5 w-5" />
                          </button>
                        )}
                        {/* Reindex button - for indexed documents */}
                        {doc.status === 'indexed' && (
                          <button 
                            onClick={() => handleReindex(doc.id, doc.name)} 
                            className="text-purple-400 hover:text-purple-300" 
                            title="Yeniden İndeksle"
                            disabled={reindexMutation.isLoading}
                          >
                            <Zap className="h-5 w-5" />
                          </button>
                        )}
                        {/* Reprocess button - for processed documents */}
                        {doc.status === 'processed' && (
                          <button onClick={() => handleReprocess(doc.id, doc.name)} className="text-orange-400 hover:text-orange-300" title="Yeniden İşle">
                            <RefreshCw className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedDocumentForEdit(doc);
                            setShowEditModal(true);
                          }}
                          className="text-primary-400 hover:text-primary-300"
                          title="Düzenle"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleReset(doc.id, doc.name)} 
                          className="text-red-400 hover:text-red-300 font-medium" 
                          title="Sıfırla ve Yeniden İşle"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDelete(doc.id, doc.name)} className="text-red-400 hover:text-red-300 font-medium" title="Sil">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
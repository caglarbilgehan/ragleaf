import { useState } from 'react';
import { useQuery } from 'react-query';
import { X, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { adminApi } from '@/services/api';
import toast from 'react-hot-toast';

interface DocumentProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  documentName: string;
  operation?: 'processing' | 'indexing';  // Operation type to show correct stages
}

interface SystemStats {
  memory?: {
    percent: number;
    used: number;
    total: number;
  };
  cpu?: {
    percent: number;
  };
}

interface LogEntry {
  timestamp: string;
  level: string;
  stage: string;
  progress: number;
  message: string;
}

interface ProgressData {
  document_id: number;
  status: string;
  processing_stage: string | null;
  processing_progress: number;
  processing_details: string | null;
  processing_logs: LogEntry[];
  is_processing: boolean;
  updated_at: string | null;
  system_stats?: SystemStats;
}

// Döküman İşleme adımları (Processing)
const PROCESSING_STEPS = [
  { key: 'initialization', label: 'Başlatma', icon: '🚀' },
  { key: 'pdf_analysis', label: 'PDF Analizi', icon: '📖' },
  { key: 'image_extraction', label: 'Görsel Çıkarma', icon: '🖼️' },
  { key: 'text_extraction', label: 'Metin Çıkarma', icon: '📄' },
  { key: 'ocr_processing', label: 'OCR İşlemi', icon: '🔍' },
  { key: 'image_ocr', label: 'Görsel OCR', icon: '🔍' },
  { key: 'text_processing', label: 'Metin İşleme', icon: '⚙️' },
  { key: 'completed', label: 'Tamamlandı', icon: '✅' },
];

// İndeksleme adımları (Indexing)
const INDEXING_STEPS = [
  { key: 'initialization', label: 'Başlatma', icon: '🚀' },
  { key: 'chunking', label: 'Metin Parçalama', icon: '✂️' },
  { key: 'translation', label: 'Çeviri', icon: '🌐' },
  { key: 'embedding', label: 'Embedding Oluşturma', icon: '🧠' },
  { key: 'indexing', label: 'Vector DB Kayıt', icon: '💾' },
  { key: 'completed', label: 'Tamamlandı', icon: '✅' },
];

export default function DocumentProgressModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  operation = 'processing',  // Default to processing
}: DocumentProgressModalProps) {
  // Select appropriate steps based on operation type
  const CURRENT_STEPS = operation === 'indexing' ? INDEXING_STEPS : PROCESSING_STEPS;
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [hasShownCompletionToast, setHasShownCompletionToast] = useState(false);

  // Fetch progress data with polling
  const { data: progressData, isLoading, error } = useQuery<ProgressData>(
    ['document-progress', documentId],
    () => adminApi.getDocumentProgress(documentId),
    {
      enabled: isOpen && documentId > 0,
      refetchInterval: 1000, // Poll every second
      refetchIntervalInBackground: true,
      retry: 3,
      retryDelay: 1000,
      onSuccess: (data) => {
        // Show completion notification only once
        if (!hasShownCompletionToast && (data.status === 'processed' || data.status === 'failed')) {
          setHasShownCompletionToast(true);
          if (data.status === 'processed') {
            toast.success('Döküman başarıyla işlendi!');
          } else {
            toast.error('Döküman işleme başarısız oldu!');
          }
        }
      },
      onError: (err) => {
        console.error('Progress fetch error:', err);
      }
    }
  );

  // Get logs from backend data
  const logs = progressData?.processing_logs || [];

  const handlePause = async () => {
    if (!progressData?.is_processing && progressData?.status !== 'processing') return;

    setIsPausing(true);
    try {
      await adminApi.pauseDocumentProcessing(documentId);
      toast.success('İşlem duraklatıldı');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Duraklatma başarısız');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await adminApi.resumeDocumentProcessing(documentId);
      toast.success('İşlem devam ettiriliyor');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Devam ettirme başarısız');
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancel = async () => {
    if (!progressData?.is_processing && progressData?.status !== 'processing') return;

    setIsCancelling(true);
    try {
      await adminApi.cancelDocumentProcessing(documentId);
      toast.success('İşleme iptal edildi');
      await new Promise(resolve => setTimeout(resolve, 1000));
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'İptal işlemi başarısız');
      setIsCancelling(false);
    }
  };

  const getStageText = (stage: string | null) => {
    switch (stage) {
      case 'initialization': return 'Başlatılıyor';
      case 'reprocessing': return 'Yeniden İşleme Başlatılıyor';
      case 'pdf_analysis': return 'PDF Analizi';
      case 'page_processing': return 'Sayfa İşleme';
      case 'image_extraction': return 'Görsel Çıkarma';
      case 'text_extraction': return 'Metin Çıkarma';
      case 'ocr_processing': return 'OCR İşlemi';
      case 'image_ocr': return 'Görsel OCR';
      case 'text_processing': return 'Metin İşleme';
      case 'embedding_generation': return 'Embedding Oluşturma';
      case 'content_analysis': return 'İçerik Analizi';
      case 'chunking': return 'Metin Parçalama';
      case 'embedding': return 'Embedding Oluşturma';
      case 'indexing': return 'İndeksleme';
      case 'completed': return 'Tamamlandı';
      case 'error': return 'Hata';
      default: return stage || 'Bilinmiyor';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed': return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'processing': return <Clock className="h-6 w-6 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="h-6 w-6 text-red-500" />;
      default: return <AlertCircle className="h-6 w-6 text-gray-500" />;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-red-500';
    if (progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Format log timestamp
  const formatLogTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('tr-TR');
    } catch {
      return timestamp;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 !mt-0 !mb-0" style={{ marginTop: '0 !important', marginBottom: '0 !important', top: '0', left: '0', right: '0', bottom: '0' }}>
      <div className="h-screen w-full bg-dark-800/60 flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            {progressData && getStatusIcon(progressData.status)}
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                {operation === 'indexing'
                  ? 'Döküman İndeksleniyor'
                  : progressData?.processing_stage === 'reprocessing' || progressData?.processing_details?.includes('Yeniden işleme')
                    ? 'Döküman Yeniden İşleniyor'
                    : 'Döküman İşleniyor'}
              </h3>
              <p className="text-sm text-gray-500">{documentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-8 w-full">
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">📄 Döküman işleme başlatıldı!</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>🔄 İşleme sistemi hazırlanıyor...</span>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600 mb-2">Bağlantı hatası</p>
                <p className="text-xs text-gray-500">
                  {error instanceof Error ? error.message : 'Sunucuya bağlanılamıyor'}
                </p>
              </div>
            ) : progressData ? (
              <div className="space-y-6">
                {/* Progress Bar */}
                <div className="w-full">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>İlerleme</span>
                    <span>{progressData.processing_progress}%</span>
                  </div>
                  <div className="w-full bg-dark-500 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-300 ${getProgressColor(progressData.processing_progress)}`}
                      style={{ width: `${progressData.processing_progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Processing Steps Stepper */}
                <div className="w-full">
                  <label className="text-sm font-medium text-gray-300 mb-3 block">İşlem Adımları</label>
                  <div className="flex items-center justify-between relative">
                    <div className="absolute top-4 left-0 right-0 h-1 bg-dark-500 z-0"></div>
                    <div
                      className="absolute top-4 left-0 h-1 bg-blue-500 z-0 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (CURRENT_STEPS.findIndex(s => s.key === progressData.processing_stage) / (CURRENT_STEPS.length - 1)) * 100)}%`
                      }}
                    ></div>

                    {CURRENT_STEPS.map((step, index) => {
                      const currentIndex = CURRENT_STEPS.findIndex(s => s.key === progressData.processing_stage);
                      const isCompleted = currentIndex > index || progressData.status === 'processed';
                      const isCurrent = step.key === progressData.processing_stage;

                      return (
                        <div key={step.key} className="flex flex-col items-center z-10 relative">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                                ? 'bg-blue-500 text-white animate-pulse ring-4 ring-blue-200'
                                : 'bg-dark-500 text-gray-400'
                              }`}
                          >
                            {isCompleted ? '✓' : step.icon}
                          </div>
                          <span className={`text-xs mt-1 text-center max-w-[60px] ${isCurrent ? 'text-blue-600 font-semibold' : isCompleted ? 'text-green-600' : 'text-gray-400'
                            }`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Main Info */}
                  <div className="space-y-6">
                    {/* Current Stage */}
                    <div>
                      <label className="text-sm font-medium text-gray-300">Mevcut Aşama</label>
                      <p className="text-lg text-gray-100 flex items-center gap-2">
                        <span className="text-xl">{CURRENT_STEPS.find(s => s.key === progressData.processing_stage)?.icon || '📋'}</span>
                        {getStageText(progressData.processing_stage)}
                      </p>
                    </div>

                    {/* Details */}
                    {progressData.processing_details && (
                      <div>
                        <label className="text-sm font-medium text-gray-300">Detaylar</label>
                        <p className="text-sm text-gray-600 bg-dark-700/50 p-3 rounded-lg">
                          {progressData.processing_details}
                        </p>
                      </div>
                    )}

                    {/* Status */}
                    <div>
                      <label className="text-sm font-medium text-gray-300">Durum</label>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusIcon(progressData.status)}
                        <span className="text-sm text-gray-100">
                          {progressData.status === 'processing' && 'İşleniyor'}
                          {progressData.status === 'processed' && 'Başarıyla Tamamlandı'}
                          {progressData.status === 'failed' && 'İşleme Başarısız'}
                        </span>
                      </div>
                    </div>

                    {/* Updated At */}
                    {progressData.updated_at && (
                      <div>
                        <label className="text-sm font-medium text-gray-300">Son Güncelleme</label>
                        <p className="text-sm text-gray-600">
                          {new Date(progressData.updated_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    )}

                    {/* Resource Usage */}
                    {progressData.system_stats && (
                      <div>
                        <label className="text-sm font-medium text-gray-300">Sistem Kaynakları</label>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-xs text-blue-600 font-medium">RAM Kullanımı</div>
                            <div className="text-lg font-bold text-blue-800">
                              {progressData.system_stats?.memory?.percent?.toFixed(1) || 'N/A'}%
                            </div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="text-xs text-green-600 font-medium">CPU Kullanımı</div>
                            <div className="text-lg font-bold text-green-800">
                              {progressData.system_stats?.cpu?.percent?.toFixed(1) || 'N/A'}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Real-time Logs */}
                  <div className="space-y-6">
                    {/* Real-time Logs from Backend */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">İşlem Logları (Gerçek Zamanlı)</label>
                        <span className="text-xs text-gray-400">{logs.length} kayıt</span>
                      </div>
                      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-80 overflow-y-auto">
                        {logs.length > 0 ? (
                          <div className="space-y-1">
                            {logs.map((log, index) => (
                              <div key={index} className="flex items-start space-x-2">
                                <span className="text-gray-500 text-xs whitespace-nowrap">[{formatLogTime(log.timestamp)}]</span>
                                <span className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-green-400'}`}>
                                  {log.message}
                                </span>
                              </div>
                            ))}
                            {progressData?.is_processing && (
                              <div className="flex items-center space-x-2 mt-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-gray-400">Canlı izleme aktif...</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-center py-4">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                              <span>İşlem başlatılıyor, loglar bekleniyor...</span>
                            </div>
                            <p className="text-xs text-gray-600">Backend'den log verileri alınacak</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* System Commands */}
                    <div>
                      <label className="text-sm font-medium text-gray-300">Sistem Komutları</label>
                      <div className="mt-2 bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs max-h-40 overflow-y-auto">
                        <div className="space-y-1">
                          {progressData.processing_stage === 'initialization' && (
                            <>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span>$ python -m backend.services.professional_document_processor</span>
                              </div>
                              <div className="text-gray-400 ml-4">→ Kaynak yönetimi başlatılıyor...</div>
                            </>
                          )}
                          {progressData.processing_stage === 'pdf_analysis' && (
                            <>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                <span>$ python -c "import fitz; doc = fitz.open('file.pdf')"</span>
                              </div>
                              <div className="text-gray-400 ml-4">→ PDF dosyası açılıyor...</div>
                            </>
                          )}
                          {progressData.processing_stage === 'image_extraction' && (
                            <>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                                <span>$ python -c "page.get_images()"</span>
                              </div>
                              <div className="text-gray-400 ml-4">→ PDF sayfasından görseller çıkarılıyor...</div>
                            </>
                          )}
                          {progressData.processing_stage === 'text_extraction' && (
                            <>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span>$ python -c "page.get_text()"</span>
                              </div>
                              <div className="text-gray-400 ml-4">→ PDF'den metin çıkarılıyor...</div>
                            </>
                          )}
                          {progressData.processing_stage === 'ocr_processing' && (
                            <>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                                <span>$ pytesseract --lang tur+eng --psm 6</span>
                              </div>
                              <div className="text-gray-400 ml-4">→ OCR işlemi çalışıyor...</div>
                            </>
                          )}
                          {progressData.processing_stage === 'embedding_generation' && (
                            <>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                <span>$ sentence-transformers --model multilingual-e5-base</span>
                              </div>
                              <div className="text-gray-400 ml-4">→ Embedding'ler oluşturuluyor...</div>
                            </>
                          )}
                          {progressData.processing_stage === 'completed' && (
                            <>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span>$ echo "İşlem tamamlandı ✅"</span>
                              </div>
                              <div className="text-green-300 ml-4">→ Tüm işlemler başarıyla tamamlandı!</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Durum bilgisi alınamadı</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between p-6 border-t bg-dark-700/50 mt-auto">
          <div className="flex space-x-3">
            {(progressData?.is_processing || progressData?.status === 'processing') && (
              <>
                {progressData.processing_details?.includes('duraklatıldı') ? (
                  <button
                    onClick={handleResume}
                    disabled={isResuming}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {isResuming ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Devam Ettiriliyor...
                      </div>
                    ) : (
                      '▶️ Devam Et'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    disabled={isPausing}
                    className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {isPausing ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Duraklatılıyor...
                      </div>
                    ) : (
                      '⏸️ Duraklat'
                    )}
                  </button>
                )}

                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {isCancelling ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      İptal Ediliyor...
                    </div>
                  ) : (
                    '❌ İptal Et'
                  )}
                </button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1 bg-dark-400 text-white rounded text-sm hover:bg-gray-700"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

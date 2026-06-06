import React, { useEffect, useState, useRef } from 'react';
import { X, Pause, Play, StopCircle, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { adminApi, getApiBaseUrl } from '@/services/api';

interface ProcessingModalProps {
  documentId: number;
  documentName: string;
  operation: 'processing' | 'indexing';
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

interface ProgressData {
  progress: number;
  stage: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  error?: string;
  processing_logs?: Array<{
    timestamp: string;
    level: string;
    stage: string;
    progress: number;
    message: string;
  }>;
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({
  documentId,
  documentName,
  operation,
  onClose,
  onPause,
  onResume,
  onCancel,
}) => {
  const [progressData, setProgressData] = useState<ProgressData>({
    progress: 0,
    stage: operation === 'processing' ? 'İşleniyor...' : 'İndeksleniyor...',
    status: 'running',
  });
  const [isPaused, setIsPaused] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const useFallbackRef = useRef(false);

  // Update elapsed time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  // Fetch progress (fallback for polling)
  const fetchProgress = async () => {
    if (completedRef.current) return;

    try {
      const data = await adminApi.getDocumentProgress(documentId);

      // Map backend status to our status
      let status: 'running' | 'paused' | 'completed' | 'error' = 'running';
      if (data.status === 'processed' || data.status === 'indexed' || data.status === 'enriched') {
        status = 'completed';
      } else if (data.status === 'error' || data.status === 'failed') {
        status = 'error';
      } else if (data.processing_details?.includes('duraklatıldı')) {
        status = 'paused';
      }

      setProgressData(prev => ({
        progress: data.processing_progress || 0,
        stage: data.processing_details || data.processing_stage || prev.stage,
        status: status,
        processing_logs: data.processing_logs,
      }));

      setIsPaused(status === 'paused');

      if (status === 'completed' || status === 'error') {
        completedRef.current = true;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        // Auto-close after 2 seconds
        setTimeout(onClose, 2000);
      }
    } catch (err) {
      console.error('Progress fetch error:', err);
    }
  };

  // SSE Connection
  useEffect(() => {
    // If fallback mode is enabled, use polling
    if (useFallbackRef.current) {
      console.log('📊 Using polling fallback mode');
      fetchProgress();
      pollingRef.current = setInterval(fetchProgress, 1000);
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }

    // Try SSE connection
    const connectSSE = () => {
      if (completedRef.current) return;

      try {
        const apiUrl = getApiBaseUrl();
        const sseUrl = `${apiUrl}/admin/documents/${documentId}/progress/stream`;

        console.log('📡 Connecting to SSE:', sseUrl);
        setConnectionStatus('connecting');

        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('✅ SSE connection opened');
          setConnectionStatus('connected');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 SSE message:', data);

            // Handle different event types
            if (data.type === 'progress') {
              let status: 'running' | 'paused' | 'completed' | 'error' = 'running';

              if (data.status === 'processed' || data.status === 'indexed' || data.status === 'enriched') {
                status = 'completed';
              } else if (data.status === 'error' || data.status === 'failed') {
                status = 'error';
              } else if (data.details?.includes('duraklatıldı')) {
                status = 'paused';
              }

              setProgressData(prev => ({
                progress: data.progress || 0,
                stage: data.details || data.stage || prev.stage,
                status: status,
                processing_logs: data.logs || [],
              }));

              setIsPaused(status === 'paused');
            }
            else if (data.type === 'complete') {
              console.log('✅ Processing completed');
              setProgressData({
                progress: 100,
                stage: data.details || 'Tamamlandı',
                status: 'completed',
                processing_logs: data.logs || [],
              });
              completedRef.current = true;
              eventSource.close();
              setTimeout(onClose, 2000);
            }
            else if (data.type === 'error') {
              console.error('❌ Processing error:', data.error);
              setProgressData(prev => ({
                ...prev,
                status: 'error',
                error: data.error || 'Bilinmeyen hata',
              }));
              completedRef.current = true;
              eventSource.close();
            }
            else if (data.type === 'cancelled') {
              console.log('⏹️ Processing cancelled');
              completedRef.current = true;
              eventSource.close();
              onClose();
            }
            else if (data.type === 'timeout') {
              console.warn('⏱️ SSE timeout');
              completedRef.current = true;
              eventSource.close();
            }
          } catch (err) {
            console.error('Failed to parse SSE message:', err);
          }
        };

        eventSource.onerror = (error) => {
          console.error('❌ SSE connection error:', error);
          setConnectionStatus('error');
          eventSource.close();

          // Retry connection after 3 seconds
          if (!completedRef.current) {
            console.log('🔄 Retrying SSE connection in 3s...');
            reconnectTimeoutRef.current = setTimeout(() => {
              connectSSE();
            }, 3000);
          }
        };

      } catch (err) {
        console.error('Failed to create SSE connection:', err);
        setConnectionStatus('error');

        // Fall back to polling
        console.log('⚠️ Falling back to polling mode');
        useFallbackRef.current = true;
        fetchProgress();
        pollingRef.current = setInterval(fetchProgress, 1000);
      }
    };

    // Start SSE connection
    connectSSE();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        console.log('🔌 Closing SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [documentId, onClose]);

  const handlePauseResume = async () => {
    if (isPaused) {
      await onResume();
      setIsPaused(false);
    } else {
      await onPause();
      setIsPaused(true);
    }
  };

  const handleCancel = async () => {
    setShowCancelConfirm(false);
    await onCancel();
    onClose();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedTotal = progressData.progress > 0
    ? Math.floor((elapsedTime / progressData.progress) * 100)
    : 0;
  const estimatedRemaining = estimatedTotal - elapsedTime;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-dark-800/60 rounded-lg shadow-2xl max-w-2xl w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-100 truncate">
                  {operation === 'processing' ? 'Döküman İşleniyor' : 'Döküman İndeksleniyor'}
                </h2>
                {/* Connection Status Indicator */}
                {!useFallbackRef.current && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${connectionStatus === 'connected' ? 'bg-green-500/10 text-green-400' :
                    connectionStatus === 'connecting' ? 'bg-yellow-500/10 text-yellow-400' :
                      connectionStatus === 'error' ? 'bg-red-500/10 text-red-400' :
                        'bg-dark-600 text-gray-300'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                      connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                        connectionStatus === 'error' ? 'bg-red-500' :
                          'bg-dark-700/500'
                      }`} />
                    {connectionStatus === 'connected' ? 'Canlı' :
                      connectionStatus === 'connecting' ? 'Bağlanıyor' :
                        connectionStatus === 'error' ? 'Bağlantı Hatası' :
                          'Bağlantı Kesildi'}
                  </span>
                )}
                {useFallbackRef.current && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400">
                    <Clock className="w-3 h-3" />
                    Polling Modu
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate mt-1">{documentName}</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Status */}
            {progressData.status === 'completed' && (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-400">Tamamlandı!</p>
                  <p className="text-sm text-green-400/80">İşlem başarıyla tamamlandı</p>
                </div>
              </div>
            )}

            {progressData.status === 'error' && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-400">Hata Oluştu</p>
                  <p className="text-sm text-red-400/80">{progressData.error || 'Bilinmeyen hata'}</p>
                </div>
              </div>
            )}

            {progressData.status === 'paused' && (
              <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <Pause className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-400">Duraklatıldı</p>
                  <p className="text-sm text-yellow-400/80">İşlem duraklatıldı, devam ettirmek için butona tıklayın</p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">{progressData.stage}</span>
                <span className="text-sm font-semibold text-gray-100">{Math.round(progressData.progress)}%</span>
              </div>
              <div className="w-full bg-dark-500 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ease-out ${progressData.status === 'completed' ? 'bg-green-500' :
                    progressData.status === 'error' ? 'bg-red-500' :
                      progressData.status === 'paused' ? 'bg-yellow-500' :
                        'bg-blue-500'
                    }`}
                  style={{ width: `${progressData.progress}%` }}
                />
              </div>
            </div>

            {/* Time Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Geçen Süre:</span>
                <span className="font-medium text-gray-100">{formatTime(elapsedTime)}</span>
              </div>
              {progressData.progress > 5 && estimatedRemaining > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Tahmini Kalan:</span>
                  <span className="font-medium text-gray-100">{formatTime(estimatedRemaining)}</span>
                </div>
              )}
            </div>

            {/* Recent Logs */}
            {progressData.processing_logs && progressData.processing_logs.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Son İşlemler</h3>
                <div className="bg-dark-700/50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                  {progressData.processing_logs.slice(-5).reverse().map((log, idx) => (
                    <div key={idx} className="text-xs text-gray-400">
                      <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      {' - '}
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-white/[0.06] bg-dark-700/50">
            <div className="flex gap-2">
              {progressData.status === 'running' || progressData.status === 'paused' ? (
                <>
                  <button
                    onClick={handlePauseResume}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${isPaused
                      ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20'
                      : 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20'
                      }`}
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-4 h-4" />
                        Devam Ettir
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4" />
                        Duraklat
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                    Durdur
                  </button>
                </>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-md hover:bg-dark-700/50 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-800/60 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-100 mb-2">İşlemi Durdurmak İstediğinize Emin Misiniz?</h3>
            <p className="text-sm text-gray-400 mb-4">
              İşlem iptal edilecek ve döküman başlangıç durumuna dönecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-md hover:bg-dark-700/50"
              >
                İptal
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Evet, Durdur
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProcessingModal;

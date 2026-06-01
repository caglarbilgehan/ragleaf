import { useEffect, useState, useRef } from 'react';
import { X, CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { ProgressUpdate } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ProgressModalProps {
  operationId: string;
  documentName: string;
  onClose: () => void;
  onComplete?: () => void;
}

export default function ProgressModal({ 
  operationId, 
  documentName, 
  onClose,
  onComplete
}: ProgressModalProps) {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Use polling instead of SSE for better cross-origin compatibility
    const fetchProgress = async () => {
      try {
        const token = localStorage.getItem('ragleaf_token');
        const response = await fetch(
          `${API_URL}/api/admin/operations/${operationId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Operation not found yet, keep polling
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Calculate elapsed time on client side
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        
        const progressData: ProgressUpdate = {
          operation_id: data.operation_id,
          document_id: data.document_id,
          stage: data.stage || data.status || 'unknown',
          progress: data.progress || 0,
          details: data.details || '',
          elapsed_seconds: elapsedSeconds,
          estimated_remaining_seconds: data.progress > 0 && data.progress < 100
            ? Math.floor((elapsedSeconds / data.progress) * (100 - data.progress))
            : 0
        };

        setProgress(progressData);

        // If completed or error, stop polling and start countdown
        if (data.status === 'completed' || data.status === 'error' || data.status === 'cancelled') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          
          if (data.status === 'completed' && onComplete) {
            onComplete();
          }
          
          setAutoCloseCountdown(3);
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
        // Don't set error immediately, keep trying
      }
    };

    // Initial fetch
    fetchProgress();

    // Poll every 1 second
    pollingRef.current = setInterval(fetchProgress, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [operationId, onComplete]);

  // Auto-close countdown
  useEffect(() => {
    if (autoCloseCountdown === null) return;
    
    if (autoCloseCountdown === 0) {
      onClose();
      return;
    }

    const timer = setTimeout(() => {
      setAutoCloseCountdown(autoCloseCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoCloseCountdown, onClose]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'resetting': return 'Sıfırlanıyor';
      case 'processing': return 'İşleniyor';
      case 'indexing': return 'İndeksleniyor';
      case 'completed': return 'Tamamlandı';
      case 'error': return 'Hata';
      case 'running': return 'Çalışıyor';
      case 'pending': return 'Bekliyor';
      default: return stage;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'resetting': return 'text-orange-600 bg-orange-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'indexing': return 'text-purple-600 bg-purple-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              progress?.stage === 'completed' 
                ? 'bg-green-100' 
                : progress?.stage === 'error'
                ? 'bg-red-100'
                : 'bg-blue-100'
            }`}>
              {progress?.stage === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : progress?.stage === 'error' ? (
                <XCircle className="h-5 w-5 text-red-600" />
              ) : (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">İşlem İlerlemesi</h3>
              <p className="text-sm text-gray-500 truncate max-w-[250px]">{documentName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            disabled={autoCloseCountdown !== null && autoCloseCountdown > 0}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : progress ? (
            <>
              {/* Stage Badge */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${getStageColor(progress.stage)}`}>
                  {getStageLabel(progress.stage)}
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {progress.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      progress.stage === 'completed' 
                        ? 'bg-green-500' 
                        : progress.stage === 'error'
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              </div>

              {/* Details */}
              {progress.details && (
                <p className="text-sm text-gray-600">
                  {progress.details}
                </p>
              )}

              {/* Time Info */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Geçen: {formatTime(progress.elapsed_seconds)}</span>
                </div>
                {progress.estimated_remaining_seconds > 0 && progress.stage !== 'completed' && (
                  <span>Kalan: ~{formatTime(progress.estimated_remaining_seconds)}</span>
                )}
              </div>

              {/* Error Message */}
              {progress.stage === 'error' && (progress as any).error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <strong>Hata:</strong> {(progress as any).error}
                  </p>
                </div>
              )}

              {/* Success Message */}
              {progress.stage === 'completed' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✅ İşlem başarıyla tamamlandı!
                  </p>
                </div>
              )}

              {/* Auto-close Countdown */}
              {autoCloseCountdown !== null && autoCloseCountdown > 0 && (
                <p className="text-xs text-center text-gray-500">
                  {autoCloseCountdown} saniye içinde otomatik kapanacak...
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-500">İşlem başlatılıyor...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(progress?.stage === 'completed' || progress?.stage === 'error' || error) && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="btn btn-primary"
            >
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

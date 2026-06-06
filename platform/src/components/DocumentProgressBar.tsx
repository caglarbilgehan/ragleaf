// platform/src/components/DocumentProgressBar.tsx
import React from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useDocumentProgressSSE, DocumentProgress, ProgressLog } from '../hooks/useDocumentProgressSSE';

interface DocumentProgressBarProps {
  documentId: number | null;
  onComplete?: () => void;
  onError?: (error: string) => void;
  showLogs?: boolean;
  compact?: boolean;
}

// Stage emoji mapping
const stageEmojis: Record<string, string> = {
  initialization: '🚀',
  text_extraction: '📄',
  image_extraction: '🖼️',
  ocr: '👁️',
  chunking: '✂️',
  embedding: '🧠',
  indexing: '📊',
  complete: '✅',
  error: '❌',
  reprocessing: '🔄'
};

// Stage display names
const stageNames: Record<string, string> = {
  initialization: 'Başlatılıyor',
  text_extraction: 'Metin Çıkarılıyor',
  image_extraction: 'Görseller Çıkarılıyor',
  ocr: 'OCR İşleniyor',
  chunking: 'Parçalanıyor',
  embedding: 'Embedding Oluşturuluyor',
  indexing: 'İndeksleniyor',
  complete: 'Tamamlandı',
  error: 'Hata',
  reprocessing: 'Yeniden İşleniyor'
};

export const DocumentProgressBar: React.FC<DocumentProgressBarProps> = ({
  documentId,
  onComplete,
  onError,
  showLogs = true,
  compact = false
}) => {
  const { progress, isConnected, error } = useDocumentProgressSSE(documentId, {
    onComplete: (data) => {
      onComplete?.();
    },
    onError: (err) => {
      onError?.(err);
    }
  });

  if (!documentId) return null;

  // No progress yet
  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Bağlanıyor...</span>
      </div>
    );
  }

  const { status, stage, progress: progressValue, details, logs, is_processing, total_chunks, total_pages } = progress;

  // Determine status icon and color
  const getStatusIcon = () => {
    if (status === 'processed' || progress.type === 'complete') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (status === 'error' || progress.type === 'error') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (is_processing) {
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const getProgressColor = () => {
    if (status === 'processed' || progress.type === 'complete') return 'bg-green-500';
    if (status === 'error' || progress.type === 'error') return 'bg-red-500';
    return 'bg-blue-500';
  };

  const stageEmoji = stageEmojis[stage] || '📋';
  const stageName = stageNames[stage] || stage;

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1">
            {stageEmoji} {stageName}
          </span>
          <span className="font-medium">{progressValue}%</span>
        </div>
        <div className="w-full bg-dark-500 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800/60 rounded-lg border border-white/[0.06] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-gray-100">
            {stageEmoji} {stageName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-sm font-medium text-gray-300">
            {progressValue}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-dark-500 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${progressValue}%` }}
        />
      </div>

      {/* Details */}
      {details && (
        <p className="text-sm text-gray-400">
          {details}
        </p>
      )}

      {/* Stats */}
      {(total_pages || total_chunks) && (
        <div className="flex gap-4 text-sm text-gray-400">
          {total_pages && <span>📄 {total_pages} sayfa</span>}
          {total_chunks && <span>✂️ {total_chunks} parça</span>}
        </div>
      )}

      {/* Logs */}
      {showLogs && logs && logs.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            İşlem Logları
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1 text-xs font-mono bg-dark-700/50 rounded p-2">
            {logs.map((log: ProgressLog, index: number) => (
              <div
                key={index}
                className={`${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-400'
                }`}
              >
                <span className="text-gray-400">[{log.progress}%]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default DocumentProgressBar;

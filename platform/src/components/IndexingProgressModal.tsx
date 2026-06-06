import React, { useEffect, useState, useRef } from 'react';
import { X, Pause, Play, StopCircle, AlertCircle, CheckCircle, Clock, Package, Globe, Calculator, Database } from 'lucide-react';
import { adminApi } from '@/services/api';

interface IndexingProgressModalProps {
  documentId: number;
  documentName: string;
  onClose: () => void;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
}

interface IndexingStep {
  id: string;
  label: string;
  icon: React.ReactNode;
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

const INDEXING_STEPS: IndexingStep[] = [
  { id: 'chunking', label: 'Metin Parçalama', icon: <Package className="w-5 h-5" /> },
  { id: 'translation', label: 'Çeviri (Opsiyonel)', icon: <Globe className="w-5 h-5" /> },
  { id: 'embedding', label: 'Vektör Oluşturma', icon: <Calculator className="w-5 h-5" /> },
  { id: 'vector_db', label: 'Veritabanına Kayıt', icon: <Database className="w-5 h-5" /> },
];

const IndexingProgressModal: React.FC<IndexingProgressModalProps> = ({
  documentId,
  documentName,
  onClose,
  onPause,
  onResume,
  onCancel,
}) => {
  const [progressData, setProgressData] = useState<ProgressData>({
    progress: 0,
    stage: 'İndeksleniyor...',
    status: 'running',
  });
  const [isPaused, setIsPaused] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  // Update elapsed time every second (only when startTime is set)
  useEffect(() => {
    if (!startTime) return;

    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  // Determine current step based on stage
  const determineCurrentStep = (stage: string): number => {
    const stageLower = stage.toLowerCase();
    if (stageLower.includes('chunk') || stageLower.includes('parça') || stageLower.includes('initialization')) return 0;
    if (stageLower.includes('translat') || stageLower.includes('çevir')) return 1;
    if (stageLower.includes('embed') || stageLower.includes('vektör')) return 2;
    if (stageLower.includes('vector') || stageLower.includes('database') || stageLower.includes('kayıt') || stageLower.includes('completed')) return 3;
    return 0;
  };

  // Fetch progress via polling
  const fetchProgress = async () => {
    if (completedRef.current) return;

    try {
      const data = await adminApi.getDocumentProgress(documentId);

      // Map backend status to our status
      let status: 'running' | 'paused' | 'completed' | 'error' = 'running';
      if (data.status === 'indexed' || data.status === 'enriched') {
        status = 'completed';
      } else if (data.status === 'error' || data.status === 'failed') {
        status = 'error';
      } else if (data.processing_details?.includes('duraklatıldı')) {
        status = 'paused';
      }

      const stage = data.processing_details || data.processing_stage || 'İndeksleniyor...';
      const stepIndex = determineCurrentStep(stage);

      // Set start time from backend data (only once, when it's null)
      if (startTime === null && data.updated_at) {
        const backendStartTime = new Date(data.updated_at).getTime();
        setStartTime(backendStartTime);
      }

      setProgressData({
        progress: data.processing_progress || 0,
        stage: stage,
        status: status,
        processing_logs: data.processing_logs,
      });

      setCurrentStepIndex(stepIndex);
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

  // Start polling
  useEffect(() => {
    fetchProgress();
    pollingRef.current = setInterval(fetchProgress, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [documentId]);

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
    try {
      await onCancel();
      onClose();
    } catch (err) {
      console.error('Cancel error:', err);
    }
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
        className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Full Screen Modal */}
      <div className="fixed inset-0 z-50 flex items-stretch pointer-events-none">
        <div
          className="bg-dark-800/60 w-full h-full pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06] bg-dark-800/60 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-gray-100">
                  Döküman İndeksleniyor
                </h2>
                {/* Status Badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full ${progressData.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                  progressData.status === 'paused' ? 'bg-yellow-500/10 text-yellow-400' :
                    progressData.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      'bg-red-500/10 text-red-400'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${progressData.status === 'running' ? 'bg-blue-500 animate-pulse' :
                    progressData.status === 'paused' ? 'bg-yellow-500' :
                      progressData.status === 'completed' ? 'bg-green-500' :
                        'bg-red-500'
                    }`} />
                  {progressData.status === 'running' ? 'Devam Ediyor' :
                    progressData.status === 'paused' ? 'Duraklatıldı' :
                      progressData.status === 'completed' ? 'Tamamlandı' :
                        'Hata'}
                </span>
              </div>
              <p className="text-base text-gray-400 mt-1 truncate">{documentName}</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 text-gray-400 hover:text-gray-300 hover:bg-dark-600 rounded-lg transition-colors"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* Main Content - Two Panel Layout */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full grid grid-cols-1 lg:grid-cols-5 divide-x divide-white/[0.04]">

              {/* Left Panel - Progress & Stats */}
              <div className="lg:col-span-2 p-8 overflow-y-auto">
                {/* Progress Ring */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-48 h-48">
                    <svg className="transform -rotate-90 w-48 h-48">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-white/[0.06]"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 88}`}
                        strokeDashoffset={`${2 * Math.PI * 88 * (1 - progressData.progress / 100)}`}
                        className={`transition-all duration-500 ${progressData.status === 'completed' ? 'text-green-500' :
                          progressData.status === 'error' ? 'text-red-500' :
                            progressData.status === 'paused' ? 'text-yellow-500' :
                              'text-blue-500'
                          }`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold text-gray-100">{Math.round(progressData.progress)}</span>
                      <span className="text-2xl text-gray-500">%</span>
                    </div>
                  </div>

                  {/* Current Stage */}
                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Mevcut Aşama</p>
                    <p className="mt-1 text-base font-semibold text-gray-100">{progressData.stage}</p>
                  </div>
                    {/* Time Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-dark-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Geçen Süre</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-100">{formatTime(elapsedTime)}</p>
                  </div>

                  <div className="bg-dark-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Kalan Süre</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-100">
                      {progressData.progress > 5 ? formatTime(Math.max(0, estimatedRemaining)) : '--:--'}
                    </p>
                  </div>
                </div>
              </div>

                {/* Status Messages */}
                {progressData.status === 'completed' && (
                  <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-400">Tamamlandı!</p>
                      <p className="text-sm text-green-400/80 mt-0.5">İndeksleme başarıyla tamamlandı</p>
                    </div>
                  </div>
                )}

                {progressData.status === 'error' && (
                  <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-400">Hata Oluştu</p>
                      <p className="text-sm text-red-400/80 mt-0.5">{progressData.error || 'Bilinmeyen hata'}</p>
                    </div>
                  </div>
                )}

                {progressData.status === 'paused' && (
                  <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <Pause className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-yellow-400">Duraklatıldı</p>
                      <p className="text-sm text-yellow-400/80 mt-0.5">İşlem duraklatıldı, devam ettirmek için butona tıklayın</p>
                    </div>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="space-y-3 pt-2">
                  {progressData.status === 'running' || progressData.status === 'paused' ? (
                    <>
                      <button
                        onClick={handlePauseResume}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        {isPaused ? (
                          <>
                            <Play className="w-5 h-5" />
                            Devam Ettir
                          </>
                        ) : (
                          <>
                            <Pause className="w-5 h-5" />
                            Duraklat
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-dark-800/60 text-red-400 font-medium rounded-xl border border-red-500/20 hover:bg-red-500/10 transition-colors"
                      >
                        <StopCircle className="w-5 h-5" />
                        İptal Et
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Right Panel - Steps & Logs */}
              <div className="lg:col-span-3 flex flex-col overflow-hidden">
                {/* Indexing Steps */}
                <div className="px-8 py-6 border-b border-white/[0.06]">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">İndeksleme Aşamaları</h3>
                  <div className="space-y-3">
                    {INDEXING_STEPS.map((step, index) => {
                      const isCompleted = index < currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      const isPending = index > currentStepIndex;

                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] transition-all ${isCurrent ? 'bg-blue-500/10 border-blue-500/30' :
                            isCompleted ? 'bg-green-500/10 border-green-500/20' :
                              'bg-dark-700/50'
                            }`}
                        >
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isCurrent ? 'bg-blue-600 text-white' :
                            isCompleted ? 'bg-green-600 text-white' :
                              'bg-dark-600 text-gray-400'
                            }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-6 h-6" />
                            ) : isCurrent ? (
                              <div className="w-3 h-3 bg-dark-800/60 rounded-full animate-pulse" />
                            ) : (
                              step.icon
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${isCurrent ? 'text-blue-400' :
                              isCompleted ? 'text-green-400' :
                                'text-gray-400'
                              }`}>
                              {step.label}
                            </p>
                            {isCurrent && (
                              <p className="text-sm text-blue-400/80 mt-0.5">
                                {Math.round(progressData.progress)}% tamamlandı
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Logs */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Son İşlemler</h3>
                  {progressData.processing_logs && progressData.processing_logs.length > 0 ? (
                    <div className="space-y-2">
                      {[...progressData.processing_logs].reverse().map((log, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg text-sm border ${log.level === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            log.level === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                              'bg-dark-700/50 border-white/[0.06] text-gray-300'
                            }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString('tr-TR')}
                            </span>
                            <span className="flex-1">{log.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Henüz log kaydı yok...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-dark-800/60 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-500/20">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-red-500/10 p-3 rounded-xl flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-100 mb-1">İşlemi Durdurmak İstediğinize Emin Misiniz?</h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  İndeksleme işlemi iptal edilecek ve mevcut ilerleme kaybedilecek.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-xl hover:bg-dark-700/50 hover:border-gray-400 transition-all"
              >
                Vazgeç
              </button>
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all"
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

export default IndexingProgressModal;

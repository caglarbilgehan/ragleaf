import { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { ResetOptions, ReprocessOptions } from '../types';

interface ResetModalProps {
  documentId: number;
  documentName: string;
  onClose: () => void;
  onConfirm: (request: {
    reset_level: 'indexing' | 'processing' | 'all';
    reset_options?: ResetOptions;
    reprocess_options?: ReprocessOptions;
    auto_process: boolean;
    auto_index: boolean;
  }) => void;
  isLoading?: boolean;
}

export default function ResetModal({ 
  documentId, 
  documentName, 
  onClose, 
  onConfirm,
  isLoading = false 
}: ResetModalProps) {
  const [resetLevel, setResetLevel] = useState<'indexing' | 'processing' | 'all'>('processing');
  const [showResetOptions, setShowResetOptions] = useState(false);
  const [showReprocessOptions, setShowReprocessOptions] = useState(false);
  
  const [resetOptions, setResetOptions] = useState<ResetOptions>({
    chunks: true,
    chunk_enrichments: true,
    doc_enrichments: true,
    images: false,
    ocr_texts: false
  });

  const [reprocessOptions, setReprocessOptions] = useState<ReprocessOptions>({
    extract_text: false,
    extract_images: false,
    run_ocr: false,
    chunking_strategy: null,
    chunk_size: 512,
    chunk_overlap: 100,
    ocr_languages: 'tur+eng'
  });

  const [autoProcess, setAutoProcess] = useState(false); // Default: false (sadece sıfırla)
  const [autoIndex, setAutoIndex] = useState(false); // Default: false
  const [estimatedTime, setEstimatedTime] = useState(15);

  // Calculate estimated time (sadece reset için)
  useEffect(() => {
    let time = 0;
    
    // Base reset time
    if (resetLevel === 'indexing') time = 5;
    else if (resetLevel === 'processing') time = 15;
    else if (resetLevel === 'all') time = 30;
    
    setEstimatedTime(time);
  }, [resetLevel]);

  const handleConfirm = () => {
    onConfirm({
      reset_level: resetLevel,
      reset_options: resetLevel === 'processing' ? resetOptions : undefined,
      reprocess_options: undefined, // Artık reprocess yok
      auto_process: false, // Varsayılan: sadece sıfırla
      auto_index: false
    });
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} saniye`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes} dakika ${secs} saniye` : `${minutes} dakika`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800/60 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] sticky top-0 bg-dark-800/60 z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Döküman Sıfırlama</h3>
              <p className="text-sm text-gray-500 truncate max-w-[350px]">{documentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Reset Level Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sıfırlama Seviyesi
            </label>
            <div className="space-y-2">
              {/* Level 1: Indexing */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                resetLevel === 'indexing' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-white/[0.06] hover:bg-dark-700/50'
              }`}>
                <input
                  type="radio"
                  name="resetLevel"
                  value="indexing"
                  checked={resetLevel === 'indexing'}
                  onChange={(e) => setResetLevel(e.target.value as 'indexing')}
                  className="mt-0.5 h-4 w-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">Hafif Sıfırlama (Sadece İndeksleme)</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">~5 sn</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Sadece embedding'leri siler. Chunk'lar ve görseller korunur.
                  </p>
                </div>
              </label>

              {/* Level 2: Processing */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                resetLevel === 'processing' 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-white/[0.06] hover:bg-dark-700/50'
              }`}>
                <input
                  type="radio"
                  name="resetLevel"
                  value="processing"
                  checked={resetLevel === 'processing'}
                  onChange={(e) => setResetLevel(e.target.value as 'processing')}
                  className="mt-0.5 h-4 w-4 text-orange-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">Orta Sıfırlama (İşleme)</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">~15 sn</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Chunk'ları ve zenginleştirmeleri siler. Granular kontrol ile seçilebilir.
                  </p>
                </div>
              </label>

              {/* Level 3: All */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                resetLevel === 'all' 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-white/[0.06] hover:bg-dark-700/50'
              }`}>
                <input
                  type="radio"
                  name="resetLevel"
                  value="all"
                  checked={resetLevel === 'all'}
                  onChange={(e) => setResetLevel(e.target.value as 'all')}
                  className="mt-0.5 h-4 w-4 text-red-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">Tam Sıfırlama (Her Şey)</span>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">~30 sn</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Orijinal dosya hariç her şeyi siler. Tamamen yeni baştan işleme.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Granular Reset Options (only for processing level) */}
          {resetLevel === 'processing' && (
            <div className="border border-white/[0.06] rounded-lg">
              <button
                onClick={() => setShowResetOptions(!showResetOptions)}
                className="w-full flex items-center justify-between p-3 hover:bg-dark-700/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-300">Sıfırlama Seçenekleri</span>
                {showResetOptions ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
              
              {showResetOptions && (
                <div className="p-3 pt-0 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resetOptions.chunks}
                      onChange={(e) => setResetOptions({ ...resetOptions, chunks: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span>Chunk'ları sil</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resetOptions.chunk_enrichments}
                      onChange={(e) => setResetOptions({ ...resetOptions, chunk_enrichments: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span>Chunk zenginleştirmelerini sil</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resetOptions.doc_enrichments}
                      onChange={(e) => setResetOptions({ ...resetOptions, doc_enrichments: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span>Döküman zenginleştirmelerini sil</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resetOptions.images}
                      onChange={(e) => setResetOptions({ ...resetOptions, images: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span>Görselleri sil</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resetOptions.ocr_texts}
                      onChange={(e) => setResetOptions({ ...resetOptions, ocr_texts: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span>OCR metinlerini temizle</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Estimated Time */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Tahmini süre: <span className="font-semibold">{formatTime(estimatedTime)}</span>
            </p>
          </div>

          {/* Warning */}
          {resetLevel === 'all' && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">
                <strong>Dikkat:</strong> Tam sıfırlama orijinal dosya hariç tüm işlenmiş verileri silecektir. 
                Bu işlem geri alınamaz!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/[0.06] bg-dark-700/50 rounded-b-xl sticky bottom-0">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            İptal
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-danger flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                Sıfırlanıyor...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Sıfırla
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

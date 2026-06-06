import { useState } from 'react';
import { X, RefreshCw, Image, FileText, Shield, AlertTriangle } from 'lucide-react';

interface ReprocessModalProps {
  documentId: number;
  documentName: string;
  onClose: () => void;
  onConfirm: (options: ReprocessOptions) => void;
  isLoading?: boolean;
}

export interface ReprocessOptions {
  reextract_images: boolean;
  rerun_image_ocr: boolean;
  preserve_enrichments: boolean;
}

export default function ReprocessModal({ 
  documentId, 
  documentName, 
  onClose, 
  onConfirm,
  isLoading = false 
}: ReprocessModalProps) {
  const [options, setOptions] = useState<ReprocessOptions>({
    reextract_images: false,
    rerun_image_ocr: false,
    preserve_enrichments: true
  });

  const handleConfirm = () => {
    onConfirm(options);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800/60 rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Yeniden İşle</h3>
              <p className="text-sm text-gray-500 truncate max-w-[250px]">{documentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Dökümanı yeniden işlerken hangi adımların tekrarlanacağını seçin:
          </p>

          {/* Options */}
          <div className="space-y-3">
            {/* Preserve Enrichments */}
            <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-green-200 bg-green-50 cursor-pointer">
              <input
                type="checkbox"
                checked={options.preserve_enrichments}
                onChange={(e) => setOptions({ ...options, preserve_enrichments: e.target.checked })}
                className="mt-0.5 h-4 w-4 text-green-600 rounded"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">Zenginleştirmeleri Koru</span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  Chunk ve görsel zenginleştirmeleri (etiketler, sorular, ilişkiler) korunur
                </p>
              </div>
            </label>

            {/* Re-extract Images */}
            <label className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] hover:bg-dark-700/50 cursor-pointer">
              <input
                type="checkbox"
                checked={options.reextract_images}
                onChange={(e) => setOptions({ ...options, reextract_images: e.target.checked })}
                className="mt-0.5 h-4 w-4 text-primary-600 rounded"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-200">Görselleri Yeniden Çıkart</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  PDF'den görselleri tekrar çıkartır (normalde atlanır)
                </p>
              </div>
            </label>

            {/* Re-run Image OCR */}
            <label className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] hover:bg-dark-700/50 cursor-pointer">
              <input
                type="checkbox"
                checked={options.rerun_image_ocr}
                onChange={(e) => setOptions({ ...options, rerun_image_ocr: e.target.checked })}
                className="mt-0.5 h-4 w-4 text-primary-600 rounded"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-200">Görsel OCR'ı Tekrarla</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Görsellerdeki metinleri tekrar OCR ile çıkartır
                </p>
              </div>
            </label>
          </div>

          {/* Warning */}
          {!options.preserve_enrichments && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Zenginleştirmeler korunmadığında, chunk'lara ve görsellere eklenen tüm 
                etiketler, sorular ve ilişkiler silinecektir.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/[0.06] bg-dark-700/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            İptal
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-primary flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                İşleniyor...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Yeniden İşle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

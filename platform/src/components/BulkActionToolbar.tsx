import React, { useState } from 'react';
import { Play, RefreshCw, RotateCcw, X } from 'lucide-react';

interface Document {
  id: number;
  name: string;
  status: string;
}

interface BulkActionToolbarProps {
  selectedDocuments: Document[];
  onBulkAction: (action: string, documentIds: number[]) => Promise<void>;
  onClearSelection: () => void;
}

interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  errors: { documentId: number; error: string }[];
}

const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedDocuments,
  onBulkAction,
  onClearSelection,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Check if action is compatible with selected documents
  const isActionCompatible = (action: string): boolean => {
    switch (action) {
      case 'bulk-process':
        return selectedDocuments.every((doc) => doc.status === 'uploaded');
      case 'bulk-index':
        return selectedDocuments.every((doc) => doc.status === 'processed');
      case 'bulk-reset':
        return selectedDocuments.every((doc) => ['processed', 'indexed'].includes(doc.status));
      default:
        return false;
    }
  };

  const handleActionClick = (action: string) => {
    if (!isActionCompatible(action)) {
      alert('Seçili dökümanlar bu işlem için uygun değil');
      return;
    }
    setPendingAction(action);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;

    setShowConfirm(false);
    setIsProcessing(true);
    setProgress({
      total: selectedDocuments.length,
      completed: 0,
      failed: 0,
      errors: [],
    });

    try {
      const documentIds = selectedDocuments.map((doc) => doc.id);
      await onBulkAction(pendingAction, documentIds);

      // Simulate progress updates (in real implementation, this would come from SSE)
      for (let i = 0; i < selectedDocuments.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setProgress((prev) => ({
          ...prev!,
          completed: i + 1,
        }));
      }

      setShowSummary(true);
    } catch (error: any) {
      setProgress((prev) => ({
        ...prev!,
        failed: prev!.failed + 1,
        errors: [...prev!.errors, { documentId: 0, error: error.message }],
      }));
      setShowSummary(true);
    } finally {
      setIsProcessing(false);
      setPendingAction(null);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingAction(null);
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    setProgress(null);
    onClearSelection();
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'bulk-process':
        return 'Toplu İşle';
      case 'bulk-index':
        return 'Toplu İndeksle';
      case 'bulk-reset':
        return 'Toplu Sıfırla';
      default:
        return '';
    }
  };

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-300">
              {selectedDocuments.length} döküman seçildi
            </span>
            <button
              onClick={onClearSelection}
              className="text-sm text-gray-600 hover:text-gray-200 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Seçimi Temizle
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleActionClick('bulk-process')}
              disabled={!isActionCompatible('bulk-process') || isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              title="Keyboard shortcut: Shift+P"
            >
              <Play className="w-4 h-4" />
              Toplu İşle
            </button>
            <button
              onClick={() => handleActionClick('bulk-index')}
              disabled={!isActionCompatible('bulk-index') || isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              title="Keyboard shortcut: Shift+I"
            >
              <RefreshCw className="w-4 h-4" />
              Toplu İndeksle
            </button>
            <button
              onClick={() => handleActionClick('bulk-reset')}
              disabled={!isActionCompatible('bulk-reset') || isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-50 disabled:bg-dark-600 disabled:cursor-not-allowed"
              title="Keyboard shortcut: Shift+R"
            >
              <RotateCcw className="w-4 h-4" />
              Toplu Sıfırla
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {isProcessing && progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">İşleniyor...</span>
              <span className="text-sm text-gray-500">
                {progress.completed} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-dark-500 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-800/60 rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-medium text-gray-100 mb-2">Emin misiniz?</h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedDocuments.length} döküman için <strong>{getActionLabel(pendingAction)}</strong>{' '}
              işlemi yapılacak:
            </p>
            <ul className="text-sm text-gray-600 mb-4 max-h-40 overflow-y-auto">
              {selectedDocuments.map((doc) => (
                <li key={doc.id} className="py-1">
                  • {doc.name}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-md hover:bg-dark-700/50"
              >
                İptal
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummary && progress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-800/60 rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-medium text-gray-100 mb-4">İşlem Tamamlandı</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Toplam:</span>
                <span className="font-medium">{progress.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Başarılı:</span>
                <span className="font-medium text-green-600">{progress.completed - progress.failed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Başarısız:</span>
                <span className="font-medium text-red-600">{progress.failed}</span>
              </div>
            </div>

            {progress.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-100 mb-2">Hatalar:</h4>
                <ul className="text-sm text-red-600 max-h-40 overflow-y-auto">
                  {progress.errors.map((err, idx) => (
                    <li key={idx} className="py-1">
                      • {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleCloseSummary}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkActionToolbar;

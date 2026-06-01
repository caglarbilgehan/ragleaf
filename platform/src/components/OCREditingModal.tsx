import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, SkipForward, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Loader2, Layers, HelpCircle, Keyboard } from 'lucide-react';
import { getApiBaseUrl } from '@/services/api';
import PageNavigator from './PageNavigator';
import BatchEditModal from './BatchEditModal';

interface OCRPage {
  document_id: number;
  page_number: number;
  original_text: string;
  confidence_score: number;
  image_url: string;
  status: string;
}

interface OCREditingModalProps {
  documentId: number;
  documentName: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function OCREditingModal({
  documentId,
  documentName,
  onClose,
  onComplete,
}: OCREditingModalProps) {
  const [pages, setPages] = useState<OCRPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});
  const [autoContinue, setAutoContinue] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sortBy, setSortBy] = useState<'page' | 'confidence'>('page');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentPage = pages[currentPageIndex];
  const isDirty = currentPage && editedTexts[currentPage.page_number] !== undefined;

  // Load OCR pages on mount
  useEffect(() => {
    loadOCRPages();
  }, [documentId]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in textarea
      if (e.target instanceof HTMLTextAreaElement) {
        // Only handle Ctrl+S and Ctrl+Enter in textarea
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          handleSave();
        } else if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          handleSave().then(() => handleSkip());
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSkip();
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(prev => !prev);
          break;
        case 's':
          if (e.ctrlKey) {
            e.preventDefault();
            handleSave();
          }
          break;
        case 'Enter':
          if (e.ctrlKey) {
            e.preventDefault();
            handleComplete();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, pages.length, isDirty]);

  // Focus trap for accessibility
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isLoading]);

  const loadOCRPages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(
        `${getApiBaseUrl()}/api/admin/documents/${documentId}/ocr-pages`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load OCR pages');
      }

      const data = await response.json();
      setPages(data);
      
      if (data.length === 0) {
        setError('Bu döküman için OCR sayfası bulunamadı.');
      }
    } catch (err) {
      console.error('Error loading OCR pages:', err);
      setError('OCR sayfaları yüklenirken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    if (!currentPage) return;
    setEditedTexts(prev => ({
      ...prev,
      [currentPage.page_number]: text
    }));
    setSaveStatus('idle');
  };

  const handleSave = async (): Promise<boolean> => {
    if (!currentPage || !isDirty) return false;

    try {
      setIsSaving(true);
      setSaveStatus('saving');
      const token = localStorage.getItem('ragleaf_token');
      const editedText = editedTexts[currentPage.page_number];

      const response = await fetch(
        `${getApiBaseUrl()}/api/admin/documents/${documentId}/ocr-pages/${currentPage.page_number}/edit`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ edited_text: editedText })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save edit');
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return true;
    } catch (err) {
      console.error('Error saving edit:', err);
      setSaveStatus('error');
      setError('Düzenleme kaydedilirken hata oluştu.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
      setSaveStatus('idle');
    }
  };

  const handlePrevious = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
      setSaveStatus('idle');
    }
  };

  const handleComplete = async () => {
    try {
      setIsCompleting(true);
      const token = localStorage.getItem('ragleaf_token');

      const response = await fetch(
        `${getApiBaseUrl()}/api/admin/documents/${documentId}/ocr-continue`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to continue pipeline');
      }

      onComplete();
      onClose();
    } catch (err) {
      console.error('Error completing OCR editing:', err);
      setError('Pipeline devam ettirilemedi.');
    } finally {
      setIsCompleting(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'Yüksek Kalite';
    if (confidence >= 50) return 'Orta Kalite';
    return 'Düşük Kalite';
  };

  const handlePageChange = (pageNumber: number) => {
    const index = pages.findIndex(p => p.page_number === pageNumber);
    if (index !== -1) {
      setCurrentPageIndex(index);
      setSaveStatus('idle');
    }
  };

  const handleBatchEditApply = (updatedTexts: Record<number, string>) => {
    // Update local state with batch edited texts
    setEditedTexts(prev => ({
      ...prev,
      ...updatedTexts
    }));
    // Update pages with new texts
    setPages(prev => prev.map(page => {
      if (updatedTexts[page.page_number]) {
        return { ...page, original_text: updatedTexts[page.page_number] };
      }
      return page;
    }));
    setSelectedPages([]);
  };

  const getSelectedPagesData = () => {
    return pages.filter(p => selectedPages.includes(p.page_number));
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">OCR sayfaları yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-modal-title"
      aria-describedby="ocr-modal-description"
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 id="ocr-modal-title" className="text-lg font-semibold text-gray-900">OCR Metni Düzenle</h3>
            <p id="ocr-modal-description" className="text-sm text-gray-500">{documentName}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowKeyboardHelp(prev => !prev)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Klavye kısayollarını göster"
              title="Klavye Kısayolları (?)"
            >
              <Keyboard className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-600" aria-live="polite">
              Sayfa {currentPageIndex + 1} / {pages.length}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Modalı kapat"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Help Panel */}
        {showKeyboardHelp && (
          <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-blue-900 flex items-center">
                <Keyboard className="h-4 w-4 mr-2" />
                Klavye Kısayolları
              </h4>
              <button 
                onClick={() => setShowKeyboardHelp(false)}
                className="text-blue-600 hover:text-blue-800"
                aria-label="Kısayol panelini kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono">←</kbd>
                <span className="text-blue-800">Önceki sayfa</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono">→</kbd>
                <span className="text-blue-800">Sonraki sayfa</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono">Ctrl+S</kbd>
                <span className="text-blue-800">Kaydet</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono">Ctrl+Enter</kbd>
                <span className="text-blue-800">Tamamla</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono">Esc</kbd>
                <span className="text-blue-800">Kapat</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono">?</kbd>
                <span className="text-blue-800">Bu panel</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {currentPage ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              {/* Page Navigator Sidebar */}
              <div className="lg:col-span-3 overflow-y-auto">
                <PageNavigator
                  pages={pages}
                  currentPage={currentPage.page_number}
                  onPageChange={handlePageChange}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  enableBatchSelect={true}
                  selectedPages={selectedPages}
                  onSelectionChange={setSelectedPages}
                  onBatchEdit={() => setShowBatchEdit(true)}
                />
              </div>

              {/* Image Preview Panel */}
              <div className="lg:col-span-4 bg-gray-50 rounded-lg p-4 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Görsel Önizleme</h4>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(currentPage.confidence_score)}`}>
                    {getConfidenceLabel(currentPage.confidence_score)} ({currentPage.confidence_score.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex-1 bg-white rounded border border-gray-200 overflow-auto flex items-center justify-center">
                  <img
                    src={`${getApiBaseUrl()}${currentPage.image_url}`}
                    alt={`Page ${currentPage.page_number}`}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              {/* Text Editor Panel */}
              <div className="lg:col-span-5 bg-gray-50 rounded-lg p-4 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Metin Düzenle</h4>
                  {saveStatus === 'saved' && (
                    <span className="flex items-center text-sm text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Kaydedildi
                    </span>
                  )}
                  {saveStatus === 'saving' && (
                    <span className="flex items-center text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Kaydediliyor...
                    </span>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  value={editedTexts[currentPage.page_number] ?? currentPage.original_text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="OCR metni buraya yazın..."
                  aria-label={`Sayfa ${currentPage.page_number} OCR metni`}
                  aria-describedby="text-stats"
                />
                <div id="text-stats" className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span aria-label="Karakter sayısı">
                    {(editedTexts[currentPage.page_number] ?? currentPage.original_text).length} karakter
                  </span>
                  <span aria-label="Satır sayısı">
                    {(editedTexts[currentPage.page_number] ?? currentPage.original_text).split('\n').length} satır
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Sayfa bulunamadı</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            {/* Navigation */}
            <button
              onClick={handlePrevious}
              disabled={currentPageIndex === 0}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Önceki sayfa"
              title="Önceki sayfa (←)"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Önceki
            </button>
            <button
              onClick={handleSkip}
              disabled={currentPageIndex === pages.length - 1}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Sonraki sayfa"
              title="Sonraki sayfa (→)"
            >
              Sonraki
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Auto-continue checkbox */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoContinue}
                onChange={(e) => setAutoContinue(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Kalan sayfaları otomatik devam ettir
            </label>

            {/* Action buttons */}
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Değişiklikleri kaydet"
              title="Kaydet (Ctrl+S)"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                  Kaydet
                </>
              )}
            </button>

            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="btn btn-success disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Düzenlemeyi tamamla ve pipeline'ı devam ettir"
              title="Tamamla (Ctrl+Enter)"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Tamamlanıyor...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                  Düzenlemeyi Tamamla
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Batch Edit Modal */}
      {showBatchEdit && (
        <BatchEditModal
          documentId={documentId}
          selectedPages={getSelectedPagesData()}
          onClose={() => setShowBatchEdit(false)}
          onApply={handleBatchEditApply}
        />
      )}
    </div>
  );
}

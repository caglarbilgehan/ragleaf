import { useState, useMemo } from 'react';
import { X, Search, Replace, Eye, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/services/api';

interface OCRPage {
  document_id: number;
  page_number: number;
  original_text: string;
  confidence_score: number;
  image_url: string;
  status: string;
}

interface BatchEditModalProps {
  documentId: number;
  selectedPages: OCRPage[];
  onClose: () => void;
  onApply: (updatedTexts: Record<number, string>) => void;
}

interface PreviewChange {
  pageNumber: number;
  originalText: string;
  newText: string;
  matchCount: number;
}

export default function BatchEditModal({
  documentId,
  selectedPages,
  onClose,
  onApply,
}: BatchEditModalProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Calculate preview changes
  const previewChanges = useMemo((): PreviewChange[] => {
    if (!findText) return [];

    return selectedPages.map(page => {
      let matchCount = 0;
      let newText = page.original_text;

      try {
        if (useRegex) {
          const regex = new RegExp(findText, caseSensitive ? 'g' : 'gi');
          const matches = page.original_text.match(regex);
          matchCount = matches ? matches.length : 0;
          newText = page.original_text.replace(regex, replaceText);
        } else {
          const searchStr = caseSensitive ? findText : findText.toLowerCase();
          const textToSearch = caseSensitive ? page.original_text : page.original_text.toLowerCase();
          
          let pos = 0;
          while ((pos = textToSearch.indexOf(searchStr, pos)) !== -1) {
            matchCount++;
            pos += searchStr.length;
          }

          if (caseSensitive) {
            newText = page.original_text.split(findText).join(replaceText);
          } else {
            const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            newText = page.original_text.replace(regex, replaceText);
          }
        }
      } catch (e) {
        // Invalid regex
        matchCount = 0;
        newText = page.original_text;
      }

      return {
        pageNumber: page.page_number,
        originalText: page.original_text,
        newText,
        matchCount,
      };
    }).filter(change => change.matchCount > 0);
  }, [selectedPages, findText, replaceText, caseSensitive, useRegex]);

  const totalMatches = previewChanges.reduce((sum, c) => sum + c.matchCount, 0);
  const affectedPages = previewChanges.length;

  const handleApply = async () => {
    if (previewChanges.length === 0) return;

    setIsApplying(true);
    setError(null);

    try {
      const token = localStorage.getItem('ragleaf_token');
      const updatedTexts: Record<number, string> = {};

      // Save each page's edited text
      for (const change of previewChanges) {
        const response = await fetch(
          `${getApiBaseUrl()}/api/admin/documents/${documentId}/ocr-pages/${change.pageNumber}/edit`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ edited_text: change.newText })
          }
        );

        if (!response.ok) {
          throw new Error(`Sayfa ${change.pageNumber} kaydedilemedi`);
        }

        updatedTexts[change.pageNumber] = change.newText;
      }

      onApply(updatedTexts);
      onClose();
    } catch (err) {
      console.error('Error applying batch edit:', err);
      setError(err instanceof Error ? err.message : 'Toplu düzenleme uygulanırken hata oluştu.');
    } finally {
      setIsApplying(false);
    }
  };

  const highlightMatches = (text: string): string => {
    if (!findText) return text;

    try {
      const regex = useRegex
        ? new RegExp(`(${findText})`, caseSensitive ? 'g' : 'gi')
        : new RegExp(`(${findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, caseSensitive ? 'g' : 'gi');
      
      return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
    } catch {
      return text;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Toplu Düzenle</h3>
            <p className="text-sm text-gray-500">
              {selectedPages.length} sayfa seçildi
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Find and Replace Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Bul
              </label>
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Aranacak metin..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Replace className="h-4 w-4 inline mr-1" />
                Değiştir
              </label>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Yeni metin..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Büyük/küçük harf duyarlı
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Regex kullan
            </label>
          </div>

          {/* Match Summary */}
          {findText && (
            <div className={`p-4 rounded-lg ${totalMatches > 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {totalMatches > 0 ? (
                    <>
                      <strong>{totalMatches}</strong> eşleşme bulundu ({affectedPages} sayfada)
                    </>
                  ) : (
                    'Eşleşme bulunamadı'
                  )}
                </span>
                {totalMatches > 0 && (
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Eye className="h-4 w-4" />
                    {showPreview ? 'Önizlemeyi Gizle' : 'Önizleme'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Preview Changes */}
          {showPreview && previewChanges.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Değişiklik Önizlemesi</h4>
              <div className="max-h-64 overflow-y-auto space-y-3">
                {previewChanges.map((change) => (
                  <div key={change.pageNumber} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Sayfa {change.pageNumber}
                      </span>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        {change.matchCount} eşleşme
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Önceki:</span>
                        <div 
                          className="bg-red-50 p-2 rounded text-gray-700 max-h-24 overflow-y-auto font-mono text-xs"
                          dangerouslySetInnerHTML={{ __html: highlightMatches(change.originalText.substring(0, 500)) }}
                        />
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Sonraki:</span>
                        <div className="bg-green-50 p-2 rounded text-gray-700 max-h-24 overflow-y-auto font-mono text-xs">
                          {change.newText.substring(0, 500)}
                          {change.newText.length > 500 && '...'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleApply}
            disabled={totalMatches === 0 || isApplying}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uygulanıyor...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Değişiklikleri Uygula
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

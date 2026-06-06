import { useState } from 'react';
import { ChevronUp, ChevronDown, SortAsc, SortDesc, CheckSquare, Square, Layers } from 'lucide-react';
import QualityIndicator from './QualityIndicator';

interface OCRPage {
  document_id: number;
  page_number: number;
  original_text: string;
  confidence_score: number;
  image_url: string;
  status: string;
}

interface PageNavigatorProps {
  pages: OCRPage[];
  currentPage: number;
  onPageChange: (pageNumber: number) => void;
  sortBy?: 'page' | 'confidence';
  onSortChange?: (sortBy: 'page' | 'confidence') => void;
  // Batch selection props
  enableBatchSelect?: boolean;
  selectedPages?: number[];
  onSelectionChange?: (selectedPages: number[]) => void;
  onBatchEdit?: () => void;
}

export default function PageNavigator({
  pages,
  currentPage,
  onPageChange,
  sortBy = 'page',
  onSortChange,
  enableBatchSelect = false,
  selectedPages = [],
  onSelectionChange,
  onBatchEdit,
}: PageNavigatorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sortedPages = [...pages].sort((a, b) => {
    if (sortBy === 'confidence') {
      return a.confidence_score - b.confidence_score; // Lowest first
    }
    return a.page_number - b.page_number;
  });

  const currentIndex = sortedPages.findIndex(p => p.page_number === currentPage);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onPageChange(sortedPages[currentIndex - 1].page_number);
    }
  };

  const handleNext = () => {
    if (currentIndex < sortedPages.length - 1) {
      onPageChange(sortedPages[currentIndex + 1].page_number);
    }
  };

  const handleToggleSelect = (pageNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    
    if (selectedPages.includes(pageNumber)) {
      onSelectionChange(selectedPages.filter(p => p !== pageNumber));
    } else {
      onSelectionChange([...selectedPages, pageNumber]);
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedPages.length === pages.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(pages.map(p => p.page_number));
    }
  };

  const isAllSelected = selectedPages.length === pages.length && pages.length > 0;


  return (
    <div className="bg-dark-800/60 border border-white/[0.06] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-dark-700/50 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-dark-500 rounded">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {enableBatchSelect && (
            <button
              onClick={handleSelectAll}
              className="p-1 hover:bg-dark-500 rounded"
              title={isAllSelected ? 'Tümünü kaldır' : 'Tümünü seç'}
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : (
                <Square className="h-4 w-4 text-gray-400" />
              )}
            </button>
          )}
          <span className="font-medium text-sm text-gray-300">
            Sayfalar ({pages.length})
            {enableBatchSelect && selectedPages.length > 0 && (
              <span className="ml-1 text-blue-600">
                - {selectedPages.length} seçili
              </span>
            )}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {enableBatchSelect && selectedPages.length > 1 && onBatchEdit && (
            <button
              onClick={onBatchEdit}
              className="flex items-center gap-1 text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
            >
              <Layers className="h-3 w-3" />
              Toplu Düzenle
            </button>
          )}
          {onSortChange && (
            <button onClick={() => onSortChange(sortBy === 'page' ? 'confidence' : 'page')}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-100 px-2 py-1 rounded hover:bg-dark-500"
              title={sortBy === 'page' ? 'Kaliteye göre sırala' : 'Sayfa numarasına göre sırala'}>
              {sortBy === 'page' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
              {sortBy === 'page' ? 'Sayfa' : 'Kalite'}
            </button>
          )}
        </div>
      </div>

      {/* Page List */}
      {!isCollapsed && (
        <div className="max-h-64 overflow-y-auto">
          {sortedPages.map((page) => (
            <button key={page.page_number} onClick={() => onPageChange(page.page_number)}
              className={`w-full flex items-center justify-between p-3 text-left hover:bg-dark-700/50 border-b border-gray-100 last:border-b-0 transition-colors ${
                page.page_number === currentPage ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}>
              <div className="flex items-center gap-2">
                {enableBatchSelect && (
                  <div
                    onClick={(e) => handleToggleSelect(page.page_number, e)}
                    className="p-1 hover:bg-dark-500 rounded cursor-pointer"
                  >
                    {selectedPages.includes(page.page_number) ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                )}
                <span className={`text-sm ${page.page_number === currentPage ? 'font-semibold text-blue-700' : 'text-gray-300'}`}>
                  Sayfa {page.page_number}
                </span>
              </div>
              <QualityIndicator confidence={page.confidence_score} showLabel={false} showTooltip={false} size="sm" />
            </button>
          ))}
        </div>
      )}

      {/* Quick Navigation */}
      <div className="flex items-center justify-between p-2 bg-dark-700/50 border-t border-white/[0.06]">
        <button onClick={handlePrevious} disabled={currentIndex <= 0}
          className="px-3 py-1 text-sm bg-dark-800/60 border border-white/[0.1] rounded hover:bg-dark-700/50 disabled:opacity-50 disabled:cursor-not-allowed">
          ← Önceki
        </button>
        <span className="text-xs text-gray-500">
          {currentIndex + 1} / {pages.length}
        </span>
        <button onClick={handleNext} disabled={currentIndex >= sortedPages.length - 1}
          className="px-3 py-1 text-sm bg-dark-800/60 border border-white/[0.1] rounded hover:bg-dark-700/50 disabled:opacity-50 disabled:cursor-not-allowed">
          Sonraki →
        </button>
      </div>
    </div>
  );
}
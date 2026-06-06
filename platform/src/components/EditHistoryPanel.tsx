import { useState, useEffect } from 'react';
import { History, RotateCcw, Filter, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { getApiBaseUrl } from '@/services/api';

interface EditHistoryItem {
  id: number;
  page_number: number;
  original_text: string;
  edited_text: string;
  confidence_score: number | null;
  user_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EditHistoryPanelProps {
  documentId: number;
  onRevert?: (pageNumber: number) => void;
}

export default function EditHistoryPanel({ documentId, onRevert }: EditHistoryPanelProps) {
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPage, setFilterPage] = useState<number | null>(null);
  const [isReverting, setIsReverting] = useState<number | null>(null);

  useEffect(() => {
    loadHistory();
  }, [documentId]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(
        `${getApiBaseUrl()}/api/admin/documents/${documentId}/ocr-edits`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to load history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError('Düzenleme geçmişi yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleRevert = async (pageNumber: number) => {
    try {
      setIsReverting(pageNumber);
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(
        `${getApiBaseUrl()}/api/admin/documents/${documentId}/ocr-pages/${pageNumber}/revert`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to revert');
      await loadHistory();
      onRevert?.(pageNumber);
    } catch (err) {
      setError('Geri alma işlemi başarısız.');
    } finally {
      setIsReverting(null);
    }
  };

  const filteredHistory = filterPage ? history.filter(h => h.page_number === filterPage) : history;
  const uniquePages = [...new Set(history.map(h => h.page_number))].sort((a, b) => a - b);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('tr-TR');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-dark-800/60 rounded-lg border border-white/[0.06]">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-100">Düzenleme Geçmişi</h3>
          <span className="text-sm text-gray-500">({history.length} kayıt)</span>
        </div>
        {uniquePages.length > 1 && (
          <div className="relative">
            <select value={filterPage ?? ''} onChange={(e) => setFilterPage(e.target.value ? Number(e.target.value) : null)}
              className="pl-8 pr-4 py-1.5 text-sm border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">Tüm Sayfalar</option>
              {uniquePages.map(p => <option key={p} value={p}>Sayfa {p}</option>)}
            </select>
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>

      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Düzenleme geçmişi bulunamadı.</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {filteredHistory.map((item) => (
            <div key={item.id} className="p-4 hover:bg-dark-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-100">Sayfa {item.page_number}</span>
                <button onClick={() => handleRevert(item.page_number)} disabled={isReverting === item.page_number}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50">
                  {isReverting === item.page_number ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Geri Al
                </button>
              </div>
              <div className="text-xs text-gray-500 mb-2">{formatDate(item.updated_at || item.created_at)}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-red-50 rounded"><span className="text-red-600 font-medium">Orijinal:</span><p className="mt-1 text-gray-300 line-clamp-2">{item.original_text || '-'}</p></div>
                <div className="p-2 bg-green-50 rounded"><span className="text-green-600 font-medium">Düzenlenen:</span><p className="mt-1 text-gray-300 line-clamp-2">{item.edited_text}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Clock, User, CheckCircle, XCircle, Filter } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ActionHistory {
  id: number;
  action: string;
  user_name: string;
  result: 'success' | 'failure';
  duration_ms?: number;
  error_message?: string;
  created_at: string;
}

interface ActionHistoryPanelProps {
  documentId: number;
}

const ActionHistoryPanel: React.FC<ActionHistoryPanelProps> = ({ documentId }) => {
  const [history, setHistory] = useState<ActionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchHistory();
  }, [documentId, filterAction]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/admin/documents/${documentId}/actions`,
        {
          params: {
            action: filterAction === 'all' ? undefined : filterAction,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('ragleaf_token')}`,
          },
        }
      );
      setHistory(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch action history');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      process: 'İşle',
      index: 'İndeksle',
      reindex: 'Yeniden İndeksle',
      reset: 'Sıfırla',
      retry: 'Yeniden Dene',
    };
    return labels[action] || action;
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Pagination
  const totalPages = Math.ceil(history.length / itemsPerPage);
  const paginatedHistory = history.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchHistory}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-sm border border-white/[0.1] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tüm İşlemler</option>
          <option value="process">İşle</option>
          <option value="index">İndeksle</option>
          <option value="reindex">Yeniden İndeksle</option>
          <option value="reset">Sıfırla</option>
          <option value="retry">Yeniden Dene</option>
        </select>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Henüz işlem geçmişi yok
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedHistory.map((item) => (
              <div
                key={item.id}
                className="border border-white/[0.06] rounded-lg p-4 hover:bg-dark-700/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {item.result === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-100">
                          {getActionLabel(item.action)}
                        </span>
                        {item.result === 'success' && item.duration_ms && (
                          <span className="text-xs text-gray-500">
                            ({formatDuration(item.duration_ms)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {item.user_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.created_at)}
                        </div>
                      </div>
                      {item.result === 'failure' && item.error_message && (
                        <div className="mt-2 text-sm text-red-600">
                          {item.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <div className="text-sm text-gray-600">
                Sayfa {currentPage} / {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-md hover:bg-dark-700/50 disabled:bg-dark-600 disabled:cursor-not-allowed"
                >
                  Önceki
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-md hover:bg-dark-700/50 disabled:bg-dark-600 disabled:cursor-not-allowed"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActionHistoryPanel;

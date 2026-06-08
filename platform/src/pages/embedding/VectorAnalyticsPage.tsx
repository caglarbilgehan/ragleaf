import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface VectorStoreAnalyticsResponse {
  chroma_stats: {
    total_chunks?: number;
    collection_name?: string;
    disk_path?: string;
    disk_usage_mb?: number;
    last_persist?: string;
    error?: string;
  };
  faiss_stats: {
    total_vectors?: number;
    dimension?: number;
    index_type?: string;
    memory_usage_mb?: number;
    disk_path?: string;
    is_trained?: boolean;
    error?: string;
  };
  sync_status: {
    chroma_count: number;
    faiss_count: number;
    difference: number;
    is_synced: boolean;
  };
}

const VectorAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<VectorStoreAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await api.get<VectorStoreAnalyticsResponse>(
        '/api/admin/embedding/vectorstore/analytics'
      );

      setAnalytics(response.data);
    } catch (error: any) {
      console.error('Analytics fetch error:', error);
      toast.error('Analytics verisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (mb: number | undefined): string => {
    if (!mb) return '0 MB';
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="w-full">
      <div className="w-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Vector Store Analytics</h1>
            <p className="mt-2 text-gray-600">
              Chroma ve FAISS vector store'larınızın detaylı analizi
            </p>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <svg
              className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Yenile
          </button>
        </div>

        {loading && !analytics ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          </div>
        ) : analytics ? (
          <>
            {/* Sync Status */}
            <div className="bg-dark-800/60 rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Senkronizasyon Durumu</h2>

              <div
                className={`flex items-center gap-3 p-4 rounded-lg ${
                  analytics.sync_status.is_synced
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <div className="text-3xl">
                  {analytics.sync_status.is_synced ? '✓' : '⚠'}
                </div>
                <div className="flex-1">
                  <p
                    className={`font-semibold ${analytics.sync_status.is_synced ? 'text-green-900' : 'text-yellow-900'}`}
                  >
                    {analytics.sync_status.is_synced ? 'Senkron' : 'Senkronize Değil'}
                  </p>
                  <p
                    className={`text-sm ${analytics.sync_status.is_synced ? 'text-green-700' : 'text-yellow-700'}`}
                  >
                    Chroma: {analytics.sync_status.chroma_count.toLocaleString()} | FAISS:{' '}
                    {analytics.sync_status.faiss_count.toLocaleString()} | Fark:{' '}
                    {analytics.sync_status.difference}
                  </p>
                </div>
              </div>
            </div>

            {/* Chroma and FAISS Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Chroma Analytics */}
              <div className="bg-dark-800/60 rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-purple-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold">Chroma Vector Store</h2>
                </div>

                {analytics.chroma_stats.error ? (
                  <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                    Error: {analytics.chroma_stats.error}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-dark-700/50 rounded-lg">
                      <span className="text-gray-600">Toplam Chunk</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {analytics.chroma_stats.total_chunks?.toLocaleString() || 0}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Koleksiyon:</span>
                        <span className="font-medium">{analytics.chroma_stats.collection_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Disk Kullanımı:</span>
                        <span className="font-medium">
                          {formatBytes(analytics.chroma_stats.disk_usage_mb)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dizin:</span>
                        <span className="font-mono text-xs text-gray-500 truncate max-w-[200px]">
                          {analytics.chroma_stats.disk_path}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* FAISS Analytics */}
              <div className="bg-dark-800/60 rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold">FAISS Index</h2>
                </div>

                {analytics.faiss_stats.error ? (
                  <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                    Error: {analytics.faiss_stats.error}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-dark-700/50 rounded-lg">
                      <span className="text-gray-600">Toplam Vector</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {analytics.faiss_stats.total_vectors?.toLocaleString() || 0}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Index Tipi:</span>
                        <span className="font-medium">{analytics.faiss_stats.index_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dimension:</span>
                        <span className="font-medium">{analytics.faiss_stats.dimension}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bellek Kullanımı:</span>
                        <span className="font-medium">
                          {formatBytes(analytics.faiss_stats.memory_usage_mb)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Eğitim Durumu:</span>
                        <span
                          className={`font-medium ${analytics.faiss_stats.is_trained ? 'text-green-600' : 'text-gray-500'}`}
                        >
                          {analytics.faiss_stats.is_trained ? 'Eğitildi' : 'Eğitilmedi'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Information */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">Toplam Chunk</h3>
                <p className="text-4xl font-bold text-purple-600">
                  {analytics.chroma_stats.total_chunks?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-purple-700 mt-2">Chroma'da saklanan</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Toplam Vector</h3>
                <p className="text-4xl font-bold text-blue-600">
                  {analytics.faiss_stats.total_vectors?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-blue-700 mt-2">FAISS index'te</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Bellek Kullanımı</h3>
                <p className="text-4xl font-bold text-green-600">
                  {formatBytes(analytics.faiss_stats.memory_usage_mb)}
                </p>
                <p className="text-sm text-green-700 mt-2">FAISS in-memory</p>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-dark-800/60 rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">Analytics verisi yüklenemedi</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VectorAnalyticsPage;

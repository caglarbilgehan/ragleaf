import { useQuery } from 'react-query';
import { Database, RefreshCw, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { adminApi } from '@/services/api';

export default function VectorStoreStatusCard() {
  const { data: status, isLoading, refetch } = useQuery(
    'vectorstore-status',
    () => adminApi.getVectorStoreStatus(),
    {
      refetchInterval: 30000,
    }
  );

  const { data: health } = useQuery(
    'vectorstore-health',
    () => adminApi.getVectorStoreHealth(),
    {
      refetchInterval: 30000,
    }
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!status?.success) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Vector Store Durumu Alınamadı</h3>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          PgVector durumu kontrol edilemedi.
        </p>
      </div>
    );
  }

  const statusData = status.status;
  const healthStatus = health?.overall_status || 'unknown';

  const getHealthColor = () => {
    switch (healthStatus) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthIcon = () => {
    switch (healthStatus) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5" />;
      case 'warning':
      case 'unhealthy':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Database className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Vector Store Durumu
              </h3>
              <p className="text-sm text-gray-600">
                PgVector (PostgreSQL)
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Yenile"
          >
            <RefreshCw className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`px-6 py-4 border-b border-gray-200 ${getHealthColor()}`}>
          <div className="flex items-center space-x-2">
            {getHealthIcon()}
            <span className="font-semibold">
              Genel Durum: {healthStatus === 'healthy' ? 'Sağlıklı' : healthStatus === 'warning' ? 'Uyarı' : 'Sorunlu'}
            </span>
          </div>
          {health.warnings && health.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {health.warnings.map((warning: string, idx: number) => (
                <p key={idx} className="text-sm">⚠️ {warning}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="p-6">
        {/* PgVector Status */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">PgVector (PostgreSQL)</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">Toplam Vektör</p>
              <p className="text-2xl font-bold text-blue-700">
                {(statusData.pgvector?.vector_count || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600">Döküman Sayısı</p>
              <p className="text-2xl font-bold text-purple-700">
                {(statusData.pgvector?.document_count || statusData.document_count || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Info */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Embedding Model:</p>
            <p className="font-semibold text-gray-900 truncate" title={statusData.embedding_model}>
              {statusData.embedding_model?.split('/').pop() || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Vektör Boyutu:</p>
            <p className="font-semibold text-gray-900">{statusData.vector_dim || 768}</p>
          </div>
          <div>
            <p className="text-gray-600">Chunk Size:</p>
            <p className="font-semibold text-gray-900">{statusData.chunk_size || 750}</p>
          </div>
          <div>
            <p className="text-gray-600">Index Tipi:</p>
            <p className="font-semibold text-gray-900">HNSW</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <div className="bg-dark-800/60 rounded-lg  border border-white/[0.06] p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-dark-500 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-dark-500 rounded"></div>
            <div className="h-4 bg-dark-500 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!status?.success) {
    return (
      <div className="bg-dark-800/60 rounded-lg  border border-red-500/20 p-6">
        <div className="flex items-center space-x-2 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Vector Store Durumu Alınamadı</h3>
        </div>
        <p className="text-sm text-gray-400 mt-2">
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
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'unhealthy':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-400 bg-dark-700/50 border-white/[0.06]';
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
    <div className="bg-dark-800/60 rounded-lg  border border-white/[0.06]">
      {/* Header */}
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <Database className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                Vector Store Durumu
              </h3>
              <p className="text-sm text-gray-400">
                PgVector (PostgreSQL)
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-dark-600 rounded-lg transition-colors"
            title="Yenile"
          >
            <RefreshCw className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`px-6 py-4 border-b border-white/[0.06] ${getHealthColor()}`}>
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
            <Database className="h-5 w-5 text-blue-400" />
            <h4 className="font-semibold text-gray-100">PgVector (PostgreSQL)</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-sm text-blue-400">Toplam Vektör</p>
              <p className="text-2xl font-bold text-blue-300">
                {(statusData.pgvector?.vector_count || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <p className="text-sm text-purple-400">Döküman Sayısı</p>
              <p className="text-2xl font-bold text-purple-300">
                {(statusData.pgvector?.document_count || statusData.document_count || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Info */}
      <div className="px-6 py-4 bg-dark-700/50 border-t border-white/[0.06]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Embedding Model:</p>
            <p className="font-semibold text-gray-100 truncate" title={statusData.embedding_model}>
              {statusData.embedding_model?.split('/').pop() || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Vektör Boyutu:</p>
            <p className="font-semibold text-gray-100">{statusData.vector_dim || 768}</p>
          </div>
          <div>
            <p className="text-gray-400">Chunk Size:</p>
            <p className="font-semibold text-gray-100">{statusData.chunk_size || 750}</p>
          </div>
          <div>
            <p className="text-gray-400">Index Tipi:</p>
            <p className="font-semibold text-gray-100">HNSW</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { EmbeddingConfigTab } from '@/components/EmbeddingConfigTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, Settings, Trash2, Loader2 } from 'lucide-react';

interface ModelCacheInfo {
  id: number;  // Database ID
  model_id: string;
  display_name: string;
  is_downloaded: boolean;
  estimated_size_gb: number;
  actual_size_gb: number | null;
  last_used: string | null;
}

interface DiskUsageResponse {
  total_gb: number;
  used_gb: number;
  free_gb: number;
  models: ModelCacheInfo[];
}

interface DownloadProgress {
  model_id: string;
  progress: number;
  status: string;
  downloaded_mb?: number;
  total_mb?: number;
  speed_mbps?: number;
}

const EmbeddingModelsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cache');
  const [diskUsage, setDiskUsage] = useState<DiskUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingModel, setDeletingModel] = useState<number | null>(null);
  const [downloadingModels, setDownloadingModels] = useState<Set<number>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // Check for active downloads
  const checkActiveDownloads = async () => {
    try {
      const response = await api.get('/api/admin/embedding/models/download/active');
      const activeDownloads = response.data.active_downloads;
      
      const activeDbIds = new Set<number>();
      for (const modelId in activeDownloads) {
        const download = activeDownloads[modelId];
        if (download.db_id) {
          activeDbIds.add(download.db_id);
        }
      }
      setDownloadingModels(activeDbIds);
      
      return activeDbIds.size > 0;
    } catch (error) {
      console.error('Error checking active downloads:', error);
      return false;
    }
  };

  const fetchDiskUsage = async () => {
    setLoading(true);
    try {
      const response = await api.get<DiskUsageResponse>(
        '/api/admin/embedding/models/cache/disk-usage'
      );

      setDiskUsage(response.data);
    } catch (error: any) {
      console.error('Disk usage fetch error:', error);
      toast.error('Disk kullanımı bilgisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiskUsage();
    checkActiveDownloads();
    
    // Poll for active downloads every 2 seconds
    const pollInterval = setInterval(async () => {
      const hasActive = await checkActiveDownloads();
      if (hasActive) {
        // Refresh disk usage to get updated status
        fetchDiskUsage();
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, []);

  const handleDownloadModel = async (modelDbId: number) => {
    // Add to downloading set
    setDownloadingModels(prev => new Set(prev).add(modelDbId));
    toast.loading('Model indirme başlatılıyor...', { id: `download-${modelDbId}` });
    
    try {
      // Model indirme için backend'e istek gönder
      await api.post(`/api/admin/embedding/models/download/${modelDbId}`);

      // İndirme başlatıldı mesajı
      toast.success('Model indirme başlatıldı!', { id: `download-${modelDbId}` });
      
      // Polling will handle the rest - no need to manually remove from set

    } catch (error: any) {
      console.error('Model download error:', error);
      toast.error(error.response?.data?.detail || 'Model indirilemedi', { id: `download-${modelDbId}` });
      // Remove from downloading set on error
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelDbId);
        return newSet;
      });
    }
  };

  const handleDeleteModel = async (modelDbId: number, displayName: string) => {
    if (!confirm(`${displayName} modelini silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setDeletingModel(modelDbId);
    try {
      const response = await api.delete(
        `/api/admin/embedding/models/cache/${modelDbId}`
      );

      toast.success(response.data.message);
      fetchDiskUsage(); // Refresh
    } catch (error: any) {
      console.error('Model delete error:', error);
      toast.error(error.response?.data?.detail || 'Model silinemedi');
    } finally {
      setDeletingModel(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Kullanılmadı';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const diskUsagePercentage =
    diskUsage ? ((diskUsage.used_gb / diskUsage.total_gb) * 100).toFixed(1) : 0;

  const downloadedModels = diskUsage?.models.filter((m) => m.is_downloaded) || [];
  const totalDownloadedSize = downloadedModels.reduce((sum, m) => sum + (m.actual_size_gb || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Embedding Modelleri</h1>
          <p className="mt-2 text-gray-600">
            Embedding modellerini indirin, silin ve yapılandırın
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cache" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Model İndirme ve Yönetimi
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Embedding Modeli Seçimi
            </TabsTrigger>
          </TabsList>

          {/* Model Cache Tab */}
          <TabsContent value="cache" className="space-y-6">
            {/* Download Progress */}
            {downloadProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {downloadProgress.model_id} İndiriliyor
                    </h3>
                    <p className="text-sm text-gray-600">{downloadProgress.status}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {downloadProgress.progress.toFixed(0)}%
                    </div>
                    {downloadProgress.speed_mbps && (
                      <div className="text-sm text-gray-600">
                        {downloadProgress.speed_mbps.toFixed(1)} MB/s
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.progress}%` }}
                  ></div>
                </div>
                
                {/* Download Details */}
                {downloadProgress.downloaded_mb && downloadProgress.total_mb && (
                  <div className="text-sm text-gray-600 text-center">
                    {downloadProgress.downloaded_mb.toFixed(1)} MB / {downloadProgress.total_mb.toFixed(1)} MB
                  </div>
                )}
              </div>
            )}

            {/* Disk Usage Overview */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Disk Kullanımı</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : diskUsage ? (
            <div>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    {diskUsage.used_gb.toFixed(1)} GB / {diskUsage.total_gb.toFixed(1)} GB kullanıldı
                  </span>
                  <span className="font-medium">{diskUsagePercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      Number(diskUsagePercentage) > 80
                        ? 'bg-red-600'
                        : Number(diskUsagePercentage) > 60
                        ? 'bg-yellow-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${diskUsagePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">Toplam Alan</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {diskUsage.total_gb.toFixed(1)} GB
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium">Boş Alan</p>
                  <p className="text-2xl font-bold text-green-900">
                    {diskUsage.free_gb.toFixed(1)} GB
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-600 font-medium">Model Cache</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {totalDownloadedSize.toFixed(1)} GB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Disk bilgisi yüklenemedi</p>
          )}
        </div>

        {/* Models List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Embedding Modelleri</h2>
          </div>

          {diskUsage && diskUsage.models.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Boyut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Son Kullanım
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {diskUsage.models.map((model) => (
                    <tr key={model.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{model.display_name}</div>
                        <div className="text-xs text-gray-500">{model.model_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {model.is_downloaded ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            ✓ İndirildi
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            ○ İndirilmemiş
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {model.is_downloaded
                          ? `${model.actual_size_gb?.toFixed(2)} GB`
                          : `~${model.estimated_size_gb.toFixed(2)} GB (tahmini)`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(model.last_used)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {model.is_downloaded ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteModel(model.id, model.display_name)}
                            disabled={deletingModel === model.id}
                          >
                            {deletingModel === model.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Siliniyor...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Sil
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadModel(model.id)}
                            disabled={downloadingModels.has(model.id)}
                          >
                            {downloadingModels.has(model.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                İndiriliyor...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                İndir
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">Model bilgisi bulunamadı</p>
            </div>
          )}
        </div>

            {/* Refresh Button */}
            <div className="flex justify-end">
              <button
                onClick={fetchDiskUsage}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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
          </TabsContent>

          {/* Embedding Configuration Tab */}
          <TabsContent value="config" className="space-y-6">
            <EmbeddingConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EmbeddingModelsPage;

/**
 * Embedding Configuration Tab
 * Manages embedding models in the admin panel
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Star, Check, X, Zap, Activity, Info, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  listEmbeddingModels,
  getStatsOverview,
  setDefaultModel,
  checkModelCompatibility,
  testEncode,
  type EmbeddingModel,
  type StatsOverview,
  type ModelCompatibilityCheck,
} from '@/services/embeddingModelsApi';

export const EmbeddingConfigTab: React.FC = () => {
  const [models, setModels] = useState<EmbeddingModel[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [changingDefault, setChangingDefault] = useState<string | null>(null);
  const [compatibilityCheck, setCompatibilityCheck] = useState<ModelCompatibilityCheck | null>(null);
  const [pendingModelChange, setPendingModelChange] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [modelsData, statsData] = await Promise.all([
        listEmbeddingModels(),
        getStatsOverview(),
      ]);
      setModels(modelsData.models);
      setStats(statsData);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle set default model - first check compatibility
  const handleSetDefault = async (modelId: string) => {
    try {
      setChangingDefault(modelId);
      setError(null);
      setSuccess(null);

      // First check compatibility
      const compatibility = await checkModelCompatibility(modelId);
      setCompatibilityCheck(compatibility);

      if (compatibility.requires_reset) {
        // Show confirmation dialog
        setPendingModelChange(modelId);
        setShowConfirmDialog(true);
        setChangingDefault(null);
        return;
      }

      // If compatible, proceed directly
      await proceedWithModelChange(modelId, false);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Uyumluluk kontrolü başarısız');
      setChangingDefault(null);
    }
  };

  // Proceed with model change after confirmation
  const proceedWithModelChange = async (modelId: string, autoReset: boolean) => {
    try {
      setChangingDefault(modelId);
      setError(null);

      const result = await setDefaultModel(modelId, autoReset);
      
      if (result.reset_performed) {
        setSuccess(
          `✅ ${result.message}\n\n🔄 Vektör veritabanı sıfırlandı. ${result.affected_documents} döküman yeniden işlenmeyi bekliyor.`
        );
      } else if (result.requires_reindex) {
        setSuccess(
          `${result.message} ⚠️ ${result.affected_documents} doküman yeniden indekslenmelidir.`
        );
      } else {
        setSuccess(result.message);
      }

      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Varsayılan model ayarlanamadı');
    } finally {
      setChangingDefault(null);
      setShowConfirmDialog(false);
      setPendingModelChange(null);
      setCompatibilityCheck(null);
    }
  };

  // Cancel model change
  const cancelModelChange = () => {
    setShowConfirmDialog(false);
    setPendingModelChange(null);
    setCompatibilityCheck(null);
  };

  // Handle test encode
  const handleTestEncode = async (modelId: string) => {
    try {
      setTestingModel(modelId);
      setError(null);
      setSuccess(null);

      const result = await testEncode(modelId, 'Test embedding metni');
      setSuccess(
        `✅ Test başarılı! Boyut: ${result.embedding_dimension}, Süre: ${result.elapsed_time_ms}ms`
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Test başarısız');
    } finally {
      setTestingModel(null);
    }
  };

  // Get performance tier badge
  const getPerformanceBadge = (tier: string) => {
    const config: Record<string, { label: string; icon: any }> = {
      fast: { label: 'Hızlı', icon: Zap },
      balanced: { label: 'Dengeli', icon: Activity },
      best: { label: 'En İyi', icon: Star },
    };
    const { label, icon: Icon } = config[tier] || config.balanced;
    return (
      <Badge variant="secondary" className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Toplam Model</CardDescription>
              <CardTitle className="text-3xl">{stats.models.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Varsayılan Model</CardDescription>
              <CardTitle className="text-lg text-green-600 truncate" title={stats.models.default || 'Belirlenmedi'}>
                {stats.models.default ? stats.models.default.split('/').pop() : 'Belirlenmedi'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Lokal / Uzak</CardDescription>
              <CardTitle className="text-3xl">
                {stats.models.local} / {stats.models.remote}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Embedding ile Doküman</CardDescription>
              <CardTitle className="text-3xl">{stats.documents.with_embedding}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Model Change Confirmation Dialog */}
      {showConfirmDialog && compatibilityCheck && pendingModelChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Embedding Modeli Değişikliği
              </h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-700">{compatibilityCheck.reason}</p>
              
              {compatibilityCheck.old_model && compatibilityCheck.new_model && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mevcut Model:</span>
                    <span className="font-medium">{compatibilityCheck.old_model.display_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mevcut Boyut:</span>
                    <span className="font-medium">{compatibilityCheck.old_model.dimension} vektör</span>
                  </div>
                  <div className="border-t my-2"></div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Yeni Model:</span>
                    <span className="font-medium text-blue-600">{compatibilityCheck.new_model.display_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Yeni Boyut:</span>
                    <span className="font-medium text-blue-600">{compatibilityCheck.new_model.dimension} vektör</span>
                  </div>
                </div>
              )}
              
              <Alert className="border-yellow-500 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  <strong>⚠️ Dikkat:</strong> Bu işlem şunları yapacak:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>PgVector vektör veritabanı sıfırlanacak</li>
                    <li>Tüm döküman vektörleri silinecek</li>
                    <li>Tüm dökümanlar "yüklendi" durumuna sıfırlanacak</li>
                    <li>Dökümanların yeniden işlenmesi gerekecek</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={cancelModelChange}
                disabled={changingDefault !== null}
              >
                İptal
              </Button>
              <Button
                variant="default"
                className="bg-yellow-600 hover:bg-yellow-700"
                onClick={() => proceedWithModelChange(pendingModelChange, true)}
                disabled={changingDefault !== null}
              >
                {changingDefault ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  'Onayla ve Sıfırla'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50">
          <AlertDescription className="text-green-800 whitespace-pre-line">{success}</AlertDescription>
        </Alert>
      )}

      {/* Models List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Embedding Modelleri</CardTitle>
              <CardDescription>
                Doküman işleme için kullanılacak embedding modellerini yönetin
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Yenile
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {models.filter(model => model.is_downloaded).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">Henüz indirilmiş model yok</p>
                <p className="text-sm">Model İndirme ve Yönetimi sekmesinden model indirebilirsiniz</p>
              </div>
            ) : (
              models.filter(model => model.is_downloaded).map((model) => (
              <Card key={model.id} className={model.is_default ? 'border-yellow-400 border-2' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {model.is_default && (
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        )}
                        <h3 className="text-lg font-semibold">{model.display_name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{model.model_id}</p>
                      {model.description && (
                        <p className="text-sm text-muted-foreground mb-3">{model.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" title="Vektör Boyutu">🔢 {model.dimension} vektör</Badge>
                        <Badge variant={model.deployment_type === 'local' ? 'default' : 'secondary'}>
                          {model.deployment_type === 'local' ? '💻 Lokal' : '☁️ Uzak'}
                        </Badge>
                        {getPerformanceBadge(model.performance_tier)}
                        {model.is_active ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <X className="h-3 w-3" />
                            Pasif
                          </Badge>
                        )}
                        {model.multilingual && (
                          <Badge variant="outline" className="text-xs">
                            🌍 Çok Dilli
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      {!model.is_default && model.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetDefault(model.model_id)}
                          disabled={changingDefault !== null}
                        >
                          {changingDefault === model.model_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Varsayılan Yap'
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleTestEncode(model.model_id)}
                        disabled={testingModel !== null}
                      >
                        {testingModel === model.model_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Test Et'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )))}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Bilgi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            • <strong>Varsayılan Model:</strong> Yeni dokümanlar için kullanılacak model
          </p>
          <p>
            • <strong>Lokal Modeller:</strong> Sunucuda çalışır, API key gerektirmez
          </p>
          <p>
            • <strong>Uzak Modeller:</strong> API üzerinden çalışır (gelecekte eklenecek)
          </p>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="font-semibold text-blue-800 mb-2">🔢 Vektör Boyutu Nedir?</p>
            <p className="text-blue-700 text-xs">
              Embedding modeli, metni sayısal bir vektöre (dizi) dönüştürür. 
              <strong> 768 vektör</strong> = metin 768 adet sayı ile temsil edilir.
            </p>
            <p className="text-blue-700 text-xs mt-1">
              Bu sayılar metnin anlamsal özelliklerini içerir ve benzer metinlerin vektörleri birbirine yakın olur.
            </p>
            <p className="text-blue-600 text-xs mt-2">
              <strong>Örnek:</strong> "Merhaba" → [0.12, -0.45, 0.78, ... 768 sayı]
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

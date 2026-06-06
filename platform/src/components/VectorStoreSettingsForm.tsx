import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Database,
  FileText,
  RefreshCw,
  Save,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info,
  TestTube,
  Loader2,
  Zap
} from 'lucide-react';
import { adminApi } from '@/services/api';
import toast from 'react-hot-toast';

interface VectorStoreSettings {
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  collection_name: string;
  reranker_model: string | null;
  reranker_enabled: boolean;
}

interface EmbeddingModel {
  model_id: string;
  display_name: string;
  dimensions: number;
  description: string;
  recommended: boolean;
}

interface RerankerModel {
  model_id: string;
  display_name: string;
  description: string;
  recommended: boolean;
  max_length: number;
}

export default function VectorStoreSettingsForm() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<VectorStoreSettings | null>(null);
  const [testingModel, setTestingModel] = useState<string | null>(null);

  // Fetch current settings
  const { isLoading } = useQuery(
    'vectorstore-settings',
    () => adminApi.getVectorStoreSettings(),
    {
      onSuccess: (data) => {
        setSettings(data);
      }
    }
  );

  // Fetch available embedding models
  const { data: embeddingModels } = useQuery<EmbeddingModel[]>(
    'embedding-models',
    () => adminApi.getEmbeddingModels()
  );

  // Fetch available reranker models
  const { data: rerankerModels } = useQuery<RerankerModel[]>(
    'reranker-models',
    () => adminApi.getRerankerModels()
  );

  // Update settings mutation
  const updateMutation = useMutation(
    (newSettings: VectorStoreSettings) => adminApi.updateVectorStoreSettings(newSettings),
    {
      onSuccess: (response) => {
        toast.success(response.message);
        if (response.requires_rebuild) {
          toast.error(
            'Embedding modeli veya chunk parametreleri değişti - dökümanları yeniden indekslemeniz gerekebilir!',
            { duration: 5000 }
          );
        }
        queryClient.invalidateQueries('vectorstore-settings');
        queryClient.invalidateQueries('vectorstore-status');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Ayarlar güncellenemedi');
      }
    }
  );

  // Reset settings mutation
  const resetMutation = useMutation(
    () => adminApi.resetVectorStoreSettings(),
    {
      onSuccess: (response) => {
        toast.success(response.message);
        setSettings(response.settings);
        queryClient.invalidateQueries('vectorstore-settings');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Ayarlar sıfırlanamadı');
      }
    }
  );

  // Test embedding model
  const handleTestModel = async (modelId: string) => {
    try {
      setTestingModel(modelId);
      const result = await adminApi.testEmbeddingModel(modelId);

      if (result.success) {
        toast.success(
          `Model test başarılı! Boyut: ${result.vector_dimensions}, Süre: ${result.encoding_time_ms}ms`,
          { duration: 4000 }
        );
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Model test edilemedi');
    } finally {
      setTestingModel(null);
    }
  };

  const handleSave = () => {
    if (settings) {
      updateMutation.mutate(settings);
    }
  };

  const handleReset = () => {
    if (confirm('Tüm ayarları varsayılan değerlere sıfırlamak istediğinizden emin misiniz?')) {
      resetMutation.mutate();
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Ayarlar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              PgVector Ayarları
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Embedding modeli, chunk parametreleri ve vector store yapılandırması
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetMutation.isLoading}
              className="flex items-center gap-2"
            >
              {resetMutation.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Sıfırla
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {updateMutation.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Kaydet
            </Button>
          </div>
        </div>
      </div>

      {/* Embedding Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Embedding Modeli
          </CardTitle>
          <CardDescription>
            Dökümanların vektörel temsilini oluşturmak için kullanılacak model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {embeddingModels?.map((model) => (
              <div
                key={model.model_id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  settings.embedding_model === model.model_id
                    ? 'border-blue-500 bg-blue-50 '
                    : 'border-white/[0.06] hover:border-white/[0.1]'
                }`}
                onClick={() => setSettings({ ...settings, embedding_model: model.model_id })}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-100">{model.display_name}</h4>
                      {model.recommended && (
                        <Badge className="bg-green-100 text-green-800">Önerilen</Badge>
                      )}
                      {settings.embedding_model === model.model_id && (
                        <Badge className="bg-blue-100 text-blue-800">Seçili</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Model ID: <code className="bg-dark-600 px-1 rounded">{model.model_id}</code>
                      {' · '}
                      Boyut: {model.dimensions}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestModel(model.model_id);
                    }}
                    disabled={testingModel === model.model_id}
                    className="ml-4"
                  >
                    {testingModel === model.model_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Önemli:</strong> Embedding modelini değiştirdiğinizde, mevcut dökümanları
              yeniden indekslemeniz gerekir. Aksi takdirde farklı boyutlu vektörler sorun yaratır.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Chunking Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Chunk Parametreleri
          </CardTitle>
          <CardDescription>
            Dökümanların parçalanması için boyut ve overlap ayarları
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chunk_size">Chunk Boyutu (karakterler)</Label>
              <Input
                id="chunk_size"
                type="number"
                min="100"
                max="2000"
                value={settings.chunk_size}
                onChange={(e) => setSettings({ ...settings, chunk_size: parseInt(e.target.value) || 750 })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Önerilen: 500-1000 arası (varsayılan: 750)
              </p>
            </div>
            <div>
              <Label htmlFor="chunk_overlap">Overlap (karakterler)</Label>
              <Input
                id="chunk_overlap"
                type="number"
                min="0"
                max="500"
                value={settings.chunk_overlap}
                onChange={(e) => setSettings({ ...settings, chunk_overlap: parseInt(e.target.value) || 100 })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Önerilen: chunk_size'ın %10-20'si (varsayılan: 100)
              </p>
            </div>
          </div>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Chunk parametrelerini değiştirdiğinizde, mevcut dökümanlar için yeniden işleme gerekebilir.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Reranker Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            Reranker (İsteğe Bağlı)
          </CardTitle>
          <CardDescription>
            Arama sonuçlarını yeniden sıralamak için reranker model kullanımı
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-100">Reranker Kullan</h4>
              <p className="text-sm text-gray-600">
                Arama sonuçlarının kalitesini artırmak için reranking aktif et
              </p>
            </div>
            <Switch
              checked={settings.reranker_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, reranker_enabled: checked })}
            />
          </div>

          {settings.reranker_enabled && (
            <div className="space-y-3">
              <Label>Reranker Modeli Seçin</Label>
              {rerankerModels?.map((model) => (
                <div
                  key={model.model_id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    settings.reranker_model === model.model_id
                      ? 'border-green-500 bg-green-50 '
                      : 'border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                  onClick={() => setSettings({ ...settings, reranker_model: model.model_id })}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-100">{model.display_name}</h4>
                        {model.recommended && (
                          <Badge className="bg-green-100 text-green-800">Önerilen</Badge>
                        )}
                        {settings.reranker_model === model.model_id && (
                          <Badge className="bg-green-100 text-green-800">Seçili</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Model ID: <code className="bg-dark-600 px-1 rounded">{model.model_id}</code>
                        {' · '}
                        Max Length: {model.max_length}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Reranker, ilk retrieval sonuçlarını daha akıllıca yeniden sıralar.
              Daha yüksek doğruluk için önerilir, ancak ek hesaplama gerektirir.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Yapılandırma Notları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Ayarlar veritabanında saklanır ve sistem yeniden başlatıldığında korunur</p>
          <p>• Embedding modeli değişikliği sonrası dökümanları yeniden indekslemeniz gerekir</p>
          <p>• Chunk parametrelerini değiştirdikten sonra yeni dökümanlar yeni ayarları kullanır</p>
          <p>• Reranker ek kaynak kullanır ama arama kalitesini %15-20 artırır</p>
          <p>• PgVector (PostgreSQL) HNSW index kullanır - hızlı ve ölçeklenebilir</p>
        </CardContent>
      </Card>
    </div>
  );
}

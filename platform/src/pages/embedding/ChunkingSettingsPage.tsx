import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  FileText,
  Save,
  RefreshCw,
  Info,
  Layers
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface ChunkingConfig {
  max_memory_mb: number;
  batch_size: number;
  chunk_size: number;
  overlap: number;
}

const ChunkingSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<ChunkingConfig>({
    max_memory_mb: 512,
    batch_size: 9,
    chunk_size: 500,
    overlap: 100
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/settings/chunking_settings');
      if (response.data) {
        setConfig(response.data);
      }
    } catch (error) {
      console.error('Error fetching chunking config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/api/admin/settings/chunking_settings', config);
      toast.success('Chunking ayarları kaydedildi');
    } catch (error) {
      toast.error('Ayarlar kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Chunking Ayarları</h1>
          <p className="text-gray-400">Dokümanların nasıl parçalara ayrılacağını yapılandırın</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </Button>
      </div>

      {/* Chunking Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Metin Parçalama (Chunking)
          </CardTitle>
          <CardDescription>Dokümanların metin parçalarına ayrılması için parametreler</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="chunk_size">Chunk Boyutu (karakter)</Label>
              <Input
                id="chunk_size"
                type="number"
                min="100"
                max="2000"
                value={config.chunk_size}
                onChange={(e) => setConfig({ ...config, chunk_size: parseInt(e.target.value) || 500 })}
              />
              <p className="text-xs text-gray-400">Her metin parçasının maksimum uzunluğu</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overlap">Overlap (karakter)</Label>
              <Input
                id="overlap"
                type="number"
                min="0"
                max="500"
                value={config.overlap}
                onChange={(e) => setConfig({ ...config, overlap: parseInt(e.target.value) || 100 })}
              />
              <p className="text-xs text-gray-400">Parçalar arası örtüşme miktarı</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch_size">Batch Boyutu</Label>
              <Input
                id="batch_size"
                type="number"
                min="1"
                max="32"
                value={config.batch_size}
                onChange={(e) => setConfig({ ...config, batch_size: parseInt(e.target.value) || 9 })}
              />
              <p className="text-xs text-gray-400">Aynı anda işlenecek chunk sayısı</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_memory_mb">Maksimum Bellek (MB)</Label>
              <Input
                id="max_memory_mb"
                type="number"
                min="128"
                max="4096"
                value={config.max_memory_mb}
                onChange={(e) => setConfig({ ...config, max_memory_mb: parseInt(e.target.value) || 512 })}
              />
              <p className="text-xs text-gray-400">İşlem için ayrılan RAM limiti</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border border-blue-500/20 bg-blue-500/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-400">
            <Info className="h-5 w-5" />
            Chunking Nasıl Çalışır?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-blue-300">
          <div className="bg-dark-800/60 p-3 rounded border border-white/[0.06] text-xs font-mono">
            <p className="text-gray-400 mb-2">Örnek: 2000 karakterlik doküman, Chunk=500, Overlap=100</p>
            <p>📄 Doküman → [Chunk 1: 0-500] [Chunk 2: 400-900] [Chunk 3: 800-1300] [Chunk 4: 1200-1700] [Chunk 5: 1600-2000]</p>
          </div>
          
          <div className="space-y-2">
            <p>
              <strong>📏 Chunk Boyutu:</strong> Dokümanı kaç karakterlik parçalara böleceğini belirler. 
              <span className="text-blue-400"> Küçük chunk = daha hassas arama, büyük chunk = daha fazla bağlam.</span>
            </p>
            <p>
              <strong>🔗 Overlap:</strong> Parçalar arasında örtüşen kısım. 
              <span className="text-blue-400"> Cümlelerin ortasından kesilmesini önler, anlam bütünlüğünü korur.</span>
            </p>
            <p>
              <strong>📦 Batch Boyutu:</strong> Aynı anda kaç chunk'ın embedding'e dönüştürüleceği. 
              <span className="text-blue-400"> Yüksek = hızlı ama daha fazla RAM kullanır.</span>
            </p>
            <p>
              <strong>💾 Maksimum Bellek:</strong> İşlem için ayrılan RAM limiti. 
              <span className="text-blue-400"> Aşılırsa işlem yavaşlar veya durur.</span>
            </p>
          </div>
          
          <div className="mt-3 text-blue-300 bg-blue-500/10 border border-blue-500/20 p-2 rounded">
            💡 <strong>Önerilen Değerler:</strong> Chunk: 500-1000, Overlap: 50-200, Batch: 8-16, Bellek: 512-1024 MB
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChunkingSettingsPage;

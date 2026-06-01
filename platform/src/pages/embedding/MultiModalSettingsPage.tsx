import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { 
  Eye,
  Save,
  RefreshCw,
  Info,
  DollarSign,
  Image,
  Cpu,
  BarChart3,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface MultiModalSettings {
  enabled: boolean;
  provider: string;
  model: string;
  max_images_per_query: number;
  max_image_size: number;
  daily_budget_usd: number;
  monthly_budget_usd: number;
  cache_enabled: boolean;
  cache_ttl_hours: number;
}

interface UsageStats {
  daily: {
    total_cost_usd: number;
    total_tokens: number;
    total_images: number;
    request_count: number;
  };
  monthly: {
    total_cost_usd: number;
    total_tokens: number;
    total_images: number;
    request_count: number;
  };
  budget: {
    daily_remaining: number;
    monthly_remaining: number;
    daily_percentage: number;
    monthly_percentage: number;
  };
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI GPT-4V', description: 'En gelişmiş görsel anlama' },
  { value: 'anthropic', label: 'Anthropic Claude 3', description: 'Detaylı analiz' },
  { value: 'google', label: 'Google Gemini', description: 'Hızlı ve ekonomik' },
];

const MultiModalSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<MultiModalSettings>({
    enabled: false,
    provider: 'openai',
    model: 'gpt-4-vision-preview',
    max_images_per_query: 3,
    max_image_size: 1024,
    daily_budget_usd: 5.0,
    monthly_budget_usd: 100.0,
    cache_enabled: true,
    cache_ttl_hours: 24,
  });
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsRes, usageRes] = await Promise.all([
        api.get('/api/admin/multimodal/settings'),
        api.get('/api/admin/multimodal/usage'),
      ]);
      if (settingsRes.data) setSettings(settingsRes.data);
      if (usageRes.data) setUsage(usageRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/api/admin/multimodal/settings', settings);
      toast.success('Multi-Modal ayarları kaydedildi');
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
          <h1 className="text-2xl font-bold text-gray-900">Multi-Modal RAG Ayarları</h1>
          <p className="text-gray-600">Görsel analiz ve muhakeme özelliklerini yapılandırın</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </Button>
      </div>

      {/* Usage Stats */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Günlük Maliyet</p>
                  <p className="text-2xl font-bold">${usage.daily.total_cost_usd.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${usage.budget.daily_percentage > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(usage.budget.daily_percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ${usage.budget.daily_remaining.toFixed(2)} kalan
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Aylık Maliyet</p>
                  <p className="text-2xl font-bold">${usage.monthly.total_cost_usd.toFixed(2)}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${usage.budget.monthly_percentage > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(usage.budget.monthly_percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ${usage.budget.monthly_remaining.toFixed(2)} kalan
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Analiz Edilen Görsel</p>
                  <p className="text-2xl font-bold">{usage.monthly.total_images}</p>
                </div>
                <Image className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Bu ay toplam
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Token Kullanımı</p>
                  <p className="text-2xl font-bold">{(usage.monthly.total_tokens / 1000).toFixed(1)}K</p>
                </div>
                <Cpu className="h-8 w-8 text-orange-500" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Bu ay toplam
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enable/Disable */}
      <Card className={settings.enabled ? 'border-2 border-green-300' : 'border-2 border-gray-200'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Multi-Modal RAG
          </CardTitle>
          <CardDescription>
            LLM'e görselleri de göndererek teknik çizim, tablo ve diyagramları analiz etmesini sağlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-medium flex items-center gap-2">
                {settings.enabled ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                Multi-Modal RAG {settings.enabled ? 'Aktif' : 'Pasif'}
              </Label>
              <p className="text-sm text-gray-500">
                {settings.enabled 
                  ? 'Görseller RAG sorgularında analiz edilecek' 
                  : 'Sadece metin tabanlı RAG kullanılacak'}
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {settings.enabled && (
        <>
          {/* Provider Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Sağlayıcı Ayarları
              </CardTitle>
              <CardDescription>Görsel analiz için kullanılacak AI sağlayıcısı</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PROVIDERS.map((provider) => (
                  <div
                    key={provider.value}
                    onClick={() => setSettings({ ...settings, provider: provider.value })}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      settings.provider === provider.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium">{provider.label}</p>
                    <p className="text-sm text-gray-500">{provider.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Image Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Görsel Ayarları
              </CardTitle>
              <CardDescription>Görsel işleme limitleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Sorgu Başına Maksimum Görsel</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.max_images_per_query}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      max_images_per_query: parseInt(e.target.value) || 3 
                    })}
                  />
                  <p className="text-xs text-gray-500">Her RAG sorgusunda analiz edilecek maksimum görsel sayısı</p>
                </div>

                <div className="space-y-2">
                  <Label>Maksimum Görsel Boyutu (px)</Label>
                  <Input
                    type="number"
                    min="256"
                    max="2048"
                    step="256"
                    value={settings.max_image_size}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      max_image_size: parseInt(e.target.value) || 1024 
                    })}
                  />
                  <p className="text-xs text-gray-500">Görseller bu boyuta küçültülür (maliyet optimizasyonu)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Settings */}
          <Card className="border-2 border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700">
                <DollarSign className="h-5 w-5" />
                Bütçe Limitleri
              </CardTitle>
              <CardDescription>Maliyet kontrolü için günlük ve aylık limitler</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Günlük Bütçe (USD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={settings.daily_budget_usd}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      daily_budget_usd: parseFloat(e.target.value) || 5.0 
                    })}
                  />
                  <p className="text-xs text-gray-500">Günlük maksimum harcama limiti</p>
                </div>

                <div className="space-y-2">
                  <Label>Aylık Bütçe (USD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={settings.monthly_budget_usd}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      monthly_budget_usd: parseFloat(e.target.value) || 100.0 
                    })}
                  />
                  <p className="text-xs text-gray-500">Aylık maksimum harcama limiti</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-700">
                <strong>⚠️ Önemli:</strong> Bütçe aşıldığında Multi-Modal RAG otomatik olarak devre dışı kalır 
                ve sadece metin tabanlı RAG kullanılır.
              </div>
            </CardContent>
          </Card>

          {/* Cache Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Önbellek Ayarları</CardTitle>
              <CardDescription>Görsel analiz sonuçlarını önbelleğe alarak maliyeti düşürün</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Önbellek Aktif</Label>
                  <p className="text-sm text-gray-500">
                    Aynı görseller için tekrar API çağrısı yapmaz
                  </p>
                </div>
                <Switch
                  checked={settings.cache_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, cache_enabled: checked })}
                />
              </div>

              {settings.cache_enabled && (
                <div className="space-y-2">
                  <Label>Önbellek Süresi (Saat)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="168"
                    value={settings.cache_ttl_hours}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      cache_ttl_hours: parseInt(e.target.value) || 24 
                    })}
                  />
                  <p className="text-xs text-gray-500">Önbellek bu süre sonra temizlenir</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Info className="h-5 w-5" />
            Multi-Modal RAG Nasıl Çalışır?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-blue-700">
          <div className="space-y-3">
            <p>
              <strong>🖼️ Görsel Muhakeme:</strong> RAG sorgusu sırasında ilgili chunk'lara bağlı görseller 
              de LLM'e gönderilir. LLM, teknik çizimleri, tabloları ve diyagramları analiz ederek 
              daha doğru yanıtlar verir.
            </p>
            
            <div className="bg-white p-3 rounded border space-y-2">
              <p className="text-gray-700 font-semibold">Kullanım Senaryoları:</p>
              <div className="space-y-1 text-xs">
                <p>• <strong>Teknik Çizimler:</strong> Bağlantı şemaları, montaj talimatları</p>
                <p>• <strong>Tablolar:</strong> Teknik özellik tabloları, karşılaştırma tabloları</p>
                <p>• <strong>Diyagramlar:</strong> Akış şemaları, sistem mimarisi</p>
                <p>• <strong>Etiketler:</strong> Ürün etiketleri, uyarı işaretleri</p>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-blue-600 bg-blue-100 p-2 rounded">
            💡 <strong>Maliyet İpucu:</strong> Önbelleği aktif tutun ve görsel boyutunu 1024px'de tutun. 
            Bu, maliyeti %50'ye kadar düşürebilir.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiModalSettingsPage;

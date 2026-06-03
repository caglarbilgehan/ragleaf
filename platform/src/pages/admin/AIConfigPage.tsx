// platform/src/pages/admin/AIConfigPage.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Settings,
  RefreshCw,
  Save,
  Cpu,
  Search,
  Zap,
  Info,
  CheckCircle,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface GlobalAIConfig {
  model_config: {
    provider: string;
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
  };
  rag_config: {
    top_k: number;
    similarity_threshold: number;
    search_method: string;
    include_sources: boolean;
    max_context_chars: number;
  };
  created_at: string | null;
  updated_at: string | null;
}

type Tab = 'model' | 'rag';

const AIConfigPage: React.FC = () => {
  const [config, setConfig] = useState<GlobalAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('model');

  // Form state
  const [modelForm, setModelForm] = useState({
    provider: 'huggingface',
    model: '',
    temperature: 0.3,
    max_tokens: 1024,
    top_p: 0.9,
  });

  const [ragForm, setRagForm] = useState({
    top_k: 5,
    similarity_threshold: 0.3,
    search_method: 'hybrid',
    include_sources: false,
    max_context_chars: 4000,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/ai-provider-config/global-config');
      const cfg = response.data.config;
      setConfig(cfg);

      if (cfg.model_config) {
        setModelForm({
          provider: cfg.model_config.provider || 'huggingface',
          model: cfg.model_config.model || '',
          temperature: cfg.model_config.temperature ?? 0.3,
          max_tokens: cfg.model_config.max_tokens ?? 1024,
          top_p: cfg.model_config.top_p ?? 0.9,
        });
      }

      if (cfg.rag_config) {
        setRagForm({
          top_k: cfg.rag_config.top_k ?? 5,
          similarity_threshold: cfg.rag_config.similarity_threshold ?? 0.3,
          search_method: cfg.rag_config.search_method || 'hybrid',
          include_sources: cfg.rag_config.include_sources ?? false,
          max_context_chars: cfg.rag_config.max_context_chars ?? 4000,
        });
      }

      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching global AI config:', error);
      toast.error('AI yapılandırma yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/ai-provider-config/global-config', {
        model_config_data: modelForm,
        rag_config: ragForm,
      });
      toast.success('AI yapılandırma kaydedildi');
      setHasChanges(false);
      fetchConfig();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  };

  const updateModelField = (field: string, value: any) => {
    setModelForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateRagField = (field: string, value: any) => {
    setRagForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="ml-2 text-gray-600">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-7 w-7 text-indigo-600" />
            AI Yapılandırma
          </h1>
          <p className="text-gray-600 mt-1">
            Tüm tenantlar için geçerli merkezi AI model ve RAG ayarları
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
              Kaydedilmemiş değişiklikler
            </Badge>
          )}
          <Button onClick={fetchConfig} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Yenile
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Bu ayarlar tüm tenantlar ve agent'lar için geçerlidir. Yeni oluşturulan agent'lar bu yapılandırmayı otomatik olarak kullanır.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('model')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'model'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Cpu className="h-4 w-4" />
          LLM Model Ayarları
        </button>
        <button
          onClick={() => setActiveTab('rag')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'rag'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Search className="h-4 w-4" />
          RAG Ayarları
        </button>
      </div>

      {/* Tab Content */}
      <Card>
        <CardContent className="pt-6">
          {activeTab === 'model' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">LLM Model Yapılandırması</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">AI Provider</Label>
                  <p className="text-xs text-gray-400 mb-1">Varsayılan AI sağlayıcısı</p>
                  <select
                    value={modelForm.provider}
                    onChange={(e) => updateModelField('provider', e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="huggingface">HuggingFace</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Model</Label>
                  <p className="text-xs text-gray-400 mb-1">Varsayılan LLM modeli</p>
                  <Input
                    type="text"
                    value={modelForm.model}
                    onChange={(e) => updateModelField('model', e.target.value)}
                    placeholder="meta-llama/Llama-3.1-70B-Instruct"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Temperature: {modelForm.temperature}
                  </Label>
                  <p className="text-xs text-gray-400 mb-1">Düşük = tutarlı, Yüksek = yaratıcı</p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={modelForm.temperature}
                    onChange={(e) => updateModelField('temperature', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0 (Kesin)</span>
                    <span>1 (Yaratıcı)</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Max Tokens</Label>
                  <p className="text-xs text-gray-400 mb-1">Maksimum yanıt uzunluğu</p>
                  <Input
                    type="number"
                    value={modelForm.max_tokens}
                    onChange={(e) => updateModelField('max_tokens', parseInt(e.target.value))}
                    min={128}
                    max={8192}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Top-P: {modelForm.top_p}
                  </Label>
                  <p className="text-xs text-gray-400 mb-1">Nucleus sampling</p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={modelForm.top_p}
                    onChange={(e) => updateModelField('top_p', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 mt-2"
                  />
                </div>
              </div>

              {/* Current Config Summary */}
              {config && (
                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">Mevcut Yapılandırma</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Provider: <span className="font-medium">{config.model_config?.provider}</span></div>
                    <div>Model: <span className="font-medium">{config.model_config?.model}</span></div>
                    <div>Temperature: <span className="font-medium">{config.model_config?.temperature}</span></div>
                    <div>Max Tokens: <span className="font-medium">{config.model_config?.max_tokens}</span></div>
                  </div>
                  {config.updated_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      Son güncelleme: {new Date(config.updated_at).toLocaleString('tr-TR')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">RAG Arama Yapılandırması</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Top-K Sonuç</Label>
                  <p className="text-xs text-gray-400 mb-1">Kaç chunk getirilecek</p>
                  <Input
                    type="number"
                    value={ragForm.top_k}
                    onChange={(e) => updateRagField('top_k', parseInt(e.target.value))}
                    min={1}
                    max={20}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Benzerlik Eşiği</Label>
                  <p className="text-xs text-gray-400 mb-1">Min benzerlik skoru (0-1)</p>
                  <Input
                    type="number"
                    value={ragForm.similarity_threshold}
                    onChange={(e) => updateRagField('similarity_threshold', parseFloat(e.target.value))}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Arama Yöntemi</Label>
                  <p className="text-xs text-gray-400 mb-1">Retrieval stratejisi</p>
                  <select
                    value={ragForm.search_method}
                    onChange={(e) => updateRagField('search_method', e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="hybrid">Hibrit (Önerilen)</option>
                    <option value="semantic">Semantik</option>
                    <option value="fulltext">Tam Metin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Max Context Karakter</Label>
                  <p className="text-xs text-gray-400 mb-1">LLM'e gönderilecek max bağlam</p>
                  <Input
                    type="number"
                    value={ragForm.max_context_chars}
                    onChange={(e) => updateRagField('max_context_chars', parseInt(e.target.value))}
                    min={500}
                    max={16000}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors w-full">
                    <input
                      type="checkbox"
                      checked={ragForm.include_sources}
                      onChange={(e) => updateRagField('include_sources', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Kaynak Göster</span>
                      <p className="text-xs text-gray-500">Yanıtlarda kaynak dokümanları göster</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Current Config Summary */}
              {config && (
                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">Mevcut RAG Yapılandırması</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Top-K: <span className="font-medium">{config.rag_config?.top_k}</span></div>
                    <div>Benzerlik: <span className="font-medium">{config.rag_config?.similarity_threshold}</span></div>
                    <div>Yöntem: <span className="font-medium">{config.rag_config?.search_method}</span></div>
                    <div>Max Context: <span className="font-medium">{config.rag_config?.max_context_chars}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIConfigPage;

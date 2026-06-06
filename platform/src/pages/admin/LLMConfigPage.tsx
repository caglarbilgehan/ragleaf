// platform/src/pages/admin/LLMConfigPage.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Cpu,
  RefreshCw,
  Save,
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
  created_at: string | null;
  updated_at: string | null;
}

const LLMConfigPage: React.FC = () => {
  const [config, setConfig] = useState<GlobalAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [modelForm, setModelForm] = useState({
    provider: 'huggingface',
    model: '',
    temperature: 0.3,
    max_tokens: 1024,
    top_p: 0.9,
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

      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching global LLM config:', error);
      toast.error('LLM yapılandırması yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/ai-provider-config/global-config', {
        model_config_data: modelForm,
      });
      toast.success('LLM yapılandırması kaydedildi');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-400" />
        <span className="ml-2 text-gray-400">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Cpu className="h-7 w-7 text-primary-400" />
            LLM Yapılandırması
          </h1>
          <p className="text-gray-400 mt-1">
            Tüm tenantlar için geçerli merkezi LLM model ve parametre ayarları
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white"
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
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-200">
          Bu ayarlar tüm tenantlar ve agent'lar için geçerlidir. Yeni oluşturulan agent'lar bu yapılandırmayı otomatik olarak kullanır.
        </AlertDescription>
      </Alert>

      {/* Content */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-5 w-5 text-primary-400" />
              <h3 className="text-lg font-semibold text-gray-100">LLM Model Yapılandırması</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-300">AI Provider</Label>
                <p className="text-xs text-gray-400 mb-1">Varsayılan AI sağlayıcısı</p>
                <select
                  value={modelForm.provider}
                  onChange={(e) => updateModelField('provider', e.target.value)}
                  className="w-full h-10 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="huggingface">HuggingFace</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-300">Model</Label>
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
                <Label className="text-sm font-medium text-gray-300">
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
                  className="w-full accent-primary-500 mt-2"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0 (Kesin)</span>
                  <span>1 (Yaratıcı)</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-300">Max Tokens</Label>
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
                <Label className="text-sm font-medium text-gray-300">
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
                  className="w-full accent-primary-500 mt-2"
                />
              </div>
            </div>

            {/* Current Config Summary */}
            {config && (
              <div className="bg-dark-700/50 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-300">Mevcut Yapılandırma</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default LLMConfigPage;

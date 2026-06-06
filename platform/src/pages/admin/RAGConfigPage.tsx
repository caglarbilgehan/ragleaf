// platform/src/pages/admin/RAGConfigPage.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Database,
  RefreshCw,
  Save,
  Info,
  CheckCircle,
  Search,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface GlobalAIConfig {
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

const RAGConfigPage: React.FC = () => {
  const [config, setConfig] = useState<GlobalAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
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
      console.error('Error fetching global RAG config:', error);
      toast.error('RAG yapılandırması yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/ai-provider-config/global-config', {
        rag_config: ragForm,
      });
      toast.success('RAG yapılandırması kaydedildi');
      setHasChanges(false);
      fetchConfig();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  };

  const updateRagField = (field: string, value: any) => {
    setRagForm((prev) => ({ ...prev, [field]: value }));
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
            <Database className="h-7 w-7 text-primary-400" />
            RAG Yönetimi
          </h1>
          <p className="text-gray-400 mt-1">
            Bilgi bankası arama, benzerlik eşiği ve retrieval (getirme) stratejisi yapılandırması
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
          Bu ayarlar tüm tenantlar ve asistanlar için RAG arama motorunun nasıl davranacağını belirler.
        </AlertDescription>
      </Alert>

      {/* Content */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-primary-400" />
              <h3 className="text-lg font-semibold text-gray-100">RAG Arama Yapılandırması</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-300">Top-K Sonuç</Label>
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
                <Label className="text-sm font-medium text-gray-300">Benzerlik Eşiği</Label>
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
                <Label className="text-sm font-medium text-gray-300">Arama Yöntemi</Label>
                <p className="text-xs text-gray-400 mb-1">Retrieval stratejisi</p>
                <select
                  value={ragForm.search_method}
                  onChange={(e) => updateRagField('search_method', e.target.value)}
                  className="w-full h-10 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="hybrid">Hibrit (Önerilen)</option>
                  <option value="semantic">Semantik</option>
                  <option value="fulltext">Tam Metin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-300">Max Context Karakter</Label>
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
                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-dark-700/50 transition-colors w-full">
                  <input
                    type="checkbox"
                    checked={ragForm.include_sources}
                    onChange={(e) => updateRagField('include_sources', e.target.checked)}
                    className="rounded border-white/[0.1] text-primary-400 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-100">Kaynak Göster</span>
                    <p className="text-xs text-gray-500">Yanıtlarda kaynak dokümanları göster</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Current Config Summary */}
            {config && (
              <div className="bg-dark-700/50 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-300">Mevcut RAG Yapılandırması</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div>Top-K: <span className="font-medium">{config.rag_config?.top_k}</span></div>
                  <div>Benzerlik: <span className="font-medium">{config.rag_config?.similarity_threshold}</span></div>
                  <div>Yöntem: <span className="font-medium">{config.rag_config?.search_method}</span></div>
                  <div>Max Context: <span className="font-medium">{config.rag_config?.max_context_chars}</span></div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RAGConfigPage;

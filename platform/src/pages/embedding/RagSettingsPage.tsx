import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { 
  Search,
  Save,
  RefreshCw,
  Info,
  Target,
  Layers,
  Sparkles,
  Combine,
  Building2,
  Shield
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Standard departments
const DEPARTMENTS = [
  'Teknik Servis',
  'Proje',
  'Uygulama',
  'Arge',
  'Satış',
  'Muhasebe',
  'Müşteri Hizmetleri'
];

interface RagConfig {
  similarity_threshold: number;
  max_chunks: number;
  diversity_threshold: number;
  enable_reranking: boolean;
  enable_query_expansion: boolean;
  // Hybrid Search settings
  hybrid_search_enabled: boolean;
  hybrid_vector_weight: number;
  hybrid_keyword_weight: number;
}

interface DepartmentAccessMatrix {
  enabled: boolean;
  departments: string[];
  access_rules: Record<string, string[]>;
  admin_bypass: boolean;
}

const RagSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<RagConfig>({
    similarity_threshold: 0.3,
    max_chunks: 5,
    diversity_threshold: 0.8,
    enable_reranking: true,
    enable_query_expansion: true,
    // Hybrid Search defaults
    hybrid_search_enabled: false,
    hybrid_vector_weight: 0.5,
    hybrid_keyword_weight: 0.5
  });
  const [departmentMatrix, setDepartmentMatrix] = useState<DepartmentAccessMatrix>({
    enabled: true,
    departments: DEPARTMENTS,
    access_rules: {},
    admin_bypass: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchDepartmentMatrix();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/settings/rag_settings');
      if (response.data) {
        setConfig(response.data);
      }
    } catch (error) {
      console.error('Error fetching RAG config:', error);
      toast.error('RAG ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentMatrix = async () => {
    try {
      const response = await api.get('/api/admin/settings/department_access_matrix');
      if (response.data) {
        setDepartmentMatrix(response.data);
      }
    } catch (error) {
      console.error('Error fetching department matrix:', error);
      // Initialize with defaults if not found
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/api/admin/settings/rag_settings', config);
      toast.success('RAG ayarları kaydedildi');
    } catch (error) {
      toast.error('Ayarlar kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDepartmentMatrix = async () => {
    try {
      setSaving(true);
      await api.post('/api/admin/settings/department_access_matrix', departmentMatrix);
      toast.success('Departman erişim matrisi kaydedildi');
    } catch (error) {
      toast.error('Departman ayarları kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const toggleDepartmentAccess = (sourceDept: string, targetDept: string) => {
    setDepartmentMatrix(prev => {
      const currentAccess = prev.access_rules[sourceDept] || [sourceDept];
      
      // Cannot remove self-access
      if (sourceDept === targetDept) return prev;
      
      let newAccess: string[];
      if (currentAccess.includes(targetDept)) {
        newAccess = currentAccess.filter(d => d !== targetDept);
      } else {
        newAccess = [...currentAccess, targetDept];
      }
      
      // Ensure self-access is always included
      if (!newAccess.includes(sourceDept)) {
        newAccess = [sourceDept, ...newAccess];
      }
      
      return {
        ...prev,
        access_rules: {
          ...prev.access_rules,
          [sourceDept]: newAccess
        }
      };
    });
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
          <h1 className="text-2xl font-bold text-gray-900">RAG Ayarları</h1>
          <p className="text-gray-600">Döküman arama ve benzerlik eşiği ayarlarını yapılandırın</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </Button>
      </div>

      {/* Similarity Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Benzerlik Eşiği (Similarity Threshold)
          </CardTitle>
          <CardDescription>Döküman chunk'larının seçilmesi için minimum benzerlik skoru</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="similarity_threshold">Benzerlik Eşiği</Label>
                <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  %{Math.round(config.similarity_threshold * 100)}
                </span>
              </div>
              <Input
                id="similarity_threshold"
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(config.similarity_threshold * 100)}
                onChange={(e) => setConfig({ ...config, similarity_threshold: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>%0 (Çok Gevşek)</span>
                <span>%50 (Dengeli)</span>
                <span>%100 (Çok Sıkı)</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Düşük değer = daha fazla chunk döner (daha geniş sonuçlar)<br/>
                Yüksek değer = sadece çok benzer chunk'lar döner (daha hassas sonuçlar)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_chunks">Maksimum Chunk Sayısı</Label>
              <Input
                id="max_chunks"
                type="number"
                min="1"
                max="20"
                value={config.max_chunks}
                onChange={(e) => setConfig({ ...config, max_chunks: parseInt(e.target.value) || 5 })}
              />
              <p className="text-xs text-gray-500">RAG modunda sorguya döndürülecek maksimum chunk sayısı</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="diversity_threshold">Çeşitlilik Eşiği</Label>
                <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  %{Math.round(config.diversity_threshold * 100)}
                </span>
              </div>
              <Input
                id="diversity_threshold"
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(config.diversity_threshold * 100)}
                onChange={(e) => setConfig({ ...config, diversity_threshold: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Sonuçlar arasında çeşitlilik sağlamak için kullanılır</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hybrid Search Settings */}
      <Card className="border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <Combine className="h-5 w-5" />
            Hibrit Arama (Hybrid Search)
          </CardTitle>
          <CardDescription>
            Vektör (anlamsal) ve anahtar kelime (BM25) aramayı birleştirerek daha doğru sonuçlar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="hybrid_search_enabled" className="text-base font-medium">
                Hibrit Arama Aktif
              </Label>
              <p className="text-sm text-gray-500">
                Ürün kodları ve teknik terimler için %100 doğruluk sağlar
              </p>
            </div>
            <Switch
              checked={config.hybrid_search_enabled}
              onCheckedChange={(checked) => setConfig({ ...config, hybrid_search_enabled: checked })}
            />
          </div>

          {config.hybrid_search_enabled && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              {/* Vector Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hybrid_vector_weight">Vektör Ağırlığı (Anlamsal)</Label>
                  <span className="text-sm font-mono bg-white px-2 py-1 rounded border">
                    %{Math.round(config.hybrid_vector_weight * 100)}
                  </span>
                </div>
                <Input
                  id="hybrid_vector_weight"
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={Math.round(config.hybrid_vector_weight * 100)}
                  onChange={(e) => {
                    const vectorWeight = parseInt(e.target.value) / 100;
                    setConfig({ 
                      ...config, 
                      hybrid_vector_weight: vectorWeight,
                      hybrid_keyword_weight: 1 - vectorWeight
                    });
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Anlamsal benzerlik araması - "ne demek istiyorsun?" sorusunu anlar
                </p>
              </div>

              {/* Keyword Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hybrid_keyword_weight">Anahtar Kelime Ağırlığı (BM25)</Label>
                  <span className="text-sm font-mono bg-white px-2 py-1 rounded border">
                    %{Math.round(config.hybrid_keyword_weight * 100)}
                  </span>
                </div>
                <Input
                  id="hybrid_keyword_weight"
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={Math.round(config.hybrid_keyword_weight * 100)}
                  onChange={(e) => {
                    const keywordWeight = parseInt(e.target.value) / 100;
                    setConfig({ 
                      ...config, 
                      hybrid_keyword_weight: keywordWeight,
                      hybrid_vector_weight: 1 - keywordWeight
                    });
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Tam kelime eşleşmesi - "ABC-123" gibi ürün kodlarını birebir bulur
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-purple-100 p-3 rounded text-sm text-purple-700">
                <strong>💡 Önerilen Ayarlar:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• <strong>Genel Sorular:</strong> Vektör %60, Kelime %40</li>
                  <li>• <strong>Teknik Terimler:</strong> Vektör %40, Kelime %60</li>
                  <li>• <strong>Ürün Kodları:</strong> Vektör %30, Kelime %70</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Gelişmiş Özellikler
          </CardTitle>
          <CardDescription>RAG performansını artıran ek özellikler</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="enable_reranking" className="text-base font-medium">
                Re-ranking (Yeniden Sıralama)
              </Label>
              <p className="text-sm text-gray-500">
                Sonuçları sorgu amacına göre yeniden sıralar
              </p>
            </div>
            <Switch
              checked={config.enable_reranking}
              onCheckedChange={(checked) => setConfig({ ...config, enable_reranking: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="enable_query_expansion" className="text-base font-medium">
                Query Expansion (Sorgu Genişletme)
              </Label>
              <p className="text-sm text-gray-500">
                Sorguyu eş anlamlılarla genişleterek daha iyi sonuçlar bulur
              </p>
            </div>
            <Switch
              checked={config.enable_query_expansion}
              onCheckedChange={(checked) => setConfig({ ...config, enable_query_expansion: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Department Access Matrix */}
      <Card className="border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Building2 className="h-5 w-5" />
            Departman Bazlı Döküman Erişimi
          </CardTitle>
          <CardDescription>
            Her departmanın hangi departman dökümanlarına erişebileceğini yapılandırın
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-medium">
                Departman Filtreleme Aktif
              </Label>
              <p className="text-sm text-gray-500">
                RAG sorguları kullanıcının departmanlarına göre filtrelenir
              </p>
            </div>
            <Switch
              checked={departmentMatrix.enabled}
              onCheckedChange={(checked) => setDepartmentMatrix({ ...departmentMatrix, enabled: checked })}
            />
          </div>

          {/* Admin Bypass */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="space-y-1 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <Label className="text-base font-medium">
                  Admin Bypass
                </Label>
                <p className="text-sm text-gray-500">
                  Yöneticiler tüm departman dökümanlarına erişebilir
                </p>
              </div>
            </div>
            <Switch
              checked={departmentMatrix.admin_bypass}
              onCheckedChange={(checked) => setDepartmentMatrix({ ...departmentMatrix, admin_bypass: checked })}
            />
          </div>

          {departmentMatrix.enabled && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Erişim Matrisi</h4>
                <p className="text-xs text-gray-500 mb-4">
                  Her satır bir departmanı temsil eder. İşaretli sütunlar o departmanın erişebileceği dökümanları gösterir.
                  <br />
                  <span className="text-green-600">✓ Kendi departmanı (zorunlu, kaldırılamaz)</span>
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Departman</th>
                        {DEPARTMENTS.map(dept => (
                          <th key={dept} className="text-center py-2 px-2 font-medium text-gray-700 text-xs">
                            {dept.split(' ')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DEPARTMENTS.map(sourceDept => {
                        const access = departmentMatrix.access_rules[sourceDept] || [sourceDept];
                        return (
                          <tr key={sourceDept} className="border-b hover:bg-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-900">{sourceDept}</td>
                            {DEPARTMENTS.map(targetDept => {
                              const hasAccess = access.includes(targetDept);
                              const isSelf = sourceDept === targetDept;
                              return (
                                <td key={targetDept} className="text-center py-2 px-2">
                                  <button
                                    onClick={() => toggleDepartmentAccess(sourceDept, targetDept)}
                                    disabled={isSelf}
                                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                      isSelf
                                        ? 'bg-green-500 text-white cursor-not-allowed'
                                        : hasAccess
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                                    }`}
                                    title={isSelf ? 'Kendi departmanı (zorunlu)' : hasAccess ? 'Erişimi kaldır' : 'Erişim ver'}
                                  >
                                    {hasAccess ? '✓' : ''}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <Button onClick={handleSaveDepartmentMatrix} disabled={saving} className="w-full flex items-center justify-center gap-2">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Departman Ayarlarını Kaydet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Info className="h-5 w-5" />
            Benzerlik Eşiği Nasıl Çalışır?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-blue-700">
          <div className="space-y-3">
            <p>
              <strong>🎯 Benzerlik Skoru:</strong> Her chunk, sorgu ile ne kadar benzer olduğunu gösteren 0.0-1.0 arası bir skor alır.
            </p>
            <p>
              <strong>📊 Eşik Değeri:</strong> Bu değerin altındaki chunk'lar filtrelenir ve sonuçlara dahil edilmez.
            </p>
            
            <div className="bg-white p-3 rounded border space-y-2">
              <p className="text-gray-700 font-semibold">Örnek Senaryolar:</p>
              <div className="space-y-1 text-xs">
                <p>• <strong>Eşik = %20:</strong> Çok geniş sonuçlar, alakasız chunk'lar da gelebilir</p>
                <p>• <strong>Eşik = %30-40:</strong> ✅ Dengeli, çoğu kullanım için ideal</p>
                <p>• <strong>Eşik = %50-70:</strong> Hassas arama, sadece çok benzer sonuçlar</p>
                <p>• <strong>Eşik = %80+:</strong> Çok sıkı, neredeyse hiç sonuç dönmeyebilir</p>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-blue-600 bg-blue-100 p-2 rounded">
            💡 <strong>Önerilen Değerler:</strong> Benzerlik: %30-40, Max Chunks: 5-7, Çeşitlilik: %70-80
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RagSettingsPage;

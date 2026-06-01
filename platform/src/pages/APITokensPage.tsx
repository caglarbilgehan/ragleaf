import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Switch } from '../components/ui/switch';
import { 
  Key,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Settings,
  Copy,
  Eye,
  EyeOff,
  Edit,
  RotateCcw,
  X,
  Calendar,
  Activity,
  Shield,
  Globe,
  Database,
  MessageSquare,
  Zap,
  Bot
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// Types
interface APIToken {
  id: number;
  name: string;
  description?: string;
  key_prefix: string;
  key_preview?: string;
  allowed_mode: 'rag' | 'chat' | 'hybrid';
  department_ids: number[];
  system_prompt?: string;
  llm_model_id?: number;
  llm_model_name?: string;
  max_tokens: number;
  temperature: number;
  top_k: number;
  similarity_threshold: number;
  include_sources: boolean;
  include_images: boolean;
  default_language: string;
  allowed_languages: string[];
  permissions: string[];
  ip_whitelist: string[];
  allowed_origins: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at?: string;
  total_requests: number;
  total_tokens_used: number;
  response_format?: any;
  custom_templates?: any;
  metadata: any;
}

interface Department {
  id: number;
  name: string;
  description: string;
}

interface LLMModel {
  id: number;
  name: string;
  provider: string;
  description: string;
  is_default: boolean;
}

interface CreateTokenResponse {
  api_key: APIToken;
  secret_key: string;
  warning: string;
}

const APITokensPage: React.FC = () => {
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [llmModels, setLLMModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [editingToken, setEditingToken] = useState<APIToken | null>(null);
  const [secretKey, setSecretKey] = useState('');
  const [secretWarning, setSecretWarning] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    allowed_mode: 'rag' as 'rag' | 'chat' | 'hybrid',
    department_ids: [] as number[],
    system_prompt: '',
    llm_model_id: null as number | null,
    max_tokens: 1000,
    temperature: 0.7,
    top_k: 5,
    similarity_threshold: 0.5,
    include_sources: true,
    include_images: true,
    default_language: 'tr',
    allowed_languages: ['tr', 'en'],
    permissions: ['chat:read'],
    ip_whitelist: [] as string[],
    allowed_origins: [] as string[],
    rate_limit_per_minute: 60,
    rate_limit_per_day: 1000,
    expires_days: null as number | null,
    is_active: true,
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tokensRes, departmentsRes, modelsRes] = await Promise.all([
        api.get('/api/keys/'),
        api.get('/api/keys/departments/list'),
        api.get('/api/keys/llm-models/list')
      ]);
      
      setTokens(tokensRes.data || []);
      setDepartments(departmentsRes.data.departments || []);
      setLLMModels(modelsRes.data.models || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'rag': return <Database className="h-4 w-4" />;
      case 'chat': return <MessageSquare className="h-4 w-4" />;
      case 'hybrid': return <Zap className="h-4 w-4" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'rag': return 'bg-blue-100 text-blue-800';
      case 'chat': return 'bg-green-100 text-green-800';
      case 'hybrid': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Hiç kullanılmadı';
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Panoya kopyalandı');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      allowed_mode: 'rag',
      department_ids: [],
      system_prompt: '',
      llm_model_id: null,
      max_tokens: 1000,
      temperature: 0.7,
      top_k: 5,
      similarity_threshold: 0.5,
      include_sources: true,
      include_images: true,
      default_language: 'tr',
      allowed_languages: ['tr', 'en'],
      permissions: ['chat:read'],
      ip_whitelist: [],
      allowed_origins: [],
      rate_limit_per_minute: 60,
      rate_limit_per_day: 1000,
      expires_days: null,
      is_active: true,
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Token adı gerekli';
    } else if (formData.name.length > 255) {
      errors.name = 'Token adı 255 karakterden uzun olamaz';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Açıklama 500 karakterden uzun olamaz';
    }

    if (formData.system_prompt && formData.system_prompt.length > 2000) {
      errors.system_prompt = 'System prompt 2000 karakterden uzun olamaz';
    }

    if (formData.rate_limit_per_minute < 1 || formData.rate_limit_per_minute > 1000) {
      errors.rate_limit_per_minute = 'Dakika başına limit 1-1000 arasında olmalı';
    }

    if (formData.rate_limit_per_day < 1 || formData.rate_limit_per_day > 100000) {
      errors.rate_limit_per_day = 'Günlük limit 1-100000 arasında olmalı';
    }

    if (formData.expires_days && (formData.expires_days < 1 || formData.expires_days > 365)) {
      errors.expires_days = 'Geçerlilik süresi 1-365 gün arasında olmalı';
    }

    if ((formData.allowed_mode === 'rag' || formData.allowed_mode === 'hybrid') && formData.department_ids.length === 0) {
      errors.department_ids = 'RAG/Hybrid modunda en az 1 departman seçilmeli';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateToken = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const response = await api.post('/api/keys/', formData);
      setSecretKey(response.data.secret_key);
      setSecretWarning(response.data.warning);
      setShowSecretModal(true);
      setShowCreateModal(false);
      resetForm();
      fetchData();
      toast.success('Token başarıyla oluşturuldu');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Token oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateToken = async () => {
    if (!editingToken || !validateForm()) return;

    try {
      setSaving(true);
      await api.put(`/api/keys/${editingToken.id}`, formData);
      setShowEditModal(false);
      setEditingToken(null);
      resetForm();
      fetchData();
      toast.success('Token başarıyla güncellendi');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Token güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleToken = async (tokenId: number, isActive: boolean) => {
    try {
      setSaving(true);
      await api.put(`/api/keys/${tokenId}`, { is_active: isActive });
      toast.success(isActive ? 'Token etkinleştirildi' : 'Token devre dışı bırakıldı');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Token güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleEditToken = (token: APIToken) => {
    setEditingToken(token);
    setFormData({
      name: token.name,
      description: token.description || '',
      allowed_mode: token.allowed_mode,
      department_ids: token.department_ids,
      system_prompt: token.system_prompt || '',
      llm_model_id: token.llm_model_id || null,
      max_tokens: token.max_tokens,
      temperature: token.temperature,
      top_k: token.top_k,
      similarity_threshold: token.similarity_threshold,
      include_sources: token.include_sources,
      include_images: token.include_images,
      default_language: token.default_language,
      allowed_languages: token.allowed_languages,
      permissions: token.permissions,
      ip_whitelist: token.ip_whitelist,
      allowed_origins: token.allowed_origins,
      rate_limit_per_minute: token.rate_limit_per_minute,
      rate_limit_per_day: token.rate_limit_per_day,
      expires_days: null, // Don't show existing expiry
      is_active: token.is_active,
    });
    setShowEditModal(true);
  };

  const handleRegenerateToken = async (tokenId: number) => {
    if (!confirm('Bu token yeniden oluşturulacak. Eski key geçersiz olacak. Emin misiniz?')) return;
    
    try {
      setSaving(true);
      const response = await api.post(`/api/keys/${tokenId}/regenerate`);
      setSecretKey(response.data.secret_key);
      setSecretWarning(response.data.warning);
      setShowSecretModal(true);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Token yeniden oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteToken = async (tokenId: number) => {
    if (!confirm('Bu token kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misiniz?')) return;
    
    try {
      setSaving(true);
      await api.delete(`/api/keys/${tokenId}`);
      toast.success('Token silindi');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Token silinemedi');
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
          <h1 className="text-2xl font-bold text-gray-900">API Token Yönetimi</h1>
          <p className="text-gray-600">Dış uygulamalar için API tokenları oluşturun ve yönetin</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Token Oluştur
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Key className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Toplam Token</p>
                <p className="text-2xl font-bold text-gray-900">{tokens.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Aktif Token</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tokens.filter(t => t.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Toplam İstek</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tokens.reduce((sum, t) => sum + (t.total_requests || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Süresi Dolan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tokens.filter(t => t.expires_at && new Date(t.expires_at) < new Date()).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tokens List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Tokenları
          <span className="text-sm font-normal text-gray-500">({tokens.length} token)</span>
        </h2>
        
        {tokens.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Key className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Henüz Token Yok</h3>
              <p className="text-gray-600 text-center mb-4">
                İlk API token'ınızı oluşturarak başlayın.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Token Oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          tokens.map((token) => (
            <Card 
              key={token.id} 
              className={`transition-all ${
                token.is_active 
                  ? 'border-green-200 bg-green-50/30' 
                  : 'border-gray-200 bg-gray-50/30 opacity-75'
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg border">
                      {getModeIcon(token.allowed_mode)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{token.name}</h3>
                        <Badge className={getModeColor(token.allowed_mode)}>
                          {token.allowed_mode.toUpperCase()}
                        </Badge>
                        {!token.is_active && (
                          <Badge variant="outline" className="text-gray-500">
                            Devre Dışı
                          </Badge>
                        )}
                        {token.expires_at && new Date(token.expires_at) < new Date() && (
                          <Badge variant="destructive">
                            <Calendar className="h-3 w-3 mr-1" />
                            Süresi Doldu
                          </Badge>
                        )}
                      </div>
                      
                      {token.description && (
                        <p className="text-sm text-gray-600 mb-3">{token.description}</p>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Model:</span>
                          <p className="font-medium">{token.llm_model_name || 'Sistem Varsayılanı'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Son Kullanım:</span>
                          <p className="font-medium">{formatDate(token.last_used_at)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Toplam İstek:</span>
                          <p className="font-medium">{token.total_requests || 0}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Rate Limit:</span>
                          <p className="font-medium">{token.rate_limit_per_minute}/dk</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Key:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {token.key_preview || `${token.key_prefix}••••••••••••••••`}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(token.key_preview || token.key_prefix)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={token.is_active}
                      onCheckedChange={(checked) => handleToggleToken(token.id, checked)}
                      disabled={saving}
                    />
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditToken(token)}
                      disabled={saving}
                      title="Düzenle"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateToken(token.id)}
                      disabled={saving}
                      title="Yeniden Oluştur"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteToken(token.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">API Token Kullanımı</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Token'ları dış uygulamalardan API'ye erişim için kullanın</li>
                <li>RAG modu: Belirli departman dökümanları ile çalışır</li>
                <li>Chat modu: Genel sohbet için kullanılır</li>
                <li>Hybrid modu: Hem RAG hem chat özelliklerini destekler</li>
                <li>Rate limit'ler dakika ve günlük bazda uygulanır</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secret Key Modal */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Token Oluşturuldu
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowSecretModal(false);
                    setSecretKey('');
                    setSecretWarning('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {secretWarning || '⚠️ Bu secret key\'i güvenli bir yerde saklayın. Bir daha gösterilmeyecek!'}
                </AlertDescription>
              </Alert>
              
              <div>
                <Label>Secret Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={secretKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(secretKey)}
                    title="Kopyala"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <Button 
                  onClick={() => {
                    setShowSecretModal(false);
                    setSecretKey('');
                    setSecretWarning('');
                  }}
                >
                  Tamam
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Token Modal */}
      {showCreateModal && (
        <TokenFormModal
          title="Yeni API Token Oluştur"
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          departments={departments}
          llmModels={llmModels}
          saving={saving}
          onSubmit={handleCreateToken}
          onCancel={() => {
            setShowCreateModal(false);
            resetForm();
          }}
        />
      )}

      {/* Edit Token Modal */}
      {showEditModal && editingToken && (
        <TokenFormModal
          title="Token Düzenle"
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          departments={departments}
          llmModels={llmModels}
          saving={saving}
          onSubmit={handleUpdateToken}
          onCancel={() => {
            setShowEditModal(false);
            setEditingToken(null);
            resetForm();
          }}
          isEdit={true}
          editingToken={editingToken}
        />
      )}
    </div>
  );
};

export default APITokensPage;

// Token Form Modal Component
interface TokenFormModalProps {
  title: string;
  formData: any;
  setFormData: (data: any) => void;
  formErrors: Record<string, string>;
  departments: Department[];
  llmModels: LLMModel[];
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
  editingToken?: APIToken | null;
}

const TokenFormModal: React.FC<TokenFormModalProps> = ({
  title,
  formData,
  setFormData,
  formErrors,
  departments,
  llmModels,
  saving,
  onSubmit,
  onCancel,
  isEdit = false,
  editingToken = null
}) => {
  const [activeTab, setActiveTab] = useState('basic');

  const updateFormData = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleDepartmentToggle = (deptId: number) => {
    const newDepts = formData.department_ids.includes(deptId)
      ? formData.department_ids.filter((id: number) => id !== deptId)
      : [...formData.department_ids, deptId];
    updateFormData('department_ids', newDepts);
  };

  const parseCommaSeparatedList = (value: string): string[] => {
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="w-full max-w-4xl mx-4 bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white rounded-t-lg sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">
                {isEdit ? 'Mevcut token ayarlarını düzenleyin' : 'Yeni API token oluşturun'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b bg-gray-50">
          <div className="flex space-x-8 px-6">
            {[
              { id: 'basic', label: 'Temel Bilgiler', icon: Settings },
              { id: 'ai', label: 'AI Ayarları', icon: Bot },
              { id: 'security', label: 'Güvenlik', icon: Shield },
              { id: 'advanced', label: 'Gelişmiş', icon: Zap }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Token Adı *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    placeholder="Örn: Mobil Uygulama Token"
                    className={formErrors.name ? 'border-red-500' : ''}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <Label>Çalışma Modu *</Label>
                  <select
                    value={formData.allowed_mode}
                    onChange={(e) => updateFormData('allowed_mode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="rag">RAG - Döküman Tabanlı</option>
                    <option value="chat">Chat - Genel Sohbet</option>
                    <option value="hybrid">Hybrid - RAG + Chat</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Açıklama</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  placeholder="Token'ın kullanım amacını açıklayın..."
                  rows={3}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.description ? 'border-red-500' : ''
                  }`}
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>{formErrors.description && <span className="text-red-600">{formErrors.description}</span>}</span>
                  <span>{formData.description.length}/500</span>
                </div>
              </div>

              {/* Department Selection - Only for RAG/Hybrid */}
              {(formData.allowed_mode === 'rag' || formData.allowed_mode === 'hybrid') && (
                <div>
                  <Label>Departmanlar * (RAG/Hybrid modu için)</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {departments.map((dept) => (
                      <label key={dept.id} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.department_ids.includes(dept.id)}
                          onChange={() => handleDepartmentToggle(dept.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium">{dept.name}</div>
                          <div className="text-xs text-gray-500">{dept.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {formErrors.department_ids && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.department_ids}</p>
                  )}
                </div>
              )}

              {isEdit && editingToken && (
                <div>
                  <Label>Durum</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => updateFormData('is_active', checked)}
                    />
                    <span className="text-sm text-gray-600">
                      {formData.is_active ? 'Aktif' : 'Devre Dışı'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Settings Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>LLM Modeli</Label>
                  <select
                    value={formData.llm_model_id || ''}
                    onChange={(e) => updateFormData('llm_model_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sistem Varsayılanı</option>
                    {llmModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.provider}) {model.is_default ? '(Varsayılan)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => updateFormData('max_tokens', parseInt(e.target.value) || 1000)}
                    min={100}
                    max={4000}
                  />
                </div>

                <div>
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => updateFormData('temperature', parseFloat(e.target.value) || 0.7)}
                    min={0}
                    max={1}
                  />
                </div>

                <div>
                  <Label>Top K (RAG)</Label>
                  <Input
                    type="number"
                    value={formData.top_k}
                    onChange={(e) => updateFormData('top_k', parseInt(e.target.value) || 5)}
                    min={1}
                    max={20}
                  />
                </div>

                <div>
                  <Label>Similarity Threshold</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.similarity_threshold}
                    onChange={(e) => updateFormData('similarity_threshold', parseFloat(e.target.value) || 0.5)}
                    min={0}
                    max={1}
                  />
                </div>

                <div>
                  <Label>Varsayılan Dil</Label>
                  <select
                    value={formData.default_language}
                    onChange={(e) => updateFormData('default_language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tr">Türkçe</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>System Prompt</Label>
                <textarea
                  value={formData.system_prompt}
                  onChange={(e) => updateFormData('system_prompt', e.target.value)}
                  placeholder="AI'ın davranışını belirleyen özel talimatlar..."
                  rows={4}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.system_prompt ? 'border-red-500' : ''
                  }`}
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>{formErrors.system_prompt && <span className="text-red-600">{formErrors.system_prompt}</span>}</span>
                  <span>{formData.system_prompt.length}/2000</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.include_sources}
                    onChange={(e) => updateFormData('include_sources', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Kaynak bilgilerini dahil et</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.include_images}
                    onChange={(e) => updateFormData('include_images', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Görselleri dahil et</span>
                </label>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Dakika Başına Limit</Label>
                  <Input
                    type="number"
                    value={formData.rate_limit_per_minute}
                    onChange={(e) => updateFormData('rate_limit_per_minute', parseInt(e.target.value) || 60)}
                    min={1}
                    max={1000}
                    className={formErrors.rate_limit_per_minute ? 'border-red-500' : ''}
                  />
                  {formErrors.rate_limit_per_minute && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.rate_limit_per_minute}</p>
                  )}
                </div>

                <div>
                  <Label>Günlük Limit</Label>
                  <Input
                    type="number"
                    value={formData.rate_limit_per_day}
                    onChange={(e) => updateFormData('rate_limit_per_day', parseInt(e.target.value) || 1000)}
                    min={1}
                    max={100000}
                    className={formErrors.rate_limit_per_day ? 'border-red-500' : ''}
                  />
                  {formErrors.rate_limit_per_day && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.rate_limit_per_day}</p>
                  )}
                </div>

                <div>
                  <Label>Geçerlilik Süresi (Gün)</Label>
                  <Input
                    type="number"
                    value={formData.expires_days || ''}
                    onChange={(e) => updateFormData('expires_days', e.target.value ? parseInt(e.target.value) : null)}
                    min={1}
                    max={365}
                    placeholder="Boş = Süresiz"
                    className={formErrors.expires_days ? 'border-red-500' : ''}
                  />
                  {formErrors.expires_days && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.expires_days}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>IP Whitelist (virgülle ayırın)</Label>
                <Input
                  value={formData.ip_whitelist.join(', ')}
                  onChange={(e) => updateFormData('ip_whitelist', parseCommaSeparatedList(e.target.value))}
                  placeholder="192.168.1.1, 10.0.0.1 (boş = tüm IP'ler)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Boş bırakılırsa tüm IP adreslerinden erişim izni verilir
                </p>
              </div>

              <div>
                <Label>Origin Whitelist (virgülle ayırın)</Label>
                <Input
                  value={formData.allowed_origins.join(', ')}
                  onChange={(e) => updateFormData('allowed_origins', parseCommaSeparatedList(e.target.value))}
                  placeholder="https://example.com, https://app.example.com (boş = tüm originler)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  CORS için izin verilen origin'ler. Boş bırakılırsa tüm origin'ler izinli
                </p>
              </div>

              <div>
                <Label>İzinler</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { id: 'chat:read', label: 'Chat Okuma' },
                    { id: 'chat:write', label: 'Chat Yazma' },
                    { id: 'documents:read', label: 'Döküman Okuma' },
                    { id: 'documents:write', label: 'Döküman Yazma' },
                    { id: 'admin:read', label: 'Admin Okuma' },
                    { id: 'admin:write', label: 'Admin Yazma' }
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={(e) => {
                          const newPerms = e.target.checked
                            ? [...formData.permissions, perm.id]
                            : formData.permissions.filter((p: string) => p !== perm.id);
                          updateFormData('permissions', newPerms);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <div>
                <Label>İzin Verilen Diller</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { code: 'tr', name: 'Türkçe' },
                    { code: 'en', name: 'English' },
                    { code: 'de', name: 'Deutsch' },
                    { code: 'fr', name: 'Français' },
                    { code: 'es', name: 'Español' },
                    { code: 'it', name: 'Italiano' }
                  ].map((lang) => (
                    <label key={lang.code} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.allowed_languages.includes(lang.code)}
                        onChange={(e) => {
                          const newLangs = e.target.checked
                            ? [...formData.allowed_languages, lang.code]
                            : formData.allowed_languages.filter((l: string) => l !== lang.code);
                          updateFormData('allowed_languages', newLangs);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{lang.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Gelişmiş Ayarlar:</strong> Bu ayarlar deneyimli kullanıcılar içindir. 
                  Varsayılan değerler çoğu kullanım durumu için uygundur.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t bg-gray-50 rounded-b-lg">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            İptal
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                {isEdit ? 'Güncelleniyor...' : 'Oluşturuluyor...'}
              </>
            ) : (
              <>
                {isEdit ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {isEdit ? 'Güncelle' : 'Oluştur'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
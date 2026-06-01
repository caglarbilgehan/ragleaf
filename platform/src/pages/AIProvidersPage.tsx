import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Switch } from '../components/ui/switch';
import { 
  Settings, 
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Pencil,
  ArrowUp,
  ArrowDown,
  Star,
  Layers,
  Zap,
  X,
  Key,
  Eye,
  EyeOff,
  TestTube,
  GripVertical
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface AIToken {
  id: number;
  provider_id: number;
  display_name: string;
  api_url?: string;
  priority: number;
  is_active: boolean;
  is_available: boolean;
  total_requests: number;
  failed_requests: number;
  last_used_at?: string;
  last_error?: string;
  created_at: string;
}

interface Provider {
  id: number;
  name: string;
  display_name: string;
  service_type: string;
  api_url?: string;
  priority: number;
  is_enabled: boolean;
  is_active: boolean;
  default_model?: string;
  default_model_display_name?: string;
  token_count: number;
  active_token_count: number;
  has_tokens: boolean;
  created_at: string;
}

const AIProvidersPage: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Token modal state
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerTokens, setProviderTokens] = useState<AIToken[]>([]);
  
  // Token management
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<number, string>>({});
  const [showAddToken, setShowAddToken] = useState(false);
  const [newToken, setNewToken] = useState({ display_name: '', api_key: '', api_url: '' });
  
  // Token editing
  const [editingTokenId, setEditingTokenId] = useState<number | null>(null);
  const [editingTokenName, setEditingTokenName] = useState('');

  // Drag and drop state
  const [draggedTokenId, setDraggedTokenId] = useState<number | null>(null);
  const [dragOverTokenId, setDragOverTokenId] = useState<number | null>(null);
  
  // Add provider modal
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', display_name: '', api_url: '' });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/ai-providers/');
      setProviders(response.data.providers || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Provider listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderTokens = async (providerId: number) => {
    try {
      const response = await api.get(`/admin/ai-providers/${providerId}/tokens`);
      setProviderTokens(response.data.tokens || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast.error('Token listesi yüklenemedi');
    }
  };

  const handleOpenTokenModal = async (provider: Provider) => {
    setEditingProvider(provider);
    setShowAddToken(false);
    await fetchProviderTokens(provider.id);
  };

  const handleCloseTokenModal = () => {
    setEditingProvider(null);
    setProviderTokens([]);
    setShowAddToken(false);
    setNewToken({ display_name: '', api_key: '', api_url: '' });
  };

  // Provider operations
  const handleCreateProvider = async () => {
    if (!newProvider.name || !newProvider.display_name) {
      toast.error('Provider adı ve görünen ad gerekli');
      return;
    }
    
    try {
      setSaving(true);
      await api.post('/admin/ai-providers/', {
        name: newProvider.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: newProvider.display_name,
        api_url: newProvider.api_url || null,
        service_type: 'inference'
      });
      toast.success('Provider oluşturuldu');
      setShowAddProvider(false);
      setNewProvider({ name: '', display_name: '', api_url: '' });
      fetchProviders();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Provider oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (providerId: number) => {
    if (!confirm('Bu provider ve tüm tokenları silinecek. Emin misiniz?')) return;
    
    try {
      setSaving(true);
      await api.delete(`/admin/ai-providers/${providerId}`);
      toast.success('Provider silindi');
      fetchProviders();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Provider silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActiveProvider = async (providerId: number) => {
    try {
      setSaving(true);
      await api.post(`/admin/ai-providers/${providerId}/set-active`);
      toast.success('Aktif provider değiştirildi');
      fetchProviders();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Provider aktifleştirilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProvider = async (provider: Provider) => {
    try {
      setSaving(true);
      await api.put(`/admin/ai-providers/${provider.id}`, {
        is_enabled: !provider.is_enabled
      });
      toast.success(provider.is_enabled ? 'Provider devre dışı bırakıldı' : 'Provider etkinleştirildi');
      fetchProviders();
    } catch (error: any) {
      toast.error('Provider güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleReorderProviders = async (providerId: number, direction: 'up' | 'down') => {
    const currentIndex = providers.findIndex(p => p.id === providerId);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === providers.length - 1) return;
    
    const newOrder = [...providers];
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newOrder[currentIndex], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[currentIndex]];
    
    try {
      setSaving(true);
      await api.post('/admin/ai-providers/reorder', newOrder.map(p => p.id));
      toast.success('Sıralama güncellendi');
      fetchProviders();
    } catch (error) {
      toast.error('Sıralama güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  // Token operations
  const handleAddToken = async () => {
    if (!editingProvider || !newToken.api_key) {
      toast.error('API key gerekli');
      return;
    }
    
    try {
      setSaving(true);
      await api.post(`/admin/ai-providers/${editingProvider.id}/tokens`, {
        display_name: newToken.display_name || `${editingProvider.display_name} Token ${providerTokens.length + 1}`,
        api_key: newToken.api_key,
        api_url: newToken.api_url || null
      });
      toast.success('Token eklendi');
      setNewToken({ display_name: '', api_key: '', api_url: '' });
      setShowAddToken(false);
      await fetchProviderTokens(editingProvider.id);
      fetchProviders();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Token eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteToken = async (tokenId: number) => {
    if (!editingProvider || !confirm('Bu token silinecek. Emin misiniz?')) return;
    
    try {
      setSaving(true);
      await api.delete(`/admin/ai-providers/${editingProvider.id}/tokens/${tokenId}`);
      toast.success('Token silindi');
      await fetchProviderTokens(editingProvider.id);
      fetchProviders();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Token silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleToken = async (tokenId: number, isActive: boolean) => {
    if (!editingProvider) return;
    
    try {
      setSaving(true);
      await api.put(`/admin/ai-providers/${editingProvider.id}/tokens/${tokenId}`, {
        is_active: isActive
      });
      toast.success(isActive ? 'Token etkinleştirildi' : 'Token devre dışı bırakıldı');
      await fetchProviderTokens(editingProvider.id);
      fetchProviders();
    } catch (error: any) {
      toast.error('Token güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameToken = async (tokenId: number) => {
    if (!editingProvider || !editingTokenName.trim()) {
      setEditingTokenId(null);
      return;
    }
    try {
      setSaving(true);
      await api.put(`/admin/ai-providers/${editingProvider.id}/tokens/${tokenId}`, {
        display_name: editingTokenName.trim()
      });
      toast.success('Token adı güncellendi');
      setEditingTokenId(null);
      await fetchProviderTokens(editingProvider.id);
    } catch (error: any) {
      toast.error('Token adı güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleTestToken = async (tokenId: number) => {
    if (!editingProvider) return;
    
    try {
      setSaving(true);
      const response = await api.post(`/admin/ai-providers/${editingProvider.id}/tokens/${tokenId}/test`);
      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
      await fetchProviderTokens(editingProvider.id);
    } catch (error: any) {
      toast.error('Token test edilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToken = async (tokenId: number, direction: 'up' | 'down') => {
    if (!editingProvider) return;
    
    const currentIndex = providerTokens.findIndex(t => t.id === tokenId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= providerTokens.length) return;
    
    // Create new array with swapped tokens
    const newTokens = [...providerTokens];
    const temp = newTokens[currentIndex];
    newTokens[currentIndex] = newTokens[newIndex];
    newTokens[newIndex] = temp;
    
    // Optimistically update UI
    setProviderTokens(newTokens);
    
    // Update priorities on server - assign sequential priorities based on new order
    try {
      setSaving(true);
      
      // Send all token IDs in new order to backend
      await api.post(`/admin/ai-providers/${editingProvider.id}/tokens/reorder`, {
        token_ids: newTokens.map(t => t.id)
      });
      
      toast.success('Sıralama güncellendi');
      await fetchProviderTokens(editingProvider.id);
    } catch (error: any) {
      // Revert on error
      await fetchProviderTokens(editingProvider.id);
      toast.error('Sıralama güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tokenId: number) => {
    setDraggedTokenId(tokenId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tokenId.toString());
  };

  const handleDragOver = (e: React.DragEvent, tokenId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTokenId !== tokenId) {
      setDragOverTokenId(tokenId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTokenId(null);
  };

  const handleDragEnd = () => {
    setDraggedTokenId(null);
    setDragOverTokenId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetTokenId: number) => {
    e.preventDefault();
    if (!editingProvider || !draggedTokenId || draggedTokenId === targetTokenId) {
      setDraggedTokenId(null);
      setDragOverTokenId(null);
      return;
    }

    const draggedIndex = providerTokens.findIndex(t => t.id === draggedTokenId);
    const targetIndex = providerTokens.findIndex(t => t.id === targetTokenId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder array
    const newTokens = [...providerTokens];
    const [removed] = newTokens.splice(draggedIndex, 1);
    newTokens.splice(targetIndex, 0, removed);

    // Optimistic update
    setProviderTokens(newTokens);
    setDraggedTokenId(null);
    setDragOverTokenId(null);

    // Save to backend
    try {
      setSaving(true);
      await api.post(`/admin/ai-providers/${editingProvider.id}/tokens/reorder`, {
        token_ids: newTokens.map(t => t.id)
      });
      toast.success('Sıralama güncellendi');
      await fetchProviderTokens(editingProvider.id);
    } catch (error: any) {
      await fetchProviderTokens(editingProvider.id);
      toast.error('Sıralama güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const fetchApiKey = async (tokenId: number) => {
    if (!editingProvider) return;
    try {
      const response = await api.get(`/admin/ai-providers/${editingProvider.id}/tokens/${tokenId}/api-key`);
      setApiKeys(prev => ({ ...prev, [tokenId]: response.data.api_key }));
    } catch (error) {
      toast.error('API key alınamadı');
    }
  };

  const toggleShowToken = async (tokenId: number) => {
    if (!showTokens[tokenId] && !apiKeys[tokenId]) {
      await fetchApiKey(tokenId);
    }
    setShowTokens(prev => ({ ...prev, [tokenId]: !prev[tokenId] }));
  };

  const getProviderIcon = (providerName: string) => {
    switch (providerName) {
      case 'huggingface': return '🤗';
      case 'openai': return '🤖';
      case 'deepseek': return '🔍';
      case 'anthropic': return '🧠';
      default: return '🔌';
    }
  };

  const getDefaultApiUrl = (providerName: string) => {
    switch (providerName) {
      case 'huggingface': return 'https://api-inference.huggingface.co/models';
      case 'openai': return 'https://api.openai.com/v1';
      case 'deepseek': return 'https://api.deepseek.com/v1';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      default: return '';
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

  const activeProvider = providers.find(p => p.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Provider Yönetimi</h1>
          <p className="text-gray-600">Provider ve token yapılandırmasını yönetin</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchProviders} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={() => setShowAddProvider(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Provider Ekle
          </Button>
        </div>
      </div>

      {/* Active Provider Info */}
      {activeProvider && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{getProviderIcon(activeProvider.name)}</div>
              <div>
                <p className="text-sm text-gray-600">Aktif Provider</p>
                <h3 className="text-xl font-bold text-gray-900">{activeProvider.display_name}</h3>
                <p className="text-sm text-gray-500">
                  Model: {activeProvider.default_model_display_name || activeProvider.default_model || 'Belirtilmemiş'} • 
                  {activeProvider.active_token_count} aktif token
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Providers List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Provider Listesi
          <span className="text-sm font-normal text-gray-500">({providers.length} provider)</span>
        </h2>
        
        {providers.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Zap className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Henüz Provider Yok</h3>
              <p className="text-gray-600 text-center mb-4">
                İlk AI provider'ınızı ekleyerek başlayın.
              </p>
              <Button onClick={() => setShowAddProvider(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Provider Ekle
              </Button>
            </CardContent>
          </Card>
        ) : (
          providers.map((provider, index) => (
            <Card 
              key={provider.id} 
              className={`transition-all ${
                provider.is_active 
                  ? 'border-blue-500 bg-blue-50/50' 
                  : provider.is_enabled 
                    ? 'border-gray-200' 
                    : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Priority Controls */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorderProviders(provider.id, 'up')}
                        disabled={index === 0 || saving}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorderProviders(provider.id, 'down')}
                        disabled={index === providers.length - 1 || saving}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Provider Info */}
                    <div className="text-3xl">{getProviderIcon(provider.name)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{provider.display_name}</h3>
                        {provider.is_active && (
                          <Badge className="bg-blue-500">
                            <Star className="h-3 w-3 mr-1" />
                            Aktif
                          </Badge>
                        )}
                        {!provider.has_tokens && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Token Yok
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Model: {provider.default_model_display_name || provider.default_model || 'Belirtilmemiş'} • 
                        <span className="inline-flex items-center gap-1 ml-1">
                          <Key className="h-3 w-3" />
                          {provider.active_token_count}/{provider.token_count} token
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={provider.is_enabled}
                      onCheckedChange={() => handleToggleProvider(provider)}
                      disabled={saving || provider.is_active}
                    />
                    
                    {provider.is_enabled && !provider.is_active && provider.has_tokens && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActiveProvider(provider.id)}
                        disabled={saving}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Aktif Yap
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenTokenModal(provider)}
                      disabled={saving}
                      title="Token Yönetimi"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProvider(provider.id)}
                      disabled={saving || provider.is_active}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

      {/* Add Provider Modal */}
      {showAddProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Yeni Provider Ekle</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowAddProvider(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Provider Adı (benzersiz)</Label>
                <Input
                  value={newProvider.name}
                  onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  placeholder="örn: huggingface, openai"
                />
              </div>
              <div>
                <Label>Görünen Ad</Label>
                <Input
                  value={newProvider.display_name}
                  onChange={(e) => setNewProvider({ ...newProvider, display_name: e.target.value })}
                  placeholder="örn: HuggingFace, OpenAI"
                />
              </div>
              <div>
                <Label>API URL (opsiyonel)</Label>
                <Input
                  value={newProvider.api_url}
                  onChange={(e) => setNewProvider({ ...newProvider, api_url: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddProvider(false)}>İptal</Button>
                <Button onClick={handleCreateProvider} disabled={saving}>
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Ekle
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Token Management Modal */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-white rounded-t-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getProviderIcon(editingProvider.name)}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{editingProvider.display_name}</h2>
                  <p className="text-sm text-gray-500">Token Yönetimi</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCloseTokenModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4 bg-white">
              {/* Add Token Button */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Birden fazla token ekleyerek failover sistemi kurabilirsiniz.
                </p>
                <Button size="sm" onClick={() => setShowAddToken(true)} disabled={showAddToken}>
                  <Plus className="h-4 w-4 mr-1" />
                  Token Ekle
                </Button>
              </div>
              
              {/* Add Token Form */}
              {showAddToken && (
                <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Token Adı (opsiyonel)</Label>
                      <Input
                        value={newToken.display_name}
                        onChange={(e) => setNewToken({ ...newToken, display_name: e.target.value })}
                        placeholder={`${editingProvider.display_name} Token ${providerTokens.length + 1}`}
                        className="h-9 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">API URL (opsiyonel)</Label>
                      <Input
                        value={newToken.api_url}
                        onChange={(e) => setNewToken({ ...newToken, api_url: e.target.value })}
                        placeholder={getDefaultApiUrl(editingProvider.name)}
                        className="h-9 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">API Key *</Label>
                    <Input
                      type="text"
                      value={newToken.api_key}
                      onChange={(e) => setNewToken({ ...newToken, api_key: e.target.value })}
                      placeholder="API key girin..."
                      className="h-9 bg-white font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowAddToken(false); setNewToken({ display_name: '', api_key: '', api_url: '' }); }}>
                      İptal
                    </Button>
                    <Button size="sm" onClick={handleAddToken} disabled={saving || !newToken.api_key}>
                      {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                      Ekle
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Token List */}
              {providerTokens.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Key className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600 font-medium">Henüz token eklenmemiş</p>
                  <p className="text-sm text-gray-500 mt-1">Token eklemeden bu provider kullanılamaz.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {providerTokens.map((token, idx) => (
                    <div 
                      key={token.id}
                      draggable={!saving}
                      onDragStart={(e) => handleDragStart(e, token.id)}
                      onDragOver={(e) => handleDragOver(e, token.id)}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, token.id)}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        draggedTokenId === token.id 
                          ? 'opacity-50 scale-[0.98]' 
                          : dragOverTokenId === token.id 
                            ? 'border-blue-400 bg-blue-50 shadow-md' 
                            : token.is_active && token.is_available 
                              ? 'bg-green-50 border-green-200' 
                              : token.is_active 
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-gray-50 border-gray-200 opacity-60'
                      } ${!saving ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Drag Handle & Priority */}
                        <div className="flex items-center gap-1">
                          <div 
                            className="p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                            title="Sürükle-bırak ile sırala"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <button
                              onClick={() => handleMoveToken(token.id, 'up')}
                              disabled={idx === 0 || saving}
                              className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${
                                idx === 0 ? 'opacity-30 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'
                              }`}
                              title="Yukarı taşı"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveToken(token.id, 'down')}
                              disabled={idx === providerTokens.length - 1 || saving}
                              className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${
                                idx === providerTokens.length - 1 ? 'opacity-30 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'
                              }`}
                              title="Aşağı taşı"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-gray-400 w-6">#{idx + 1}</span>
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            {editingTokenId === token.id ? (
                              <input
                                autoFocus
                                className="font-semibold border border-blue-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                value={editingTokenName}
                                onChange={(e) => setEditingTokenName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameToken(token.id);
                                  if (e.key === 'Escape') setEditingTokenId(null);
                                }}
                                onBlur={() => handleRenameToken(token.id)}
                              />
                            ) : (
                              <>
                                <span className="font-semibold">{token.display_name}</span>
                                <button
                                  onClick={() => { setEditingTokenId(token.id); setEditingTokenName(token.display_name); }}
                                  className="text-gray-400 hover:text-gray-600 p-0.5"
                                  title="Adı düzenle"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </>
                            )}
                            {idx === 0 && token.is_active && (
                              <Badge className="bg-blue-500 text-white text-xs">Birincil</Badge>
                            )}
                            {token.is_available === false && token.is_active && (
                              <Badge variant="destructive" className="text-xs">Hata</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                              {showTokens[token.id] && apiKeys[token.id] 
                                ? apiKeys[token.id].substring(0, 24) + '...'
                                : '••••••••••••••••'}
                            </span>
                            <button onClick={() => toggleShowToken(token.id)} className="hover:text-gray-700 p-1">
                              {showTokens[token.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={token.is_active}
                          onCheckedChange={(checked) => handleToggleToken(token.id, checked)}
                          disabled={saving}
                        />
                        <Button variant="outline" size="sm" onClick={() => handleTestToken(token.id)} disabled={saving} title="Test Et">
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeleteToken(token.id)} 
                          disabled={saving}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Info */}
              {providerTokens.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  💡 Tokenları sürükle-bırak veya ok butonlarıyla sıralayın. İlk token başarısız olursa sıradaki denenir.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Nasıl Çalışır?</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-700">
                <li>Provider ekleyin (HuggingFace, OpenAI, DeepSeek vb.)</li>
                <li>Her provider için en az bir API token ekleyin</li>
                <li>Token'ı olan provider'ı aktif yapın</li>
                <li>LLM Modelleri sayfasından model ekleyin</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIProvidersPage;

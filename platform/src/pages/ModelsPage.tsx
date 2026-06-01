import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Bot, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Star,
  Settings,
  Key,
  Lock,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import api from '../services/api';
import type { ModelConfig, ModelConfigCreate, ModelConfigUpdate } from '@/types';
import HuggingFaceAddModelModal from '../components/HuggingFaceAddModelModal';
import EditModelModal from '../components/EditModelModal';

// Provider interface
interface Provider {
  id: number;
  name: string;
  display_name: string;
  service_type: string;
  has_tokens: boolean;
  active_token_count: number;
}

// Provider icon helper
const getProviderIcon = (name: string): string => {
  const icons: Record<string, string> = {
    'huggingface': '🤗',
    'openai': '🤖',
    'anthropic': '🧠',
    'google': '🔮',
    'deepseek': '🔍',
    'groq': '⚡',
    'together': '🤝',
    'mistral': '🌀',
    'cohere': '💬',
  };
  return icons[name.toLowerCase()] || '🔌';
};

// ModelCard Component
function ModelCard({ 
  model, 
  onEdit, 
  onDelete,
  onSetDefault,
  isDeleting,
  isSettingDefault
}: { 
  model: ModelConfig; 
  onEdit: (model: ModelConfig) => void;
  onDelete: (id: number, name: string) => void;
  onSetDefault: (id: number, name: string) => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full">
      <div className="flex items-center justify-between">
        {/* Left Section - Model Info */}
        <div className="flex items-center flex-1">
          <div className="h-12 w-12 rounded-lg flex items-center justify-center mr-4 bg-blue-100">
            <Bot className="h-6 w-6 text-blue-600" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{model.name}</h3>
              {model.is_default && (
                <Star className="h-5 w-5 text-yellow-500 fill-current" />
              )}
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                HuggingFace
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Model:</span>
                <p className="font-medium text-gray-900">{model.model_name}</p>
              </div>
              
              {model.description && (
                <div className="md:col-span-2">
                  <span className="text-gray-600">Açıklama:</span>
                  <p className="text-gray-700">{model.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Section - Status & Actions */}
        <div className="flex items-center space-x-4 ml-6">
          <div className="flex items-center">
            {model.is_active ? (
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">Aktif</span>
              </div>
            ) : (
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-gray-500 mr-1" />
                <span className="text-sm text-gray-500">Pasif</span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            {!model.is_default && (
              <button 
                onClick={() => onSetDefault(model.id, model.name)}
                disabled={isSettingDefault}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors disabled:opacity-50"
              >
                <Star className="h-3 w-3 mr-1 inline" />
                Varsayılan Yap
              </button>
            )}
            <button 
              onClick={() => onEdit(model)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Settings className="h-3 w-3 mr-1 inline" />
              Düzenle
            </button>
            <button
              onClick={() => onDelete(model.id, model.name)}
              disabled={isDeleting}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main ModelsPage Component
export default function ModelsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showHuggingFaceModal, setShowHuggingFaceModal] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const queryClient = useQueryClient();

  // Fetch providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await api.get('/admin/ai-providers/');
        const providerList = response.data.providers || [];
        setProviders(providerList);
        
        // Auto-select first provider with tokens
        const firstWithTokens = providerList.find((p: Provider) => p.has_tokens);
        if (firstWithTokens) {
          setSelectedProvider(firstWithTokens);
        }
      } catch (error) {
        console.error('Error fetching providers:', error);
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchProviders();
  }, []);

  // Fetch models
  const { data: models = [], isLoading } = useQuery<ModelConfig[]>(
    'models',
    adminApi.getModels,
    {
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Modeller yüklenirken hata oluştu');
      }
    }
  );

  // Filter models by selected provider
  const filteredModels = selectedProvider 
    ? models.filter(m => m.provider === selectedProvider.name)
    : [];

  // Create model mutation
  const createModelMutation = useMutation(adminApi.createModel, {
    onSuccess: () => {
      queryClient.invalidateQueries('models');
      toast.success('Model başarıyla eklendi!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Model eklenirken hata oluştu');
    }
  });

  // Delete model mutation
  const deleteModelMutation = useMutation(adminApi.deleteModel, {
    onSuccess: () => {
      queryClient.invalidateQueries('models');
      toast.success('Model başarıyla silindi!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Model silinirken hata oluştu');
    }
  });

  // Update model mutation
  const updateModelMutation = useMutation(
    ({ id, data }: { id: number; data: ModelConfigUpdate }) => adminApi.updateModel(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('models');
        toast.success('Model başarıyla güncellendi!');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Model güncellenirken hata oluştu');
      }
    }
  );

  // Set default model mutation
  const setDefaultMutation = useMutation(
    (id: number) => adminApi.updateModel(id, { is_default: true }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('models');
        toast.success('Varsayılan model değiştirildi!');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Varsayılan model değiştirilirken hata oluştu');
      }
    }
  );

  const handleEditModel = (model: ModelConfig) => {
    setEditingModel(model);
  };

  const handleSetDefault = (id: number, name: string) => {
    if (window.confirm(`"${name}" modelini varsayılan yapmak istediğinizden emin misiniz?`)) {
      setDefaultMutation.mutate(id);
    }
  };

  const handleDeleteModel = (id: number, name: string) => {
    if (window.confirm(`"${name}" modelini silmek istediğinizden emin misiniz?`)) {
      deleteModelMutation.mutate(id);
    }
  };

  const handleAddModelClick = () => {
    if (!selectedProvider) return;
    
    // For now, only HuggingFace has a modal
    if (selectedProvider.name === 'huggingface') {
      setShowHuggingFaceModal(true);
    } else {
      toast.error(`${selectedProvider.display_name} için model ekleme henüz desteklenmiyor`);
    }
  };

  const handleAddHuggingFaceModel = (modelId: string) => {
    // Extract model name from ID (e.g., "openai/gpt-oss-20b" -> "GPT-OSS 20B")
    const modelName = modelId.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || modelId;
    
    const modelData: ModelConfigCreate = {
      name: modelName,
      provider: 'huggingface',
      model_name: modelId,
      description: `HuggingFace model: ${modelId}`,
      num_ctx: 131072,
      num_predict: 1024,
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      repeat_penalty: 1.1,
      max_context_chars: 1500,
      rag_top_k: 3,
      chunk_size: 500,
      chunk_overlap: 100,
      timeout_seconds: 120,
      stream_enabled: true,
      is_active: true,
      is_default: false
    };
    
    createModelMutation.mutate(modelData);
    setShowHuggingFaceModal(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Provider List */}
      <div className="w-72 bg-white shadow-lg border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">LLM Modelleri</h1>
          <p className="text-xs text-gray-500 mt-1">Provider seçerek modellerini görüntüleyin</p>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {loadingProviders ? (
              // Loading skeleton
              [...Array(4)].map((_, i) => (
                <div key={i} className="p-3 rounded-lg animate-pulse">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-gray-200 rounded-lg mr-3"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : providers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Provider bulunamadı</p>
              </div>
            ) : (
              providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => provider.has_tokens && setSelectedProvider(provider)}
                  disabled={!provider.has_tokens}
                  className={`w-full flex items-center p-3 rounded-lg transition-all text-left ${
                    selectedProvider?.id === provider.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : provider.has_tokens
                        ? 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        : 'bg-gray-50 opacity-50 cursor-not-allowed border-2 border-transparent'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center mr-3 text-xl ${
                    selectedProvider?.id === provider.id
                      ? 'bg-blue-100'
                      : 'bg-gray-100'
                  }`}>
                    {getProviderIcon(provider.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${
                        selectedProvider?.id === provider.id ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {provider.display_name}
                      </span>
                      {!provider.has_tokens && (
                        <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {provider.has_tokens ? (
                        <>
                          <Key className="h-3 w-3" />
                          <span>{provider.active_token_count} token</span>
                        </>
                      ) : (
                        <span className="text-gray-400">Token gerekli</span>
                      )}
                    </div>
                  </div>
                  {selectedProvider?.id === provider.id && (
                    <div className="w-1.5 h-8 bg-blue-500 rounded-full ml-2"></div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3 border-t border-gray-200 bg-amber-50">
          <p className="text-xs text-amber-700">
            💡 Token eklemek için <strong>AI Sağlayıcıları</strong> sayfasını kullanın
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Main Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedProvider && (
                <span className="text-2xl">{getProviderIcon(selectedProvider.name)}</span>
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedProvider ? `${selectedProvider.display_name} Modelleri` : 'Modeller'}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedProvider 
                    ? `${filteredModels.length} model kayıtlı`
                    : 'Sol taraftan bir provider seçin'
                  }
                </p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {/* HuggingFace Inference Providers Link */}
              {selectedProvider?.name === 'huggingface' && (
                <a
                  href="https://huggingface.co/inference/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Provider İstatistikleri</span>
                </a>
              )}
              
              {/* Add Model Button */}
              {selectedProvider && selectedProvider.has_tokens && (
                <button
                  onClick={handleAddModelClick}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Model Ekle
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Models Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedProvider ? (
            // No provider selected
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bot className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Provider Seçin</p>
              <p className="text-sm">Sol taraftan bir provider seçerek modellerini görüntüleyin</p>
            </div>
          ) : isLoading ? (
            // Loading
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                  <div className="flex items-center">
                    <div className="h-12 w-12 bg-gray-200 rounded-lg mr-4"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredModels.length === 0 ? (
            // No models for this provider
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bot className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Henüz model eklenmemiş</p>
              <p className="text-sm mb-4">{selectedProvider.display_name} için model ekleyin</p>
              <button
                onClick={handleAddModelClick}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                İlk Modeli Ekle
              </button>
            </div>
          ) : (
            // Model list
            <div className="space-y-4">
              {filteredModels.map((model) => (
                <ModelCard 
                  key={model.id} 
                  model={model} 
                  onEdit={handleEditModel}
                  onDelete={handleDeleteModel}
                  onSetDefault={handleSetDefault}
                  isDeleting={deleteModelMutation.isLoading}
                  isSettingDefault={setDefaultMutation.isLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showHuggingFaceModal && (
        <HuggingFaceAddModelModal
          isOpen={showHuggingFaceModal}
          onClose={() => setShowHuggingFaceModal(false)}
          onModelAdd={handleAddHuggingFaceModel}
        />
      )}

      {/* Model Edit Modal */}
      {editingModel && (
        <EditModelModal
          model={editingModel}
          onClose={() => setEditingModel(null)}
          onSubmit={(updatedModel: ModelConfigUpdate) => {
            updateModelMutation.mutate({ 
              id: editingModel.id, 
              data: updatedModel 
            });
            setEditingModel(null);
          }}
          isLoading={updateModelMutation.isLoading}
        />
      )}
    </div>
  );
}

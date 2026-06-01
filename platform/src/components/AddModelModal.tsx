import { useState } from 'react';
import { X, Save, Plus } from 'lucide-react';
import type { ModelConfigCreate } from '@/types';

interface AddModelModalProps {
  onClose: () => void;
  onSubmit: (data: ModelConfigCreate) => void;
  isLoading?: boolean;
}

export default function AddModelModal({
  onClose,
  onSubmit,
  isLoading = false,
}: AddModelModalProps) {
  const [formData, setFormData] = useState<ModelConfigCreate>({
    name: '',
    provider: 'huggingface',
    model_name: '',
    description: '',
    
    // LLM Parameters
    num_ctx: 2048,
    num_predict: 512,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    
    // RAG Parameters
    max_context_chars: 1500,
    rag_top_k: 3,
    chunk_size: 500,
    chunk_overlap: 100,
    
    // System Parameters
    timeout_seconds: 120,
    stream_enabled: true,
    
    is_default: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: keyof ModelConfigCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Plus className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Yeni Model Ekle
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <div className="h-2 w-2 bg-blue-500 rounded-full mr-2"></div>
                Temel Bilgiler
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model Adı *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="GPT-4 Turbo"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Panelde görünecek açıklayıcı model adı
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sağlayıcı *
                  </label>
                  <select
                    value={formData.provider}
                    onChange={(e) => handleChange('provider', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="huggingface">HuggingFace</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="cohere">Cohere</option>
                    <option value="mistral">Mistral</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Model sağlayıcısı (huggingface, openai, anthropic, vb.)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model İsmi *
                  </label>
                  <input
                    type="text"
                    value={formData.model_name}
                    onChange={(e) => handleChange('model_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="openai/gpt-oss-120b"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    API'de kullanılacak gerçek model adı
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Model hakkında kısa açıklama..."
                />
              </div>
            </div>

            {/* Quick Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                Hızlı Ayarlar
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Context Size
                  </label>
                  <input
                    type="number"
                    value={formData.num_ctx}
                    onChange={(e) => handleChange('num_ctx', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="128"
                    max="1048576"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={formData.num_predict}
                    onChange={(e) => handleChange('num_predict', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="4096"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Top P
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.top_p}
                    onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="1"
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <div className="h-2 w-2 bg-purple-500 rounded-full mr-2"></div>
                Seçenekler
              </h4>
              
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.stream_enabled ?? true}
                    onChange={(e) => handleChange('stream_enabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Stream Yanıtları</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_default ?? false}
                    onChange={(e) => handleChange('is_default', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Varsayılan Model</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.name || !formData.model_name}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Ekleniyor...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Model Ekle
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

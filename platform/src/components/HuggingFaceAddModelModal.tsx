import { useState, useEffect } from 'react';
import { X, Search, Download, Star, Users, Calendar, Database, Plus, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getApiBaseUrl } from '@/services/api';

interface HuggingFaceModel {
  id: string;
  author: string;
  modelId: string;
  pipeline_tag: string | null;
  tags: string[];
  downloads: number;
  likes: number;
  library_name: string | null;
  created_at: string;
  updated_at: string;
}

interface HuggingFaceAddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelAdd: (modelId: string) => void;
}

export default function HuggingFaceAddModelModal({ 
  isOpen, 
  onClose, 
  onModelAdd 
}: HuggingFaceAddModelModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [models, setModels] = useState<HuggingFaceModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch popular models on mount
  useEffect(() => {
    if (isOpen) {
      fetchPopularModels();
    }
  }, [isOpen]);

  const fetchPopularModels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(`${getApiBaseUrl()}/admin/huggingface/models/popular?limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch popular models');
      }

      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error('Error fetching popular models:', error);
      toast.error('Popüler modeller yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const searchModels = async () => {
    if (!searchQuery.trim()) {
      fetchPopularModels();
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('ragleaf_token');
      const response = await fetch(
        `${getApiBaseUrl()}/admin/huggingface/models/search?query=${encodeURIComponent(searchQuery)}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search models');
      }

      const data = await response.json();
      setModels(data.models);
    } catch (error) {
      console.error('Error searching models:', error);
      toast.error('Model arama başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleAddModel = (modelId: string) => {
    onModelAdd(modelId);
    toast.success(`Model eklendi: ${modelId}`);
    onClose();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Bilinmiyor';
    try {
      return new Date(dateString).toLocaleDateString('tr-TR');
    } catch {
      return 'Bilinmiyor';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">HuggingFace Model Ekle</h2>
            <p className="text-sm text-gray-600 mt-1">
              HuggingFace Hub'dan model arayın ve projenize ekleyin
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Model adı veya yazar ara... (örn: microsoft/DialoGPT, gpt2)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchModels()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={searchModels}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>Ara</span>
            </button>
          </div>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Modeller yükleniyor...</span>
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Database className="h-12 w-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">Model bulunamadı</p>
              <p className="text-sm">Farklı anahtar kelimeler deneyin</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {models.map((model) => (
                <div key={model.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {model.modelId}
                        </h3>
                        {model.pipeline_tag && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {model.pipeline_tag}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{model.author}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Download className="h-4 w-4" />
                          <span>{formatNumber(model.downloads)} indirme</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4" />
                          <span>{formatNumber(model.likes)} beğeni</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(model.updated_at)}</span>
                        </div>
                      </div>

                      {model.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {model.tags.slice(0, 5).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {model.tags.length > 5 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                              +{model.tags.length - 5} daha
                            </span>
                          )}
                        </div>
                      )}

                      {model.library_name && (
                        <div className="text-sm text-gray-600">
                          <strong>Kütüphane:</strong> {model.library_name}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleAddModel(model.modelId)}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Ekle</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <strong>Not:</strong> Eklenen modeller otomatik olarak yapılandırılacak ve kullanıma hazır hale gelecektir.
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

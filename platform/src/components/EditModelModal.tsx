import { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { ModelConfig, ModelConfigUpdate } from '@/types';

interface EditModelModalProps {
  model: ModelConfig;
  onClose: () => void;
  onSubmit: (data: ModelConfigUpdate) => void;
  isLoading?: boolean;
}

export default function EditModelModal({
  model,
  onClose,
  onSubmit,
  isLoading = false,
}: EditModelModalProps) {
  const [formData, setFormData] = useState<ModelConfigUpdate>({
    name: model.name,
    description: model.description || '',
    provider: model.provider,
    model_name: model.model_name,
    
    // LLM Parameters (RAG-Optimized)
    num_ctx: model.num_ctx || 32768,
    num_predict: model.num_predict || 4096,
    temperature: model.temperature || 0.3,
    top_p: model.top_p || 0.9,
    top_k: model.top_k || 40,
    repeat_penalty: model.repeat_penalty || 1.1,
    
    // RAG Parameters (Optimized for Technical Documentation)
    max_context_chars: model.max_context_chars || 8000,
    rag_top_k: model.rag_top_k || 5,
    chunk_size: model.chunk_size || 1000,
    chunk_overlap: model.chunk_overlap || 200,
    
    // System Parameters
    timeout_seconds: model.timeout_seconds || 120,
    stream_enabled: model.stream_enabled ?? true,
    
    is_active: model.is_active,
    is_default: model.is_default,
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'llm' | 'rag' | 'system'>('basic');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: keyof ModelConfigUpdate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Model Düzenle</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="border-b">
            <div className="flex space-x-1 p-2">
              {[
                { id: 'basic', label: 'Temel Bilgiler' },
                { id: 'llm', label: 'LLM Parametreleri' },
                { id: 'rag', label: 'RAG Parametreleri' },
                { id: 'system', label: 'Sistem' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model Adı
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Panelde görünecek açıklayıcı model adı
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sağlayıcı
                  </label>
                  <input
                    type="text"
                    value={formData.provider || ''}
                    onChange={(e) => handleChange('provider', e.target.value)}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Model sağlayıcısı (huggingface, openai, anthropic, vb.)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model İsmi
                  </label>
                  <input
                    type="text"
                    value={formData.model_name || ''}
                    onChange={(e) => handleChange('model_name', e.target.value)}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    API'de kullanılacak gerçek model adı (örn: openai/gpt-oss-120b)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="input min-h-[80px]"
                    placeholder="Model hakkında kısa bir açıklama..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Modelin kullanım amacı veya özellikleri hakkında açıklama
                  </p>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active || false}
                      onChange={(e) => handleChange('is_active', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Aktif</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default || false}
                      onChange={(e) => handleChange('is_default', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Varsayılan Model</span>
                  </label>
                </div>
              </div>
            )}

            {/* LLM Parameters Tab */}
            {activeTab === 'llm' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Context Window (num_ctx)
                    </label>
                    <input
                      type="number"
                      value={formData.num_ctx || 32768}
                      onChange={(e) => handleChange('num_ctx', parseInt(e.target.value))}
                      className="input"
                      min="128"
                      max="1048576"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Model'in aynı anda işleyebileceği maksimum token sayısı. Modern LLM'ler 32K-128K context destekler. <strong>Önerilen: 32768</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Tokens (num_predict)
                    </label>
                    <input
                      type="number"
                      value={formData.num_predict || 4096}
                      onChange={(e) => handleChange('num_predict', parseInt(e.target.value))}
                      className="input"
                      min="1"
                      max="16384"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Tek bir yanıtta üretilecek maksimum token sayısı. RAG için <strong>4096 önerilir</strong> (detaylı teknik yanıtlar için).
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temperature
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature || 0.3}
                      onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                      className="input"
                      min="0"
                      max="2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Yanıtların yaratıcılık seviyesi. <strong>0.3 = tutarlı teknik yanıtlar</strong>, 0.7 = dengeli, 1.0+ = yaratıcı.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Top P
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.top_p || 0.9}
                      onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
                      className="input"
                      min="0"
                      max="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nucleus sampling. Sadece en olası %90'lık token'ları dikkate alır. Düşük değerler daha odaklı yanıtlar üretir.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Top K
                    </label>
                    <input
                      type="number"
                      value={formData.top_k || 40}
                      onChange={(e) => handleChange('top_k', parseInt(e.target.value))}
                      className="input"
                      min="1"
                      max="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Sadece en olası K adet token'ı dikkate alır. Düşük değerler (10-20) daha tutarlı, yüksek değerler (50-100) daha çeşitli yanıtlar üretir.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Repeat Penalty
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.repeat_penalty || 1.1}
                      onChange={(e) => handleChange('repeat_penalty', parseFloat(e.target.value))}
                      className="input"
                      min="0"
                      max="2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Tekrarlayan kelimeleri cezalandırır. 1.0 = ceza yok, 1.1 = hafif ceza, 1.5+ = güçlü ceza. Yüksek değerler daha çeşitli kelime kullanımı sağlar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* RAG Parameters Tab */}
            {activeTab === 'rag' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Context Chars
                    </label>
                    <input
                      type="number"
                      value={formData.max_context_chars || 8000}
                      onChange={(e) => handleChange('max_context_chars', parseInt(e.target.value))}
                      className="input"
                      min="100"
                      max="20000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      RAG sisteminden alınan toplam karakter sayısı. <strong>Önerilen: 8000</strong> (5 chunk × ~1600 char).
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RAG Top K
                    </label>
                    <input
                      type="number"
                      value={formData.rag_top_k || 5}
                      onChange={(e) => handleChange('rag_top_k', parseInt(e.target.value))}
                      className="input"
                      min="1"
                      max="20"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Getirilecek chunk sayısı. <strong>Önerilen: 5</strong> (detaylı teknik sorular için). 3 = hızlı, 5 = dengeli, 7+ = kapsamlı.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chunk Size
                    </label>
                    <input
                      type="number"
                      value={formData.chunk_size || 1000}
                      onChange={(e) => handleChange('chunk_size', parseInt(e.target.value))}
                      className="input"
                      min="100"
                      max="2000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Her chunk'ın karakter boyutu. <strong>Önerilen: 1000</strong>. Büyük chunk'lar daha fazla bağlam içerir.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chunk Overlap
                    </label>
                    <input
                      type="number"
                      value={formData.chunk_overlap || 200}
                      onChange={(e) => handleChange('chunk_overlap', parseInt(e.target.value))}
                      className="input"
                      min="0"
                      max="500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Chunk'lar arası örtüşme. <strong>Önerilen: 200</strong> (bilgi kaybını önler). Chunk size'ın %20'si ideal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timeout (saniye)
                  </label>
                  <input
                    type="number"
                    value={formData.timeout_seconds || 120}
                    onChange={(e) => handleChange('timeout_seconds', parseInt(e.target.value))}
                    className="input"
                    min="10"
                    max="600"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Model'den yanıt beklenecek maksimum süre. Uzun süreli işlemler için daha yüksek değerler kullanın.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="stream_enabled"
                    checked={formData.stream_enabled ?? true}
                    onChange={(e) => handleChange('stream_enabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div>
                    <label htmlFor="stream_enabled" className="text-sm font-medium text-gray-700">
                      Stream Yanıtları Etkinleştir
                    </label>
                    <p className="text-xs text-gray-500">
                      Yanıtları kelime kelime gerçek zamanlı olarak gösterir. Devre dışı bırakılırsa yanıt tamamlandıktan sonra gösterilir.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors font-medium"
              disabled={isLoading}
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center disabled:opacity-50"
              disabled={isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

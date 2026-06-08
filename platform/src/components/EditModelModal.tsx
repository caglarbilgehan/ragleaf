import { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { ModelConfig, ModelConfigUpdate } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';

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
  const { t } = useTranslation();
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

  const [activeTab, setActiveTab] = useState<'basic' | 'llm' | 'system'>('basic');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: keyof ModelConfigUpdate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-100">{t('admin.models.edit_modal_title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="border-b">
            <div className="flex space-x-1 p-2">
              {[
                { id: 'basic', label: t('admin.models.tab_basic') },
                { id: 'llm', label: t('admin.models.tab_llm') },
                { id: 'system', label: t('admin.models.tab_system') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-dark-600'
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
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('admin.models.label_name')}
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('admin.models.name_hint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('admin.models.label_provider')}
                  </label>
                  <input
                    type="text"
                    value={formData.provider || ''}
                    onChange={(e) => handleChange('provider', e.target.value)}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('admin.models.provider_hint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('admin.models.label_model_name')}
                  </label>
                  <input
                    type="text"
                    value={formData.model_name || ''}
                    onChange={(e) => handleChange('model_name', e.target.value)}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('admin.models.model_name_hint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('admin.models.label_desc')}
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="input min-h-[80px]"
                    placeholder={t('admin.models.desc_placeholder')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('admin.models.desc_hint')}
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
                    <span className="text-sm text-gray-300">{t('admin.models.label_active')}</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default || false}
                      onChange={(e) => handleChange('is_default', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-300">{t('admin.models.label_default')}</span>
                  </label>
                </div>
              </div>
            )}

            {/* LLM Parameters Tab */}
            {activeTab === 'llm' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {t('admin.models.label_num_ctx')}
                    </label>
                    <input
                      type="number"
                      value={formData.num_ctx || 32768}
                      onChange={(e) => handleChange('num_ctx', parseInt(e.target.value))}
                      className="input"
                      min="128"
                      max="1048576"
                    />
                    <p className="text-xs text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: t('admin.models.num_ctx_hint') }} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {t('admin.models.label_num_predict')}
                    </label>
                    <input
                      type="number"
                      value={formData.num_predict || 4096}
                      onChange={(e) => handleChange('num_predict', parseInt(e.target.value))}
                      className="input"
                      min="1"
                      max="16384"
                    />
                    <p className="text-xs text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: t('admin.models.num_predict_hint') }} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {t('admin.models.label_temperature')}
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
                    <p className="text-xs text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: t('admin.models.temperature_hint') }} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {t('admin.models.label_top_p')}
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
                    <p className="text-xs text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: t('admin.models.top_p_hint') }} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {t('admin.models.label_top_k')}
                    </label>
                    <input
                      type="number"
                      value={formData.top_k || 40}
                      onChange={(e) => handleChange('top_k', parseInt(e.target.value))}
                      className="input"
                      min="1"
                      max="100"
                    />
                    <p className="text-xs text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: t('admin.models.top_k_hint') }} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {t('admin.models.label_repeat_penalty')}
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
                    <p className="text-xs text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: t('admin.models.repeat_penalty_hint') }} />
                  </div>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('admin.models.label_timeout')}
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
                    {t('admin.models.timeout_hint')}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="stream_enabled"
                    checked={formData.stream_enabled ?? true}
                    onChange={(e) => handleChange('stream_enabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-white/[0.1] rounded"
                  />
                  <div>
                    <label htmlFor="stream_enabled" className="text-sm font-medium text-gray-300">
                      {t('admin.models.label_stream')}
                    </label>
                    <p className="text-xs text-gray-500">
                      {t('admin.models.stream_hint')}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t bg-dark-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 bg-dark-500 rounded-md hover:bg-dark-400 transition-colors font-medium"
              disabled={isLoading}
            >
              {t('ui.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center disabled:opacity-50"
              disabled={isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? t('admin.models.saving') : t('ui.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

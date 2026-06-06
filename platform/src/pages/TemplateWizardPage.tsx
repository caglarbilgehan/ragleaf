// platform/src/pages/TemplateWizardPage.tsx
// Sektörel şablondan agent oluşturma wizard'ı
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  templateApi,
  type AgentTemplate,
  type TemplateConfigField,
} from '@/services/ragleafApi';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  SparklesIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

type WizardStep = 'select' | 'configure' | 'preview';

export default function TemplateWizardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [configData, setConfigData] = useState<Record<string, any>>({});
  const [agentName, setAgentName] = useState('');

  const { data: templates = [], isLoading } = useQuery<AgentTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => templateApi.list(),
  });

  // Initialize config defaults when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      const defaults: Record<string, any> = {};
      for (const field of selectedTemplate.config_schema) {
        if (field.default !== undefined) {
          defaults[field.key] = field.default;
        } else if (field.type === 'tag_list') {
          defaults[field.key] = [];
        } else if (field.type === 'schedule') {
          defaults[field.key] = {};
        } else {
          defaults[field.key] = '';
        }
      }
      setConfigData(defaults);
      setAgentName('');
    }
  }, [selectedTemplate]);

  const createMutation = useMutation({
    mutationFn: () =>
      templateApi.createFromTemplate({
        template_slug: selectedTemplate!.slug,
        config_data: configData,
        agent_name: agentName || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('🎉 Agent başarıyla oluşturuldu!');
      navigate(`/agents/${data.id}/edit`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Asistan oluşturma hatası');
    },
  });

  const updateConfig = useCallback((key: string, value: any) => {
    setConfigData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = () => {
    if (step === 'select') return !!selectedTemplate;
    if (step === 'configure') {
      if (!selectedTemplate) return false;
      return selectedTemplate.config_schema
        .filter((f) => f.required)
        .every((f) => {
          const val = configData[f.key];
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
          return !!val;
        });
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'select') setStep('configure');
    else if (step === 'configure') setStep('preview');
    else if (step === 'preview') createMutation.mutate();
  };

  const handleBack = () => {
    if (step === 'configure') setStep('select');
    else if (step === 'preview') setStep('configure');
  };

  const stepIndex = step === 'select' ? 0 : step === 'configure' ? 1 : 2;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/agents')}
          className="p-2 hover:bg-dark-600 rounded-lg"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Hazır Asistan Seç</h1>
          <p className="text-sm text-gray-500">
            Sektörünüze uygun şablonu seçin, bilgilerinizi girin, hemen kullanmaya başlayın
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['Şablon Seçimi', 'Bilgi Girişi', 'Önizleme & Oluştur'].map((label, idx) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                idx < stepIndex
                  ? 'bg-green-500 text-white'
                  : idx === stepIndex
                  ? 'bg-primary-600 text-white ring-4 ring-primary-500/20'
                  : 'bg-dark-500 text-gray-500'
              }`}
            >
              {idx < stepIndex ? '✓' : idx + 1}
            </div>
            <span
              className={`text-sm font-medium ${
                idx === stepIndex ? 'text-primary-400' : 'text-gray-500'
              }`}
            >
              {label}
            </span>
            {idx < 2 && (
              <div
                className={`flex-1 h-0.5 ${
                  idx < stepIndex ? 'bg-green-500' : 'bg-dark-500'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 min-h-[400px]">
        {/* STEP 1: Template Selection */}
        {step === 'select' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-100">Sektörünüzü Seçin</h3>
            <p className="text-sm text-gray-500">
              İşletmenize uygun hazır AI asistan şablonunu seçin. Şablon, sektörünüze özel system prompt, hizmet listesi ve randevu sistemi içerir.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <SparklesIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Henüz şablon eklenmemiş</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.slug}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all hover:shadow-md ${
                      selectedTemplate?.slug === tmpl.slug
                        ? 'border-primary-500 bg-primary-500/10 ring-2 ring-primary-500/20'
                        : 'border-white/[0.06] hover:border-primary-500/50 hover:bg-dark-700/30'
                    }`}
                  >
                    {tmpl.is_featured && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
                        ⭐ Önerilen
                      </span>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{tmpl.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-100">{tmpl.name}</h4>
                        <p className="text-xs text-gray-500">{tmpl.category}</p>
                      </div>
                    </div>
                    {tmpl.description && (
                      <p className="text-sm text-gray-400 mb-3">{tmpl.description}</p>
                    )}
                    {tmpl.preview_questions && tmpl.preview_questions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-400">Örnek sorular:</p>
                        {tmpl.preview_questions.slice(0, 3).map((q, i) => (
                          <p key={i} className="text-xs text-gray-500 flex items-start gap-1">
                            <span className="text-primary-400">💬</span> {q}
                          </p>
                        ))}
                      </div>
                    )}
                    {selectedTemplate?.slug === tmpl.slug && (
                      <div className="absolute top-3 left-3">
                        <CheckCircleIcon className="h-6 w-6 text-primary-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Configuration */}
        {step === 'configure' && selectedTemplate && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{selectedTemplate.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-500">İşletme bilgilerinizi girin</p>
              </div>
            </div>

            {/* Agent name override */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Agent Adı <span className="text-gray-400 font-normal">(opsiyonel)</span>
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder={`Otomatik: ${configData.firma_adi || 'Firma'} Asistanı`}
                className="w-full px-3 py-2 border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <hr />

            {/* Dynamic fields from config_schema */}
            {selectedTemplate.config_schema.map((field) => (
              <DynamicField
                key={field.key}
                field={field}
                value={configData[field.key]}
                onChange={(val) => updateConfig(field.key, val)}
              />
            ))}
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && selectedTemplate && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-100">Önizleme & Onay</h3>

            {/* Summary card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-xl p-4 space-y-3">
                <h4 className="font-medium text-gray-100 flex items-center gap-2">
                  <span className="text-xl">{selectedTemplate.icon}</span>
                  {agentName || `${configData.firma_adi || ''} Asistanı`}
                </h4>
                <div className="space-y-2 text-sm text-gray-600">
                  {selectedTemplate.config_schema.map((field) => {
                    const val = configData[field.key];
                    if (!val || (Array.isArray(val) && val.length === 0)) return null;
                    return (
                      <div key={field.key}>
                        <span className="font-medium text-gray-300">{field.label}: </span>
                        {Array.isArray(val)
                          ? val.join(', ')
                          : typeof val === 'object'
                          ? Object.entries(val)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' | ')
                          : String(val)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Widget Preview */}
              <div className="border rounded-xl p-4 bg-dark-700/50">
                <p className="text-xs font-medium text-gray-500 mb-3">Widget Önizleme</p>
                <div className="bg-dark-800/60 rounded-xl shadow-lg border p-4 max-w-[280px] mx-auto">
                  <div
                    className="rounded-lg p-3 mb-3 text-white text-sm"
                    style={{ backgroundColor: selectedTemplate.default_appearance?.primary_color || '#4F46E5' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{selectedTemplate.icon}</span>
                      <span className="font-semibold text-sm">
                        {agentName || `${configData.firma_adi || ''} Asistanı`}
                      </span>
                    </div>
                    <p className="text-xs opacity-90">
                      {selectedTemplate.default_welcome_message
                        ?.replace('{{firma_adi}}', configData.firma_adi || 'Firma')
                        .substring(0, 120)}
                      ...
                    </p>
                  </div>
                  {selectedTemplate.preview_questions?.slice(0, 2).map((q, i) => (
                    <div
                      key={i}
                      className="bg-dark-600 rounded-lg px-3 py-2 mb-2 text-xs text-gray-600"
                    >
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              <strong>Not:</strong> Asistan oluşturulduktan sonra tüm ayarları düzenleyebilirsiniz.
              System prompt, görünüm ve RAG ayarları Asistan düzenleme sayfasından değiştirilebilir.
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 'select'}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 bg-dark-600 rounded-lg hover:bg-dark-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Geri
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed() || createMutation.isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {step === 'preview' ? (
            createMutation.isPending ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5" />
                Asistan Oluştur
              </>
            )
          ) : (
            <>
              İleri
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Dynamic Field Component
// ============================================================================

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: TemplateConfigField;
  value: any;
  onChange: (val: any) => void;
}) {
  const [tagInput, setTagInput] = useState('');

  const label = (
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {field.label}
      {field.required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  switch (field.type) {
    case 'text':
    case 'phone':
      return (
        <div>
          {label}
          <input
            type={field.type === 'phone' ? 'tel' : 'text'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      );

    case 'textarea':
      return (
        <div>
          {label}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {label}
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      );

    case 'tag_list': {
      const tags: string[] = Array.isArray(value) ? value : [];
      const addTag = (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !tags.includes(trimmed)) {
          onChange([...tags, trimmed]);
        }
        setTagInput('');
      };
      return (
        <div>
          {label}
          {/* Selected Tags */}
          <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => onChange(tags.filter((t) => t !== tag))}
                  className="hover:text-red-600"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder={field.placeholder || 'Yeni ekle...'}
              className="flex-1 px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              onClick={() => addTag(tagInput)}
              disabled={!tagInput.trim()}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
          {/* Suggestions */}
          {field.suggestions && field.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-400 mb-1">Hızlı ekle:</p>
              <div className="flex flex-wrap gap-1">
                {field.suggestions
                  .filter((s) => !tags.includes(s))
                  .slice(0, 12)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => addTag(s)}
                      className="px-2 py-0.5 text-xs bg-dark-600 text-gray-400 border border-white/[0.06] rounded hover:bg-primary-500/10 hover:text-primary-400 hover:border-primary-500/20 transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'schedule': {
      const schedule: Record<string, string> = typeof value === 'object' && value ? value : {};
      const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
      return (
        <div>
          {label}
          <div className="space-y-2 border rounded-lg p-3">
            {days.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-sm text-gray-300 w-24 font-medium">{day}</span>
                <input
                  type="text"
                  value={schedule[day] || ''}
                  onChange={(e) => onChange({ ...schedule, [day]: e.target.value })}
                  placeholder="09:00 - 20:00 veya Kapalı"
                  className="flex-1 px-3 py-1.5 text-sm border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    default:
      return (
        <div>
          {label}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      );
  }
}

// platform/src/pages/admin/TemplateBuilderPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { templateApi, type AgentTemplate, type AgentDocument } from '@/services/ragleafApi';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  FolderIcon,
  ArrowPathIcon,
  TrashIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline';

type Tab = 'general' | 'prompt' | 'advanced' | 'documents';

const CATEGORY_LABELS: Record<string, string> = {
  beauty: 'Güzellik & Bakım',
  health: 'Sağlık',
  retail: 'Perakende & E-Ticaret',
  food: 'Yeme & İçme',
  finance: 'Finans',
  education: 'Eğitim & Kurs',
  general: 'Genel Destek',
};

export default function TemplateBuilderPage() {
  const { t, language } = useTranslation();
  const { templateSlug } = useParams<{ templateSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const isEditMode = templateSlug !== 'new';
  
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Form states
  const [form, setForm] = useState({
    name: '',
    slug: '',
    category: 'beauty',
    description: '',
    icon: '💡',
    defaultSystemPrompt: '',
    defaultWelcomeMessage: '',
    configSchemaJson: '[]',
    previewQuestionsText: '',
    isFeatured: false,
    isActive: true,
    sortOrder: 0,
  });

  // Fetch template in edit mode
  const { data: template, isLoading } = useQuery({
    queryKey: ['template-admin-detail', templateSlug],
    queryFn: () => templateApi.get(templateSlug!),
    enabled: isEditMode && !!templateSlug,
  });

  // Populate form in edit mode
  useEffect(() => {
    if (isEditMode && template) {
      setForm({
        name: template.name || '',
        slug: template.slug || '',
        category: template.category || 'beauty',
        description: template.description || '',
        icon: template.icon || '💡',
        defaultSystemPrompt: template.default_system_prompt || '',
        defaultWelcomeMessage: template.default_welcome_message || '',
        configSchemaJson: JSON.stringify(template.config_schema || [], null, 2),
        previewQuestionsText: (template.preview_questions || []).join('\n'),
        isFeatured: !!template.is_featured,
        isActive: !!template.is_active,
        sortOrder: template.sort_order || 0,
      });
    } else if (!isEditMode) {
      setForm({
        name: '',
        slug: '',
        category: 'beauty',
        description: '',
        icon: '💡',
        defaultSystemPrompt: 'Sen {{firma_adi}} firmasının AI asistanısın.',
        defaultWelcomeMessage: 'Merhaba! Size nasıl yardımcı olabilirim?',
        configSchemaJson: JSON.stringify([
          { key: 'firma_adi', label: 'Firma Adı', type: 'text', required: true, placeholder: 'Firma ismini giriniz' }
        ], null, 2),
        previewQuestionsText: '',
        isFeatured: false,
        isActive: true,
        sortOrder: 0,
      });
    }
  }, [template, isEditMode]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<AgentTemplate>) => templateApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-admin'] });
      toast.success('Şablon başarıyla oluşturuldu!');
      navigate('/admin/templates');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Şablon oluşturulurken hata oluştu.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AgentTemplate>) => {
      if (!template?.id) throw new Error('Şablon ID bulunamadı.');
      return templateApi.update(template.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['template-admin-detail', templateSlug] });
      toast.success('Şablon başarıyla güncellendi!');
      setHasChanges(false);
      navigate('/admin/templates');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Şablon güncellenirken hata oluştu.');
    },
  });

  // Fetch template documents in edit mode
  const { data: docData, isLoading: isLoadingDocs, refetch: refetchDocs } = useQuery({
    queryKey: ['template-documents', template?.id],
    queryFn: () => template?.id ? templateApi.listDocuments(template.id) : null,
    enabled: isEditMode && !!template?.id && activeTab === 'documents',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !template?.id) return;
    setUploadingFile(true);
    try {
      await templateApi.uploadDocument(template.id, file);
      toast.success('Döküman başarıyla yüklendi!');
      refetchDocs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Döküman yüklenirken hata oluştu.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => {
      if (!template?.id) throw new Error('Şablon ID bulunamadı.');
      return templateApi.deleteDocument(template.id, docId);
    },
    onSuccess: () => {
      toast.success('Döküman başarıyla silindi!');
      refetchDocs();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Döküman silinirken hata oluştu.');
    },
  });

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config_schema = JSON.parse(form.configSchemaJson);
      const preview_questions = form.previewQuestionsText
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      const templateData: Partial<AgentTemplate> = {
        name: form.name,
        slug: form.slug,
        category: form.category,
        description: form.description || null,
        icon: form.icon || '💡',
        default_system_prompt: form.defaultSystemPrompt,
        default_welcome_message: form.defaultWelcomeMessage || null,
        config_schema,
        preview_questions,
        is_featured: form.isFeatured,
        is_active: form.isActive,
        sort_order: form.sortOrder,
      };

      if (isEditMode) {
        updateMutation.mutate(templateData);
      } else {
        createMutation.mutate(templateData);
      }
    } catch (err) {
      toast.error('Yapılandırma şeması geçersiz bir JSON formatı içeriyor.');
    }
  };

  if (isEditMode && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/templates')} className="p-2 hover:bg-dark-600 rounded-lg transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">
              {isEditMode ? `Şablonu Düzenle: ${form.name}` : 'Yeni Asistan Şablonu Ekle'}
            </h1>
            <p className="text-sm text-gray-500">
              {isEditMode ? 'Hazır asistan şablonunun parametrelerini ve promptlarını güncelleyin.' : 'Yeni bir sektörel hazır AI asistan şablonu oluşturun.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full font-medium">
              {t('builder.unsaved_changes')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending || (isEditMode && !hasChanges)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-semibold text-sm"
          >
            <CheckCircleIcon className="h-5 w-5" />
            {createMutation.isPending || updateMutation.isPending ? t('builder.btn_saving') : t('ui.save')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-600 p-1 rounded-lg overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
            activeTab === 'general' ? 'bg-dark-800/60 text-primary-400' : 'text-gray-600 hover:text-gray-100'
          }`}
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          {language === 'tr' ? 'Genel Bilgiler' : 'General Info'}
        </button>
        <button
          onClick={() => setActiveTab('prompt')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
            activeTab === 'prompt' ? 'bg-dark-800/60 text-primary-400' : 'text-gray-600 hover:text-gray-100'
          }`}
        >
          <DocumentTextIcon className="h-4 w-4" />
          {language === 'tr' ? 'Prompt ve Karşılama' : 'Prompt & Welcome'}
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
            activeTab === 'advanced' ? 'bg-dark-800/60 text-primary-400' : 'text-gray-600 hover:text-gray-100'
          }`}
        >
          <CodeBracketIcon className="h-4 w-4" />
          {language === 'tr' ? 'Yapılandırma & Sorular' : 'Schema & Questions'}
        </button>
        <button
          onClick={() => {
            if (isEditMode) {
              setActiveTab('documents');
            } else {
              toast.error(language === 'tr' ? 'Döküman eklemek için önce şablonu oluşturmalısınız.' : 'You must create the template first to add documents.');
            }
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
            activeTab === 'documents'
              ? 'bg-dark-800/60 text-primary-400'
              : !isEditMode
              ? 'text-gray-700 cursor-not-allowed opacity-50'
              : 'text-gray-600 hover:text-gray-100'
          }`}
        >
          <FolderIcon className="h-4 w-4" />
          {language === 'tr' ? 'Dökümanlar' : 'Documents'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6">
        {activeTab === 'general' && (
          <div className="space-y-5 max-w-3xl">
            <h3 className="text-lg font-semibold border-b border-white/[0.06] pb-2">
              {language === 'tr' ? 'Temel Bilgiler' : 'Basic Information'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Şablon Adı">
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Kuaför Asistanı"
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                />
              </Field>
              <Field label="Slug (Tekil Kod)">
                <input
                  type="text"
                  required
                  disabled={isEditMode}
                  value={form.slug}
                  onChange={(e) => updateField('slug', e.target.value)}
                  placeholder="kuafor-asistani"
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition disabled:opacity-50"
                />
              </Field>
              <Field label="Kategori">
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="İkon (Emoji)">
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => updateField('icon', e.target.value)}
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                />
              </Field>
              <Field label="Sıralama (Order)">
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => updateField('sortOrder', parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                />
              </Field>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={form.isFeatured}
                  onChange={(e) => updateField('isFeatured', e.target.checked)}
                  className="h-4 w-4 bg-dark-900 border border-white/[0.08] rounded focus:ring-0 text-primary-600"
                />
                <label htmlFor="is_featured" className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                  Öne Çıkan Şablon
                </label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.isActive}
                  onChange={(e) => updateField('isActive', e.target.checked)}
                  className="h-4 w-4 bg-dark-900 border border-white/[0.08] rounded focus:ring-0 text-primary-600"
                />
                <label htmlFor="is_active" className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                  Aktif (Göster)
                </label>
              </div>
            </div>

            <Field label="Açıklama">
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                placeholder="Şablon hakkında pazarlama/açıklama metni..."
                className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition resize-none"
              />
            </Field>
          </div>
        )}

        {activeTab === 'prompt' && (
          <div className="space-y-5 max-w-3xl">
            <h3 className="text-lg font-semibold border-b border-white/[0.06] pb-2">
              {language === 'tr' ? 'Varsayılan Yapay Zeka Talimatları' : 'Default AI Instructions'}
            </h3>
            
            <Field 
              label="Varsayılan Sistem Promptu" 
              hint="Yeni asistan oluşturulduğunda yüklenecek talimat ( placeholders: {{firma_adi}} vb. kullanabilirsiniz )"
            >
              <textarea
                value={form.defaultSystemPrompt}
                onChange={(e) => updateField('defaultSystemPrompt', e.target.value)}
                rows={8}
                required
                className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition font-mono"
                placeholder="Sen {{firma_adi}} firmasının asistanısın. Müşterilere güler yüzlü davran..."
              />
            </Field>

            <Field label="Varsayılan Karşılama Mesajı">
              <input
                type="text"
                value={form.defaultWelcomeMessage}
                onChange={(e) => updateField('defaultWelcomeMessage', e.target.value)}
                className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                placeholder="Merhaba! {{firma_adi}} asistanına hoş geldiniz."
              />
            </Field>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-5 max-w-3xl">
            <h3 className="text-lg font-semibold border-b border-white/[0.06] pb-2">
              {language === 'tr' ? 'Değişkenler & Test Soruları' : 'Variables & Sample Questions'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field 
                label="Yapılandırma Alanları Şeması (JSON Array)"
                hint="Müşterinin kurulum sihirbazında dolduracağı form alanları."
              >
                <textarea
                  value={form.configSchemaJson}
                  onChange={(e) => updateField('configSchemaJson', e.target.value)}
                  rows={8}
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition font-mono"
                />
              </Field>
              <Field 
                label="Örnek Sorular (Her satıra bir soru)"
                hint="Ziyaretçiye asistanla sohbete başlaması için önerilecek hızlı buton soruları."
              >
                <textarea
                  value={form.previewQuestionsText}
                  onChange={(e) => updateField('previewQuestionsText', e.target.value)}
                  rows={8}
                  placeholder="Çalışma saatleriniz nedir?&#10;Randevu alabilir miyim?"
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                />
              </Field>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-200">
                  {language === 'tr' ? 'Bilgi Tabanı Dökümanları' : 'Knowledge Base Documents'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'tr'
                    ? 'Bu şablona yüklenen dökümanlar, şablonu kullanan tüm müşteri asistanlarının bilgi tabanına dahil edilecektir.'
                    : 'Documents uploaded to this template will be included in the knowledge base of all customer assistants using this template.'}
                </p>
              </div>
            </div>

            {/* Document Upload Area */}
            <div className="bg-dark-700/40 border-2 border-dashed border-white/[0.08] hover:border-primary-500/40 rounded-xl p-6 text-center transition-colors relative">
              <input
                type="file"
                id="template-file-upload"
                onChange={handleFileUpload}
                accept=".pdf,.docx,.txt,.md"
                disabled={uploadingFile}
                className="hidden"
              />
              <label htmlFor="template-file-upload" className="cursor-pointer space-y-2 block">
                <DocumentArrowUpIcon className="h-8 w-8 text-gray-500 mx-auto" />
                <div className="text-sm font-semibold text-gray-300">
                  {uploadingFile ? 'Yükleniyor...' : (language === 'tr' ? 'Bir döküman yükleyin (PDF, DOCX, TXT, MD)' : 'Upload a document (PDF, DOCX, TXT, MD)')}
                </div>
                <div className="text-xs text-gray-500">{language === 'tr' ? 'Maksimum dosya boyutu: 50MB' : 'Maximum file size: 50MB'}</div>
              </label>
            </div>

            {/* Documents List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {language === 'tr' ? `Yüklenen Dökümanlar (${docData?.documents?.length || 0})` : `Uploaded Documents (${docData?.documents?.length || 0})`}
                </span>
                <button
                  onClick={() => refetchDocs()}
                  className="p-1 rounded text-gray-500 hover:text-white"
                  title="Yenile"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </div>

              {isLoadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                </div>
              ) : !docData || docData.documents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border border-white/[0.04] rounded-xl bg-dark-700/20">
                  {language === 'tr' ? 'Henüz döküman yüklenmemiş.' : 'No documents uploaded yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {docData.documents.map((doc: AgentDocument) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3.5 bg-dark-700/50 rounded-xl border border-white/[0.04] text-sm"
                    >
                      <div className="min-w-0 pr-4">
                        <h4 className="font-semibold text-gray-200 truncate">{doc.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <span className="uppercase">{doc.file_type}</span>
                          <span>•</span>
                          <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status badge */}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          doc.status === 'processed'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : doc.status === 'processing'
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {doc.status === 'processed' ? (language === 'tr' ? 'İşlendi' : 'Processed') : doc.status === 'processing' ? (language === 'tr' ? 'İşleniyor' : 'Processing') : (language === 'tr' ? 'Hatalı' : 'Error')}
                        </span>

                        <button
                          onClick={() => deleteDocMutation.mutate(doc.id)}
                          disabled={deleteDocMutation.isPending}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                          title={language === 'tr' ? 'Dökümanı Kaldır' : 'Remove Document'}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable field wrapper
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{label}</label>}
      {hint && <p className="text-xs text-gray-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

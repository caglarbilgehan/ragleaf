// platform/src/pages/AgentBuilderPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { agentApi, type Agent, type KnowledgeBaseDocument } from '@/services/ragleafApi';
import { adminApi } from '@/services/api';
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  DocumentTextIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type Tab = 'general' | 'prompt' | 'knowledge' | 'appearance' | 'security';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'general', label: 'Genel', icon: ChatBubbleLeftRightIcon },
  { id: 'prompt', label: 'Prompt & Kişilik', icon: ChatBubbleLeftRightIcon },
  { id: 'knowledge', label: 'Bilgi Tabanı', icon: DocumentTextIcon },
  { id: 'appearance', label: 'Görünüm', icon: PaintBrushIcon },
  { id: 'security', label: 'Güvenlik', icon: ShieldCheckIcon },
];

export default function AgentBuilderPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = Number(agentId);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    system_prompt: '',
    welcome_message: '',
    // Personality
    tone: 'professional',
    language: 'tr',
    response_style: 'balanced',
    fallback_message: '',
    // Appearance
    primary_color: '#4F46E5',
    text_color: '#FFFFFF',
    position: 'bottom-right',
    width: 400,
    height: 600,
    show_branding: true,
    bubble_icon: 'chat',
    border_radius: 16,
    auto_open: true,
    // Security
    is_active: true,
    is_public: true,
    rate_limit_per_minute: 20,
    rate_limit_per_day: 500,
    allowed_domains: '' as string,
  });

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentApi.get(id),
    enabled: !!id,
  });

  const { data: kbData } = useQuery({
    queryKey: ['agent-kb', id],
    queryFn: () => agentApi.getKnowledgeBase(id),
    enabled: !!id,
  });

  const { data: orgDocs } = useQuery({
    queryKey: ['org-documents'],
    queryFn: () => adminApi.getDocuments({ limit: 200 }),
  });

  // Populate form from agent data
  useEffect(() => {
    if (agent) {
      const p = agent.personality || {};
      const a = agent.appearance || {};
      setForm({
        name: agent.name || '',
        description: agent.description || '',
        system_prompt: agent.system_prompt || '',
        welcome_message: agent.welcome_message || '',
        tone: p.tone || 'professional',
        language: p.language || 'tr',
        response_style: p.response_style || 'balanced',
        fallback_message: p.fallback_message || '',
        primary_color: a.primary_color || '#4F46E5',
        text_color: a.text_color || '#FFFFFF',
        position: a.position || 'bottom-right',
        width: a.width ?? 400,
        height: a.height ?? 600,
        show_branding: a.show_branding ?? true,
        bubble_icon: a.bubble_icon || 'chat',
        border_radius: a.border_radius ?? 16,
        auto_open: a.auto_open ?? true,
        is_active: agent.is_active,
        is_public: agent.is_public,
        rate_limit_per_minute: agent.rate_limit_per_minute,
        rate_limit_per_day: agent.rate_limit_per_day,
        allowed_domains: (agent.allowed_domains || []).join(', '),
      });
    }
  }, [agent]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Agent>) => agentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      toast.success('Asistan güncellendi');
      setHasChanges(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Güncelleme hatası'),
  });

  const addDocsMutation = useMutation({
    mutationFn: (docIds: number[]) => agentApi.addDocuments(id, docIds),
    onSuccess: (data: { added: number }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-kb', id] });
      toast.success(`${data.added} doküman eklendi`);
    },
  });

  const removeDocMutation = useMutation({
    mutationFn: (docId: number) => agentApi.removeDocument(id, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-kb', id] });
      toast.success('Doküman kaldırıldı');
    },
  });

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const domains = form.allowed_domains
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    updateMutation.mutate({
      name: form.name,
      description: form.description || null,
      system_prompt: form.system_prompt || null,
      welcome_message: form.welcome_message || null,
      personality: {
        tone: form.tone,
        language: form.language,
        response_style: form.response_style,
        fallback_message: form.fallback_message,
      },
      appearance: {
        primary_color: form.primary_color,
        text_color: form.text_color,
        position: form.position,
        width: form.width,
        height: form.height,
        show_branding: form.show_branding,
        bubble_icon: form.bubble_icon,
        border_radius: form.border_radius,
        auto_open: form.auto_open,
      },
      is_active: form.is_active,
      is_public: form.is_public,
      rate_limit_per_minute: form.rate_limit_per_minute,
      rate_limit_per_day: form.rate_limit_per_day,
      allowed_domains: domains,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!agent) {
    return <div className="text-center py-12 text-gray-500">Asistan bulunamadı</div>;
  }

  const kbDocIds = new Set((kbData?.documents || []).map((d) => d.id));
  const availableDocs = (orgDocs?.documents || []).filter(
    (d: any) => !kbDocIds.has(d.id) && d.vector_indexed
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/agents')} className="p-2 hover:bg-dark-600 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{agent.name}</h1>
            <p className="text-sm text-gray-500">Asistan ayarlarını düzenle</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              Kaydedilmemiş değişiklikler
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircleIcon className="h-5 w-5" />
            {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-600 p-1 rounded-lg overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-dark-800/60 text-primary-400 '
                : 'text-gray-600 hover:text-gray-100'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6">
        {activeTab === 'general' && (
          <div className="space-y-5 max-w-2xl">
            <h3 className="text-lg font-semibold border-b pb-2">Genel Bilgiler</h3>
            <Field label="Asistan Adı *" hint="Kullanıcılara gösterilecek isim">
              <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} className="input" />
            </Field>
            <Field label="Açıklama" hint="İç kullanım için kısa açıklama">
              <input type="text" value={form.description} onChange={(e) => updateField('description', e.target.value)} className="input" />
            </Field>
            <Field label="Karşılama Mesajı" hint="Widget açıldığında gösterilecek ilk mesaj">
              <textarea value={form.welcome_message} onChange={(e) => updateField('welcome_message', e.target.value)} rows={2} className="input" />
            </Field>
          </div>
        )}

        {activeTab === 'prompt' && (
          <div className="space-y-5 max-w-2xl">
            <h3 className="text-lg font-semibold border-b pb-2">Prompt & Kişilik</h3>
            <Field label="System Prompt" hint="Asistanın davranışını tanımlayan ana talimat">
              <textarea value={form.system_prompt} onChange={(e) => updateField('system_prompt', e.target.value)} rows={6} className="input font-mono text-sm" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Ton">
                <select value={form.tone} onChange={(e) => updateField('tone', e.target.value)} className="input">
                  <option value="professional">Profesyonel</option>
                  <option value="friendly">Samimi</option>
                  <option value="casual">Günlük</option>
                </select>
              </Field>
              <Field label="Dil">
                <select value={form.language} onChange={(e) => updateField('language', e.target.value)} className="input">
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                  <option value="auto">Otomatik</option>
                </select>
              </Field>
              <Field label="Yanıt Stili">
                <select value={form.response_style} onChange={(e) => updateField('response_style', e.target.value)} className="input">
                  <option value="concise">Kısa & Öz</option>
                  <option value="balanced">Dengeli</option>
                  <option value="detailed">Detaylı</option>
                </select>
              </Field>
            </div>
            <Field label="Fallback Mesajı" hint="Bilgi tabanında cevap bulunamazsa verilecek yanıt">
              <textarea value={form.fallback_message} onChange={(e) => updateField('fallback_message', e.target.value)} rows={2} className="input" />
            </Field>
          </div>
        )}



        {activeTab === 'knowledge' && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold border-b pb-2">
              Bilgi Tabanı ({kbData?.documents?.length || 0} doküman)
            </h3>

            {/* Current KB */}
            {(kbData?.documents || []).length > 0 ? (
              <div className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-lg">
                {(kbData?.documents || []).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm text-gray-100">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.file_type} • {doc.total_chunks || 0} chunk
                          {doc.vector_indexed && <span className="text-green-600 ml-2">✓ indexed</span>}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeDocMutation.mutate(doc.id)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border border-white/[0.06] bg-dark-700/30 rounded-lg">
                Henüz doküman eklenmedi
              </div>
            )}

            {/* Add documents */}
            {availableDocs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Doküman Ekle</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableDocs.slice(0, 10).map((doc: any) => (
                    <button
                      key={doc.id}
                      onClick={() => addDocsMutation.mutate([doc.id])}
                      className="flex items-center gap-2 p-3 text-left border border-white/[0.06] rounded-lg hover:border-primary-500/50 hover:bg-dark-700/50 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4 text-primary-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-100">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.file_type} • {doc.total_chunks || 0} chunk</p>
                      </div>
                    </button>
                  ))}
                </div>
                {availableDocs.length > 10 && (
                  <p className="text-xs text-gray-500 mt-2">+{availableDocs.length - 10} daha fazla doküman mevcut</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-5 max-w-2xl">
            <h3 className="text-lg font-semibold border-b pb-2">Widget Görünümü</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ana Renk">
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.primary_color} onChange={(e) => updateField('primary_color', e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                  <input type="text" value={form.primary_color} onChange={(e) => updateField('primary_color', e.target.value)} className="input flex-1" />
                </div>
              </Field>
              <Field label="Yazı Rengi">
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.text_color} onChange={(e) => updateField('text_color', e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                  <input type="text" value={form.text_color} onChange={(e) => updateField('text_color', e.target.value)} className="input flex-1" />
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Pozisyon">
                <select value={form.position} onChange={(e) => updateField('position', e.target.value)} className="input">
                  <option value="bottom-right">Sağ Alt</option>
                  <option value="bottom-left">Sol Alt</option>
                </select>
              </Field>
              <Field label="Genişlik (px)">
                <input type="number" value={form.width} onChange={(e) => updateField('width', parseInt(e.target.value))} min={300} max={600} className="input" />
              </Field>
              <Field label="Yükseklik (px)">
                <input type="number" value={form.height} onChange={(e) => updateField('height', parseInt(e.target.value))} min={400} max={800} className="input" />
              </Field>
            </div>
            <Field label={`Köşe Yuvarlaklığı: ${form.border_radius}px`}>
              <input type="range" min="0" max="24" value={form.border_radius} onChange={(e) => updateField('border_radius', parseInt(e.target.value))} className="w-full accent-primary-500" />
            </Field>
            <Field label="">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.show_branding} onChange={(e) => updateField('show_branding', e.target.checked)} className="rounded border-white/[0.06] bg-dark-900 text-primary-600" />
                <span className="text-sm text-gray-300">"Powered by Ragleaf" yazısını göster</span>
              </label>
            </Field>
            <Field label="">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_open} onChange={(e) => updateField('auto_open', e.target.checked)} className="rounded" />
                <div>
                  <span className="text-sm font-medium text-gray-100">Widget Otomatik Açılsın</span>
                  <p className="text-xs text-gray-500">Ziyaretçi siteye girdiğinde chat widget’ı otomatik açılır</p>
                </div>
              </label>
            </Field>

            {/* Preview */}
            <div className="border rounded-xl p-4 bg-dark-700/50">
              <p className="text-xs font-medium text-gray-500 mb-3">Önizleme</p>
              <div className="flex justify-end">
                <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: form.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill={form.text_color}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z" /></svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-5 max-w-2xl">
            <h3 className="text-lg font-semibold border-b pb-2">Güvenlik & Limitler</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="">
                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} className="rounded" />
                  <div>
                    <span className="text-sm font-medium text-gray-100">Aktif</span>
                    <p className="text-xs text-gray-500">Devre dışı bırakılırsa asistan yanıt vermez</p>
                  </div>
                </label>
              </Field>
              <Field label="">
                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg">
                  <input type="checkbox" checked={form.is_public} onChange={(e) => updateField('is_public', e.target.checked)} className="rounded" />
                  <div>
                    <span className="text-sm font-medium text-gray-100">Public API</span>
                    <p className="text-xs text-gray-500">Widget ve API üzerinden erişilebilir</p>
                  </div>
                </label>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dakika Limiti" hint="IP başına dakikada max istek">
                <input type="number" value={form.rate_limit_per_minute} onChange={(e) => updateField('rate_limit_per_minute', parseInt(e.target.value))} min={1} max={1000} className="input" />
              </Field>
              <Field label="Günlük Limit" hint="IP başına günde max istek">
                <input type="number" value={form.rate_limit_per_day} onChange={(e) => updateField('rate_limit_per_day', parseInt(e.target.value))} min={1} max={100000} className="input" />
              </Field>
            </div>
            <Field label="İzin Verilen Domainler" hint="Virgülle ayırın. Boş = tüm domainler izinli. Wildcard: *.example.com">
              <textarea value={form.allowed_domains} onChange={(e) => updateField('allowed_domains', e.target.value)} rows={2} placeholder="example.com, *.example.com" className="input font-mono text-sm" />
            </Field>
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
      {label && <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>}
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

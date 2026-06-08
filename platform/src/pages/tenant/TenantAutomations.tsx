// platform/src/pages/tenant/TenantAutomations.tsx
// AI Blog Otomasyonları Yönetim Sayfası
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  writerAutomationApi,
  agentApi,
  type WriterAutomation,
  type Agent,
} from '@/services/ragleafApi';
import {
  CalendarDaysIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  ClockIcon,
  CpuChipIcon,
  GlobeAltIcon,
  SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function TenantAutomations() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<WriterAutomation | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [intervalDays, setIntervalDays] = useState(7);
  const [keywords, setKeywords] = useState('');
  const [mode, setMode] = useState<'autonomous' | 'semi-autonomous'>('autonomous');
  const [platform, setPlatform] = useState<'ragleaf' | 'wordpress' | 'ghost'>('ragleaf');
  const [agentId, setAgentId] = useState<number | ''>('');

  // Queries
  const { data: automations = [], isLoading } = useQuery<WriterAutomation[]>({
    queryKey: ['writer-automations'],
    queryFn: writerAutomationApi.list,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: agentApi.list,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: writerAutomationApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-automations'] });
      toast.success(language === 'tr' ? 'Otomasyon başarıyla oluşturuldu!' : 'Automation created successfully!');
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (language === 'tr' ? 'Hata oluştu' : 'Error occurred'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => writerAutomationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-automations'] });
      toast.success(language === 'tr' ? 'Otomasyon başarıyla güncellendi!' : 'Automation updated successfully!');
      setIsEditModalOpen(false);
      setSelectedAutomation(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (language === 'tr' ? 'Hata oluştu' : 'Error occurred'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: writerAutomationApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-automations'] });
      toast.success(language === 'tr' ? 'Otomasyon silindi!' : 'Automation deleted!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (language === 'tr' ? 'Hata oluştu' : 'Error occurred'));
    },
  });

  const resetForm = () => {
    setTitle('');
    setIntervalDays(7);
    setKeywords('');
    setMode('autonomous');
    setPlatform('ragleaf');
    setAgentId('');
  };

  const handleOpenEdit = (auto: WriterAutomation) => {
    setSelectedAutomation(auto);
    setTitle(auto.title);
    setIntervalDays(auto.interval_days);
    setKeywords(auto.keywords ? auto.keywords.join(', ') : '');
    setMode(auto.mode);
    setPlatform(auto.publishing_platform);
    setAgentId(auto.agent_id || '');
    setIsEditModalOpen(true);
  };

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error(language === 'tr' ? 'Lütfen konu/başlık girin.' : 'Please enter a topic/title.');
      return;
    }
    if (agentId === '') {
      toast.error(language === 'tr' ? 'Lütfen bir yazar asistanı (kimliği) seçin.' : 'Please select a writer agent (identity).');
      return;
    }
    const keywordsList = keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    createMutation.mutate({
      title,
      interval_days: Number(intervalDays),
      keywords: keywordsList,
      mode,
      publishing_platform: platform,
      agent_id: Number(agentId),
    });
  };

  const handleUpdate = () => {
    if (!selectedAutomation) return;
    if (!title.trim()) {
      toast.error(language === 'tr' ? 'Lütfen konu/başlık girin.' : 'Please enter a topic/title.');
      return;
    }
    if (agentId === '') {
      toast.error(language === 'tr' ? 'Lütfen bir yazar asistanı (kimliği) seçin.' : 'Please select a writer agent (identity).');
      return;
    }
    const keywordsList = keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    updateMutation.mutate({
      id: selectedAutomation.id,
      data: {
        title,
        interval_days: Number(intervalDays),
        keywords: keywordsList,
        mode,
        publishing_platform: platform,
        agent_id: Number(agentId),
      },
    });
  };

  const handleToggleActive = (auto: WriterAutomation) => {
    updateMutation.mutate({
      id: auto.id,
      data: { is_active: !auto.is_active },
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIntervalLabel = (days: number) => {
    if (days === 1) return language === 'tr' ? 'Her Gün' : 'Daily';
    if (days === 3) return language === 'tr' ? '3 Günde Bir' : 'Every 3 Days';
    if (days === 7) return language === 'tr' ? 'Haftada Bir' : 'Weekly';
    if (days === 14) return language === 'tr' ? '2 Haftada Bir' : 'Every 2 Weeks';
    if (days === 30) return language === 'tr' ? 'Ayda Bir' : 'Monthly';
    return language === 'tr' ? `${days} Günde Bir` : `Every ${days} Days`;
  };

  const getPlatformLabel = (plat: string) => {
    switch (plat) {
      case 'ragleaf': return 'Ragleaf Blog';
      case 'wordpress': return 'WordPress';
      case 'ghost': return 'Ghost CMS';
      default: return plat;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <CalendarDaysIcon className="h-6 w-6 text-primary-400" />
            <span className="text-primary-500">AI</span>writer / {language === 'tr' ? 'Otomasyonlar' : 'Automations'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'tr'
              ? 'Tetikleyicilere (zamanlama, Telegram vb.) bağlı eylemleri (içerik yazarı, sosyal medya vb.) planlayın ve yönetin.'
              : 'Plan and manage actions (content writer, social media, etc.) based on triggers (schedule, Telegram, etc.).'}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors self-start md:self-auto"
        >
          <PlusIcon className="h-4 w-4" />
          {language === 'tr' ? 'Yeni Otomasyon Programı' : 'New Automation Schedule'}
        </button>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-12 text-center">
          <ClockIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-100">
            {language === 'tr' ? 'Kayıtlı Otomasyon Bulunmuyor' : 'No Automations Configured'}
          </h3>
          <p className="text-gray-500 mt-1">
            {language === 'tr'
              ? 'İlk otomatik içerik üretme kuralınızı oluşturmak için sağ üstteki butonu kullanın.'
              : 'Use the button on the top right to create your first content schedule.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {automations.map((auto) => {
            const connectedAgent = agents.find(a => a.id === auto.agent_id);
            return (
              <div
                key={auto.id}
                className={`bg-dark-800/50 rounded-2xl border transition-all duration-300 p-6 flex flex-col justify-between group ${
                  auto.is_active ? 'border-white/[0.06] hover:border-primary-500/30' : 'border-white/[0.03] opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/10">
                      ⏱️ {getIntervalLabel(auto.interval_days)}
                    </span>
                    
                    {/* Active Toggle Switch */}
                    <button
                      onClick={() => handleToggleActive(auto)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        auto.is_active ? 'bg-primary-600' : 'bg-dark-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          auto.is_active ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-gray-100 leading-snug mb-2 line-clamp-2">
                    {auto.title}
                  </h3>

                  {/* Flow Diagram */}
                  <div className="flex items-center gap-2.5 my-4 bg-dark-900/40 rounded-xl p-3 border border-white/[0.04] text-xs">
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{t('automation.trigger')}</span>
                      <span className="text-gray-200 truncate font-medium">⏱️ {getIntervalLabel(auto.interval_days)}</span>
                    </div>
                    <div className="text-gray-500 text-base">➔</div>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{t('automation.action')}</span>
                      <span className="text-gray-200 truncate font-medium">✍️ {t('automation.action.writer')}</span>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="space-y-2 text-xs text-gray-400 mt-2 border-t border-white/[0.04] pt-4">
                    <div className="flex items-center gap-1.5">
                      <CpuChipIcon className="h-4 w-4 text-gray-500" />
                      <span>
                        Agent: <strong className="text-gray-300">{connectedAgent ? connectedAgent.name : 'Varsayılan Asistan'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <GlobeAltIcon className="h-4 w-4 text-gray-500" />
                      <span>
                        Platform: <strong className="text-gray-300">{getPlatformLabel(auto.publishing_platform)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <SparklesIcon className="h-4 w-4 text-gray-500" />
                      <span>
                        Mod: <strong className="text-gray-300">{auto.mode === 'autonomous' ? (language === 'tr' ? 'Tam Otonom' : 'Autonomous') : (language === 'tr' ? 'Onay Bekler' : 'Requires Approval')}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Keywords */}
                  {auto.keywords && auto.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-4">
                      {auto.keywords.map((kw, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-300">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/[0.04] pt-4 mt-6 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex flex-col">
                    <span>{language === 'tr' ? 'Son Çalışma' : 'Last Run'}: {formatDate(auto.last_run_at)}</span>
                    <span className="text-primary-400/80">{language === 'tr' ? 'Sonraki Çalışma' : 'Next Run'}: {formatDate(auto.next_run_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(auto)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 transition-colors"
                      title={language === 'tr' ? 'Düzenle' : 'Edit'}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(language === 'tr' ? 'Bu otomasyon kuralını silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this schedule?')) {
                          deleteMutation.mutate(auto.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      title={language === 'tr' ? 'Sil' : 'Delete'}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE & EDIT MODALS */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-100">
                {isAddModalOpen
                  ? (language === 'tr' ? 'Yeni Otomasyon Kuralı Tanımla' : 'Create Automation Schedule')
                  : (language === 'tr' ? 'Otomasyon Kuralını Düzenle' : 'Edit Automation Schedule')}
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* SECTION 1: TRIGGER SELECT */}
              <div>
                <label className="block text-xs font-bold text-primary-400 uppercase tracking-wider mb-2">
                  {t('automation.trigger_select')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Zamanlama Card (Active) */}
                  <div className="bg-primary-500/10 border-2 border-primary-500 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all">
                    <div className="text-lg mb-1.5">⏱️</div>
                    <div>
                      <div className="text-xs font-bold text-gray-100">{t('automation.trigger.schedule')}</div>
                      <div className="text-[10px] text-primary-400 font-medium mt-0.5">{language === 'tr' ? 'Periyodik' : 'Periodic'}</div>
                    </div>
                  </div>

                  {/* Telegram Card (Coming Soon) */}
                  <div className="bg-dark-900/40 border border-white/[0.04] opacity-50 rounded-xl p-3.5 flex flex-col justify-between cursor-not-allowed select-none">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-lg">💬</span>
                      <span className="text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded border border-amber-500/20">{t('nav.coming_soon')}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400">{t('automation.trigger.telegram')}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{language === 'tr' ? 'Telegram Botu' : 'Telegram Bot'}</div>
                    </div>
                  </div>

                  {/* Document Card (Coming Soon) */}
                  <div className="bg-dark-900/40 border border-white/[0.04] opacity-50 rounded-xl p-3.5 flex flex-col justify-between cursor-not-allowed select-none">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-lg">📁</span>
                      <span className="text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded border border-amber-500/20">{t('nav.coming_soon')}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400">{t('automation.trigger.document')}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{language === 'tr' ? 'Dosya Yüklendiğinde' : 'On File Upload'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/[0.06] my-4"></div>

              {/* SECTION 2: TRIGGER CONFIG */}
              <div>
                <label className="block text-xs font-bold text-primary-400 uppercase tracking-wider mb-3">
                  {t('automation.config')}
                </label>
                <div className="space-y-4 bg-dark-900/30 rounded-xl p-4 border border-white/[0.04]">
                  {/* Topic Focus */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      {language === 'tr' ? 'Konu / Odak Alanı' : 'Topic / Focus Area'}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Yapay Zeka ve Bulut Teknolojileri"
                      className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none placeholder-gray-600"
                    />
                  </div>

                  {/* Keywords */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      {language === 'tr' ? 'SEO Anahtar Kelimeleri (virgülle ayırın)' : 'SEO Keywords (comma separated)'}
                    </label>
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="yapayzeka, bulut, SaaS"
                      className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none placeholder-gray-600"
                    />
                  </div>

                  {/* Grid 2 Columns */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Interval Select */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                        {language === 'tr' ? 'Yayınlanma Sıklığı' : 'Frequency'}
                      </label>
                      <select
                        value={intervalDays}
                        onChange={(e) => setIntervalDays(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                      >
                        <option value={1}>{language === 'tr' ? 'Her Gün' : 'Daily'}</option>
                        <option value={3}>{language === 'tr' ? '3 Günde Bir' : 'Every 3 Days'}</option>
                        <option value={7}>{language === 'tr' ? 'Haftada Bir' : 'Weekly'}</option>
                        <option value={14}>{language === 'tr' ? '2 Haftada Bir' : 'Every 2 Weeks'}</option>
                        <option value={30}>{language === 'tr' ? 'Ayda Bir' : 'Monthly'}</option>
                      </select>
                    </div>

                    {/* Mode Select */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                        {language === 'tr' ? 'Üretim Modu' : 'Generation Mode'}
                      </label>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as any)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                      >
                        <option value="autonomous">{language === 'tr' ? 'Tam Otonom (Yayınla)' : 'Autonomous'}</option>
                        <option value="semi-autonomous">{language === 'tr' ? 'Yarı Otonom (Onay Bekler)' : 'Requires Approval'}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/[0.06] my-4"></div>

              {/* SECTION 3: ACTION SELECT */}
              <div>
                <label className="block text-xs font-bold text-primary-400 uppercase tracking-wider mb-2">
                  {t('automation.action_select')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* AI Blog Yazısı (Active) */}
                  <div className="bg-primary-500/10 border-2 border-primary-500 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all">
                    <div className="text-lg mb-1.5">✍️</div>
                    <div>
                      <div className="text-xs font-bold text-gray-100">{t('automation.action.writer')}</div>
                      <div className="text-[10px] text-primary-400 font-medium mt-0.5">{language === 'tr' ? 'Makale Üretici' : 'Article Gen'}</div>
                    </div>
                  </div>

                  {/* Sosyal Medya Paylaşımı (Coming Soon) */}
                  <div className="bg-dark-900/40 border border-white/[0.04] opacity-50 rounded-xl p-3.5 flex flex-col justify-between cursor-not-allowed select-none">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-lg">📢</span>
                      <span className="text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded border border-amber-500/20">{t('nav.coming_soon')}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400">{t('automation.action.social')}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{language === 'tr' ? 'AIsocial Paylaşım' : 'AIsocial Share'}</div>
                    </div>
                  </div>

                  {/* E-posta Yanıtı (Coming Soon) */}
                  <div className="bg-dark-900/40 border border-white/[0.04] opacity-50 rounded-xl p-3.5 flex flex-col justify-between cursor-not-allowed select-none">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-lg">📧</span>
                      <span className="text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded border border-amber-500/20">{t('nav.coming_soon')}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400">{t('automation.action.mail')}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{language === 'tr' ? 'E-posta Yanıtı' : 'Email Reply'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/[0.06] my-4"></div>

              {/* SECTION 4: ACTION CONFIG */}
              <div className="space-y-4 bg-dark-900/30 rounded-xl p-4 border border-white/[0.04]">
                {/* Grid 2 Columns */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Publishing Platform */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      {language === 'tr' ? 'Hedef Platform' : 'Publishing Platform'}
                    </label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="ragleaf">Ragleaf Blog</option>
                      <option value="wordpress">WordPress</option>
                      <option value="ghost">Ghost CMS</option>
                    </select>
                  </div>

                  {/* AI Agent Persona */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      {language === 'tr' ? 'Yazar Yapay Zeka Asistanı' : 'AI Writer Agent'}
                    </label>
                    <select
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="">{language === 'tr' ? 'Varsayılan Agent' : 'Default Agent'}</option>
                      {agents.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-dark-900/40 border-t border-white/[0.06] flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                {language === 'tr' ? 'Vazgeç' : 'Cancel'}
              </button>
              <button
                onClick={isAddModalOpen ? handleCreate : handleUpdate}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-1"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                )}
                {language === 'tr' ? 'Kaydet' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

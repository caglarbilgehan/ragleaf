import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import {
  Zap,
  Plus,
  Play,
  Trash2,
  Edit,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Send,
  Clock,
  Globe,
  Database,
  Code,
  FileText,
  Sparkles,
  Bot,
  Activity,
  X
} from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  triggerType: 'telegram' | 'visit' | 'webhook' | 'schedule';
  actionType: 'writer' | 'chat' | 'mail' | 'system';
  agentName: string;
  isActive: boolean;
  lastRun: string;
  runCount: number;
  description: string;
}

const defaultScenarios: Scenario[] = [
  {
    id: 'sc_01',
    name: 'Telegram Gelen Mesaj Otomasyonu',
    triggerType: 'telegram',
    actionType: 'chat',
    agentName: 'Müşteri İlişkileri Temsilcisi',
    isActive: true,
    lastRun: '15 dakika önce',
    runCount: 42,
    description: 'Telegram grubuna veya botuna gelen mesajları asistan süzgecinden geçirir ve otomatik destek yanıtı döner.'
  },
  {
    id: 'sc_02',
    name: 'Ziyaretçi Sepet Terk Tetikleyicisi',
    triggerType: 'visit',
    actionType: 'chat',
    agentName: 'Satış Kapatıcı Asistan',
    isActive: true,
    lastRun: '2 saat önce',
    runCount: 18,
    description: 'Ziyaretçi ödeme veya sepet sayfasında 90 saniyeden fazla kaldığında sohbette kişiselleştirilmiş indirim sunar.'
  },
  {
    id: 'sc_03',
    name: 'Başarılı Ödeme Raporlayıcı',
    triggerType: 'webhook',
    actionType: 'writer',
    agentName: 'Finansal Analist Asistanı',
    isActive: false,
    lastRun: 'Hiç çalıştırılmadı',
    runCount: 0,
    description: 'Stripe veya iyzico web kancası üzerinden gelen başarılı ödemelerden sonra asistan otonom onboarding raporu hazırlar.'
  },
  {
    id: 'sc_04',
    name: 'Haftalık Sistem Sağlık Analizi',
    triggerType: 'schedule',
    actionType: 'system',
    agentName: 'Sistem Yöneticisi',
    isActive: true,
    lastRun: '3 gün önce',
    runCount: 12,
    description: 'Her Pazartesi saat 09:00\'da veri tabanındaki API kullanım istatistiklerini tarar ve Slack özet raporu yollar.'
  }
];

export default function TenantAutomationScenarios() {
  const { t, language } = useTranslation();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'telegram' | 'visit' | 'webhook' | 'schedule'>('telegram');
  const [actionType, setActionType] = useState<'writer' | 'chat' | 'mail' | 'system'>('chat');
  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('ragleaf_scenarios');
    if (saved) {
      try {
        setScenarios(JSON.parse(saved));
      } catch (e) {
        setScenarios(defaultScenarios);
      }
    } else {
      setScenarios(defaultScenarios);
    }
  }, []);

  const saveToLocalStorage = (updated: Scenario[]) => {
    localStorage.setItem('ragleaf_scenarios', JSON.stringify(updated));
    setScenarios(updated);
  };

  const handleToggleActive = (id: string) => {
    const updated = scenarios.map(s => {
      if (s.id === id) {
        const nextState = !s.isActive;
        toast.success(
          language === 'tr' 
            ? `${s.name} ${nextState ? 'aktif' : 'pasif'} duruma getirildi.` 
            : `${s.name} set to ${nextState ? 'active' : 'passive'}.`
        );
        return { ...s, isActive: nextState };
      }
      return s;
    });
    saveToLocalStorage(updated);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(language === 'tr' ? `"${name}" senaryosunu silmek istediğinize emin misiniz?` : `Are you sure you want to delete "${name}"?`)) {
      const updated = scenarios.filter(s => s.id !== id);
      saveToLocalStorage(updated);
      toast.success(language === 'tr' ? 'Senaryo silindi.' : 'Scenario deleted.');
    }
  };

  const handleRunSimulation = (id: string) => {
    const target = scenarios.find(s => s.id === id);
    if (!target) return;

    if (!target.isActive) {
      toast.error(language === 'tr' ? 'Önce senaryoyu aktif hale getirmelisiniz!' : 'Activate the scenario first!');
      return;
    }

    setRunningId(id);
    setLogs(prev => ({
      ...prev,
      [id]: [
        language === 'tr' ? '⏳ Tetikleyici dinleniyor...' : '⏳ Waiting for trigger...',
        language === 'tr' ? `⚡ Olay algılandı (${target.triggerType})` : `⚡ Event captured (${target.triggerType})`
      ]
    }));

    setTimeout(() => {
      setLogs(prev => ({
        ...prev,
        [id]: [
          ...(prev[id] || []),
          language === 'tr' ? `🤖 Asistan yönlendiriliyor: "${target.agentName}"` : `🤖 Routeing request to assistant: "${target.agentName}"`
        ]
      }));
    }, 1000);

    setTimeout(() => {
      setLogs(prev => ({
        ...prev,
        [id]: [
          ...(prev[id] || []),
          language === 'tr' ? `⚙️ Eylem tamamlanıyor (${target.actionType})` : `⚙️ Actions compiling (${target.actionType})`
        ]
      }));
    }, 2000);

    setTimeout(() => {
      setLogs(prev => ({
        ...prev,
        [id]: [
          ...(prev[id] || []),
          language === 'tr' ? '✅ Otomasyon başarıyla sonuçlandı!' : '✅ Automation processed successfully!'
        ]
      }));
      setRunningId(null);
      
      const nowText = language === 'tr' ? 'Şimdi' : 'Just now';
      const updated = scenarios.map(s => {
        if (s.id === id) {
          return { ...s, lastRun: nowText, runCount: s.runCount + 1 };
        }
        return s;
      });
      saveToLocalStorage(updated);
      toast.success(language === 'tr' ? `${target.name} simülasyonu başarıyla çalıştırıldı.` : `${target.name} simulation executed successfully.`);
    }, 3000);
  };

  const openCreateModal = () => {
    setEditingScenario(null);
    setName('');
    setTriggerType('telegram');
    setActionType('chat');
    setAgentName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setName(scenario.name);
    setTriggerType(scenario.triggerType);
    setActionType(scenario.actionType);
    setAgentName(scenario.agentName);
    setDescription(scenario.description);
    setIsModalOpen(true);
  };

  const handleSaveScenario = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !agentName) {
      toast.error(language === 'tr' ? 'Lütfen tüm zorunlu alanları doldurun.' : 'Please fill all required fields.');
      return;
    }

    if (editingScenario) {
      // Edit mode
      const updated = scenarios.map(s => {
        if (s.id === editingScenario.id) {
          return {
            ...s,
            name,
            triggerType,
            actionType,
            agentName,
            description
          };
        }
        return s;
      });
      saveToLocalStorage(updated);
      toast.success(language === 'tr' ? 'Senaryo güncellendi.' : 'Scenario updated.');
    } else {
      // Create mode
      const newScenario: Scenario = {
        id: `sc_${Date.now()}`,
        name,
        triggerType,
        actionType,
        agentName,
        isActive: true,
        lastRun: language === 'tr' ? 'Hiç çalıştırılmadı' : 'Never run',
        runCount: 0,
        description
      };
      saveToLocalStorage([newScenario, ...scenarios]);
      toast.success(language === 'tr' ? 'Yeni senaryo oluşturuldu.' : 'New scenario created.');
    }

    setIsModalOpen(false);
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'telegram': return <MessageSquare className="h-5 w-5 text-sky-400" />;
      case 'visit': return <Globe className="h-5 w-5 text-emerald-400" />;
      case 'webhook': return <Code className="h-5 w-5 text-purple-400" />;
      case 'schedule': return <Clock className="h-5 w-5 text-amber-400" />;
      default: return <Zap className="h-5 w-5 text-primary-400" />;
    }
  };

  const getTriggerLabel = (type: string) => {
    if (language === 'tr') {
      switch (type) {
        case 'telegram': return 'Telegram Mesajı';
        case 'visit': return 'Ziyaretçi Sayfa Etkileşimi';
        case 'webhook': return 'API Webhook Kancası';
        case 'schedule': return 'Zamanlama (Rutine)';
        default: return type;
      }
    } else {
      switch (type) {
        case 'telegram': return 'Telegram Message';
        case 'visit': return 'Visitor Site Action';
        case 'webhook': return 'API Webhook';
        case 'schedule': return 'Scheduled Cron';
        default: return type;
      }
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'writer': return <Sparkles className="h-5 w-5 text-pink-400" />;
      case 'chat': return <Bot className="h-5 w-5 text-blue-400" />;
      case 'mail': return <Send className="h-5 w-5 text-teal-400" />;
      case 'system': return <Activity className="h-5 w-5 text-yellow-400" />;
      default: return <Zap className="h-5 w-5 text-primary-400" />;
    }
  };

  const getActionLabel = (type: string) => {
    if (language === 'tr') {
      switch (type) {
        case 'writer': return 'Makale Otonom Yazma (AIwriter)';
        case 'chat': return 'Asistan Canlı Mesajlaşma (AIchat)';
        case 'mail': return 'Akıllı E-Posta Yanıtı (AImail)';
        case 'system': return 'Slack / Sistem Bildirimi';
        default: return type;
      }
    } else {
      switch (type) {
        case 'writer': return 'Autonomous Article (AIwriter)';
        case 'chat': return 'Interactive Chat (AIchat)';
        case 'mail': return 'Automated Email (AImail)';
        case 'system': return 'Slack / Push Notification';
        default: return type;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary-500" />
            <span>AI</span>automation {language === 'tr' ? 'Senaryoları' : 'Scenarios'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'tr' 
              ? 'Tetikleyici olayları asistanlarınız ile eşleştirin, tamamen otonom çalışan senaryolar kurgulayın.'
              : 'Match events & triggers with custom assistant roles to craft self-running workflows on autopilot.'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold transition-all active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span>{language === 'tr' ? 'Yeni Senaryo' : 'New Scenario'}</span>
        </button>
      </div>

      {/* Scenarios Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {scenarios.map((sc) => (
          <div
            key={sc.id}
            className={`relative flex flex-col justify-between bg-dark-800/40 border rounded-2xl p-6 transition-all duration-300 hover:border-primary-500/20 hover:shadow-[0_12px_32px_rgba(34,197,94,0.04)] ${
              sc.isActive ? 'border-white/[0.06]' : 'border-white/[0.03] opacity-60'
            }`}
          >
            {/* Upper Content */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-gray-100 text-lg">{sc.name}</h3>
                
                {/* Active Slider Switch */}
                <button
                  onClick={() => handleToggleActive(sc.id)}
                  className={`w-12 h-6 rounded-full p-0.5 transition-all duration-300 ${
                    sc.isActive ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-all duration-300 ${
                      sc.isActive ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                {sc.description}
              </p>

              {/* Action and Trigger details cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-dark-900/40 rounded-xl p-3 border border-white/[0.04] flex items-center gap-2.5">
                  <div className="p-2 bg-dark-700 rounded-lg">
                    {getTriggerIcon(sc.triggerType)}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">
                      {language === 'tr' ? 'Tetikleyici' : 'Trigger'}
                    </span>
                    <span className="text-xs font-semibold text-gray-300 block leading-tight">
                      {getTriggerLabel(sc.triggerType)}
                    </span>
                  </div>
                </div>

                <div className="bg-dark-900/40 rounded-xl p-3 border border-white/[0.04] flex items-center gap-2.5">
                  <div className="p-2 bg-dark-700 rounded-lg">
                    {getActionIcon(sc.actionType)}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">
                      {language === 'tr' ? 'Çalışan Eylem' : 'Action'}
                    </span>
                    <span className="text-xs font-semibold text-gray-300 block leading-tight">
                      {getActionLabel(sc.actionType)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bot Info */}
              <div className="flex items-center gap-2 text-xs text-primary-400 bg-primary-400/5 border border-primary-400/10 px-3 py-2 rounded-xl">
                <Bot className="h-4 w-4" />
                <span>
                  {language === 'tr' ? 'Yöneten Asistan: ' : 'Handler AI: '}
                  <strong>{sc.agentName}</strong>
                </span>
              </div>
            </div>

            {/* Logs & Bottom Actions */}
            <div className="mt-5 pt-4 border-t border-white/[0.04] space-y-4">
              {/* Simulation Logs view */}
              {logs[sc.id] && logs[sc.id].length > 0 && (
                <div className="bg-dark-900/60 rounded-xl p-3 font-mono text-[11px] space-y-1 text-gray-400 border border-white/[0.04] max-h-[110px] overflow-y-auto">
                  {logs[sc.id].map((log, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-primary-500">›</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{sc.lastRun}</span>
                  </span>
                  <span>•</span>
                  <span>
                    {language === 'tr' ? `${sc.runCount} Kez Çalıştı` : `${sc.runCount} Executions`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunSimulation(sc.id)}
                    disabled={runningId === sc.id || !sc.isActive}
                    className={`p-2 rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 transition-all flex items-center gap-1 ${
                      (!sc.isActive || runningId === sc.id) ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'
                    }`}
                    title={language === 'tr' ? 'Simüle Et' : 'Simulate Run'}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase">{language === 'tr' ? 'Test Et' : 'Test'}</span>
                  </button>

                  <button
                    onClick={() => openEditModal(sc)}
                    className="p-2 rounded-lg bg-dark-700 text-gray-300 hover:bg-dark-600 transition-all active:scale-95 border border-white/[0.04]"
                    title="Düzenle"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(sc.id, sc.name)}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95"
                    title="Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        ))}

        {scenarios.length === 0 && (
          <div className="lg:col-span-2 bg-dark-800/40 border border-white/[0.06] rounded-2xl p-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-200">{language === 'tr' ? 'Senaryo Bulunmuyor' : 'No Scenarios Configured'}</h3>
            <p className="text-gray-500 mt-1 text-sm max-w-md mx-auto">
              {language === 'tr' 
                ? 'Henüz bir otonom tetikleyici kuralı eklemediniz. Üstteki butona tıklayarak ilk otomasyonunuzu tanımlayabilirsiniz.'
                : 'Create trigger-action paths to map site events or messaging events straight onto your custom AI bots.'}
            </p>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-dark-800 border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-100">
                {editingScenario 
                  ? (language === 'tr' ? 'Senaryoyu Düzenle' : 'Edit Scenario')
                  : (language === 'tr' ? 'Yeni Senaryo Ekle' : 'Add New Scenario')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveScenario} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {language === 'tr' ? 'Senaryo Adı *' : 'Scenario Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'tr' ? 'Örn: Telegram Bilet Açıcı' : 'e.g. Stripe Sync to Slack'}
                  className="w-full px-4 py-2 border border-white/[0.08] bg-dark-900 text-gray-100 placeholder:text-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {language === 'tr' ? 'Hangi Asistan Yönetecek? *' : 'Assigned Assistant *'}
                </label>
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder={language === 'tr' ? 'Örn: Satış Temsilcisi' : 'e.g. Lead Assistant'}
                  className="w-full px-4 py-2 border border-white/[0.08] bg-dark-900 text-gray-100 placeholder:text-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'tr' ? 'Tetikleyici Tipi' : 'Trigger Scope'}
                  </label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as any)}
                    className="w-full px-4 py-2 border border-white/[0.08] bg-dark-900 text-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="telegram">{language === 'tr' ? 'Telegram Mesajı' : 'Telegram Msg'}</option>
                    <option value="visit">{language === 'tr' ? 'Ziyaret Eylemi' : 'Site Visit'}</option>
                    <option value="webhook">{language === 'tr' ? 'API Webhook' : 'Webhook'}</option>
                    <option value="schedule">{language === 'tr' ? 'Zamanlayıcı (Cron)' : 'Schedule'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'tr' ? 'Hedef Eylem' : 'Target Action'}
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as any)}
                    className="w-full px-4 py-2 border border-white/[0.08] bg-dark-900 text-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="chat">{language === 'tr' ? 'AIchat Yanıtı' : 'AIchat Response'}</option>
                    <option value="writer">{language === 'tr' ? 'AIwriter Taslağı' : 'AIwriter Draft'}</option>
                    <option value="mail">{language === 'tr' ? 'AImail Gönder' : 'AImail Outbox'}</option>
                    <option value="system">{language === 'tr' ? 'Slack/Sistem Logu' : 'Slack Notice'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {language === 'tr' ? 'Açıklama' : 'Description'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={language === 'tr' ? 'Senaryonun ne işe yaradığına dair kısa bilgi...' : 'Brief overview of this automated behavior...'}
                  className="w-full px-4 py-2 border border-white/[0.08] bg-dark-900 text-gray-100 placeholder:text-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-dark-700 text-gray-300 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  {t('ui.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold transition-all active:scale-98"
                >
                  {editingScenario ? (language === 'tr' ? 'Değişiklikleri Kaydet' : 'Save Changes') : (language === 'tr' ? 'Oluştur' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { agentApi, type Agent } from '@/services/ragleafApi';
import { 
  Puzzle, 
  Calendar, 
  ShoppingBag, 
  UserCheck, 
  Check, 
  Save, 
  AlertCircle,
  Clock,
  ArrowLeft,
  ChevronRight,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

type ActiveModule = 'list' | 'appointment' | 'reservation' | 'order' | 'lead';

interface ResourceItem {
  name: string;
  max_capacity: number;
  min_capacity: number;
}

const DAYS_OF_WEEK = [
  { key: 'monday', tr: 'Pazartesi', en: 'Monday' },
  { key: 'tuesday', tr: 'Salı', en: 'Tuesday' },
  { key: 'wednesday', tr: 'Çarşamba', en: 'Wednesday' },
  { key: 'thursday', tr: 'Perşembe', en: 'Thursday' },
  { key: 'friday', tr: 'Cuma', en: 'Friday' },
  { key: 'saturday', tr: 'Cumartesi', en: 'Saturday' },
  { key: 'sunday', tr: 'Pazar', en: 'Sunday' }
];

export default function TenantModules() {
  const { language } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeModuleView, setActiveModuleView] = useState<ActiveModule>('list');

  // Appointment configurations
  const [appointmentEnabled, setAppointmentEnabled] = useState(false);
  const [appointmentDuration, setAppointmentDuration] = useState(60);
  const [workingDays, setWorkingDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [workingStart, setWorkingStart] = useState('09:00');
  const [workingEnd, setWorkingEnd] = useState('18:00');
  const [appointmentType, setAppointmentType] = useState('face_to_face');

  // Reservation configurations (Cafe/Restaurant focused)
  const [reservationEnabled, setReservationEnabled] = useState(false);
  const [resWorkingDays, setResWorkingDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  const [resWorkingStart, setResWorkingStart] = useState('12:00');
  const [resWorkingEnd, setResWorkingEnd] = useState('22:00');
  const [resCapacityMode, setResCapacityMode] = useState<'single' | 'multi'>('multi');
  const [resMaxCapacity, setResMaxCapacity] = useState<number>(4);
  const [resResourceManagementEnabled, setResResourceManagementEnabled] = useState(true);
  const [resResources, setResResources] = useState<ResourceItem[]>([]);
  const [resMinBookingSize, setResMinBookingSize] = useState<number>(1);
  const [resRequireAllGuestDetails, setResRequireAllGuestDetails] = useState<boolean>(false);

  // Order settings
  const [orderEnabled, setOrderEnabled] = useState(false);
  const [orderCurrency, setOrderCurrency] = useState('TRY');
  const [paymentMethod, setPaymentMethod] = useState('cod');

  // Lead settings
  const [leadEnabled, setLeadEnabled] = useState(false);
  const [requirePhone, setRequirePhone] = useState(true);
  const [requireCompany, setRequireCompany] = useState(false);

  useEffect(() => {
    async function loadAgents() {
      try {
        const list = await agentApi.list();
        setAgents(list);
        if (list.length > 0) {
          setSelectedAgentId(list[0].id);
        }
      } catch (e) {
        console.error(e);
        toast.error(language === 'tr' ? 'Asistanlar yüklenemedi' : 'Failed to load assistants');
      } finally {
        setLoading(false);
      }
    }
    loadAgents();
  }, [language]);

  // Load configuration whenever agent changes
  useEffect(() => {
    if (!selectedAgentId) return;
    const agent = agents.find(a => a.id === selectedAgentId);
    if (agent) {
      const personality = agent.personality || {};
      
      // Appointment settings
      setAppointmentEnabled(!!personality.appointment_module_enabled);
      setAppointmentDuration(Number(personality.session_duration_minutes) || 60);
      setWorkingDays(personality.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
      setWorkingStart(personality.working_start_hour || '09:00');
      setWorkingEnd(personality.working_end_hour || '18:00');
      setAppointmentType(personality.appointment_type || 'face_to_face');

      // Reservation settings
      setReservationEnabled(!!personality.reservation_module_enabled);
      setResWorkingDays(personality.res_working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
      setResWorkingStart(personality.res_working_start_hour || '12:00');
      setResWorkingEnd(personality.res_working_end_hour || '22:00');
      setResCapacityMode(personality.res_capacity_mode || 'multi');
      setResMaxCapacity(Number(personality.res_max_capacity) || 4);
      setResResourceManagementEnabled(personality.res_resource_management_enabled !== false);
      
      const rawResources = personality.res_resources || [];
      const formattedResources = Array.isArray(rawResources) 
        ? rawResources.map((r: any) => {
            if (typeof r === 'object' && r !== null) {
              return {
                name: r.name || '',
                max_capacity: Number(r.max_capacity) || 4,
                min_capacity: Number(r.min_capacity) || 1
              };
            }
            return {
              name: String(r),
              max_capacity: 4,
              min_capacity: 1
            };
          })
        : [];
      setResResources(formattedResources);
      setResMinBookingSize(Number(personality.res_min_booking_size) || 1);
      setResRequireAllGuestDetails(!!personality.res_require_all_guest_details);

      // Order settings
      setOrderEnabled(!!personality.order_module_enabled);
      setOrderCurrency(personality.order_currency || 'TRY');
      setPaymentMethod(personality.payment_method || 'cod');

      // Lead settings
      setLeadEnabled(!!personality.lead_module_enabled);
      setRequirePhone(personality.require_phone !== false);
      setRequireCompany(!!personality.require_company);
    }
  }, [selectedAgentId, agents]);

  const handleSave = async (navigateBack = true) => {
    if (!selectedAgentId) return;
    setSaving(true);
    
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;
 
    const existingPersonality = agent.personality || {};
    const updatedPersonality = {
      ...existingPersonality,
      appointment_module_enabled: appointmentEnabled,
      session_duration_minutes: appointmentDuration,
      working_days: workingDays,
      working_start_hour: workingStart,
      working_end_hour: workingEnd,
      appointment_type: appointmentType,
      reservation_module_enabled: reservationEnabled,
      res_working_days: resWorkingDays,
      res_working_start_hour: resWorkingStart,
      res_working_end_hour: resWorkingEnd,
      res_capacity_mode: resCapacityMode,
      res_max_capacity: resMaxCapacity,
      res_resource_management_enabled: resResourceManagementEnabled,
      res_resources: resResources,
      res_min_booking_size: resMinBookingSize,
      res_require_all_guest_details: resRequireAllGuestDetails,
      order_module_enabled: orderEnabled,
      order_currency: orderCurrency,
      payment_method: paymentMethod,
      lead_module_enabled: leadEnabled,
      require_phone: requirePhone,
      require_company: requireCompany
    };

    try {
      const updatedAgent = await agentApi.update(selectedAgentId, {
        personality: updatedPersonality
      });
      
      setAgents(prev => prev.map(a => a.id === selectedAgentId ? updatedAgent : a));
      toast.success(language === 'tr' ? 'Modül ayarları kaydedildi!' : 'Module settings saved!');
      if (navigateBack) {
        setActiveModuleView('list');
      }
    } catch (e) {
      console.error(e);
      toast.error(language === 'tr' ? 'Kaydedilemedi' : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setWorkingDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleResDay = (day: string) => {
    setResWorkingDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Resource List Management Helpers
  const addNewResource = () => {
    setResResources(prev => [
      ...prev,
      { name: `Masa ${prev.length + 1}`, max_capacity: 4, min_capacity: 1 }
    ]);
  };

  const removeResource = (index: number) => {
    setResResources(prev => prev.filter((_, i) => i !== index));
  };

  const updateResourceField = (index: number, field: keyof ResourceItem, value: any) => {
    setResResources(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const applyBulkMinCapacityOffset = (offset: number) => {
    setResResources(prev =>
      prev.map(r => ({
        ...r,
        min_capacity: Math.max(1, r.max_capacity - offset)
      }))
    );
    toast.success(
      language === 'tr' 
        ? `Tüm minimum kapasiteler Maksimum - ${offset} olarak güncellendi!` 
        : `All minimum capacities updated to Max - ${offset}!`
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl w-full">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Puzzle className="h-6 w-6 text-primary-400" />
            {language === 'tr' ? 'AIchat Modülleri' : 'AIchat Modules'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'tr' 
              ? 'Yapay zeka asistanınızın gerçekleştirebileceği işlemleri (randevu, rezervasyon, sipariş vb.) yönetin.' 
              : 'Manage capabilities (booking, reservation, ordering, etc.) your AI assistant can execute.'}
          </p>
        </div>

        {/* Agent Selector */}
        {agents.length > 0 && (
          <div className="flex items-center gap-2 bg-dark-800/40 p-1.5 px-3 rounded-lg border border-white/[0.04]">
            <span className="text-xs text-gray-400 font-medium">{language === 'tr' ? 'Asistan Seçin:' : 'Select Assistant:'}</span>
            <select
              value={selectedAgentId || ''}
              onChange={(e) => {
                setSelectedAgentId(Number(e.target.value));
                setActiveModuleView('list');
              }}
              className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none font-bold cursor-pointer"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id} className="bg-dark-900 text-white">
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-dark-800/20 border border-white/[0.06] rounded-xl">
          <Puzzle className="h-12 w-12 mx-auto text-gray-600 mb-3" />
          <p className="text-base font-medium">{language === 'tr' ? 'Henüz asistanınız bulunmuyor.' : 'You don\'t have any assistants yet.'}</p>
        </div>
      ) : (
        <div>
          {/* VIEW: List Modules */}
          {activeModuleView === 'list' && (
            <div className="space-y-6">
              
              {/* Modules Table List */}
              <div className="bg-dark-800/40 border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="divide-y divide-white/[0.06]">
                  
                  {/* Item 1: Randevu */}
                  <div className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                          {language === 'tr' ? 'Randevu (Görüşme & Seans)' : 'Appointments (Sessions & Meetings)'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {language === 'tr'
                            ? 'Müşterilerinizden tarih/saat toplayarak kuaför, danışmanlık veya seans randevuları oluşturur.'
                            : 'Generates hairdresser, consultation or session appointments by collecting date/time.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModuleView('appointment')}
                      className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      {language === 'tr' ? 'Yapılandır' : 'Configure'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Item 1.5: Rezervasyon */}
                  <div className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                        <Puzzle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                          {language === 'tr' ? 'Rezervasyon (Masa & Yer)' : 'Reservations (Tables & Spots)'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {language === 'tr'
                            ? 'Masa ve kapasite yönetimi sunarak kafe/restoran veya etkinlikler için rezervasyon oluşturur.'
                            : 'Generates restaurant, cafe or event reservations with table and capacity management.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModuleView('reservation')}
                      className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      {language === 'tr' ? 'Yapılandır' : 'Configure'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Item 2: Sipariş */}
                  <div className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                          {language === 'tr' ? 'Ürün Siparişi' : 'Product Ordering'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {language === 'tr'
                            ? 'Sohbet üzerinden ürün sipariş talepleri toplar.'
                            : 'Collects product order leads directly through conversation.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModuleView('order')}
                      className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      {language === 'tr' ? 'Yapılandır' : 'Configure'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Item 3: Lead */}
                  <div className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                          {language === 'tr' ? 'Müşteri Kayıt & Lead' : 'Lead Generation'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {language === 'tr'
                            ? 'Sohbet esnasında müşteri isim, telefon ve şirket bilgilerini toplar.'
                            : 'Collects lead names, phone numbers, and companies during support.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModuleView('lead')}
                      className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      {language === 'tr' ? 'Yapılandır' : 'Configure'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* VIEW: Appointment Module Configuration */}
          {activeModuleView === 'appointment' && (
            <div className="space-y-6 animate-fadeIn">
              <button 
                onClick={() => setActiveModuleView('list')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {language === 'tr' ? 'Modül Listesine Geri Dön' : 'Back to Modules'}
              </button>

              <div className="bg-dark-800/40 border border-white/[0.06] rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-100">{language === 'tr' ? 'Randevu & Seans Yapılandırması' : 'Appointment & Session Settings'}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{language === 'tr' ? 'Müşterilerinizin alabileceği randevu gün, saat ve seans sürelerini belirleyin.' : 'Define working days, hours and session duration for customer bookings.'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-450">{language === 'tr' ? 'Modül Durumu:' : 'Module Status:'}</span>
                    <input 
                      type="checkbox"
                      checked={appointmentEnabled}
                      onChange={(e) => setAppointmentEnabled(e.target.checked)}
                      className="rounded border-white/[0.06] bg-dark-900 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Sub Configurations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: General */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'tr' ? 'Genel Ayarlar' : 'General Settings'}</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Seans Süresi (Dakika)' : 'Session Duration (Minutes)'}</label>
                      <select 
                        value={appointmentDuration}
                        onChange={(e) => setAppointmentDuration(Number(e.target.value))}
                        className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none"
                      >
                        <option value="30">30 {language === 'tr' ? 'Dakika' : 'Minutes'}</option>
                        <option value="60">60 {language === 'tr' ? 'Dakika' : 'Minutes'}</option>
                        <option value="90">90 {language === 'tr' ? 'Dakika' : 'Minutes'}</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Çalışma Başlangıç Saati' : 'Work Start Hour'}</label>
                        <input 
                          type="time" 
                          value={workingStart}
                          onChange={(e) => setWorkingStart(e.target.value)}
                          className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Çalışma Bitiş Saati' : 'Work End Hour'}</label>
                        <input 
                          type="time" 
                          value={workingEnd}
                          onChange={(e) => setWorkingEnd(e.target.value)}
                          className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Randevu Türü' : 'Appointment Type'}</label>
                      <select 
                        value={appointmentType}
                        onChange={(e) => setAppointmentType(e.target.value)}
                        className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none"
                      >
                        <option value="face_to_face">{language === 'tr' ? 'Yüz Yüze' : 'In-Person'}</option>
                        <option value="online">{language === 'tr' ? 'Online (Çevrimiçi)' : 'Online'}</option>
                        <option value="visitor_choice">{language === 'tr' ? 'Seçimi Müşteriye Bırak' : 'Let Customer Choose'}</option>
                      </select>
                    </div>
                  </div>

                  {/* Right Column: Working Days Selection */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'tr' ? 'Çalışma Günleri' : 'Working Days'}</h3>
                    <div className="space-y-2 bg-dark-900/50 p-4 rounded-lg border border-white/[0.06]">
                      {DAYS_OF_WEEK.map(day => {
                        const isChecked = workingDays.includes(day.key);
                        return (
                          <label key={day.key} className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-white/[0.02]">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleDay(day.key)}
                              className="rounded border-white/[0.08] bg-dark-900 text-emerald-500 focus:ring-0"
                            />
                            <span className="text-sm text-gray-300">{language === 'tr' ? day.tr : day.en}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => setActiveModuleView('list')}
                    className="px-5 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] text-gray-300 font-semibold rounded-lg text-sm transition cursor-pointer"
                  >
                    {language === 'tr' ? 'Geri Dön' : 'Go Back'}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Reservation Module Configuration */}
          {activeModuleView === 'reservation' && (
            <div className="space-y-6 animate-fadeIn">
              <button 
                onClick={() => setActiveModuleView('list')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {language === 'tr' ? 'Modül Listesine Geri Dön' : 'Back to Modules'}
              </button>

              <div className="bg-dark-800/40 border border-white/[0.06] rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                      <Puzzle className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-100">{language === 'tr' ? 'Rezervasyon & Kapasite Yapılandırması' : 'Reservation & Capacity Settings'}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{language === 'tr' ? 'Masa veya yer rezervasyonları için çalışma gün, saat ve kaynak sınırlarını belirleyin.' : 'Define working days, hours, capacity and resources for bookings.'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-450">{language === 'tr' ? 'Modül Durumu:' : 'Module Status:'}</span>
                    <input 
                      type="checkbox"
                      checked={reservationEnabled}
                      onChange={(e) => setReservationEnabled(e.target.checked)}
                      className="rounded border-white/[0.08] bg-dark-900 text-teal-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Sub Configurations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: General */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'tr' ? 'Genel Ayarlar' : 'General Settings'}</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Çalışma Başlangıç Saati' : 'Work Start Hour'}</label>
                        <input 
                          type="time" 
                          value={resWorkingStart}
                          onChange={(e) => setResWorkingStart(e.target.value)}
                          className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Çalışma Bitiş Saati' : 'Work End Hour'}</label>
                        <input 
                          type="time" 
                          value={resWorkingEnd}
                          onChange={(e) => setResWorkingEnd(e.target.value)}
                          className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Kişi / Kapasite Seçimi' : 'Capacity Mode'}</label>
                        <select 
                          value={resCapacityMode}
                          onChange={(e) => setResCapacityMode(e.target.value as 'single' | 'multi')}
                          className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none"
                        >
                          <option value="single">{language === 'tr' ? 'Tek Kişilik' : 'Single Person'}</option>
                          <option value="multi">{language === 'tr' ? 'Çok Kişilik (Grup)' : 'Multi Person'}</option>
                        </select>
                      </div>
                      
                      {resCapacityMode === 'multi' && (
                        <div className="space-y-1.5 animate-fadeIn">
                          <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Maks. Kişi Sayısı' : 'Max Capacity'}</label>
                          <input 
                            type="number"
                            min={2}
                            max={100}
                            value={resMaxCapacity}
                            onChange={(e) => setResMaxCapacity(Number(e.target.value))}
                            className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none font-mono"
                          />
                        </div>
                      )}
                    </div>

                    {/* Rezervasyon Kuralları (Booking Rules) */}
                    <div className="space-y-3 p-4 bg-dark-900/40 border border-white/[0.06] rounded-lg">
                      <span className="text-xs font-semibold text-gray-300 block">{language === 'tr' ? 'Rezervasyon Kuralları' : 'Booking Rules'}</span>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={resMinBookingSize >= 2}
                            onChange={(e) => setResMinBookingSize(e.target.checked ? 2 : 1)}
                            className="rounded border-white/[0.08] bg-dark-900 text-teal-500 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">{language === 'tr' ? 'Tek kişi gelinemez olarak işaretle (Min 2 Kişi)' : 'Disable single-person bookings (Min 2 People)'}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={resRequireAllGuestDetails}
                            onChange={(e) => setResRequireAllGuestDetails(e.target.checked)}
                            className="rounded border-white/[0.08] bg-dark-900 text-teal-500 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">{language === 'tr' ? 'Her katılımcı için kişisel bilgileri zorunlu tut' : 'Require details for all participants'}</span>
                        </label>
                      </div>
                    </div>

                    {/* Kaynak Yönetimi */}
                    <div className="space-y-3 p-4 bg-dark-900/40 border border-white/[0.06] rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300">{language === 'tr' ? 'Kaynak Yönetimi' : 'Resource Management'}</span>
                        <input 
                          type="checkbox"
                          checked={resResourceManagementEnabled}
                          onChange={(e) => setResResourceManagementEnabled(e.target.checked)}
                          className="rounded border-white/[0.08] bg-dark-900 text-teal-500 focus:ring-0"
                        />
                      </div>
                      
                      {resResourceManagementEnabled && (
                        <div className="space-y-4 pt-2 border-t border-white/[0.04] animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-gray-400 block">{language === 'tr' ? 'Kayıtlı Kaynaklar (Masa / Yer)' : 'Registered Resources'}</label>
                            
                            {/* Bulk Apply Offset */}
                            <div className="flex items-center gap-2 bg-dark-900/60 p-1 px-2 rounded border border-white/[0.04]">
                              <span className="text-[10px] text-gray-500">{language === 'tr' ? 'Toplu Min. (Maks - X):' : 'Bulk Min (Max - X):'}</span>
                              <input 
                                type="number" 
                                min={0} 
                                max={10} 
                                defaultValue={2}
                                id="bulkOffsetInput"
                                className="w-10 bg-dark-800 border border-white/[0.1] rounded text-center text-xs text-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById('bulkOffsetInput') as HTMLInputElement;
                                  const val = parseInt(el?.value || '2');
                                  applyBulkMinCapacityOffset(val);
                                }}
                                className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded transition"
                              >
                                {language === 'tr' ? 'Uygula' : 'Apply'}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {resResources.map((res, index) => (
                              <div key={index} className="flex items-center gap-2 bg-dark-900/40 p-2 rounded-lg border border-white/[0.04]">
                                <input
                                  type="text"
                                  value={res.name}
                                  onChange={(e) => updateResourceField(index, 'name', e.target.value)}
                                  placeholder={language === 'tr' ? 'Kaynak Adı (Örn: Masa 1)' : 'Resource Name (e.g. Table 1)'}
                                  className="flex-1 bg-dark-900 border border-white/[0.08] focus:border-teal-500 rounded px-2 py-1.5 text-xs text-white outline-none"
                                />
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[10px] text-gray-500">{language === 'tr' ? 'Maks:' : 'Max:'}</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={res.max_capacity}
                                    onChange={(e) => updateResourceField(index, 'max_capacity', parseInt(e.target.value) || 1)}
                                    className="w-12 bg-dark-900 border border-white/[0.08] focus:border-teal-500 rounded px-1 py-1.5 text-center text-xs text-white outline-none font-mono"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[10px] text-gray-500">{language === 'tr' ? 'Min:' : 'Min:'}</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={res.min_capacity}
                                    onChange={(e) => updateResourceField(index, 'min_capacity', parseInt(e.target.value) || 1)}
                                    className="w-12 bg-dark-900 border border-white/[0.08] focus:border-teal-500 rounded px-1 py-1.5 text-center text-xs text-white outline-none font-mono"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeResource(index)}
                                  className="text-gray-500 hover:text-red-500 p-1 transition"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}

                            {resResources.length === 0 && (
                              <p className="text-xs text-gray-500 text-center py-2">{language === 'tr' ? 'Kayıtlı kaynak bulunmuyor. Yeni kaynak ekleyin.' : 'No registered resources. Add a new resource.'}</p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={addNewResource}
                            className="w-full py-1.5 border border-dashed border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.02] text-gray-400 hover:text-white rounded-lg text-xs font-semibold transition"
                          >
                            + {language === 'tr' ? 'Yeni Kaynak Ekle' : 'Add New Resource'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Working Days Selection */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'tr' ? 'Çalışma Günleri' : 'Working Days'}</h3>
                    <div className="space-y-2 bg-dark-900/50 p-4 rounded-lg border border-white/[0.06]">
                      {DAYS_OF_WEEK.map(day => {
                        const isChecked = resWorkingDays.includes(day.key);
                        return (
                          <label key={day.key} className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-white/[0.02]">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleResDay(day.key)}
                              className="rounded border-white/[0.08] bg-dark-900 text-teal-500 focus:ring-0"
                            />
                            <span className="text-sm text-gray-300">{language === 'tr' ? day.tr : day.en}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => setActiveModuleView('list')}
                    className="px-5 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] text-gray-300 font-semibold rounded-lg text-sm transition cursor-pointer"
                  >
                    {language === 'tr' ? 'Geri Dön' : 'Go Back'}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Product Order Configuration */}
          {activeModuleView === 'order' && (
            <div className="space-y-6 animate-fadeIn">
              <button 
                onClick={() => setActiveModuleView('list')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {language === 'tr' ? 'Modül Listesine Geri Dön' : 'Back to Modules'}
              </button>

              <div className="bg-dark-800/40 border border-white/[0.06] rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-100">{language === 'tr' ? 'Ürün Sipariş Talebi Yapılandırması' : 'Product Order Settings'}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{language === 'tr' ? 'Alınan siparişler için varsayılan ödeme tipi ve para birimi.' : 'Specify default currency and payment methods for orders.'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Para Birimi' : 'Currency'}</label>
                    <select 
                      value={orderCurrency}
                      onChange={(e) => setOrderCurrency(e.target.value)}
                      className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-300 font-semibold">{language === 'tr' ? 'Ödeme Metodu' : 'Payment Type'}</label>
                    <select 
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded px-3 py-2 text-sm text-gray-200 outline-none"
                    >
                      <option value="cod">{language === 'tr' ? 'Kapıda Ödeme' : 'Cash on Delivery'}</option>
                      <option value="invoice">{language === 'tr' ? 'Fatura / Havale' : 'Bank Transfer'}</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => setActiveModuleView('list')}
                    className="px-5 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] text-gray-300 font-semibold rounded-lg text-sm transition cursor-pointer"
                  >
                    {language === 'tr' ? 'Geri Dön' : 'Go Back'}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Lead Gen Configuration */}
          {activeModuleView === 'lead' && (
            <div className="space-y-6 animate-fadeIn">
              <button 
                onClick={() => setActiveModuleView('list')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {language === 'tr' ? 'Modül Listesine Geri Dön' : 'Back to Modules'}
              </button>

              <div className="bg-dark-800/40 border border-white/[0.06] rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-100">{language === 'tr' ? 'Müşteri Kayıt & Lead Yapılandırması' : 'Lead Gen Settings'}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{language === 'tr' ? 'Yapay zekanın toplaması gereken müşteri bilgilerini belirleyin.' : 'Select fields for capturing lead information.'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 bg-dark-900/40 p-4 rounded-lg border border-white/[0.06] max-w-md">
                  <label className="flex items-center justify-between cursor-pointer p-1 rounded hover:bg-white/[0.02]">
                    <span className="text-sm text-gray-300">{language === 'tr' ? 'Telefon Zorunlu' : 'Require Phone'}</span>
                    <input 
                      type="checkbox"
                      checked={requirePhone}
                      onChange={(e) => setRequirePhone(e.target.checked)}
                      className="rounded border-white/[0.08] bg-dark-900 text-purple-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-1 rounded hover:bg-white/[0.02]">
                    <span className="text-sm text-gray-300">{language === 'tr' ? 'Şirket Adı Zorunlu' : 'Require Company'}</span>
                    <input 
                      type="checkbox"
                      checked={requireCompany}
                      onChange={(e) => setRequireCompany(e.target.checked)}
                      className="rounded border-white/[0.08] bg-dark-900 text-purple-500 focus:ring-0"
                    />
                  </label>
                </div>

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => setActiveModuleView('list')}
                    className="px-5 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/[0.06] text-gray-300 font-semibold rounded-lg text-sm transition cursor-pointer"
                  >
                    {language === 'tr' ? 'Geri Dön' : 'Go Back'}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Bot,
  Database,
  Users,
  HardDrive,
  TrendingUp,
  Activity,
  AlertTriangle,
  Building2,
  MessageSquare,
  Calendar,
  Layers,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Zap,
  Monitor,
  Settings,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { adminApi } from '@/services/api';
import type { SystemStats } from '@/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useQuery<SystemStats>(
    'system-stats',
    adminApi.getStats,
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-dark-500 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-dark-800/60 p-6 rounded-xl border border-white/[0.06]">
              <div className="h-4 bg-dark-500 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-dark-500 rounded w-1/2"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-dark-800/60 rounded-xl border border-white/[0.06] p-6"></div>
          <div className="h-64 bg-dark-800/60 rounded-xl border border-white/[0.06] p-6"></div>
          <div className="h-64 bg-dark-800/60 rounded-xl border border-white/[0.06] p-6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-200 font-semibold">Sistem istatistikleri yüklenirken hata oluştu</h3>
            <p className="text-red-400 text-sm mt-1">Lütfen bağlantıyı kontrol edin veya servislerin çalıştığından emin olun.</p>
          </div>
        </div>
      </div>
    );
  }

  // Multi-tenant statistical cards
  const statsCards = [
    {
      title: 'Müşteriler (Tenantlar)',
      value: stats?.tenants?.total || 0,
      description: `${stats?.tenants?.active || 0} Aktif / ${stats?.tenants?.suspended || 0} Askıda`,
      icon: Building2,
      gradient: 'from-orange-500 to-amber-500',
      shadow: 'shadow-orange-100',
    },
    {
      title: 'AI Asistanlar',
      value: stats?.agents?.total || 0,
      description: `${stats?.agents?.active || 0} Aktif Asistan`,
      icon: Bot,
      gradient: 'from-blue-500 to-indigo-500',
      shadow: 'shadow-blue-100',
    },
    {
      title: 'Toplam Konuşma',
      value: stats?.conversations?.total || 0,
      description: `${stats?.conversations?.total_messages || 0} Toplam Mesaj`,
      icon: MessageSquare,
      gradient: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-100',
    },
    {
      title: 'Randevular',
      value: stats?.appointments?.total || 0,
      description: `${stats?.appointments?.pending || 0} Bekleyen Onay`,
      icon: Calendar,
      gradient: 'from-violet-500 to-purple-500',
      shadow: 'shadow-violet-100',
    },
    {
      title: 'Disk Kullanımı',
      value: `${stats?.storage?.total_mb.toFixed(1) || 0} MB`,
      description: `${stats?.documents?.total || 0} Toplam Döküman`,
      icon: HardDrive,
      gradient: 'from-pink-500 to-rose-500',
      shadow: 'shadow-pink-100',
    },
  ];

  // Plan distribution helpers
  const plans = [
    { name: 'Ücretsiz (Free)', key: 'free', color: 'bg-gray-400', progressColor: 'bg-dark-700/500' },
    { name: 'Başlangıç (Starter)', key: 'starter', color: 'bg-blue-400', progressColor: 'bg-blue-600' },
    { name: 'Profesyonel (Pro)', key: 'pro', color: 'bg-indigo-400', progressColor: 'bg-primary-600' },
    { name: 'Kurumsal (Enterprise)', key: 'enterprise', color: 'bg-purple-400', progressColor: 'bg-purple-600' },
  ];

  const totalTenants = stats?.tenants?.total || 1; // avoid divide by zero

  // Appointment status helpers
  const appointmentStatuses = [
    { name: 'Beklemede', count: stats?.appointments?.pending || 0, color: 'text-amber-400', icon: Clock, bgColor: 'bg-amber-500/10 border border-amber-500/20' },
    { name: 'Onaylandı', count: stats?.appointments?.confirmed || 0, color: 'text-blue-400', icon: CheckCircle, bgColor: 'bg-blue-500/10 border border-blue-500/20' },
    { name: 'Tamamlandı', count: stats?.appointments?.completed || 0, color: 'text-green-400', icon: CheckCircle, bgColor: 'bg-green-500/10 border border-green-500/20' },
    { name: 'İptal Edildi', count: stats?.appointments?.cancelled || 0, color: 'text-red-400', icon: XCircle, bgColor: 'bg-red-500/10 border border-red-500/20' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-100 tracking-tight">Yönetim Paneli</h1>
          <p className="text-gray-500 mt-1">Ragleaf Multi-Tenant Platform Genel Durumu ve İstatistikleri</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-dark-800/60 border rounded-full px-4 py-1.5  self-start">
          <Activity className="h-4 w-4 text-green-500 animate-pulse" />
          <span>Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {statsCards.map((card, index) => (
          <div 
            key={index} 
            className={`bg-dark-800/60 rounded-2xl  hover:shadow-md border border-white/[0.06] p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{card.title}</span>
                <p className="text-2xl font-bold text-gray-100 mt-1">{card.value}</p>
              </div>
              <div className={`bg-gradient-to-br ${card.gradient} p-3 rounded-xl shadow-md`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <span className="text-xs font-medium text-gray-500">{card.description}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tenant Plan Distribution */}
        <div className="bg-dark-800/60 rounded-2xl border border-white/[0.06] p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Müşteri Plan Dağılımı</h3>
            <p className="text-xs text-gray-500 mt-0.5">Tenant plan türleri dağılımı</p>
          </div>
          
          <div className="space-y-4">
            {plans.map((plan) => {
              const count = stats?.tenants?.by_plan?.[plan.key] || 0;
              const percentage = Math.round((count / totalTenants) * 100) || 0;
              return (
                <div key={plan.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${plan.color}`}></span>
                      <span className="font-semibold text-gray-300">{plan.name}</span>
                    </div>
                    <span className="text-gray-500 font-semibold">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-dark-600 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${plan.progressColor}`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Appointment Status */}
        <div className="bg-dark-800/60 rounded-2xl border border-white/[0.06] p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Randevu İstatistikleri</h3>
            <p className="text-xs text-gray-500 mt-0.5">Asistanlar üzerinden alınan randevular</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {appointmentStatuses.map((status, index) => (
              <div key={index} className={`p-4 rounded-xl ${status.bgColor} border border-transparent flex flex-col justify-between gap-2`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider ${status.color}`}>{status.name}</span>
                  <status.icon className={`h-5 w-5 ${status.color}`} />
                </div>
                <span className="text-2xl font-black text-gray-100">{status.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Document Status & Storage */}
        <div className="bg-dark-800/60 rounded-2xl border border-white/[0.06] p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Doküman Durumları</h3>
            <p className="text-xs text-gray-500 mt-0.5">Sisteme yüklenen dokümanların işleme durumları</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-400">İşlenmiş (Başarılı)</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-dark-600 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ 
                      width: `${stats?.documents.total ? (stats.documents.processed / stats.documents.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-gray-100">{stats?.documents.processed || 0}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-400">İşleniyor</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-dark-600 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ 
                      width: `${stats?.documents.total ? (stats.documents.processing / stats.documents.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-gray-100">{stats?.documents.processing || 0}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-400">Hatalı</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-dark-600 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ 
                      width: `${stats?.documents.total ? (stats.documents.failed / stats.documents.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-gray-100">{stats?.documents.failed || 0}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Mevcut Toplam Depolama</span>
            <span className="text-sm font-bold text-gray-100 bg-dark-700/50 border border-white/[0.06] px-3 py-1 rounded-lg">
              {stats?.storage.total_mb.toFixed(2) || 0} MB
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-100">Hızlı İşlemler</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            onClick={() => navigate('/admin/tenants')}
            className="group bg-dark-800/60 p-6 rounded-2xl border border-white/[0.06] hover:border-orange-500/30 hover:bg-dark-700/50 hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between h-44"
          >
            <div className="space-y-2">
              <div className="bg-orange-500/10 text-orange-400 p-2.5 rounded-xl w-10 h-10 flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-gray-100 text-base">Tenant Yönetimi</h4>
              <p className="text-xs text-gray-400 leading-tight">Müşteri listesini görüntüle, limitleri ve planları yönetin.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-orange-400 mt-2">
              <span>Yönetime Git</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => navigate('/admin/templates')}
            className="group bg-dark-800/60 p-6 rounded-2xl border border-white/[0.06] hover:border-blue-500/30 hover:bg-dark-700/50 hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between h-44"
          >
            <div className="space-y-2">
              <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl w-10 h-10 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-gray-100 text-base">Asistan Şablonları</h4>
              <p className="text-xs text-gray-400 leading-tight">Hazır sektörel asistan şablonlarını yapılandırın.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-blue-400 mt-2">
              <span>Şablonlara Git</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => navigate('/admin/llm-config')}
            className="group bg-dark-800/60 p-6 rounded-2xl border border-white/[0.06] hover:border-primary-500/30 hover:bg-dark-700/50 hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between h-44"
          >
            <div className="space-y-2">
              <div className="bg-primary-500/10 text-primary-400 p-2.5 rounded-xl w-10 h-10 flex items-center justify-center">
                <Settings className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-gray-100 text-base">LLM Yapılandırması</h4>
              <p className="text-xs text-gray-400 leading-tight">Sistem geneli LLM model ve parametre ayarlarını düzenleyin.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-primary-400 mt-2">
              <span>Yapılandırmaya Git</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => navigate('/system-monitor')}
            className="group bg-dark-800/60 p-6 rounded-2xl border border-white/[0.06] hover:border-pink-500/30 hover:bg-dark-700/50 hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between h-44"
          >
            <div className="space-y-2">
              <div className="bg-pink-500/10 text-pink-400 p-2.5 rounded-xl w-10 h-10 flex items-center justify-center">
                <Monitor className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-gray-100 text-base">Sistem İzleme</h4>
              <p className="text-xs text-gray-400 leading-tight">Bellek tüketimi, CPU ve detaylı sistem durumunu görün.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-pink-400 mt-2">
              <span>İzlemeye Git</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-dark-800/60 rounded-2xl  border border-white/[0.06] p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-100">Sistem Sağlık Durumu</h3>
          <p className="text-xs text-gray-500 mt-0.5">Sistem servisleri ve AI sağlayıcılarının durumu</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div>
              <span className="text-sm font-bold text-green-400">Backend API</span>
              <p className="text-xs text-green-400/80 mt-0.5">FastAPI Server</p>
            </div>
            <div className="flex items-center bg-dark-800/60 border border-green-500/20 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
              <span className="text-xs font-bold text-green-400">Aktif</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div>
              <span className="text-sm font-bold text-green-400">PostgreSQL DB</span>
              <p className="text-xs text-green-400/80 mt-0.5">İlişkisel Veritabanı</p>
            </div>
            <div className="flex items-center bg-dark-800/60 border border-green-500/20 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
              <span className="text-xs font-bold text-green-400">Bağlı</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div>
              <span className="text-sm font-bold text-blue-400">MongoDB</span>
              <p className="text-xs text-blue-400/80 mt-0.5">Chat Veritabanı</p>
            </div>
            <div className="flex items-center bg-dark-800/60 border border-blue-500/20 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-xs font-bold text-blue-600">Bağlı</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <div>
              <span className="text-sm font-bold text-purple-400">AI Servisleri</span>
              <p className="text-xs text-purple-400/80 mt-0.5">{stats?.ai_services?.active || 0} aktif servis</p>
            </div>
            <div className="flex items-center bg-dark-800/60 border border-purple-500/20 px-2.5 py-1 rounded-full">
              <div className={`w-1.5 h-1.5 ${(stats?.ai_services?.active || 0) > 0 ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-2`}></div>
              <span className={`text-xs font-bold ${(stats?.ai_services?.active || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                {(stats?.ai_services?.active || 0) > 0 ? 'Hazır' : 'Bağlantı Yok'}
              </span>
            </div>
          </div>
        </div>
        
        {/* AI Services Detail */}
        {stats?.ai_services?.by_provider && stats.ai_services.by_provider.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/[0.06]">
            <h4 className="text-md font-bold text-gray-100 mb-4">AI Servis Sağlayıcıları</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.ai_services.by_provider.map((provider, index) => (
                <div key={index} className="p-4 bg-dark-700/50 border border-white/[0.06] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${provider.active > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      <span className="text-sm font-bold text-gray-200">{provider.display_name}</span>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      provider.active > 0 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                        : 'bg-dark-600 text-gray-400 border-white/[0.06]'
                    }`}>
                      {provider.active}/{provider.total} aktif
                    </span>
                  </div>
                  {provider.services && provider.services.length > 0 && (
                    <div className="space-y-1.5 pl-4 border-l border-white/[0.06]">
                      {provider.services.map((service, sIdx) => (
                        <div key={sIdx} className="flex items-center text-xs justify-between">
                          <span className={service.is_active ? 'text-gray-300 font-semibold' : 'text-gray-400'}>
                            {service.name}
                          </span>
                          <span className={`text-[10px] font-bold ${service.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                            {service.is_active ? 'AKTİF' : 'PASİF'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

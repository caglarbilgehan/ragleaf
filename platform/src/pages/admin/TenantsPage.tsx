// platform/src/pages/admin/TenantsPage.tsx
// Admin — Tenant (Organizasyon) yönetimi

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/contexts/LanguageContext';
import { adminTenantApi, type TenantListItem, type TenantStats } from '@/services/ragleafApi';
import {
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export default function TenantsPage() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const getPlanBadgeLabel = (plan: string) => {
    switch (plan) {
      case 'free': return t('admin.dash.plan_free').split(' (')[0];
      case 'starter': return 'Starter';
      case 'pro': return 'Pro';
      case 'ultimate': return 'Ultimate';
      case 'ultra': return 'Ultra';
      default: return plan;
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20';
      case 'starter': return 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20';
      case 'pro': return 'bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/20';
      case 'ultimate': return 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20';
      case 'ultra': return 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20';
    }
  };

  const { data: tenants = [], isLoading } = useQuery<TenantListItem[]>({
    queryKey: ['admin-tenants', search, planFilter],
    queryFn: () => adminTenantApi.list({
      search: search || undefined,
      plan: planFilter || undefined,
    }),
  });

  const { data: stats } = useQuery<TenantStats>({
    queryKey: ['admin-tenant-stats'],
    queryFn: adminTenantApi.stats,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🏢 {t('admin.tenants.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('admin.tenants.subtitle')}
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">{t('admin.tenants.stat_total')}</p>
            <p className="text-2xl font-bold text-gray-100">{stats.total_tenants}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">{t('admin.tenants.stat_active')}</p>
            <p className="text-2xl font-bold text-green-600">{stats.active_tenants}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">{t('admin.tenants.stat_agents')}</p>
            <p className="text-2xl font-bold text-primary-400">{stats.total_agents}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">{t('admin.tenants.stat_appointments')}</p>
            <p className="text-2xl font-bold text-purple-600">{stats.total_appointments}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">{t('admin.tenants.stat_plan_distribution')}</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(stats.plan_distribution).map(([plan, count]) => (
                <span key={plan} className="text-xs bg-dark-600 px-1.5 py-0.5 rounded">
                  {getPlanBadgeLabel(plan)}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.tenants.search_placeholder')}
            className="w-full pl-10 pr-4 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:outline-none"
        >
          <option value="">{t('admin.tenants.filter_plans')}</option>
          <option value="free">{getPlanBadgeLabel('free')}</option>
          <option value="starter">{getPlanBadgeLabel('starter')}</option>
          <option value="pro">{getPlanBadgeLabel('pro')}</option>
          <option value="ultimate">{getPlanBadgeLabel('ultimate')}</option>
          <option value="ultra">{getPlanBadgeLabel('ultra')}</option>
        </select>
      </div>

      {/* Tenant List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-12 text-center">
          <BuildingOffice2Icon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-100">{t('admin.tenants.no_tenants')}</h3>
        </div>
      ) : (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
          {tenants.map((tItem) => {
            const label = getPlanBadgeLabel(tItem.plan);
            const color = getPlanBadgeColor(tItem.plan);
            return (
              <div
                key={tItem.id}
                onClick={() => navigate(`/admin/tenants/${tItem.id}`)}
                className="flex items-center justify-between p-4 hover:bg-dark-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <BuildingOffice2Icon className="h-5 w-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100">{tItem.name}</span>
                      {tItem.is_system && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 font-semibold">
                          <ShieldCheckIcon className="h-3 w-3" />
                          {t('admin.tenants.badge_system')}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
                        {label}
                      </span>
                      {!tItem.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                          {t('admin.tenants.badge_inactive')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{tItem.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-1" title={language === 'tr' ? 'Kullanıcılar' : 'Users'}>
                    <UserGroupIcon className="h-4 w-4" />
                    {tItem.user_count}
                  </span>
                  <span className="flex items-center gap-1" title={language === 'tr' ? 'Asistanlar' : 'Assistants'}>
                    <CpuChipIcon className="h-4 w-4" />
                    {tItem.agent_count}
                  </span>
                  <span className="flex items-center gap-1" title={language === 'tr' ? 'Dokümanlar' : 'Documents'}>
                    <DocumentTextIcon className="h-4 w-4" />
                    {tItem.document_count}
                  </span>
                  <span className="flex items-center gap-1" title={language === 'tr' ? 'Randevular' : 'Appointments'}>
                    <CalendarDaysIcon className="h-4 w-4" />
                    {tItem.appointment_count}
                  </span>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

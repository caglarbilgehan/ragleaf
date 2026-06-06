// platform/src/pages/admin/TenantsPage.tsx
// Admin — Tenant (Organizasyon) yönetimi

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

const PLAN_BADGES: Record<string, { label: string; color: string }> = {
  free: { label: 'Ücretsiz', color: 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20' },
  starter: { label: 'Starter', color: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20' },
  pro: { label: 'Pro', color: 'bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/20' },
  enterprise: { label: 'Enterprise', color: 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20' },
};

export default function TenantsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');

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
        <h1 className="text-2xl font-bold text-gray-100">🏢 Tenant Yönetimi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Platformdaki tüm organizasyonları yönetin
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">Toplam Tenant</p>
            <p className="text-2xl font-bold text-gray-100">{stats.total_tenants}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-600">{stats.active_tenants}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">Toplam Agent</p>
            <p className="text-2xl font-bold text-primary-400">{stats.total_agents}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">Toplam Randevu</p>
            <p className="text-2xl font-bold text-purple-600">{stats.total_appointments}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500">Plan Dağılımı</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(stats.plan_distribution).map(([plan, count]) => (
                <span key={plan} className="text-xs bg-dark-600 px-1.5 py-0.5 rounded">
                  {plan}: {count}
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
            placeholder="Tenant ara..."
            className="w-full pl-10 pr-4 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tüm Planlar</option>
          <option value="free">Ücretsiz</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
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
          <h3 className="text-lg font-medium text-gray-100">Tenant bulunamadı</h3>
        </div>
      ) : (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
          {tenants.map((t) => {
            const plan = PLAN_BADGES[t.plan] || PLAN_BADGES.free;
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/admin/tenants/${t.id}`)}
                className="flex items-center justify-between p-4 hover:bg-dark-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <BuildingOffice2Icon className="h-5 w-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100">{t.name}</span>
                      {t.is_system && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 font-semibold">
                          <ShieldCheckIcon className="h-3 w-3" />
                          Sistem
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${plan.color}`}>
                        {plan.label}
                      </span>
                      {!t.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                          Pasif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{t.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-1" title="Kullanıcılar">
                    <UserGroupIcon className="h-4 w-4" />
                    {t.user_count}
                  </span>
                  <span className="flex items-center gap-1" title="Asistanlar">
                    <CpuChipIcon className="h-4 w-4" />
                    {t.agent_count}
                  </span>
                  <span className="flex items-center gap-1" title="Dokümanlar">
                    <DocumentTextIcon className="h-4 w-4" />
                    {t.document_count}
                  </span>
                  <span className="flex items-center gap-1" title="Randevular">
                    <CalendarDaysIcon className="h-4 w-4" />
                    {t.appointment_count}
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

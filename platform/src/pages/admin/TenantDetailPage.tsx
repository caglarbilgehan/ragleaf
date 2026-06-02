// platform/src/pages/admin/TenantDetailPage.tsx
// Admin — Tenant detay sayfası (tab'lı: genel, kullanıcılar, agentlar, dokümanlar, randevular)

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminTenantApi, type TenantListItem } from '@/services/ragleafApi';
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const TABS = [
  { key: 'general', label: 'Genel Bilgi', icon: BuildingOffice2Icon },
  { key: 'users', label: 'Kullanıcılar', icon: UserGroupIcon },
  { key: 'agents', label: "Agent'lar", icon: CpuChipIcon },
  { key: 'documents', label: 'Dokümanlar', icon: DocumentTextIcon },
  { key: 'appointments', label: 'Randevular', icon: CalendarDaysIcon },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const id = parseInt(tenantId || '0');

  const { data: tenant, isLoading } = useQuery<TenantListItem>({
    queryKey: ['admin-tenant', id],
    queryFn: () => adminTenantApi.get(id),
    enabled: id > 0,
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-tenant-users', id],
    queryFn: () => adminTenantApi.getUsers(id),
    enabled: id > 0 && activeTab === 'users',
  });

  const { data: agentsData } = useQuery({
    queryKey: ['admin-tenant-agents', id],
    queryFn: () => adminTenantApi.getAgents(id),
    enabled: id > 0 && activeTab === 'agents',
  });

  const { data: docsData } = useQuery({
    queryKey: ['admin-tenant-docs', id],
    queryFn: () => adminTenantApi.getDocuments(id),
    enabled: id > 0 && activeTab === 'documents',
  });

  const { data: appointmentsData } = useQuery({
    queryKey: ['admin-tenant-appointments', id],
    queryFn: () => adminTenantApi.getAppointments(id),
    enabled: id > 0 && activeTab === 'appointments',
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => adminTenantApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenant', id] });
      toast.success('Tenant güncellendi');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!tenant) {
    return <div className="text-center text-gray-500 p-12">Tenant bulunamadı</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/tenants')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="text-sm text-gray-500">{tenant.slug} • {tenant.plan} plan</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500">Plan</label>
                <select
                  value={tenant.plan}
                  onChange={(e) => updateMutation.mutate({ plan: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="free">Ücretsiz</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Maks Agent</label>
                <input
                  type="number"
                  defaultValue={tenant.max_agents}
                  onBlur={(e) => updateMutation.mutate({ max_agents: parseInt(e.target.value) })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Maks Doküman</label>
                <input
                  type="number"
                  defaultValue={tenant.max_documents}
                  onBlur={(e) => updateMutation.mutate({ max_documents: parseInt(e.target.value) })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Durum</label>
                <button
                  onClick={() => updateMutation.mutate({ is_active: !tenant.is_active })}
                  className={`mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    tenant.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {tenant.is_active ? (
                    <><CheckCircleIcon className="h-4 w-4" /> Aktif</>
                  ) : (
                    <><XCircleIcon className="h-4 w-4" /> Pasif</>
                  )}
                </button>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{tenant.user_count}</p>
                <p className="text-xs text-gray-500">Kullanıcı</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{tenant.agent_count}</p>
                <p className="text-xs text-gray-500">Agent</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{tenant.document_count}</p>
                <p className="text-xs text-gray-500">Doküman</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{tenant.appointment_count}</p>
                <p className="text-xs text-gray-500">Randevu</p>
              </div>
            </div>

            {/* KVKK */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <ShieldExclamationIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">KVKK Doküman Erişimi</p>
                <p className="text-sm text-amber-700 mt-1">
                  {tenant.allow_admin_doc_access
                    ? 'Bu tenant doküman erişim izni vermiş. Dokümanlar sekmesinden görüntüleyebilirsiniz.'
                    : 'Bu tenant henüz doküman erişim izni vermemiş. KVKK kapsamında dokümanlar görüntülenemez.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h3 className="font-medium mb-4">Kullanıcılar ({usersData?.total || 0})</h3>
            {usersData?.users?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">E-posta</th>
                    <th>Ad Soyad</th>
                    <th>Rol</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usersData.users.map((u: any) => (
                    <tr key={u.id}>
                      <td className="py-2 font-medium">{u.email}</td>
                      <td>{u.first_name} {u.last_name}</td>
                      <td><span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{u.role}</span></td>
                      <td>{u.is_active ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">Henüz kullanıcı yok</p>
            )}
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            <h3 className="font-medium mb-4">Agent'lar ({agentsData?.total || 0})</h3>
            {agentsData?.agents?.length > 0 ? (
              <div className="space-y-2">
                {agentsData.agents.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{a.slug}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>💬 {a.total_conversations} konuşma</span>
                      <span>📨 {a.total_messages} mesaj</span>
                      <span className={a.is_active ? 'text-green-600' : 'text-red-600'}>
                        {a.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Henüz agent yok</p>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            {docsData?.kvkk_access === false ? (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                <ShieldExclamationIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">KVKK Erişim Engeli</p>
                  <p className="text-sm text-red-700 mt-1">{docsData.message}</p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-medium mb-4">Dokümanlar ({docsData?.total || 0})</h3>
                {docsData?.documents?.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2">Dosya Adı</th>
                        <th>Tür</th>
                        <th>Boyut</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {docsData.documents.map((d: any) => (
                        <tr key={d.id}>
                          <td className="py-2 font-medium">{d.name}</td>
                          <td className="text-gray-500">{d.file_type}</td>
                          <td className="text-gray-500">{d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '-'}</td>
                          <td><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">Henüz doküman yok</p>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'appointments' && (
          <div>
            <h3 className="font-medium mb-4">Son Randevular ({appointmentsData?.total || 0})</h3>
            {appointmentsData?.appointments?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">Müşteri</th>
                    <th>Hizmet</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointmentsData.appointments.map((a: any) => (
                    <tr key={a.id}>
                      <td className="py-2 font-medium">{a.customer_name}</td>
                      <td className="text-gray-500">{a.service_type || '-'}</td>
                      <td className="text-gray-500">{a.appointment_date ? new Date(a.appointment_date).toLocaleDateString('tr-TR') : '-'}</td>
                      <td><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">Henüz randevu yok</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

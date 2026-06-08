// platform/src/pages/admin/TenantDetailPage.tsx
// Admin — Tenant detay sayfası (tab'lı: genel, kullanıcılar, agentlar, dokümanlar, randevular)

import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTranslation } from '@/contexts/LanguageContext';
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
  { key: 'general', icon: BuildingOffice2Icon },
  { key: 'users', icon: UserGroupIcon },
  { key: 'agents', icon: CpuChipIcon },
  { key: 'documents', icon: DocumentTextIcon },
  { key: 'appointments', icon: CalendarDaysIcon },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function TenantDetailPage() {
  const { t, language } = useTranslation();
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const id = parseInt(tenantId || '0');

  const getTabLabel = (key: string) => {
    switch (key) {
      case 'general': return t('admin.tenant_detail.tab_general');
      case 'users': return t('admin.tenant_detail.tab_users');
      case 'agents': return t('admin.tenant_detail.tab_agents');
      case 'documents': return t('admin.tenant_detail.tab_documents');
      case 'appointments': return t('admin.tenant_detail.tab_appointments');
      default: return key;
    }
  };

  const getPlanLabel = (planName: string) => {
    switch (planName) {
      case 'free': return t('admin.dash.plan_free').split(' (')[0];
      case 'starter': return 'Starter';
      case 'pro': return 'Pro';
      case 'ultimate': return 'Ultimate';
      case 'ultra': return 'Ultra';
      default: return planName;
    }
  };

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
      toast.success(t('admin.tenant_detail.toast_updated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminTenantApi.delete(id),
    onSuccess: () => {
      toast.success(t('admin.tenant_detail.toast_deleted'));
      navigate('/admin/tenants');
    },
    onError: (err: any) => {
      toast.error(t('admin.tenant_detail.toast_delete_error').replace('{error}', err?.response?.data?.detail || err.message));
    }
  });

  const handleDeleteTenant = () => {
    if ((tenant as any).is_system) {
      toast.error(t('admin.tenant_detail.toast_system_error'));
      return;
    }
    const confirmName = prompt(
      t('admin.tenant_detail.delete_prompt').replace('{name}', tenant.name)
    );
    if (confirmName === tenant.name) {
      deleteMutation.mutate();
    } else if (confirmName !== null) {
      toast.error(t('admin.tenant_detail.toast_mismatch'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!tenant) {
    return <div className="text-center text-gray-500 p-12">{t('admin.tenant_detail.not_found')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/tenants')}
          className="p-2 rounded-lg hover:bg-dark-600"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100">{tenant.name}</h1>
            {(tenant as any).is_system && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 font-semibold">
                {t('admin.tenant_detail.badge_system')}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{tenant.slug} • {getPlanLabel(tenant.plan)} {t('admin.tenant_detail.info_plan')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06]">
        <nav className="flex gap-6 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {getTabLabel(tab.key)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500">{t('admin.tenant_detail.label_plan')}</label>
                <select
                  value={tenant.plan}
                  onChange={(e) => updateMutation.mutate({ plan: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="free">{getPlanLabel('free')}</option>
                  <option value="starter">{getPlanLabel('starter')}</option>
                  <option value="pro">{getPlanLabel('pro')}</option>
                  <option value="ultimate">{getPlanLabel('ultimate')}</option>
                  <option value="ultra">{getPlanLabel('ultra')}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('admin.tenant_detail.label_max_agents')}</label>
                <input
                  type="number"
                  defaultValue={tenant.max_agents}
                  onBlur={(e) => updateMutation.mutate({ max_agents: parseInt(e.target.value) })}
                  className="mt-1 w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('admin.tenant_detail.label_max_docs')}</label>
                <input
                  type="number"
                  defaultValue={tenant.max_documents}
                  onBlur={(e) => updateMutation.mutate({ max_documents: parseInt(e.target.value) })}
                  className="mt-1 w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('admin.tenant_detail.label_status')}</label>
                <button
                  onClick={() => updateMutation.mutate({ is_active: !tenant.is_active })}
                  className={`mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    tenant.is_active
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {tenant.is_active ? (
                    <><CheckCircleIcon className="h-4 w-4" /> {t('ui.active')}</>
                  ) : (
                    <><XCircleIcon className="h-4 w-4" /> {t('ui.passive')}</>
                  )}
                </button>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/[0.06]">
              <div className="text-center p-3 bg-dark-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-100">{tenant.user_count}</p>
                <p className="text-xs text-gray-500">{t('admin.tenant_detail.stat_users')}</p>
              </div>
              <div className="text-center p-3 bg-dark-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-100">{tenant.agent_count}</p>
                <p className="text-xs text-gray-500">{t('admin.tenant_detail.stat_agents')}</p>
              </div>
              <div className="text-center p-3 bg-dark-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-100">{tenant.document_count}</p>
                <p className="text-xs text-gray-500">{t('admin.tenant_detail.stat_docs')}</p>
              </div>
              <div className="text-center p-3 bg-dark-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-100">{tenant.appointment_count}</p>
                <p className="text-xs text-gray-500">{t('admin.tenant_detail.stat_appointments')}</p>
              </div>
            </div>

            {/* KVKK */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <ShieldExclamationIcon className="h-6 w-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-200">{t('admin.tenant_detail.kvkk_title')}</p>
                <p className="text-sm text-amber-400 mt-1">
                  {tenant.allow_admin_doc_access
                    ? t('admin.tenant_detail.kvkk_allowed')
                    : t('admin.tenant_detail.kvkk_denied')}
                </p>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-6 border-t border-white/[0.06] mt-6">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-red-400">{t('admin.tenant_detail.danger_title')}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{t('admin.tenant_detail.danger_subtitle')}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col justify-between p-4 bg-dark-800/60 rounded-lg border border-white/[0.06]">
                    <div>
                      <h4 className="font-medium text-gray-100 text-sm">{t('admin.tenant_detail.suspend_title')}</h4>
                      <p className="text-xs text-gray-500 mt-1 text-justify">
                        {t('admin.tenant_detail.suspend_desc')}
                      </p>
                    </div>
                    <button
                      onClick={() => updateMutation.mutate({ is_active: !tenant.is_active })}
                      className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tenant.is_active
                          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                          : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30'
                      }`}
                    >
                      {tenant.is_active ? (
                        <><XCircleIcon className="h-5 w-5" /> {t('admin.tenant_detail.suspend_btn')}</>
                      ) : (
                        <><CheckCircleIcon className="h-5 w-5" /> {t('admin.tenant_detail.unsuspend_btn')}</>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col justify-between p-4 bg-dark-800/60 rounded-lg border border-white/[0.06]">
                    <div>
                      <h4 className="font-medium text-red-400 text-sm font-semibold">{t('admin.tenant_detail.delete_title')}</h4>
                      <p className="text-xs text-gray-500 mt-1 text-justify">
                        {t('admin.tenant_detail.delete_desc')}
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteTenant}
                      disabled={(tenant as any).is_system}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {t('admin.tenant_detail.delete_btn')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h3 className="font-medium mb-4">{t('admin.tenant_detail.users_count').replace('{count}', String(usersData?.total || 0))}</h3>
            {usersData?.users?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-gray-500">
                    <th className="py-2">{t('admin.tenant_detail.th_email')}</th>
                    <th>{t('admin.tenant_detail.th_fullname')}</th>
                    <th>{t('admin.tenant_detail.th_role')}</th>
                    <th>{t('admin.tenant_detail.th_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {usersData.users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="py-2 font-medium">{u.email}</td>
                      <td>{u.first_name} {u.last_name}</td>
                      <td><span className="text-xs bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-full">{u.role}</span></td>
                      <td>{u.is_active ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">{t('admin.tenant_detail.no_users')}</p>
            )}
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            <h3 className="font-medium mb-4">{t('admin.tenant_detail.agents_count').replace('{count}', String(agentsData?.total || 0))}</h3>
            {agentsData?.agents?.length > 0 ? (
              <div className="space-y-2">
                {agentsData.agents.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-gray-500">{a.slug}</span>
                      {a.is_system && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 font-semibold">🔒 {t('admin.tenants.badge_system')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        {t('admin.tenant_detail.agent_stats')
                          .replace('{conv}', String(a.total_conversations))
                          .replace('{msg}', String(a.total_messages))}
                      </span>
                      <span className={a.is_active ? 'text-green-600' : 'text-red-600'}>
                        {a.is_active ? t('ui.active') : t('ui.passive')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">{t('admin.tenant_detail.no_agents')}</p>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            {docsData?.kvkk_access === false ? (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <ShieldExclamationIcon className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-200">{t('admin.tenant_detail.kvkk_error')}</p>
                  <p className="text-sm text-red-400 mt-1">{docsData.message}</p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-medium mb-4">{t('admin.tenant_detail.docs_count').replace('{count}', String(docsData?.total || 0))}</h3>

                {/* Admin Doc Upload */}
                {tenant.allow_admin_doc_access && agentsData?.agents?.length > 0 && (
                  <AdminDocUpload tenantId={id} agents={agentsData.agents} onUploadSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['admin-tenant-docs', id] });
                  }} />
                )}

                {docsData?.documents?.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left text-gray-500">
                        <th className="py-2">{t('admin.tenant_detail.th_filename')}</th>
                        <th>{t('admin.tenant_detail.th_type')}</th>
                        <th>{t('admin.tenant_detail.th_size')}</th>
                        <th>{t('ui.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {docsData.documents.map((d: any) => (
                        <tr key={d.id} className="hover:bg-dark-700/50 transition-colors">
                          <td className="py-2 font-medium">{d.name}</td>
                          <td className="text-gray-500">{d.file_type}</td>
                          <td className="text-gray-500">{d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '-'}</td>
                          <td><span className="text-xs bg-green-500/10 text-green-400 ring-1 ring-green-500/20 px-2 py-0.5 rounded-full">{d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">{t('admin.tenant_detail.no_docs')}</p>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'appointments' && (
          <div>
            <h3 className="font-medium mb-4">{t('admin.tenant_detail.appointments_count').replace('{count}', String(appointmentsData?.total || 0))}</h3>
            {appointmentsData?.appointments?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-gray-500">
                    <th className="py-2">{t('admin.tenant_detail.th_customer')}</th>
                    <th>{t('admin.tenant_detail.th_service')}</th>
                    <th>{t('admin.tenant_detail.th_date')}</th>
                    <th>{t('ui.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {appointmentsData.appointments.map((a: any) => (
                    <tr key={a.id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="py-2 font-medium">{a.customer_name}</td>
                      <td className="text-gray-500">{a.service_type || '-'}</td>
                      <td className="text-gray-500">{a.appointment_date ? new Date(a.appointment_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US') : '-'}</td>
                      <td><span className="text-xs bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 px-2 py-0.5 rounded-full">{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">{t('admin.tenant_detail.no_appointments')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// Admin Document Upload Component (inline)
// ============================================================================

function AdminDocUpload({
  tenantId,
  agents,
  onUploadSuccess,
}: {
  tenantId: number;
  agents: any[];
  onUploadSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || 0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgent) return;

    setUploading(true);
    try {
      await adminTenantApi.uploadDocumentToAgent(tenantId, selectedAgent, file);
      toast.success(t('admin.tenant_detail.upload_success').replace('{name}', file.name));
      onUploadSuccess();
    } catch (err: any) {
      toast.error(t('admin.tenant_detail.upload_error').replace('{error}', err?.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mb-6 p-4 border border-dashed border-primary-500/20 bg-primary-500/5 rounded-xl">
      <p className="text-sm font-medium text-primary-400 mb-3">{t('admin.tenant_detail.upload_title')}</p>
      <div className="flex items-center gap-3">
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(Number(e.target.value))}
          className="text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {agents.map((a: any) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50 transition"
        >
          {uploading ? t('admin.tenant_detail.upload_loading') : t('admin.tenant_detail.upload_btn')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}

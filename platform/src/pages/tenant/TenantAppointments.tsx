// platform/src/pages/tenant/TenantAppointments.tsx
// Randevu yönetim sayfası — işletme sahibi randevuları görür ve yönetir
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  appointmentApi,
  type Appointment,
  type AppointmentStats,
} from '@/services/ragleafApi';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  XMarkIcon,
  PhoneIcon,
  UserIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

const getStatusLabel = (status: string, t: (key: string) => string) => {
  switch (status) {
    case 'pending': return t('apt.status.pending');
    case 'confirmed': return t('apt.status.confirmed');
    case 'completed': return t('apt.status.completed');
    case 'cancelled': return t('apt.status.cancelled');
    case 'no_show': return t('apt.status.no_show');
    default: return status;
  }
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'pending':
      return { color: 'text-amber-400', bg: 'bg-amber-500/10 ring-1 ring-amber-500/20' };
    case 'confirmed':
      return { color: 'text-blue-400', bg: 'bg-blue-500/10 ring-1 ring-blue-500/20' };
    case 'completed':
      return { color: 'text-green-400', bg: 'bg-green-500/10 ring-1 ring-green-500/20' };
    case 'cancelled':
      return { color: 'text-red-400', bg: 'bg-red-500/10 ring-1 ring-red-500/20' };
    case 'no_show':
      return { color: 'text-gray-400', bg: 'bg-dark-600 ring-1 ring-white/[0.06]' };
    default:
      return { color: 'text-gray-400', bg: 'bg-dark-600 ring-1 ring-white/[0.06]' };
  }
};

export default function TenantAppointments() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['appointments', statusFilter],
    queryFn: () => appointmentApi.list(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: stats } = useQuery<AppointmentStats>({
    queryKey: ['appointment-stats'],
    queryFn: appointmentApi.stats,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      appointmentApi.updateStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] });
      toast.success(t('apt.toast_updated'));
      setCancellingId(null);
      setCancelReason('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('apt.toast_update_error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] });
      toast.success(t('apt.toast_deleted'));
    },
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">📅 {t('apt.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('apt.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: t('apt.stat_today'), value: stats.today, color: 'bg-primary-500/10 text-primary-400 border border-primary-500/20' },
            { label: t('apt.stat_this_week'), value: stats.this_week, color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
            { label: t('apt.stat_pending'), value: stats.pending, color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
            { label: t('apt.stat_confirmed'), value: stats.confirmed, color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
            { label: t('apt.stat_completed'), value: stats.completed, color: 'bg-green-500/10 text-green-400 border border-green-500/20' },
            { label: t('apt.stat_cancelled'), value: stats.cancelled, color: 'bg-red-500/10 text-red-400 border border-red-500/20' },
            { label: t('apt.stat_total'), value: stats.total, color: 'bg-dark-700/50 text-gray-300 border border-white/[0.06]' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
              <p className="text-xs font-medium opacity-75">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <FunnelIcon className="h-5 w-5 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('apt.filter_all')}</option>
          <option value="pending">{t('apt.status.pending')}</option>
          <option value="confirmed">{t('apt.status.confirmed')}</option>
          <option value="completed">{t('apt.status.completed')}</option>
          <option value="cancelled">{t('apt.status.cancelled')}</option>
          <option value="no_show">{t('apt.status.no_show')}</option>
        </select>
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-dark-800/60 rounded-xl border p-12 text-center">
          <CalendarDaysIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-100">{t('apt.no_appointments')}</h3>
          <p className="text-gray-500 mt-1">
            {t('apt.no_appointments_desc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const statusLabel = getStatusLabel(apt.status, t);
            const statusConfig = getStatusConfig(apt.status);
            return (
              <div
                key={apt.public_id}
                className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 hover: transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left — Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                        {statusLabel}
                      </span>
                      <span className="text-sm font-semibold text-gray-100">
                        {formatDate(apt.appointment_date)}
                      </span>
                      <span className="text-sm text-primary-400 font-medium">
                        {formatTime(apt.appointment_date)}
                      </span>
                      {apt.duration_minutes && (
                        <span className="text-xs text-gray-400">
                          ({t('apt.duration_suffix').replace('{duration}', String(apt.duration_minutes))})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        {apt.customer_name}
                      </span>
                      {apt.customer_phone && (
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="h-4 w-4 text-gray-400" />
                          {apt.customer_phone}
                        </span>
                      )}
                      {apt.service_type && (
                        <span className="text-primary-400 font-medium">
                          {apt.service_type}
                        </span>
                      )}
                    </div>

                    {apt.customer_notes && (
                      <p className="text-xs text-gray-500 italic">"{apt.customer_notes}"</p>
                    )}

                    {apt.cancelled_reason && (
                      <p className="text-xs text-red-500">{t('apt.cancel_reason_prefix').replace('{reason}', apt.cancelled_reason)}</p>
                    )}
                  </div>

                  {/* Right — Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/tenant/appointments/${apt.public_id}`}
                      className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      {language === 'tr' ? 'Detaylar' : 'Details'}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// platform/src/pages/tenant/TenantAppointments.tsx
// Randevu yönetim sayfası — işletme sahibi randevuları görür ve yönetir
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  appointmentApi,
  type Appointment,
  type AppointmentStats,
} from '@/services/ragleafApi';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon,
  PhoneIcon,
  UserIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Bekliyor', color: 'text-amber-400', bg: 'bg-amber-500/10 ring-1 ring-amber-500/20' },
  confirmed: { label: 'Onaylı', color: 'text-blue-400', bg: 'bg-blue-500/10 ring-1 ring-blue-500/20' },
  completed: { label: 'Tamamlandı', color: 'text-green-400', bg: 'bg-green-500/10 ring-1 ring-green-500/20' },
  cancelled: { label: 'İptal', color: 'text-red-400', bg: 'bg-red-500/10 ring-1 ring-red-500/20' },
  no_show: { label: 'Gelmedi', color: 'text-gray-400', bg: 'bg-dark-600 ring-1 ring-white/[0.06]' },
};

export default function TenantAppointments() {
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
      toast.success('Randevu durumu güncellendi');
      setCancellingId(null);
      setCancelReason('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Güncelleme hatası');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] });
      toast.success('Randevu silindi');
    },
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">📅 Randevular</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI asistanınız üzerinden alınan randevuları yönetin
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Bugün', value: stats.today, color: 'bg-primary-500/10 text-primary-400 border border-primary-500/20' },
            { label: 'Bu Hafta', value: stats.this_week, color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
            { label: 'Bekleyen', value: stats.pending, color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
            { label: 'Onaylı', value: stats.confirmed, color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
            { label: 'Tamamlanan', value: stats.completed, color: 'bg-green-500/10 text-green-400 border border-green-500/20' },
            { label: 'İptal', value: stats.cancelled, color: 'bg-red-500/10 text-red-400 border border-red-500/20' },
            { label: 'Toplam', value: stats.total, color: 'bg-dark-700/50 text-gray-300 border border-white/[0.06]' },
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
          <option value="">Tüm Durumlar</option>
          <option value="pending">Bekleyen</option>
          <option value="confirmed">Onaylı</option>
          <option value="completed">Tamamlanan</option>
          <option value="cancelled">İptal</option>
          <option value="no_show">Gelmedi</option>
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
          <h3 className="text-lg font-medium text-gray-100">Henüz randevu yok</h3>
          <p className="text-gray-500 mt-1">
            AI asistanınız üzerinden alınan randevular burada görünecek
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const status = STATUS_LABELS[apt.status] || STATUS_LABELS.pending;
            return (
              <div
                key={apt.public_id}
                className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 hover: transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left — Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-100">
                        {formatDate(apt.appointment_date)}
                      </span>
                      <span className="text-sm text-primary-400 font-medium">
                        {formatTime(apt.appointment_date)}
                      </span>
                      {apt.duration_minutes && (
                        <span className="text-xs text-gray-400">
                          ({apt.duration_minutes} dk)
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
                      <p className="text-xs text-red-500">İptal nedeni: {apt.cancelled_reason}</p>
                    )}
                  </div>

                  {/* Right — Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {apt.status === 'pending' && (
                      <>
                        <button
                          onClick={() => statusMutation.mutate({ id: apt.public_id, status: 'confirmed' })}
                          disabled={statusMutation.isPending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Onayla
                        </button>
                        <button
                          onClick={() => setCancellingId(apt.public_id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          İptal
                        </button>
                      </>
                    )}
                    {apt.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => statusMutation.mutate({ id: apt.public_id, status: 'completed' })}
                          disabled={statusMutation.isPending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Tamamla
                        </button>
                        <button
                          onClick={() => statusMutation.mutate({ id: apt.public_id, status: 'no_show' })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-dark-600 text-gray-300 rounded-lg hover:bg-dark-500 transition-colors"
                        >
                          Gelmedi
                        </button>
                        <button
                          onClick={() => setCancellingId(apt.public_id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          İptal
                        </button>
                      </>
                    )}
                    {['completed', 'cancelled', 'no_show'].includes(apt.status) && (
                      <button
                        onClick={() => {
                          if (confirm('Bu randevuyu kalıcı olarak silmek istediğinize emin misiniz?'))
                            deleteMutation.mutate(apt.public_id);
                        }}
                        className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </div>

                {/* Cancel reason modal (inline) */}
                {cancellingId === apt.public_id && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">İptal Nedeni (opsiyonel)</label>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Müşteri tarafından iptal edildi..."
                        className="w-full px-3 py-1.5 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() =>
                        statusMutation.mutate({
                          id: apt.public_id,
                          status: 'cancelled',
                          reason: cancelReason || undefined,
                        })
                      }
                      className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                    >
                      İptal Et
                    </button>
                    <button
                      onClick={() => { setCancellingId(null); setCancelReason(''); }}
                      className="px-3 py-1.5 text-sm text-gray-400 hover:bg-dark-600 hover:text-gray-100 rounded-lg transition-colors"
                    >
                      Vazgeç
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

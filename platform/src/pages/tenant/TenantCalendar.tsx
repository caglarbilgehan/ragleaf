import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { appointmentApi, type Appointment } from '@/services/ragleafApi';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Plus
} from 'lucide-react';

export default function TenantCalendar() {
  const { t, language } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch real appointments
  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () => appointmentApi.list(),
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNamesTr = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthLabel = language === 'tr' 
    ? `${monthNamesTr[month]} ${year}`
    : `${monthNamesEn[month]} ${year}`;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Day of week index for first day of month (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const paddingDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const paddingArray = Array.from({ length: paddingDays });
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getDayAppointments = (day: number) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_date);
      return aptDate.getFullYear() === year && 
             aptDate.getMonth() === month && 
             aptDate.getDate() === day;
    });
  };

  const formatTimeRange = (apt: Appointment) => {
    const start = new Date(apt.appointment_date);
    const duration = apt.duration_minutes || 60;
    const end = new Date(start.getTime() + duration * 60000);
    const fmt = (d: Date) => d.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const formatTimeStart = (apt: Appointment) => {
    const start = new Date(apt.appointment_date);
    return start.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const now = new Date();
  const isSelectedToday = selectedDate.getFullYear() === now.getFullYear() &&
                          selectedDate.getMonth() === now.getMonth() &&
                          selectedDate.getDate() === now.getDate();

  // Agenda for selected date
  const agendaAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    return aptDate.getFullYear() === selectedDate.getFullYear() &&
           aptDate.getMonth() === selectedDate.getMonth() &&
           aptDate.getDate() === selectedDate.getDate();
  });

  const agendaTitle = language === 'tr'
    ? `${selectedDate.getDate()} ${monthNamesTr[selectedDate.getMonth()]} ${selectedDate.getFullYear()} Rezervasyonları`
    : `Appointments for ${selectedDate.getDate()} ${monthNamesEn[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary-400" />
            {language === 'tr' ? 'Rezervasyon Takvimi' : 'Reservation Calendar'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'tr' ? 'AI asistanınız üzerinden veya manuel olarak alınan randevuları takvim üzerinde yönetin.' : 'Manage appointments scheduled via AI assistant or manually on a calendar view.'}
          </p>
        </div>

        {/* Navigation / Month switcher */}
        <div className="flex items-center gap-2 bg-dark-800/80 border border-white/[0.06] rounded-lg p-1">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-dark-700 text-gray-400 hover:text-white rounded transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-200 px-3 min-w-32 text-center">
            {monthLabel}
          </span>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-dark-700 text-gray-400 hover:text-white rounded transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid Calendar Layout */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-4">
        {/* Days of Week Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div>{language === 'tr' ? 'Pzt' : 'Mon'}</div>
          <div>{language === 'tr' ? 'Sal' : 'Tue'}</div>
          <div>{language === 'tr' ? 'Çar' : 'Wed'}</div>
          <div>{language === 'tr' ? 'Per' : 'Thu'}</div>
          <div>{language === 'tr' ? 'Cum' : 'Fri'}</div>
          <div>{language === 'tr' ? 'Cmt' : 'Sat'}</div>
          <div>{language === 'tr' ? 'Paz' : 'Sun'}</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2 auto-rows-[120px]">
          {/* Padding empty days */}
          {paddingArray.map((_, idx) => (
            <div key={`pad-${idx}`} className="p-2 rounded-lg border border-transparent bg-transparent" />
          ))}

          {/* Actual days */}
          {daysArray.map((day) => {
            const dayEvents = getDayAppointments(day);
            const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
            const isSelected = selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;

            return (
              <div
                key={`day-${day}`}
                onClick={() => setSelectedDate(new Date(year, month, day))}
                className={`p-2 rounded-lg border transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500/10 shadow-inner'
                    : isToday 
                    ? 'border-primary-500/50 bg-primary-500/5 shadow-inner hover:bg-primary-500/10' 
                    : 'border-white/[0.04] bg-dark-900/20 hover:bg-dark-900/40'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${isToday || isSelected ? 'text-primary-400' : 'text-gray-400'}`}>
                    {day}
                  </span>
                  {isToday && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                  )}
                </div>

                {/* Events list inside cell */}
                <div className="flex-1 mt-1 space-y-1 overflow-y-auto max-h-[75px] scrollbar-none">
                  {dayEvents.map(e => (
                    <div 
                      key={e.public_id} 
                      className="text-[10px] p-1 rounded bg-dark-700 border border-white/[0.06] text-gray-200 truncate hover:border-primary-500 transition-colors"
                      title={`${e.service_type || 'Randevu'} - ${e.customer_name} (${formatTimeRange(e)})`}
                    >
                      <span className="font-semibold text-primary-400">{formatTimeStart(e)}</span> {e.customer_name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-side Today details and quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Selected Day Agenda */}
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 md:col-span-2">
          <h3 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-400" />
            {agendaTitle}
          </h3>
          <div className="space-y-3">
            {agendaAppointments.map(e => (
              <div key={e.public_id} className="flex items-center justify-between p-3.5 bg-dark-900/30 rounded-lg border border-white/[0.04] hover:border-white/[0.08] transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-500/10 rounded-lg border border-primary-500/20 text-primary-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-200">{e.service_type || 'Randevu'}</h4>
                    <p className="text-xs text-gray-500">{e.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/tenant/appointments/${e.public_id}`}
                    className="text-xs px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded font-semibold transition"
                  >
                    {language === 'tr' ? 'Detaylar' : 'Details'}
                  </a>
                  <div className="text-xs font-mono font-semibold text-gray-400 bg-dark-800 px-2.5 py-1 rounded border border-white/[0.06]">
                    {formatTimeRange(e)}
                  </div>
                </div>
              </div>
            ))}
            {agendaAppointments.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">
                {language === 'tr' ? 'Seçilen gün için planlanmış randevu bulunmuyor.' : 'No appointments scheduled for the selected day.'}
              </p>
            )}
          </div>
        </div>

        {/* Quick action card */}
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-200 mb-2">{language === 'tr' ? 'Randevuları Yönet' : 'Manage Appointments'}</h3>
            <p className="text-xs text-gray-500">
              {language === 'tr' ? 'Tüm randevu taleplerini onaylamak, güncellemek veya iptal etmek için randevular listesine gidin.' : 'Go to the appointments list to approve, update, or cancel booking requests.'}
            </p>
          </div>
          <a 
            href="/tenant/appointments"
            className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg text-sm transition"
          >
            <CalendarDays className="h-4 w-4" />
            {language === 'tr' ? 'Randevu Listesine Git' : 'Go to Appointments List'}
          </a>
        </div>
      </div>
    </div>
  );
}

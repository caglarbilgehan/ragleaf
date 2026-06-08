import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  appointmentApi,
  agentApi,
  type Appointment,
  type Agent
} from '@/services/ragleafApi';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  Tag,
  CheckCircle,
  XCircle,
  Trash2,
  MessageSquare,
  Users
} from 'lucide-react';

interface Message {
  role: string;
  content: string;
  created_at: string | null;
}

function getApiBase(): string {
  if (window.location.origin.includes('ragleaf.com')) return 'https://api.ragleaf.com';
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:1306`;
  }
  return 'http://cserver-2:1306';
}
const API_BASE = getApiBase();

async function fetchConversationMessages(sessionId: string): Promise<Message[]> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}/api/org/conversations/${sessionId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.messages || [];
}

const getStatusLabel = (status: string, language: string) => {
  switch (status) {
    case 'pending': return language === 'tr' ? 'Bekliyor' : 'Pending';
    case 'confirmed': return language === 'tr' ? 'Onaylı' : 'Confirmed';
    case 'completed': return language === 'tr' ? 'Tamamlandı' : 'Completed';
    case 'cancelled': return language === 'tr' ? 'İptal Edildi' : 'Cancelled';
    case 'no_show': return language === 'tr' ? 'Gelmedi' : 'No Show';
    default: return status;
  }
};

const renderMarkdown = (content: string | null) => {
  if (!content) return '';
  
  // Normalize newlines and replace basic formatting (bold, italic, code, links)
  let html = content
    .replace(/\\n/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic opacity-90">$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-black/25 px-1 py-0.5 rounded text-xs font-mono text-emerald-400">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:underline">$1</a>');

  const lines = html.split('\n');
  let inList = false; // for unordered list -
  let inNumList = false; // for ordered list 1.
  let inTable = false; // for tables |
  let inCodeBlock = false; // for fenced code blocks ```
  let inBlockquote = false; // for blockquotes >

  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // 1. Fenced code block check
    if (trimmed.startsWith('```')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }

      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = trimmed.substring(3).trim();
        return `${prefix}<pre class="bg-black/30 p-2.5 rounded-lg border border-white/5 overflow-x-auto font-mono text-xs my-1 text-emerald-400"><code class="${lang}">`;
      } else {
        inCodeBlock = false;
        return '</code></pre>';
      }
    }

    // If inside a code block, just output the raw content encoded/escaped
    if (inCodeBlock) {
      return line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
    }

    // 2. Horizontal rule check
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
      return `${prefix}<hr class="border-t border-white/10 my-3"/>`;
    }

    // 3. Header check
    if (trimmed.startsWith('#')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
      
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const title = trimmed.replace(/^#+\s*/, '');
      if (level === 1) {
        return `${prefix}<h1 class="text-base font-bold mt-2 mb-1 text-white">${title}</h1>`;
      } else if (level === 2) {
        return `${prefix}<h2 class="text-sm font-bold mt-2 mb-1 text-white border-b border-white/5 pb-0.5">${title}</h2>`;
      } else {
        return `${prefix}<h3 class="text-xs font-bold mt-2 mb-1 text-white">${title}</h3>`;
      }
    }

    // 4. Table check
    if (trimmed.startsWith('|')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }

      const isSeparator = /^[|:\s-]+$/.test(trimmed);
      if (isSeparator) {
        return ''; // skip separator lines
      }

      const cells = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      if (!inTable) {
        inTable = true;
        const headerCols = cells.map(c => `<th class="border border-white/10 bg-white/5 px-3 py-2 text-left font-semibold text-white">${c}</th>`).join('');
        return `${prefix}<div class="overflow-x-auto my-3"><table class="min-w-full border-collapse border border-white/10 text-xs"><thead><tr>${headerCols}</tr></thead><tbody>`;
      } else {
        const rowCols = cells.map(c => `<td class="border border-white/10 px-3 py-1.5">${c}</td>`).join('');
        return `<tr>${rowCols}</tr>`;
      }
    }

    // 5. Blockquote check
    if (trimmed.startsWith('>')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const quoteContent = trimmed.replace(/^>\s*/, '');
      if (!inBlockquote) {
        inBlockquote = true;
        return `${prefix}<blockquote class="border-l-2 border-primary-500 bg-white/5 px-3 py-1.5 italic text-gray-300 my-1 rounded-r">${quoteContent}`;
      } else {
        return `<br/>${quoteContent}`;
      }
    }

    // Close any open blockquote if current line isn't one
    let closingPrefix = '';
    if (inBlockquote) {
      inBlockquote = false;
      closingPrefix = '</blockquote>';
    }

    // 6. Unordered list check
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      let prefix = closingPrefix;
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const contentStr = trimmed.substring(2);
      if (!inList) {
        inList = true;
        prefix += '<ul class="list-disc pl-4 my-1 space-y-0.5">';
      }
      return `${prefix}<li>${contentStr}</li>`;
    }

    // 7. Numbered list check
    const numListMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numListMatch) {
      let prefix = closingPrefix;
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const contentStr = numListMatch[2];
      if (!inNumList) {
        inNumList = true;
        prefix += '<ol class="list-decimal pl-4 my-1 space-y-0.5">';
      }
      return `${prefix}<li>${contentStr}</li>`;
    }

    // Regular line formatting
    let prefix = closingPrefix;
    if (inList) { inList = false; prefix += '</ul>'; }
    if (inNumList) { inNumList = false; prefix += '</ol>'; }
    if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

    return `${prefix}${line}<br/>`;
  });

  // Final cleanup for open tags
  let finalHtml = processedLines.join('');
  if (inCodeBlock) finalHtml += '</code></pre>';
  if (inTable) finalHtml += '</tbody></table></div>';
  if (inList) finalHtml += '</ul>';
  if (inNumList) finalHtml += '</ol>';
  if (inBlockquote) finalHtml += '</blockquote>';

  return finalHtml;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'confirmed': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'cancelled': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'no_show': return 'text-gray-400 bg-dark-600 border-white/[0.06]';
    default: return 'text-gray-400 bg-dark-600 border-white/[0.06]';
  }
};

export default function TenantAppointmentDetail() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const { language } = useTranslation();
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch appointment info
  const { data: appointment, isLoading: isAptLoading, error: aptError } = useQuery<Appointment>({
    queryKey: ['appointment', publicId],
    queryFn: () => appointmentApi.get(publicId!),
    enabled: !!publicId,
  });

  // Fetch conversation messages
  const { data: messages = [], isLoading: isMessagesLoading } = useQuery<Message[]>({
    queryKey: ['appointment-messages', appointment?.conversation_id],
    queryFn: () => fetchConversationMessages(appointment!.conversation_id!),
    enabled: !!appointment?.conversation_id,
  });

  // Fetch agent info for module settings
  const { data: agent, isLoading: isAgentLoading } = useQuery<Agent>({
    queryKey: ['agent', appointment?.agent_id],
    queryFn: () => agentApi.get(appointment!.agent_id!),
    enabled: !!appointment?.agent_id,
  });

  // Mutation to update status
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      appointmentApi.updateStatus(publicId!, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', publicId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(language === 'tr' ? 'Randevu durumu güncellendi' : 'Appointment status updated');
      setIsCancelling(false);
      setCancelReason('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (language === 'tr' ? 'Güncelleme hatası' : 'Update error'));
    },
  });

  // Mutation to delete
  const deleteMutation = useMutation({
    mutationFn: () => appointmentApi.delete(publicId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(language === 'tr' ? 'Randevu silindi' : 'Appointment deleted');
      navigate('/tenant/appointments');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (language === 'tr' ? 'Silme hatası' : 'Delete error'));
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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

  const formatMsgDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isAptLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (aptError || !appointment) {
    return (
      <div className="p-6 bg-dark-800/60 rounded-xl border border-white/[0.06] text-center max-w-lg mx-auto mt-12">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-200">
          {language === 'tr' ? 'Randevu Bulunamadı' : 'Appointment Not Found'}
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          {language === 'tr' ? 'Talep ettiğiniz randevu bulunamadı veya silinmiş olabilir.' : 'The appointment you requested was not found or has been deleted.'}
        </p>
        <button
          onClick={() => navigate('/tenant/appointments')}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          {language === 'tr' ? 'Geri Dön' : 'Go Back'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Top navigation */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 bg-dark-800/80 hover:bg-dark-700 border border-white/[0.06] rounded-lg transition"
      >
        <ArrowLeft className="h-4 w-4" />
        {language === 'tr' ? 'Geri Dön' : 'Go Back'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column - Appointment Info & Actions (2/5 size) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                  {getStatusLabel(appointment.status, language)}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {language === 'tr' ? 'Randevu Detayı' : 'Booking Details'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-100">{appointment.customer_name}</h2>
            </div>

            {/* Info Grid */}
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 text-gray-300">
                <Calendar className="h-4 w-4 text-primary-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{language === 'tr' ? 'Tarih' : 'Date'}</p>
                  <p className="font-semibold">{formatDate(appointment.appointment_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-300">
                <Clock className="h-4 w-4 text-primary-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{language === 'tr' ? 'Saat & Süre' : 'Time & Duration'}</p>
                  <p className="font-semibold">
                    {formatTimeRange(appointment)} 
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      ({appointment.duration_minutes || 60} {language === 'tr' ? 'dk' : 'min'})
                    </span>
                  </p>
                </div>
              </div>

              {appointment.customer_phone && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Phone className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{language === 'tr' ? 'Telefon' : 'Phone'}</p>
                    <p className="font-semibold">{appointment.customer_phone}</p>
                  </div>
                </div>
              )}

              {appointment.customer_email && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Mail className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-semibold">{appointment.customer_email}</p>
                  </div>
                </div>
              )}

              {appointment.service_type && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Tag className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{language === 'tr' ? 'Hizmet Türü' : 'Service Type'}</p>
                    <p className="font-semibold text-primary-400">{appointment.service_type}</p>
                  </div>
                </div>
              )}

              {appointment.extra_data?.resource && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Tag className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{language === 'tr' ? 'Seçilen Kaynak / Masa' : 'Selected Resource'}</p>
                    <p className="font-semibold text-emerald-400">{appointment.extra_data.resource}</p>
                  </div>
                </div>
              )}

              {appointment.extra_data?.party_size && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Users className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{language === 'tr' ? 'Kişi Sayısı' : 'Party Size'}</p>
                    <p className="font-semibold text-cyan-400">{appointment.extra_data.party_size} {language === 'tr' ? 'Kişi' : 'People'}</p>
                  </div>
                </div>
              )}

              {appointment.extra_data?.guest_details && Array.isArray(appointment.extra_data.guest_details) && appointment.extra_data.guest_details.length > 0 && (
                <div className="border-t border-white/[0.04] pt-4 space-y-2">
                  <p className="text-xs text-gray-500 font-semibold">{language === 'tr' ? 'Diğer Katılımcılar' : 'Other Participants'}</p>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                    {appointment.extra_data.guest_details.map((g: any, i: number) => (
                      <div key={i} className="text-xs bg-dark-900/40 p-2 rounded border border-white/[0.04] text-gray-300">
                        <div className="font-semibold text-gray-200">{g.name}</div>
                        {g.contact && <div className="text-gray-500 mt-0.5">{g.contact}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {appointment.customer_notes && (
                <div className="flex items-start gap-3 text-gray-300 border-t border-white/[0.04] pt-4">
                  <FileText className="h-4 w-4 text-primary-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500">{language === 'tr' ? 'Müşteri Notu' : 'Customer Notes'}</p>
                    <p className="italic text-gray-300 mt-1">"{appointment.customer_notes}"</p>
                  </div>
                </div>
              )}

              {appointment.cancelled_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400">
                  <p className="text-xs font-semibold">{language === 'tr' ? 'İptal Gerekçesi' : 'Cancellation Reason'}</p>
                  <p className="text-xs mt-1">{appointment.cancelled_reason}</p>
                </div>
              )}
            </div>

            {/* Actions Panel */}
            <div className="border-t border-white/[0.06] pt-5 space-y-3">
              {appointment.status === 'pending' && !isCancelling && (
                <div className="flex gap-2">
                  <button
                    onClick={() => statusMutation.mutate({ status: 'confirmed' })}
                    disabled={statusMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {language === 'tr' ? 'Randevuyu Onayla' : 'Confirm Appointment'}
                  </button>
                  <button
                    onClick={() => setIsCancelling(true)}
                    className="inline-flex items-center justify-center px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-sm font-semibold transition"
                  >
                    {language === 'tr' ? 'İptal Et' : 'Cancel'}
                  </button>
                </div>
              )}

              {appointment.status === 'confirmed' && !isCancelling && (
                <div className="flex gap-2">
                  <button
                    onClick={() => statusMutation.mutate({ status: 'no_show' })}
                    disabled={statusMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-dark-600 hover:bg-dark-500 text-gray-300 border border-white/[0.06] rounded-lg text-sm font-semibold transition disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    {language === 'tr' ? 'Gelmedi Olarak İşaretle' : 'Mark as No Show'}
                  </button>
                  <button
                    onClick={() => setIsCancelling(true)}
                    className="inline-flex items-center justify-center px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-sm font-semibold transition"
                  >
                    {language === 'tr' ? 'İptal Et' : 'Cancel'}
                  </button>
                </div>
              )}

              {isCancelling && (
                <div className="space-y-2.5 bg-dark-900/30 p-3 rounded-lg border border-white/[0.04]">
                  <label className="block text-xs text-gray-400 font-semibold">{language === 'tr' ? 'İptal Gerekçesi (İsteğe Bağlı)' : 'Cancellation Reason (Optional)'}</label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={language === 'tr' ? 'Müşteri iptal talep etti...' : 'Requested by customer...'}
                    className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-primary-500 focus:outline-none"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() =>
                        statusMutation.mutate({
                          status: 'cancelled',
                          reason: cancelReason || undefined,
                        })
                      }
                      disabled={statusMutation.isPending}
                      className="flex-1 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition disabled:opacity-50"
                    >
                      {language === 'tr' ? 'İptal İşlemini Tamamla' : 'Confirm Cancel'}
                    </button>
                    <button
                      onClick={() => { setIsCancelling(false); setCancelReason(''); }}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:bg-dark-600 hover:text-gray-100 rounded transition"
                    >
                      {language === 'tr' ? 'Vazgeç' : 'Keep'}
                    </button>
                  </div>
                </div>
              )}

              {/* Always show delete button as secondary action */}
              <button
                onClick={() => {
                  if (confirm(language === 'tr' ? 'Bu randevuyu kalıcı olarak silmek istediğinize emin misiniz?' : 'Are you sure you want to permanently delete this appointment?')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg border border-transparent hover:border-red-500/10 transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {language === 'tr' ? 'Randevuyu Sil' : 'Delete Appointment'}
              </button>
            </div>
          </div>

          {/* Module Settings Card */}
          {agent && (
            <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-200 border-b border-white/[0.06] pb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {language === 'tr' ? 'Asistan Modül Yapılandırması' : 'Assistant Module Settings'}
              </h3>
              <div className="space-y-3 text-xs text-gray-300">
                <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                  <span className="text-gray-500">{language === 'tr' ? 'Seans Süresi' : 'Session Duration'}</span>
                  <span className="font-semibold text-gray-200">{(agent.personality as any)?.session_duration_minutes || 60} {language === 'tr' ? 'Dakika' : 'Minutes'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                  <span className="text-gray-500">{language === 'tr' ? 'Çalışma Saatleri' : 'Working Hours'}</span>
                  <span className="font-semibold text-gray-200 font-mono">{(agent.personality as any)?.working_start_hour || '09:00'} - {(agent.personality as any)?.working_end_hour || '18:00'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                  <span className="text-gray-500">{language === 'tr' ? 'Randevu Türü' : 'Appointment Type'}</span>
                  <span className="font-semibold text-primary-400">
                    {(agent.personality as any)?.appointment_type === 'online' 
                      ? (language === 'tr' ? 'Online (Çevrimiçi)' : 'Online')
                      : (agent.personality as any)?.appointment_type === 'visitor_choice'
                      ? (language === 'tr' ? 'Müşteri Seçimi' : "Visitor's Choice")
                      : (language === 'tr' ? 'Yüz Yüze' : 'Face to Face')}
                  </span>
                </div>
                {/* Capacity mode and resource management rows removed */}
              </div>
            </div>
          )}
        </div>

        {/* Right column - Conversation / Message View (3/5 size) */}
        <div className="lg:col-span-3 flex flex-col h-[calc(100vh-220px)] bg-dark-800/60 rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] bg-dark-700/50 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary-400" />
            <h3 className="text-sm font-semibold text-gray-200">
              {language === 'tr' ? 'Randevunun Alındığı Konuşma Geçmişi' : 'Conversation History of the Booking'}
            </h3>
          </div>

          {!appointment.conversation_id ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-6 text-center">
              <div>
                <MessageSquare className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium">
                  {language === 'tr' ? 'Bu randevu bir sohbet üzerinden oluşturulmamış.' : 'This appointment was not created via a chat session.'}
                </p>
              </div>
            </div>
          ) : isMessagesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-6 text-center">
              <div>
                <MessageSquare className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium">
                  {language === 'tr' ? 'Sohbet mesajı bulunamadı.' : 'No chat messages found for this session.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-dark-700/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-dark-800/60 border border-white/[0.06] text-gray-200 rounded-bl-md'
                  }`}>
                    <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    {msg.created_at && (
                      <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                        {formatMsgDate(msg.created_at)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

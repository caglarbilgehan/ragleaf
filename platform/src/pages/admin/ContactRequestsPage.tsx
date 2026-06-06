import { useState, useEffect } from 'react';
import { contactApi, type ContactRequest } from '@/services/api';
import toast from 'react-hot-toast';
import {
  EnvelopeIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function ContactRequestsPage() {
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const data = await contactApi.getContactRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });
      setContacts(data);
    } catch (error) {
      console.error('Error fetching contact requests:', error);
      toast.error('İletişim talepleri yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchContacts();
  };

  const handleToggleStatus = async (contact: ContactRequest) => {
    const newStatus = contact.status === 'pending' ? 'resolved' : 'pending';
    const actionText = newStatus === 'resolved' ? 'çözüldü' : 'beklemeye alındı';
    
    try {
      const response = await contactApi.updateContactStatus(contact.id, newStatus);
      if (response.success) {
        toast.success(`Talep başarıyla ${actionText}.`);
        // Update local state directly
        setContacts(prev =>
          prev.map(c => (c.id === contact.id ? { ...c, status: newStatus } : c))
        );
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Talep durumu güncellenirken bir hata oluştu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="h-7 w-7 text-primary-500" />
            İletişim Talepleri
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ziyaretçiler tarafından gönderilen iletişim formu mesajlarını yönetin
          </p>
        </div>
        <button
          onClick={fetchContacts}
          className="p-2 border border-white/[0.1] bg-dark-700/50 hover:bg-dark-600/50 text-gray-300 rounded-lg text-sm transition-colors flex items-center gap-1.5"
          title="Yenile"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, e-posta veya mesaj içeriği..."
            className="w-full pl-10 pr-24 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 font-medium px-3 py-1 rounded-md text-xs transition-colors"
          >
            Ara
          </button>
        </form>

        {/* Status filters */}
        <div className="flex gap-1.5 bg-dark-800/80 p-1 border border-white/[0.06] rounded-lg w-fit">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'text-gray-400 hover:text-yellow-400/80'
            }`}
          >
            Bekleyenler
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'resolved'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-emerald-400/80'
            }`}
          >
            Çözülenler
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-dark-800/20 rounded-xl border border-white/[0.06]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-16 text-center">
          <EnvelopeIcon className="h-12 w-12 mx-auto text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-200">Hiç talep bulunamadı</h3>
          <p className="text-sm text-gray-500 mt-1">
            {search ? 'Arama kriterlerinize uyan kayıt bulunmuyor.' : 'Henüz iletişim formu aracılığıyla mesaj gönderilmemiş.'}
          </p>
        </div>
      ) : (
        <div className="bg-dark-800/40 rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-dark-800/60 text-xs text-gray-400 font-semibold uppercase">
                  <th className="p-4">Gönderen</th>
                  <th className="p-4">Konu</th>
                  <th className="p-4">Mesaj</th>
                  <th className="p-4">Tarih</th>
                  <th className="p-4">Durum</th>
                  <th className="p-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.01] transition-colors text-sm">
                    {/* Sender */}
                    <td className="p-4 max-w-[200px]">
                      <div className="font-semibold text-gray-100 truncate">{c.name}</div>
                      <div className="text-xs text-gray-400 truncate">{c.email}</div>
                    </td>

                    {/* Subject */}
                    <td className="p-4 font-medium text-gray-300 max-w-[150px] truncate" title={c.subject || 'Konu Yok'}>
                      {c.subject || <span className="text-gray-600 italic">Konu Belirtilmemiş</span>}
                    </td>

                    {/* Message */}
                    <td className="p-4 text-gray-400 max-w-[320px]">
                      <p className="whitespace-pre-line text-xs line-clamp-3 leading-relaxed" title={c.message}>
                        {c.message}
                      </p>
                    </td>

                    {/* Date */}
                    <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleString('tr-TR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      {c.status === 'resolved' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 font-medium">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Çözüldü
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20 font-medium">
                          <ClockIcon className="h-3.5 w-3.5 animate-pulse" />
                          Bekliyor
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(c)}
                        className={`text-xs px-3 py-1.5 font-medium rounded-lg border transition-all ${
                          c.status === 'resolved'
                            ? 'border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-400'
                            : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {c.status === 'resolved' ? 'Beklet' : 'Çözüldü Yap'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

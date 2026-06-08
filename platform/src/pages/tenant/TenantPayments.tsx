import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  Calendar
} from 'lucide-react';

interface Payment {
  id: string;
  customerName: string;
  amount: number;
  currency: string;
  method: 'Stripe' | 'Credit Card' | 'PayPal' | 'Bank Transfer';
  type: 'appointment_fee' | 'subscription' | 'addon_purchase';
  status: 'succeeded' | 'failed' | 'processing';
  date: string;
}

const mockPayments: Payment[] = [
  { id: 'PAY-1101', customerName: 'Ahmet Yılmaz', amount: 350.00, currency: 'USD', method: 'Credit Card', type: 'appointment_fee', status: 'succeeded', date: '2026-06-06T10:15:00Z' },
  { id: 'PAY-1102', customerName: 'Zeynep Kaya', amount: 3500.00, currency: 'USD', method: 'Stripe', type: 'subscription', status: 'succeeded', date: '2026-06-06T09:00:00Z' },
  { id: 'PAY-1103', customerName: 'Mehmet Demir', amount: 850.00, currency: 'USD', method: 'Credit Card', type: 'addon_purchase', status: 'succeeded', date: '2026-06-05T16:22:00Z' },
  { id: 'PAY-1104', customerName: 'Can Öztürk', amount: 350.00, currency: 'USD', method: 'Credit Card', type: 'appointment_fee', status: 'failed', date: '2026-06-04T18:40:00Z' },
  { id: 'PAY-1105', customerName: 'Selin Gök', amount: 450.00, currency: 'USD', method: 'PayPal', type: 'appointment_fee', status: 'processing', date: '2026-06-06T11:05:00Z' }
];

export default function TenantPayments() {
  const { t, language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filteredPayments = mockPayments.filter(payment => {
    const matchesSearch = payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          payment.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === '' || payment.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: Payment['status']) => {
    const configs = {
      succeeded: { label: language === 'tr' ? 'Başarılı' : 'Succeeded', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: CheckCircle },
      failed: { label: language === 'tr' ? 'Hata' : 'Failed', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
      processing: { label: language === 'tr' ? 'İşlemde' : 'Processing', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Calendar }
    };
    const config = configs[status];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  const getTypeLabel = (type: Payment['type']) => {
    switch (type) {
      case 'appointment_fee': return language === 'tr' ? 'Randevu Ücreti' : 'Appointment Fee';
      case 'subscription': return language === 'tr' ? 'Abonelik' : 'Subscription';
      case 'addon_purchase': return language === 'tr' ? 'Paket/Limit Alımı' : 'Addon Purchase';
    }
  };

  const totalEarnings = mockPayments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary-400" />
          {language === 'tr' ? 'Ödemeler ve Finans' : 'Payments & Finance'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {language === 'tr' ? 'AI asistan ve rezervasyonlar üzerinden alınan ödemeleri takip edin.' : 'Track payments received via AI assistants and reservations.'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{language === 'tr' ? 'Toplam Ciro' : 'Total Revenue'}</span>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              {totalEarnings.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'USD' })}
            </h2>
          </div>
          <div className="h-12 w-12 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{language === 'tr' ? 'Başarılı İşlemler' : 'Successful Tx'}</span>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              {mockPayments.filter(p => p.status === 'succeeded').length}
            </h2>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{language === 'tr' ? 'Bekleyen Ödemeler' : 'Pending Payments'}</span>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              {mockPayments.filter(p => p.status === 'processing').length}
            </h2>
          </div>
          <div className="h-12 w-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-dark-800/40 p-4 rounded-xl border border-white/[0.04]">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder={language === 'tr' ? 'Müşteri veya İşlem No Ara...' : 'Search Customer or Tx ID...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-dark-700/30 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">{language === 'tr' ? 'Tüm Türler' : 'All Types'}</option>
            <option value="appointment_fee">{language === 'tr' ? 'Randevu Ücreti' : 'Appointment Fee'}</option>
            <option value="subscription">{language === 'tr' ? 'Abonelik' : 'Subscription'}</option>
            <option value="addon_purchase">{language === 'tr' ? 'Paket/Limit Alımı' : 'Addon Purchase'}</option>
          </select>
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs font-semibold text-gray-400 uppercase bg-dark-900/30">
                <th className="p-4">{language === 'tr' ? 'İşlem No' : 'Tx ID'}</th>
                <th className="p-4">{language === 'tr' ? 'Müşteri' : 'Customer'}</th>
                <th className="p-4">{language === 'tr' ? 'İşlem Türü' : 'Type'}</th>
                <th className="p-4">{language === 'tr' ? 'Ödeme Metodu' : 'Method'}</th>
                <th className="p-4">{language === 'tr' ? 'Tarih' : 'Date'}</th>
                <th className="p-4">{language === 'tr' ? 'Tutar' : 'Amount'}</th>
                <th className="p-4">{language === 'tr' ? 'Durum' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-white/[0.01] transition-colors text-sm text-gray-300">
                  <td className="p-4 font-mono text-gray-400">{payment.id}</td>
                  <td className="p-4 font-semibold text-gray-200">{payment.customerName}</td>
                  <td className="p-4 text-xs">{getTypeLabel(payment.type)}</td>
                  <td className="p-4 text-xs text-gray-400">{payment.method}</td>
                  <td className="p-4 text-xs text-gray-500">
                    {new Date(payment.date).toLocaleString(language === 'tr' ? 'tr' : 'en')}
                  </td>
                  <td className="p-4 font-semibold text-gray-100">
                    {payment.amount.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: payment.currency })}
                  </td>
                  <td className="p-4">{getStatusBadge(payment.status)}</td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 bg-dark-700/5">
                    {language === 'tr' ? 'Hiç işlem bulunamadı.' : 'No transactions found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Clock component definition (from lucide or local mock)
function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

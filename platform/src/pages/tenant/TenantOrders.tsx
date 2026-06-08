import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  ArrowUpDown
} from 'lucide-react';

interface Order {
  id: string;
  customerName: string;
  email: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  date: string;
  items: string;
}

const mockOrders: Order[] = [
  { id: 'ORD-9821', customerName: 'Ahmet Yılmaz', email: 'ahmet@gmail.com', total: 1250.00, status: 'delivered', date: '2026-06-05T14:32:00Z', items: 'AI Asistan Paketi (Standard)' },
  { id: 'ORD-9822', customerName: 'Zeynep Kaya', email: 'zeynep@hotmail.com', total: 3500.00, status: 'processing', date: '2026-06-06T09:15:00Z', items: 'AI Writer & Mail Otomasyon Pro' },
  { id: 'ORD-9823', customerName: 'Mehmet Demir', email: 'mehmet@demirinsaat.com', total: 850.00, status: 'pending', date: '2026-06-06T10:42:00Z', items: 'Ekstra 10.000 Ragleaf Yaprağı' },
  { id: 'ORD-9824', customerName: 'Elif Şahin', email: 'elif.sahin@outlook.com', total: 4900.00, status: 'shipped', date: '2026-06-05T11:20:00Z', items: 'Kurumsal Custom AI Çözümü' },
  { id: 'ORD-9825', customerName: 'Can Öztürk', email: 'can.ozturk@gmail.com', total: 1250.00, status: 'cancelled', date: '2026-06-04T16:05:00Z', items: 'AI Asistan Paketi (Standard)' }
];

export default function TenantOrders() {
  const { t, language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredOrders = mockOrders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.items.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Order['status']) => {
    const configs = {
      pending: { label: language === 'tr' ? 'Beklemede' : 'Pending', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
      processing: { label: language === 'tr' ? 'Hazırlanıyor' : 'Processing', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Clock },
      shipped: { label: language === 'tr' ? 'Kargoda' : 'Shipped', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: Truck },
      delivered: { label: language === 'tr' ? 'Teslim Edildi' : 'Delivered', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: CheckCircle },
      cancelled: { label: language === 'tr' ? 'İptal Edildi' : 'Cancelled', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle }
    };
    const config = configs[status];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-primary-400" />
          {language === 'tr' ? 'Siparişler' : 'Orders'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {language === 'tr' ? 'Müşterilerinizin verdiği siparişleri ve ürün taleplerini yönetin.' : 'Manage orders and product requests submitted by your customers.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-dark-800/40 p-4 rounded-xl border border-white/[0.04]">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder={language === 'tr' ? 'Sipariş No, Müşteri veya Ürün Ara...' : 'Search Order No, Customer, or Product...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-dark-700/30 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">{language === 'tr' ? 'Tüm Durumlar' : 'All Statuses'}</option>
            <option value="pending">{language === 'tr' ? 'Beklemede' : 'Pending'}</option>
            <option value="processing">{language === 'tr' ? 'Hazırlanıyor' : 'Processing'}</option>
            <option value="shipped">{language === 'tr' ? 'Kargoda' : 'Shipped'}</option>
            <option value="delivered">{language === 'tr' ? 'Teslim Edildi' : 'Delivered'}</option>
            <option value="cancelled">{language === 'tr' ? 'İptal Edildi' : 'Cancelled'}</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs font-semibold text-gray-400 uppercase bg-dark-900/30">
                <th className="p-4">{language === 'tr' ? 'Sipariş No' : 'Order ID'}</th>
                <th className="p-4">{language === 'tr' ? 'Müşteri' : 'Customer'}</th>
                <th className="p-4">{language === 'tr' ? 'Ürün / Detay' : 'Product / Details'}</th>
                <th className="p-4">{language === 'tr' ? 'Tutar' : 'Amount'}</th>
                <th className="p-4">{language === 'tr' ? 'Tarih' : 'Date'}</th>
                <th className="p-4">{language === 'tr' ? 'Durum' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.01] transition-colors text-sm text-gray-300">
                  <td className="p-4 font-mono font-semibold text-primary-400">{order.id}</td>
                  <td className="p-4">
                    <div>
                      <div className="font-semibold text-gray-200">{order.customerName}</div>
                      <div className="text-xs text-gray-500">{order.email}</div>
                    </div>
                  </td>
                  <td className="p-4">{order.items}</td>
                  <td className="p-4 font-semibold text-gray-100">
                    {order.total.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'USD' })}
                  </td>
                  <td className="p-4 text-xs text-gray-500">
                    {new Date(order.date).toLocaleString(language === 'tr' ? 'tr' : 'en')}
                  </td>
                  <td className="p-4">{getStatusBadge(order.status)}</td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 bg-dark-700/5">
                    {language === 'tr' ? 'Hiç sipariş bulunamadı.' : 'No orders found.'}
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

// platform/src/pages/admin/PlansPage.tsx
// Admin — Plan ve Limit Yönetimi

import { useState, useEffect } from 'react';
import { adminPlanApi, type Plan } from '@/services/ragleafApi';
import toast from 'react-hot-toast';
import {
  CreditCardIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  CpuChipIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for editing
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formBillingCycle, setFormBillingCycle] = useState('monthly');
  const [formMaxAgents, setFormMaxAgents] = useState(0);
  const [formMaxDocuments, setFormMaxDocuments] = useState(0);
  const [formMaxQueries, setFormMaxQueries] = useState(0);
  const [formMaxStorage, setFormMaxStorage] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await adminPlanApi.list();
      setPlans(data);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Planlar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEditClick = (plan: Plan) => {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormPrice(plan.price);
    setFormBillingCycle(plan.billing_cycle);
    setFormMaxAgents(plan.max_agents);
    setFormMaxDocuments(plan.max_documents);
    setFormMaxQueries(plan.max_queries_per_month);
    setFormMaxStorage(plan.max_storage_mb);
    setFormIsActive(plan.is_active);
  };

  const handleCloseModal = () => {
    setEditingPlan(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSubmitting(true);
    try {
      const updated = await adminPlanApi.update(editingPlan.id, {
        name: formName,
        price: Number(formPrice),
        billing_cycle: formBillingCycle,
        max_agents: Number(formMaxAgents),
        max_documents: Number(formMaxDocuments),
        max_queries_per_month: Number(formMaxQueries),
        max_storage_mb: Number(formMaxStorage),
        is_active: formIsActive,
      });

      toast.success('Plan başarıyla güncellendi.');
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      handleCloseModal();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Plan güncellenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <CreditCardIcon className="h-7 w-7 text-primary-500" />
            Plan ve Limit Yönetimi
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Platformdaki paketlerin fiyat, periyot ve kaynak limitlerini düzenleyin
          </p>
        </div>
        <button
          onClick={fetchPlans}
          className="p-2 border border-white/[0.1] bg-dark-700/50 hover:bg-dark-600/50 text-gray-300 rounded-lg text-sm transition-colors flex items-center gap-1.5"
          title="Yenile"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-dark-800/20 rounded-xl border border-white/[0.06]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-16 text-center">
          <CreditCardIcon className="h-12 w-12 mx-auto text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-200">Hiç plan bulunamadı</h3>
          <p className="text-sm text-gray-500 mt-1">
            Veritabanında tanımlı plan bulunamadı. Lütfen tohumlama betiklerini çalıştırın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-dark-800/40 rounded-2xl border transition-all duration-300 hover:scale-[1.01] hover:bg-dark-800/60 flex flex-col justify-between overflow-hidden ${
                plan.is_active ? 'border-white/[0.06]' : 'border-red-500/20 opacity-75'
              }`}
            >
              {/* Card Title & Pricing */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">{plan.name}</h3>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                      {plan.key}
                    </span>
                  </div>
                  {plan.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 font-medium">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20 font-medium">
                      <XCircleIcon className="h-3.5 w-3.5" />
                      Pasif
                    </span>
                  )}
                </div>

                <div className="pt-2">
                  <div className="flex items-baseline text-gray-100">
                    <span className="text-3xl font-extrabold tracking-tight">
                      ₺{plan.price.toLocaleString('tr-TR')}
                    </span>
                    <span className="ml-1 text-sm font-semibold text-gray-500">
                      / {plan.billing_cycle === 'monthly' ? 'ay' : plan.billing_cycle}
                    </span>
                  </div>
                </div>

                {/* Resource Limits List */}
                <div className="border-t border-white/[0.06] pt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <CpuChipIcon className="h-4 w-4 text-primary-400" />
                      <span>Maks. Asistan</span>
                    </div>
                    <span className="font-semibold text-gray-200">
                      {plan.max_agents === -1 ? 'Sınırsız' : plan.max_agents}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <DocumentTextIcon className="h-4 w-4 text-primary-400" />
                      <span>Maks. Doküman</span>
                    </div>
                    <span className="font-semibold text-gray-200">
                      {plan.max_documents === -1 ? 'Sınırsız' : plan.max_documents}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-primary-400" />
                      <span>Aylık Sorgu Limiti</span>
                    </div>
                    <span className="font-semibold text-gray-200">
                      {plan.max_queries_per_month === -1 ? 'Sınırsız' : plan.max_queries_per_month.toLocaleString('tr-TR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <CircleStackIcon className="h-4 w-4 text-primary-400" />
                      <span>Maks. Depolama (MB)</span>
                    </div>
                    <span className="font-semibold text-gray-200">
                      {plan.max_storage_mb === -1 ? 'Sınırsız' : `${plan.max_storage_mb.toLocaleString('tr-TR')} MB`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="bg-white/[0.02] border-t border-white/[0.04] p-4">
                <button
                  onClick={() => handleEditClick(plan)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 bg-primary-500/10 hover:bg-primary-500/25 border border-primary-500/20 text-primary-400 rounded-xl transition-all"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  Planı Düzenle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal (Glassmorphism overlay) */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-dark-800 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
              <div>
                <h3 className="text-lg font-bold text-gray-100">Plan Düzenle</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editingPlan.name} ({editingPlan.key})</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-200 transition-colors p-1.5 hover:bg-white/5 rounded-lg"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Plan Adı</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Fiyat (₺)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Billing Cycle */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Faturalandırma Periyodu</label>
                  <select
                    value={formBillingCycle}
                    onChange={(e) => setFormBillingCycle(e.target.value)}
                    className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="monthly">Aylık (monthly)</option>
                    <option value="yearly">Yıllık (yearly)</option>
                  </select>
                </div>

                {/* Max Agents */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Maks. Asistan (-1: Sınırsız)</label>
                  <input
                    type="number"
                    min="-1"
                    required
                    value={formMaxAgents}
                    onChange={(e) => setFormMaxAgents(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Max Documents */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Maks. Doküman (-1: Sınırsız)</label>
                  <input
                    type="number"
                    min="-1"
                    required
                    value={formMaxDocuments}
                    onChange={(e) => setFormMaxDocuments(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Max Queries */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Aylık Sorgu Limiti (-1: Sınırsız)</label>
                  <input
                    type="number"
                    min="-1"
                    required
                    value={formMaxQueries}
                    onChange={(e) => setFormMaxQueries(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Max Storage */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Maks. Depolama (MB) (-1: Sınırsız)</label>
                  <input
                    type="number"
                    min="-1"
                    required
                    value={formMaxStorage}
                    onChange={(e) => setFormMaxStorage(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Active Status */}
                <div className="col-span-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-white/[0.1] bg-dark-700/50 text-primary-600 focus:ring-primary-500 focus:ring-offset-dark-800"
                    />
                    <span className="text-sm font-medium text-gray-300">Plan Aktif Olsun (Yeni kayıtlarda seçilebilir)</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-6 border-t border-white/[0.06] mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border border-white/[0.06] hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

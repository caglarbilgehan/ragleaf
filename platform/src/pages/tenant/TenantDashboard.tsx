import { useEffect, useState } from 'react';
import { templateApi, organizationApi, AgentTemplate } from '@/services/ragleafApi';
import { useTranslation } from '@/contexts/LanguageContext';

interface DashboardStats {
  agent_count: number;
  active_agent_count: number;
  document_count: number;
  total_conversations: number;
  total_messages: number;
  total_queries_this_month: number;
  total_tokens_this_month: number;
  max_agents: number;
  max_documents: number;
  max_queries_per_month: number;
  plan: string;
  ragleaf_leaves: number;
}

interface AgentSummary {
  id: number;
  name: string;
  public_id: string;
  is_active: boolean;
  total_conversations: number;
  total_messages: number;
  document_count: number;
  api_key_count: number;
  created_at: string;
}

function getApiBase(): string {
  if (window.location.origin.includes('ragleaf.com')) return 'https://api.ragleaf.com';
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:1306`;
  }
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return 'http://cserver-2:1306';
}
const API_BASE = getApiBase();

async function fetchAPI<T>(path: string): Promise<T> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Onboarding Wizard States
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const [selectedPlan, setSelectedPlan] = useState<string>('starter_trial');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('kuafor');
  const [agentName, setAgentName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  const userObj = JSON.parse(localStorage.getItem('ragleaf_user') || '{}');
  const brandName = userObj.company_name || 'Markanız';

  useEffect(() => {
    if (selectedTemplate && templates.length > 0) {
      const tmpl = templates.find(t => t.slug === selectedTemplate);
      if (tmpl) {
        setAgentName(`${brandName} ${tmpl.name}`);
        setWelcomeMessage(tmpl.default_welcome_message ? tmpl.default_welcome_message.replace(/\{\{brand\}\}/g, brandName) : '');
      }
    }
  }, [selectedTemplate, templates, brandName]);

  const handleCompleteOnboarding = async () => {
    setIsSubmitting(true);
    setOnboardingError('');
    try {
      const apiPlan = selectedPlan === 'starter_trial' ? 'starter' : selectedPlan;
      await organizationApi.update({ plan: apiPlan });

      const templateSlug = selectedTemplate;
      const configData = {
        firma_adi: brandName,
        telefon: userObj.phone || '',
        website: userObj.website || '',
      };
      
      await templateApi.createFromTemplate({
        template_slug: templateSlug,
        config_data: configData,
        agent_name: agentName,
      });

      localStorage.removeItem('show_onboarding_wizard');
      setShowOnboarding(false);

      const [s, a] = await Promise.all([
        fetchAPI<DashboardStats>('/api/org/dashboard'),
        fetchAPI<AgentSummary[]>('/api/org/agents'),
      ]);
      setStats(s);
      setAgents(a);
    } catch (error: any) {
      setOnboardingError(error.message || t('dashboard.onboarding.error_occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetchAPI<DashboardStats>('/api/org/dashboard'),
      fetchAPI<AgentSummary[]>('/api/org/agents'),
      templateApi.list(),
      fetchAPI<any[]>('/api/public/plans').catch(() => []), // public plans
    ])
      .then(([s, a, t, p]) => {
        setStats(s);
        setAgents(a);
        setTemplates(t);
        setPlans(p || []);
        if (a.length === 0 && localStorage.getItem('show_onboarding_wizard') === 'true') {
          setShowOnboarding(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!stats) return <div className="p-6 text-red-400">{t('dashboard.data_load_error')}</div>;

  const planColors: Record<string, string> = {
    free: 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20',
    starter: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
    pro: 'bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/20',
    ultra: 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t('nav.dashboard')}</h1>
          <p className="text-gray-500 mt-1">{t('dashboard.org_status')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-green-500/10 text-green-400 ring-1 ring-green-500/20 rounded-full font-semibold text-sm shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <span className="animate-pulse">🍃</span> {stats.ragleaf_leaves || 0} {t('dashboard.leaves')}
          </div>
          <span className={`px-3.5 py-1.5 rounded-full text-sm font-medium ${planColors[stats.plan] || planColors.free}`}>
            {stats.plan.toUpperCase()} {t('dashboard.plan')}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={t('nav.asistanlarim')}
          value={stats.agent_count}
          subtitle={`${stats.active_agent_count} ${t('dashboard.active_assistants')} / ${stats.max_agents} ${t('dashboard.limit')}`}
          icon="🤖"
          progress={(stats.agent_count / stats.max_agents) * 100}
        />
        <StatCard
          title={t('nav.dokumanlar')}
          value={stats.document_count}
          subtitle={`/ ${stats.max_documents} ${t('dashboard.limit')}`}
          icon="📄"
          progress={(stats.document_count / stats.max_documents) * 100}
        />
        <StatCard
          title={t('dashboard.stats_queries_month')}
          value={stats.total_queries_this_month}
          subtitle={`/ ${stats.max_queries_per_month.toLocaleString()} ${t('dashboard.limit')}`}
          icon="💬"
          progress={(stats.total_queries_this_month / stats.max_queries_per_month) * 100}
        />
        <StatCard
          title={t('dashboard.stats_total_conversations')}
          value={stats.total_conversations}
          subtitle={`${stats.total_messages.toLocaleString()} ${t('dashboard.stats_messages')}`}
          icon="📊"
        />
        <StatCard
          title={t('dashboard.stats_leaves')}
          value={stats.ragleaf_leaves || 0}
          subtitle={t('dashboard.stats_discount_hint')}
          icon="🍃"
        />
      </div>

      {/* Loyalty Banner */}
      <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-sm shadow-[0_4px_20px_rgba(34,197,94,0.05)]">
        <div className="flex items-center gap-4">
          <span className="text-3xl animate-bounce">🍃</span>
          <div>
            <h3 className="font-semibold text-gray-100 text-base">{t('dashboard.loyalty_program')}</h3>
            <p className="text-sm text-gray-400 mt-1">{t('dashboard.loyalty_desc')}</p>
          </div>
        </div>
        <button 
          onClick={() => alert(t('dashboard.convert_to_discount_alert'))}
          className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-semibold rounded-lg transition border border-green-500/30 whitespace-nowrap"
        >
          {t('dashboard.convert_to_discount')}
        </button>
      </div>

      {/* Agents Table */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-gray-100">{t('dashboard.your_assistants')}</h2>
        </div>
        {agents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-4xl mb-2">🤖</p>
            <p>{t('dashboard.no_assistants_yet')}</p>
            <a href="/agents" className="text-primary-400 hover:underline mt-2 inline-block">{t('dashboard.create_first_assistant')}</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-700/50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">{t('dashboard.table_assistant')}</th>
                  <th className="px-6 py-3 text-center">{t('dashboard.table_status')}</th>
                  <th className="px-6 py-3 text-center">{t('dashboard.table_document')}</th>
                  <th className="px-6 py-3 text-center">{t('dashboard.table_conversation')}</th>
                  <th className="px-6 py-3 text-center">{t('dashboard.table_message')}</th>
                  <th className="px-6 py-3 text-center">{t('dashboard.table_api_key')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-200">{agent.name}</div>
                      <div className="text-xs text-gray-400">{agent.public_id}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        agent.is_active ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20' : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                      }`}>
                        {agent.is_active ? t('dashboard.table_status_active') : t('dashboard.table_status_passive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-300">{agent.document_count}</td>
                    <td className="px-6 py-4 text-center text-gray-300">{agent.total_conversations}</td>
                    <td className="px-6 py-4 text-center text-gray-300">{agent.total_messages}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs ${agent.api_key_count > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {agent.api_key_count > 0 ? `${agent.api_key_count} key` : t('dashboard.table_key_none')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-dark-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-900 border border-white/[0.06] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-100">{t('dashboard.onboarding.title')}</h3>
                <p className="text-sm text-gray-500 mt-1">{t('dashboard.onboarding.subtitle')}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                <span className={`px-2.5 py-1 rounded-full ${onboardingStep === 0 ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-700'}`}>{t('dashboard.onboarding.step_1')}</span>
                <span className="text-gray-600">→</span>
                <span className={`px-2.5 py-1 rounded-full ${onboardingStep === 1 ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-700'}`}>{t('dashboard.onboarding.step_2')}</span>
                <span className="text-gray-600">→</span>
                <span className={`px-2.5 py-1 rounded-full ${onboardingStep === 2 ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-700'}`}>{t('dashboard.onboarding.step_3')}</span>
              </div>
            </div>

            {onboardingStep === 0 && (() => {
              const starterPlan = plans.find(p => p.key === 'starter') || { price: 490, max_agents: 3, max_documents: 100, max_queries_per_month: 5000 };
              const proPlan = plans.find(p => p.key === 'pro') || { price: 1490, max_agents: 10, max_documents: 500, max_queries_per_month: 25000 };
              const ultimatePlan = plans.find(p => p.key === 'ultimate') || { price: 4990, max_agents: 50, max_documents: 2000, max_queries_per_month: 100000 };
              const ultraPlan = plans.find(p => p.key === 'ultra') || { price: 9990, max_agents: 999, max_documents: 9999, max_queries_per_month: 999999 };

              return (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-200">{t('dashboard.onboarding.step_1_title')}</h4>
                    <p className="text-sm text-gray-400">{t('dashboard.onboarding.step_1_desc')}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Starter Trial Card */}
                    <div 
                      onClick={() => setSelectedPlan('starter_trial')}
                      className={`p-4 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                        selectedPlan === 'starter_trial' 
                          ? 'border-primary-500 bg-primary-500/[0.03] shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                          : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="absolute top-3 right-3 bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {t('dashboard.onboarding.free_trial')}
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-200 text-base">{t('dashboard.onboarding.starter_trial')}</h5>
                        <p className="text-xs text-gray-500 mt-1">{t('dashboard.onboarding.no_card')}</p>
                        <div className="text-2xl font-black text-gray-100 mt-3">$0 <span className="text-xs font-normal text-gray-500">/ 7 {t('dashboard.onboarding.days')}</span></div>
                      </div>
                      <ul className="text-xs text-gray-400 space-y-1.5 mt-4 pt-3 border-t border-white/[0.04]">
                        <li className="flex items-center gap-1.5">✓ {starterPlan.max_agents} {t('dashboard.table_assistant')}</li>
                        <li className="flex items-center gap-1.5">✓ {starterPlan.max_documents} {t('dashboard.table_document')}</li>
                        <li className="flex items-center gap-1.5">✓ {starterPlan.max_queries_per_month.toLocaleString()} {t('dashboard.table_conversation')} / {t('dashboard.onboarding.month')}</li>
                      </ul>
                    </div>

                    {/* Starter Card */}
                    <div 
                      onClick={() => setSelectedPlan('starter')}
                      className={`p-4 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                        selectedPlan === 'starter' 
                          ? 'border-primary-500 bg-primary-500/[0.03] shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                          : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div>
                        <h5 className="font-bold text-gray-200 text-base">{t('dashboard.onboarding.starter_plan')}</h5>
                        <p className="text-xs text-gray-500 mt-1">{t('dashboard.onboarding.small_biz')}</p>
                        <div className="text-2xl font-black text-gray-100 mt-3">${starterPlan.price} <span className="text-xs font-normal text-gray-500">/ {t('dashboard.onboarding.month')}</span></div>
                      </div>
                      <ul className="text-xs text-gray-400 space-y-1.5 mt-4 pt-3 border-t border-white/[0.04]">
                        <li className="flex items-center gap-1.5">✓ {starterPlan.max_agents} {t('dashboard.table_assistant')}</li>
                        <li className="flex items-center gap-1.5">✓ {starterPlan.max_documents} {t('dashboard.table_document')}</li>
                        <li className="flex items-center gap-1.5">✓ {starterPlan.max_queries_per_month.toLocaleString()} {t('dashboard.table_conversation')} / {t('dashboard.onboarding.month')}</li>
                      </ul>
                    </div>

                    {/* Pro Card */}
                    <div 
                      onClick={() => setSelectedPlan('pro')}
                      className={`p-4 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                        selectedPlan === 'pro' 
                          ? 'border-primary-500 bg-primary-500/[0.03] shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                          : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="absolute top-3 right-3 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {t('dashboard.onboarding.popular')}
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-200 text-base">{t('dashboard.onboarding.pro_plan')}</h5>
                        <p className="text-xs text-gray-500 mt-1">{t('dashboard.onboarding.growing_teams')}</p>
                        <div className="text-2xl font-black text-gray-100 mt-3">${proPlan.price} <span className="text-xs font-normal text-gray-500">/ {t('dashboard.onboarding.month')}</span></div>
                      </div>
                      <ul className="text-xs text-gray-400 space-y-1.5 mt-4 pt-3 border-t border-white/[0.04]">
                        <li className="flex items-center gap-1.5">✓ {proPlan.max_agents} {t('dashboard.table_assistant')}</li>
                        <li className="flex items-center gap-1.5">✓ {proPlan.max_documents} {t('dashboard.table_document')}</li>
                        <li className="flex items-center gap-1.5">✓ {proPlan.max_queries_per_month.toLocaleString()} {t('dashboard.table_conversation')} / {t('dashboard.onboarding.month')}</li>
                      </ul>
                    </div>

                    {/* Ultimate Card */}
                    <div 
                      onClick={() => setSelectedPlan('ultimate')}
                      className={`p-4 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                        selectedPlan === 'ultimate' 
                          ? 'border-primary-500 bg-primary-500/[0.03] shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                          : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div>
                        <h5 className="font-bold text-gray-200 text-base">Ultimate</h5>
                        <p className="text-xs text-gray-500 mt-1">{t('dashboard.onboarding.growing_teams')}</p>
                        <div className="text-2xl font-black text-gray-100 mt-3">${ultimatePlan.price} <span className="text-xs font-normal text-gray-500">/ {t('dashboard.onboarding.month')}</span></div>
                      </div>
                      <ul className="text-xs text-gray-400 space-y-1.5 mt-4 pt-3 border-t border-white/[0.04]">
                        <li className="flex items-center gap-1.5">✓ {ultimatePlan.max_agents} {t('dashboard.table_assistant')}</li>
                        <li className="flex items-center gap-1.5">✓ {ultimatePlan.max_documents} {t('dashboard.table_document')}</li>
                        <li className="flex items-center gap-1.5">✓ {ultimatePlan.max_queries_per_month.toLocaleString()} {t('dashboard.table_conversation')} / {t('dashboard.onboarding.month')}</li>
                      </ul>
                    </div>

                    {/* Ultra Card */}
                    <div 
                      onClick={() => setSelectedPlan('ultra')}
                      className={`p-4 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                        selectedPlan === 'ultra' 
                          ? 'border-primary-500 bg-primary-500/[0.03] shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                          : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div>
                        <h5 className="font-bold text-gray-200 text-base">{t('dashboard.onboarding.enterprise')}</h5>
                        <p className="text-xs text-gray-500 mt-1">{t('dashboard.onboarding.big_org')}</p>
                        <div className="text-2xl font-black text-gray-100 mt-3">${ultraPlan.price} <span className="text-xs font-normal text-gray-500">/ {t('dashboard.onboarding.month')}</span></div>
                      </div>
                      <ul className="text-xs text-gray-400 space-y-1.5 mt-4 pt-3 border-t border-white/[0.04]">
                        <li className="flex items-center gap-1.5">✓ {ultraPlan.max_agents === 999 ? t('dashboard.onboarding.unlimited') : `${ultraPlan.max_agents}`} {t('dashboard.table_assistant')}</li>
                        <li className="flex items-center gap-1.5">✓ {ultraPlan.max_documents === 9999 ? t('dashboard.onboarding.unlimited') : `${ultraPlan.max_documents}`} {t('dashboard.table_document')}</li>
                        <li className="flex items-center gap-1.5">✓ {t('dashboard.onboarding.special_sla')}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/[0.06]">
                    <button 
                      onClick={() => setOnboardingStep(1)}
                      className="px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition text-sm flex items-center gap-2"
                    >
                      {t('dashboard.onboarding.continue')}
                    </button>
                  </div>
                </div>
              );
            })()}

            {onboardingStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-lg font-semibold text-gray-200">{t('dashboard.onboarding.step_2_title')}</h4>
                  <p className="text-sm text-gray-400">{t('dashboard.onboarding.step_2_desc')}</p>
                </div>

                {selectedPlan === 'starter_trial' ? (
                  <div className="p-5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 space-y-3">
                    <div className="flex items-center gap-2.5 font-bold text-base">
                      {t('dashboard.onboarding.no_card_required_title')}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-300">
                      {t('dashboard.onboarding.no_card_required_desc')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400">{t('dashboard.onboarding.card_name')}</label>
                      <input 
                        type="text" 
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-dark-800 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400">{t('dashboard.onboarding.card_number')}</label>
                      <input 
                        type="text" 
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().substring(0, 19))}
                        placeholder="0000 0000 0000 0000"
                        className="w-full bg-dark-800 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">{t('dashboard.onboarding.card_expiry')}</label>
                        <input 
                          type="text" 
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value.replace(/\D/g, '').replace(/(.{2})/g, '$1/').replace(/\/$/, '').substring(0, 5))}
                          placeholder="AA/YY"
                          className="w-full bg-dark-800 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition font-mono"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">{t('dashboard.onboarding.card_cvc')}</label>
                        <input 
                          type="password" 
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').substring(0, 3))}
                          placeholder="***"
                          className="w-full bg-dark-800 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t border-white/[0.06] mt-6">
                  <button 
                    onClick={() => setOnboardingStep(0)}
                    className="px-5 py-2.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.03] text-gray-300 font-semibold transition text-sm"
                  >
                    {t('dashboard.onboarding.back')}
                  </button>
                  <button 
                    onClick={() => {
                      if (selectedPlan !== 'starter_trial') {
                        if (!cardName || !cardNumber || !cardExpiry || !cardCvc) {
                          alert(t('dashboard.onboarding.fill_all'));
                          return;
                        }
                      }
                      setOnboardingStep(2);
                    }}
                    className="px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition text-sm"
                  >
                    {t('dashboard.onboarding.continue')}
                  </button>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-lg font-semibold text-gray-200">{t('dashboard.onboarding.step_3_title')}</h4>
                  <p className="text-sm text-gray-400">{t('dashboard.onboarding.step_3_desc')}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 block">{t('dashboard.onboarding.select_template')}</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
                      {templates.map((tmpl) => (
                        <div
                           key={tmpl.slug}
                           onClick={() => setSelectedTemplate(tmpl.slug)}
                           className={`p-3 rounded-lg border text-center cursor-pointer transition ${
                            selectedTemplate === tmpl.slug
                              ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                              : 'border-white/[0.06] bg-white/[0.01] text-gray-400 hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="text-2xl mb-1">{tmpl.icon || '🤖'}</div>
                          <div className="text-[11px] font-semibold truncate">{tmpl.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">{t('dashboard.onboarding.assistant_name')}</label>
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Bella Asistan"
                      className="w-full bg-dark-800 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">{t('dashboard.onboarding.welcome_msg')}</label>
                    <textarea 
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      rows={3}
                      placeholder={t('dashboard.onboarding.welcome_placeholder')}
                      className="w-full bg-dark-800 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition resize-none"
                    />
                  </div>
                </div>

                {onboardingError && (
                  <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                    {onboardingError}
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t border-white/[0.06] mt-6">
                  <button 
                    onClick={() => setOnboardingStep(1)}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.03] text-gray-300 font-semibold transition text-sm disabled:opacity-50"
                  >
                    {t('dashboard.onboarding.back')}
                  </button>
                  <button 
                    onClick={handleCompleteOnboarding}
                    disabled={isSubmitting || !agentName || !welcomeMessage}
                    className="px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        {t('dashboard.onboarding.setting_up')}
                      </>
                    ) : t('dashboard.onboarding.complete')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, progress }: {
  title: string; value: number; subtitle: string; icon: string; progress?: number;
}) {
  return (
    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-400">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-100">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      {progress !== undefined && (
        <div className="mt-3 w-full bg-dark-600 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-primary-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

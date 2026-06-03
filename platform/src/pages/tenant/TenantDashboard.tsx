import { useEffect, useState } from 'react';

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
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (window.location.origin.includes('ragleaf.com')) return 'https://api.ragleaf.com';
  return 'http://localhost:1306';
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAPI<DashboardStats>('/api/org/dashboard'),
      fetchAPI<AgentSummary[]>('/api/org/agents'),
    ])
      .then(([s, a]) => { setStats(s); setAgents(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!stats) return <div className="p-6 text-red-500">Dashboard verileri yüklenemedi.</div>;

  const planColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    starter: 'bg-blue-100 text-blue-700',
    pro: 'bg-indigo-100 text-indigo-700',
    enterprise: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Organizasyon genel durumu</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${planColors[stats.plan] || planColors.free}`}>
          {stats.plan.toUpperCase()} Plan
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Asistanlar"
          value={stats.agent_count}
          subtitle={`${stats.active_agent_count} aktif / ${stats.max_agents} limit`}
          icon="🤖"
          progress={(stats.agent_count / stats.max_agents) * 100}
        />
        <StatCard
          title="Dokümanlar"
          value={stats.document_count}
          subtitle={`/ ${stats.max_documents} limit`}
          icon="📄"
          progress={(stats.document_count / stats.max_documents) * 100}
        />
        <StatCard
          title="Bu Ay Sorgu"
          value={stats.total_queries_this_month}
          subtitle={`/ ${stats.max_queries_per_month.toLocaleString()} limit`}
          icon="💬"
          progress={(stats.total_queries_this_month / stats.max_queries_per_month) * 100}
        />
        <StatCard
          title="Toplam Konuşma"
          value={stats.total_conversations}
          subtitle={`${stats.total_messages.toLocaleString()} mesaj`}
          icon="📊"
        />
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Asistanlarınız</h2>
        </div>
        {agents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-4xl mb-2">🤖</p>
            <p>Henüz asistan oluşturmadınız.</p>
            <a href="/agents" className="text-indigo-600 hover:underline mt-2 inline-block">İlk asistanınızı oluşturun →</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Asistan</th>
                  <th className="px-6 py-3 text-center">Durum</th>
                  <th className="px-6 py-3 text-center">Doküman</th>
                  <th className="px-6 py-3 text-center">Konuşma</th>
                  <th className="px-6 py-3 text-center">Mesaj</th>
                  <th className="px-6 py-3 text-center">API Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{agent.name}</div>
                      <div className="text-xs text-gray-400">{agent.public_id}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        agent.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {agent.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-700">{agent.document_count}</td>
                    <td className="px-6 py-4 text-center text-gray-700">{agent.total_conversations}</td>
                    <td className="px-6 py-4 text-center text-gray-700">{agent.total_messages}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs ${agent.api_key_count > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {agent.api_key_count > 0 ? `${agent.api_key_count} key` : 'Yok'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, progress }: {
  title: string; value: number; subtitle: string; icon: string; progress?: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
      {progress !== undefined && (
        <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

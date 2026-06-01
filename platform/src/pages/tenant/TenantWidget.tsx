import { useEffect, useState } from 'react';

interface EmbedCodeResponse {
  agent_id: number;
  agent_name: string;
  public_id: string;
  has_api_key: boolean;
  api_key_prefix: string;
  embed_code: {
    widget: string;
    iframe: string;
  };
  instructions: {
    widget: string;
    iframe: string;
  };
  note: string;
}

interface AgentDetail {
  id: number;
  name: string;
  public_id: string;
  is_active: boolean;
  allowed_domains: string[] | null;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantWidget() {
  const [agents, setAgents] = useState<AgentDetail[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [embedCode, setEmbedCode] = useState<EmbedCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeLoading, setCodeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'widget' | 'iframe'>('widget');
  const [copied, setCopied] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const domains = selectedAgent?.allowed_domains || [];
  const hasDomains = domains.length > 0;

  useEffect(() => {
    fetchAPI<AgentDetail[]>('/api/org/agents')
      .then((a) => {
        setAgents(a);
        if (a.length > 0) setSelectedAgentId(a[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAgentId) return;
    setCodeLoading(true);
    fetchAPI<EmbedCodeResponse>(`/api/agents/${selectedAgentId}/embed-code`)
      .then(setEmbedCode)
      .catch(console.error)
      .finally(() => setCodeLoading(false));
  }, [selectedAgentId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addDomain = async () => {
    if (!newDomain.trim() || !selectedAgentId) return;
    setDomainSaving(true);
    try {
      const updated = [...domains, newDomain.trim().toLowerCase()];
      const agent = await fetchAPI<AgentDetail>(`/api/agents/${selectedAgentId}`, {
        method: 'PUT',
        body: JSON.stringify({ allowed_domains: updated }),
      });
      setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
      setNewDomain('');
    } catch (err) {
      console.error('Domain eklenemedi:', err);
    } finally {
      setDomainSaving(false);
    }
  };

  const removeDomain = async (domain: string) => {
    if (!selectedAgentId) return;
    setDomainSaving(true);
    try {
      const updated = domains.filter(d => d !== domain);
      const agent = await fetchAPI<AgentDetail>(`/api/agents/${selectedAgentId}`, {
        method: 'PUT',
        body: JSON.stringify({ allowed_domains: updated }),
      });
      setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
    } catch (err) {
      console.error('Domain silinemedi:', err);
    } finally {
      setDomainSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Widget Entegrasyonu</h1>
        <p className="text-gray-500 mt-1">Agent'ınızı web sitenize eklemek için embed kodunu kopyalayın</p>
      </div>

      {agents.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-700">Henüz agent oluşturmadınız. Önce bir agent oluşturun.</p>
          <a href="/agents" className="text-indigo-600 hover:underline mt-2 inline-block">Agent Oluştur →</a>
        </div>
      ) : (
        <>
          {/* Agent Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Agent Seçin</label>
            <select
              value={selectedAgentId || ''}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.public_id})</option>
              ))}
            </select>
          </div>

          {/* Domain Security Section */}
          <div className={`rounded-xl shadow-sm border p-5 ${hasDomains ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{hasDomains ? '🔒' : '🔓'}</span>
                <h3 className="font-semibold text-gray-900">Domain Güvenliği</h3>
                {hasDomains ? (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Korumalı</span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full animate-pulse">Korunmasız</span>
                )}
              </div>
            </div>

            {!hasDomains && (
              <div className="bg-red-100 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-800 text-sm font-medium">⚠️ Domain kısıtlaması ayarlanmamış!</p>
                <p className="text-red-700 text-xs mt-1">
                  Embed kodunuz herhangi bir websitede çalışabilir. Bu durum kötüye kullanıma yol açabilir — 
                  sorgu kotanız başkaları tarafından tüketilebilir. Aşağıdan izin verilen domainleri ekleyin.
                </p>
              </div>
            )}

            {/* Current domains */}
            {hasDomains && (
              <div className="flex flex-wrap gap-2 mb-3">
                {domains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
                    🌐 {d}
                    <button
                      onClick={() => removeDomain(d)}
                      className="text-gray-400 hover:text-red-500 transition ml-1"
                      title="Kaldır"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add domain */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                placeholder="ornek.com veya *.ornek.com"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={addDomain}
                disabled={domainSaving || !newDomain.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {domainSaving ? '...' : '+ Ekle'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Alt domainleri dahil etmek için *.ornek.com yazın. Birden fazla domain ekleyebilirsiniz.
            </p>
          </div>

          {codeLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : embedCode ? (
            <>
              {/* Tab Selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('widget')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === 'widget' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🧩 Widget (Script)
                </button>
                <button
                  onClick={() => setActiveTab('iframe')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === 'iframe' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🖼️ iframe
                </button>
              </div>

              {/* Code Block */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">
                    {activeTab === 'widget' ? 'Widget Script Kodu' : 'iframe Embed Kodu'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(
                      activeTab === 'widget' ? embedCode.embed_code.widget : embedCode.embed_code.iframe
                    )}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition"
                  >
                    {copied ? '✅ Kopyalandı!' : '📋 Kopyala'}
                  </button>
                </div>
                <pre className="p-5 text-sm text-gray-800 bg-gray-900 text-green-400 overflow-x-auto font-mono">
                  {activeTab === 'widget' ? embedCode.embed_code.widget : embedCode.embed_code.iframe}
                </pre>
                <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
                  <p className="text-sm text-blue-700">
                    💡 {activeTab === 'widget' ? embedCode.instructions.widget : embedCode.instructions.iframe}
                  </p>
                </div>
              </div>

              {/* Security Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">🛡️ Güvenlik Durumu</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${hasDomains ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <span>{hasDomains ? '✅' : '❌'}</span>
                    Domain Kısıtlaması
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 text-green-700">
                    <span>✅</span>
                    Rate Limiting
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 text-green-700">
                    <span>✅</span>
                    API Key Auth
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

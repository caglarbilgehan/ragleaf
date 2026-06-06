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
  appearance?: {
    layout_mode?: 'floating' | 'split' | 'fullscreen';
    [key: string]: any;
  } | null;
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

  const [layoutMode, setLayoutMode] = useState<'floating' | 'split' | 'fullscreen'>('floating');
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutSaved, setLayoutSaved] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const domains = selectedAgent?.allowed_domains || [];
  const hasDomains = domains.length > 0;

  useEffect(() => {
    if (selectedAgent) {
      setLayoutMode(selectedAgent.appearance?.layout_mode || 'floating');
    }
  }, [selectedAgentId, agents]);

  const saveLayoutMode = async (mode: 'floating' | 'split' | 'fullscreen') => {
    if (!selectedAgentId || !selectedAgent) return;
    setLayoutSaving(true);
    setLayoutSaved(false);
    try {
      const currentAppearance = selectedAgent.appearance || {};
      const updatedAppearance = { ...currentAppearance, layout_mode: mode };
      
      const agent = await fetchAPI<AgentDetail>(`/api/agents/${selectedAgentId}`, {
        method: 'PUT',
        body: JSON.stringify({ appearance: updatedAppearance }),
      });
      
      setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
      setLayoutMode(mode);
      setLayoutSaved(true);
      setTimeout(() => setLayoutSaved(false), 2000);
    } catch (err) {
      console.error('Görünüm modu kaydedilemedi:', err);
    } finally {
      setLayoutSaving(false);
    }
  };

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Widget Entegrasyonu</h1>
        <p className="text-gray-500 mt-1">Asistanınızı web sitenize eklemek için embed kodunu kopyalayın</p>
      </div>

      {agents.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
          <p className="text-amber-400">Henüz asistan oluşturmadınız. Önce bir asistan oluşturun.</p>
          <a href="/agents" className="text-primary-400 hover:underline mt-2 inline-block">Asistan Oluştur →</a>
        </div>
      ) : (
        <>
          {/* Agent Selector */}
          <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-5">
            <label className="block text-sm font-medium text-gray-300 mb-2">Asistan Seçin</label>
            <select
              value={selectedAgentId || ''}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              className="w-full border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id} className="bg-dark-900 text-gray-100">{a.name} ({a.public_id})</option>
              ))}
            </select>
          </div>

          {/* Domain Security Section */}
          <div className={`rounded-xl border p-5 ${hasDomains ? 'bg-dark-800/60 border-white/[0.06]' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{hasDomains ? '🔒' : '🔓'}</span>
                <h3 className="font-semibold text-gray-100">Domain Güvenliği</h3>
                {hasDomains ? (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 rounded-full">Korumalı</span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-full animate-pulse">Korunmasız</span>
                )}
              </div>
            </div>

            {!hasDomains && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                <p className="text-red-400 text-sm font-medium">⚠️ Domain kısıtlaması ayarlanmamış!</p>
                <p className="text-red-400/80 text-xs mt-1">
                  Embed kodunuz herhangi bir websitede çalışabilir. Bu durum kötüye kullanıma yol açabilir — 
                  sorgu kotanız başkaları tarafından tüketilebilir. Aşağıdan izin verilen domainleri ekleyin.
                </p>
              </div>
            )}

            {/* Current domains */}
            {hasDomains && (
              <div className="flex flex-wrap gap-2 mb-3">
                {domains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-600 border border-white/[0.06] rounded-lg text-sm text-gray-300">
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
                className="flex-1 border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:outline-none"
              />
              <button
                onClick={addDomain}
                disabled={domainSaving || !newDomain.trim()}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {domainSaving ? '...' : '+ Ekle'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Alt domainleri dahil etmek için *.ornek.com yazın. Birden fazla domain ekleyebilirsiniz.
            </p>
          </div>

          {/* Widget Layout Configurations */}
          <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-100 text-base">Arayüz & Varsayılan Konumlandırma</h3>
                <p className="text-gray-500 text-xs mt-0.5">Müşterilerinizin sitenizi ziyaret ettiğinde asistanın varsayılan olarak nasıl görüneceğini seçin</p>
              </div>
              {layoutSaving && (
                <span className="text-xs text-gray-500 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-ping"></span>
                  Kaydediliyor...
                </span>
              )}
              {layoutSaved && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  ✅ Değişiklikler Kaydedildi
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Floating */}
              <div
                onClick={() => !layoutSaving && saveLayoutMode('floating')}
                className={`border-2 rounded-xl p-4 cursor-pointer transition flex flex-col justify-between gap-3 ${
                  layoutMode === 'floating' 
                    ? 'border-primary-500 bg-primary-500/10' 
                    : 'border-white/[0.06] hover:border-white/[0.1] bg-dark-800/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-gray-100">Sağ Altta Yüzen (FAB)</span>
                    <input 
                      type="radio" 
                      checked={layoutMode === 'floating'} 
                      onChange={() => {}} 
                      className="text-primary-400 focus:ring-primary-500" 
                    />
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Klasik chat balonu. Web sitenizin sağ altında asılı durur. Tıklandığında küçük bir pencerede açılır.
                  </p>
                </div>

                {/* Mini Graphic Preview */}
                <div className="w-full h-24 bg-dark-600 border border-white/[0.06] rounded-lg relative overflow-hidden flex items-end justify-end p-2">
                  <div className="absolute left-2.5 top-2.5 w-1/2 space-y-1.5 opacity-30">
                    <div className="h-1.5 bg-gray-400 rounded-full w-full"></div>
                    <div className="h-1.5 bg-gray-400 rounded-full w-5/6"></div>
                    <div className="h-1.5 bg-gray-400 rounded-full w-4/6"></div>
                  </div>
                  <div className="w-7 h-7 bg-primary-600 rounded-full shadow-lg flex items-center justify-center text-[10px] text-white font-bold border border-white/20 animate-bounce">
                    🍃
                  </div>
                </div>
              </div>

              {/* Option 2: Split Screen */}
              <div
                onClick={() => !layoutSaving && saveLayoutMode('split')}
                className={`border-2 rounded-xl p-4 cursor-pointer transition flex flex-col justify-between gap-3 ${
                  layoutMode === 'split' 
                    ? 'border-primary-500 bg-primary-500/10' 
                    : 'border-white/[0.06] hover:border-white/[0.1] bg-dark-800/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-gray-100">Ekranı İkiye Bölen</span>
                    <input 
                      type="radio" 
                      checked={layoutMode === 'split'} 
                      onChange={() => {}} 
                      className="text-primary-400 focus:ring-primary-500" 
                    />
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Ekranı ikiye böler. Sağ tarafta asistan sabit durur. Kullanıcı sayfanızı gezerken asistan sürekli göz önündedir.
                  </p>
                </div>

                {/* Mini Graphic Preview */}
                <div className="w-full h-24 bg-dark-600 border border-white/[0.06] rounded-lg relative overflow-hidden flex">
                  <div className="flex-1 p-2.5 space-y-1.5 opacity-30">
                    <div className="h-1.5 bg-gray-400 rounded-full w-5/6"></div>
                    <div className="h-1.5 bg-gray-400 rounded-full w-full"></div>
                    <div className="h-1.5 bg-gray-400 rounded-full w-3/4"></div>
                  </div>
                  <div className="w-1/3 border-l border-white/[0.06] bg-dark-800/60 p-1.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="h-1 bg-primary-500/10 rounded w-full"></div>
                      <div className="h-2 bg-dark-600 rounded w-4/5"></div>
                    </div>
                    <div className="h-2.5 bg-primary-600 rounded w-full flex items-center justify-center text-[5px] text-white">
                      🍃
                    </div>
                  </div>
                </div>
              </div>

              {/* Option 3: Full Screen */}
              <div
                onClick={() => !layoutSaving && saveLayoutMode('fullscreen')}
                className={`border-2 rounded-xl p-4 cursor-pointer transition flex flex-col justify-between gap-3 ${
                  layoutMode === 'fullscreen' 
                    ? 'border-primary-500 bg-primary-500/10' 
                    : 'border-white/[0.06] hover:border-white/[0.1] bg-dark-800/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-gray-100">Tam Ekran</span>
                    <input 
                      type="radio" 
                      checked={layoutMode === 'fullscreen'} 
                      onChange={() => {}} 
                      className="text-primary-400 focus:ring-primary-500" 
                    />
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Kullanıcıyı odaklayan tam ekran sohbet. Arka planı tamamen kaplayarak odağı yalnızca asistan konuşmasına verir.
                  </p>
                </div>

                {/* Mini Graphic Preview */}
                <div className="w-full h-24 bg-dark-600 border border-white/[0.06] rounded-lg relative overflow-hidden flex items-center justify-center p-2">
                  <div className="w-5/6 h-full bg-dark-800/60 border border-white/[0.06] rounded-t-md  p-1.5 flex flex-col justify-between">
                    <div className="flex items-center gap-1 border-b border-white/[0.06] pb-1">
                      <div className="w-2 h-2 rounded-full bg-primary-600"></div>
                      <div className="h-1 bg-gray-300 rounded w-1/3"></div>
                    </div>
                    <div className="space-y-1 my-1 flex-1">
                      <div className="h-2 bg-dark-600 rounded w-3/4"></div>
                      <div className="h-2 bg-primary-500/10 rounded w-2/3 ml-auto"></div>
                    </div>
                    <div className="h-3 bg-dark-700/50 border border-white/[0.06] rounded w-full flex items-center px-1">
                      <div className="h-1 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {codeLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : embedCode ? (
            <>
              {/* Tab Selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('widget')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === 'widget' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-300 hover:bg-dark-500'
                  }`}
                >
                  🧩 Widget (Script)
                </button>
                <button
                  onClick={() => setActiveTab('iframe')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === 'iframe' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-300 hover:bg-dark-500'
                  }`}
                >
                  🖼️ iframe
                </button>
              </div>

              {/* Code Block */}
              <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-dark-700/50 border-b border-white/[0.06]">
                  <span className="text-sm font-medium text-gray-300">
                    {activeTab === 'widget' ? 'Widget Script Kodu' : 'iframe Embed Kodu'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(
                      activeTab === 'widget' ? embedCode.embed_code.widget : embedCode.embed_code.iframe
                    )}
                    className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition"
                  >
                    {copied ? '✅ Kopyalandı!' : '📋 Kopyala'}
                  </button>
                </div>
                <pre className="p-5 text-sm text-gray-200 bg-dark-900 text-green-400 overflow-x-auto font-mono">
                  {activeTab === 'widget' ? embedCode.embed_code.widget : embedCode.embed_code.iframe}
                </pre>
                <div className="px-5 py-3 bg-primary-500/10 border-t border-primary-500/20">
                  <p className="text-sm text-primary-400">
                    💡 {activeTab === 'widget' ? embedCode.instructions.widget : embedCode.instructions.iframe}
                  </p>
                </div>
              </div>

              <div className="bg-dark-700/50 border border-white/[0.06] rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-300">🛡️ Güvenlik Durumu</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${hasDomains ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    <span>{hasDomains ? '✅' : '❌'}</span>
                    Domain Kısıtlaması
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
                    <span>✅</span>
                    Rate Limiting
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
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

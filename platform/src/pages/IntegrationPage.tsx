// platform/src/pages/IntegrationPage.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { agentApi, type Agent, type AgentAPIKey } from '@/services/ragleafApi';
import {
  ClipboardDocumentIcon,
  PlusIcon,
  TrashIcon,
  KeyIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';

export default function IntegrationPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const id = Number(agentId);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'widget' | 'api' | 'keys'>('widget');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<'public' | 'secret'>('public');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const { data: agent } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => agentApi.get(id),
    enabled: !!id,
  });

  const { data: apiKeys = [] } = useQuery<AgentAPIKey[]>({
    queryKey: ['agent-keys', id],
    queryFn: () => agentApi.listApiKeys(id),
    enabled: !!id,
  });

  const createKeyMutation = useMutation({
    mutationFn: () => agentApi.createApiKey(id, { name: newKeyName, key_type: newKeyType }),
    onSuccess: (data: AgentAPIKey) => {
      queryClient.invalidateQueries({ queryKey: ['agent-keys', id] });
      setCreatedKey(data.raw_key || null);
      setNewKeyName('');
      toast.success('API key oluşturuldu');
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: number) => agentApi.revokeApiKey(id, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-keys', id] });
      toast.success('API key iptal edildi');
    },
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopyalandı!');
  };

  const baseUrl = window.location.origin;
  const firstPublicKey = apiKeys.find((k) => k.key_type === 'public' && k.is_active);

  const widgetCode = `<script
  src="${baseUrl}/widget.js"
  data-agent-id="${agent?.public_id || 'ag_...'}"
  data-api-key="${firstPublicKey?.key_prefix || 'ak_...'}"
  data-api-url="${baseUrl}"
  async
></script>`;

  const curlExample = `curl -X POST ${baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "Merhaba"}],
    "session_id": "optional-session-id"
  }'`;

  const tabs = [
    { id: 'widget' as const, label: 'Website Widget', icon: GlobeAltIcon },
    { id: 'api' as const, label: 'REST API', icon: CommandLineIcon },
    { id: 'keys' as const, label: 'API Keys', icon: KeyIcon },
  ];

  if (!agent) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Entegrasyon — {agent.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Agent'ınızı web sitenize veya uygulamanıza ekleyin
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Widget Tab */}
      {activeTab === 'widget' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-2">Widget Embed Kodu</h3>
            <p className="text-sm text-gray-500 mb-4">
              Bu kodu web sitenizin <code className="bg-gray-100 px-1 rounded">&lt;body&gt;</code> tag'ının sonuna ekleyin
            </p>

            {!firstPublicKey && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-4 text-sm">
                ⚠️ Henüz API key oluşturmadınız. Önce "API Keys" sekmesinden bir public key oluşturun.
              </div>
            )}

            <div className="relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                {widgetCode}
              </pre>
              <button
                onClick={() => copy(widgetCode)}
                className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Customization */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Özelleştirme Seçenekleri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                { attr: 'data-primary-color', desc: 'Tema rengi', example: '#4F46E5' },
                { attr: 'data-position', desc: 'Widget pozisyonu', example: 'bottom-right | bottom-left' },
                { attr: 'data-title', desc: 'Widget başlığı', example: 'Destek Asistanı' },
              ].map((opt) => (
                <div key={opt.attr} className="bg-gray-50 rounded-lg p-3">
                  <code className="text-indigo-600 font-mono text-xs">{opt.attr}</code>
                  <p className="text-gray-600 mt-1">{opt.desc}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Örnek: {opt.example}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* API Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-2">REST API Kullanımı</h3>
            <p className="text-sm text-gray-500 mb-4">
              OpenAI-compatible API ile kendi uygulamanızdan sohbet başlatın
            </p>

            <div className="relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono whitespace-pre">
                {curlExample}
              </pre>
              <button
                onClick={() => copy(curlExample)}
                className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-3">API Endpointleri</h3>
            <div className="space-y-3 text-sm">
              {[
                { method: 'POST', path: '/v1/chat/completions', desc: 'Sohbet mesajı gönder' },
                { method: 'GET', path: `/v1/agents/${agent.public_id}/info`, desc: 'Agent bilgilerini al' },
                { method: 'GET', path: '/v1/conversations/{session_id}/history', desc: 'Sohbet geçmişi' },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    ep.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {ep.method}
                  </span>
                  <code className="font-mono text-gray-700 flex-1">{ep.path}</code>
                  <span className="text-gray-500">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Created Key Alert */}
          {createdKey && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="font-semibold text-green-800 mb-2">🔑 Yeni API Key Oluşturuldu</h4>
              <p className="text-sm text-green-700 mb-2">
                Bu key sadece bir kez gösterilecek. Güvenli bir yere kaydedin.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-green-100 px-3 py-2 rounded-lg font-mono text-sm break-all">
                  {createdKey}
                </code>
                <button onClick={() => copy(createdKey)} className="p-2 bg-green-200 rounded-lg hover:bg-green-300">
                  <ClipboardDocumentIcon className="h-5 w-5 text-green-700" />
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)} className="mt-2 text-sm text-green-600 hover:underline">
                Kapat
              </button>
            </div>
          )}

          {/* Create Key Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Yeni API Key</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Adı</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="ör: Website Widget, Backend Integration"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
                <select
                  value={newKeyType}
                  onChange={(e) => setNewKeyType(e.target.value as 'public' | 'secret')}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="public">Public (widget)</option>
                  <option value="secret">Secret (API)</option>
                </select>
              </div>
              <button
                onClick={() => createKeyMutation.mutate()}
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                Oluştur
              </button>
            </div>
          </div>

          {/* Key List */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {apiKeys.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Henüz API key oluşturulmadı
              </div>
            ) : (
              apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <KeyIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{key.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <code>{key.key_prefix}...</code>
                        <span className={`px-1.5 py-0.5 rounded ${
                          key.key_type === 'public' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {key.key_type}
                        </span>
                        <span>{key.total_requests} istek</span>
                        {key.last_used_at && (
                          <span>Son: {new Date(key.last_used_at).toLocaleDateString('tr')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Bu API key iptal edilecek. Emin misiniz?'))
                        revokeKeyMutation.mutate(key.id);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

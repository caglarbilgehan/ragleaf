import { useEffect, useState, useRef } from 'react';

interface AgentSummary {
  id: number;
  name: string;
  public_id: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchAPI<T>(path: string): Promise<T> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantDocuments() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAPI<AgentSummary[]>('/api/org/agents')
      .then((a) => {
        setAgents(a);
        if (a.length > 0) setSelectedAgentId(a[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgentId) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const token = localStorage.getItem('ragleaf_token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/agents/${selectedAgentId}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadResult({ success: true, message: `✅ "${file.name}" başarıyla yüklendi. (ID: ${data.document_id})` });
      } else {
        setUploadResult({ success: false, message: `❌ Hata: ${data.detail || 'Bilinmeyen hata'}` });
      }
    } catch (err) {
      setUploadResult({ success: false, message: '❌ Bağlantı hatası.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        <h1 className="text-2xl font-bold text-gray-900">Doküman Yükleme</h1>
        <p className="text-gray-500 mt-1">Asistanlarınıza bilgi tabanı dokümanları yükleyin</p>
      </div>

      {agents.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-700">Henüz asistan oluşturmadınız.</p>
          <a href="/agents" className="text-indigo-600 hover:underline mt-2 inline-block">Asistan Oluştur →</a>
        </div>
      ) : (
        <>
          {/* Agent Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Hedef Asistan</label>
            <select
              value={selectedAgentId || ''}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Upload Area */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-indigo-400 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
                  <p className="text-gray-600">Yükleniyor...</p>
                </div>
              ) : (
                <>
                  <p className="text-5xl mb-4">📁</p>
                  <p className="text-lg font-medium text-gray-700">Dosya yüklemek için tıklayın</p>
                  <p className="text-sm text-gray-400 mt-2">Desteklenen formatlar: PDF, DOCX, TXT, MD (Maks. 50MB)</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`rounded-xl p-4 border ${
              uploadResult.success 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <p className="font-medium">{uploadResult.message}</p>
              {uploadResult.success && (
                <p className="text-sm mt-1 opacity-75">
                  Dokümanın işlenmesi ve bilgi tabanına eklenmesi biraz zaman alabilir.
                </p>
              )}
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-800 text-sm">
              💡 Yüklenen dokümanlar seçili asistanın bilgi tabanına eklenir. Asistan, bu dokümanları kullanarak soruları yanıtlar.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

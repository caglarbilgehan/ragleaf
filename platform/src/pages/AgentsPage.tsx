// platform/src/pages/AgentsPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { agentApi, type Agent } from '@/services/ragleafApi';
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  KeyIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newWelcome, setNewWelcome] = useState('Merhaba! Size nasıl yardımcı olabilirim?');

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: agentApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Agent>) => agentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent oluşturuldu');
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewPrompt('');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Hata oluştu'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => agentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent silindi');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      agentApi.update(id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const handleCreate = () => {
    if (!newName.trim()) return toast.error('Agent adı gerekli');
    createMutation.mutate({
      name: newName,
      description: newDesc || undefined,
      system_prompt: newPrompt || undefined,
      welcome_message: newWelcome || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Temsilciler</h1>
          <p className="text-sm text-gray-500 mt-1">
            Firmanız için AI temsilciler oluşturun ve yönetin
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Yeni Agent
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-semibold">Yeni Agent Oluştur</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Adı *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ör: Müşteri Destek Botu"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Agent'ın amacı"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Karşılama Mesajı</label>
            <input
              type="text"
              value={newWelcome}
              onChange={(e) => setNewWelcome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={3}
              placeholder="Agent'ın davranışını tanımlayan prompt (boş bırakılırsa otomatik oluşturulur)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </div>
      )}

      {/* Agent Cards */}
      {agents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Henüz agent yok</h3>
          <p className="text-gray-500 mt-1">İlk AI temsilcinizi oluşturarak başlayın</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`bg-white rounded-xl border p-5 space-y-4 transition-all hover:shadow-md ${
                agent.is_active ? 'border-gray-200' : 'border-red-200 bg-red-50/30'
              }`}
            >
              {/* Agent Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: agent.appearance?.primary_color || '#4F46E5' }}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                    <p className="text-xs text-gray-500">{agent.slug}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleMutation.mutate({ id: agent.id, active: !agent.is_active })}
                  className={`p-1.5 rounded ${agent.is_active ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}
                  title={agent.is_active ? 'Aktif — devre dışı bırak' : 'Devre dışı — aktifleştir'}
                >
                  {agent.is_active ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                </button>
              </div>

              {/* Description */}
              {agent.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{agent.description}</p>
              )}

              {/* Stats */}
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  {agent.total_conversations} sohbet
                </span>
                <span className="flex items-center gap-1">
                  <DocumentTextIcon className="h-4 w-4" />
                  {agent.document_count || 0} doküman
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => navigate(`/agents/${agent.id}/edit`)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  Düzenle
                </button>
                <button
                  onClick={() => navigate(`/agents/${agent.id}/integrate`)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                >
                  <KeyIcon className="h-4 w-4" />
                  Entegre Et
                </button>
                <button
                  onClick={() => {
                    if (confirm(`"${agent.name}" agent'ı silinecek. Emin misiniz?`))
                      deleteMutation.mutate(agent.id);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

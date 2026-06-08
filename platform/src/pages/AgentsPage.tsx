// platform/src/pages/AgentsPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { agentApi, type Agent } from '@/services/ragleafApi';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function AgentsPage() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newWelcome, setNewWelcome] = useState('');

  // Set default welcome message once translations are loaded
  useState(() => {
    setNewWelcome(t('agents.default_welcome'));
  });

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: agentApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Agent>) => agentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('agents.toast_created'));
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewPrompt('');
      setNewWelcome(t('agents.default_welcome'));
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t('ui.error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => agentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('agents.toast_deleted'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      agentApi.update(id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const handleCreate = () => {
    if (!newName.trim()) return toast.error(t('agents.toast_name_required'));
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            <span className="text-primary-500">AI</span>assistant / {language === 'tr' ? 'Asistanlarım' : 'Assistants'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('agents.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/agents/new/template')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-medium text-sm"
          >
            <SparklesIcon className="h-5 w-5" />
            {t('agents.btn_template')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-600 text-gray-300 rounded-lg hover:bg-dark-500 transition-colors font-medium text-sm"
          >
            <PlusIcon className="h-5 w-5" />
            {t('agents.btn_create_empty')}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 space-y-4">
          <h3 className="text-lg font-semibold">{t('agents.create_title')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{t('agents.label_name')}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('agents.placeholder_name')}
                className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{t('agents.label_desc')}</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t('agents.placeholder_desc')}
                className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{t('agents.label_welcome')}</label>
            <input
              type="text"
              value={newWelcome}
              onChange={(e) => setNewWelcome(e.target.value)}
              className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{t('agents.label_prompt')}</label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={3}
              placeholder={t('agents.placeholder_prompt')}
              className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              {t('ui.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? t('agents.btn_creating') : t('ui.create')}
            </button>
          </div>
        </div>
      )}

      {/* Agent Table List */}
      {agents.length === 0 ? (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-12 text-center">
          <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-100">{t('agents.no_agents')}</h3>
          <p className="text-gray-500 mt-1">{t('agents.no_agents_desc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-dark-800/40 rounded-xl border border-white/[0.06] shadow-xl">
          <table className="min-w-full divide-y divide-white/[0.06] text-left">
            <thead className="bg-dark-900/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4">{language === 'tr' ? 'Asistan' : 'Assistant'}</th>
                <th scope="col" className="px-6 py-4">{language === 'tr' ? 'Rapor / Detay' : 'Stats / Info'}</th>
                <th scope="col" className="px-6 py-4">{language === 'tr' ? 'Durum' : 'Status'}</th>
                <th scope="col" className="px-6 py-4 text-right">{language === 'tr' ? 'İşlemler' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {agents.map((agent) => (
                <tr 
                  key={agent.id} 
                  className={`hover:bg-white/[0.02] transition-colors ${
                    agent.is_active ? '' : 'opacity-75 bg-red-500/[0.01]'
                  }`}
                >
                  {/* Name & Avatar */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm"
                        style={{ backgroundColor: agent.appearance?.primary_color || '#22c55e' }}
                      >
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-100 text-sm">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.slug}</div>
                      </div>
                    </div>
                  </td>

                  {/* Stats */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 bg-dark-900/60 px-2.5 py-1 rounded-md border border-white/[0.03]">
                        <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-primary-400" />
                        <strong>{agent.total_conversations}</strong> {t('agents.stats_conversations')}
                      </span>
                      <span className="flex items-center gap-1.5 bg-dark-900/60 px-2.5 py-1 rounded-md border border-white/[0.03]">
                        <DocumentTextIcon className="h-3.5 w-3.5 text-emerald-400" />
                        <strong>{agent.document_count || 0}</strong> {t('agents.stats_documents')}
                      </span>
                    </div>
                  </td>

                  {/* Toggle Status */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => toggleMutation.mutate({ id: agent.id, active: !agent.is_active })}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        agent.is_active 
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.is_active ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                      {agent.is_active ? (language === 'tr' ? 'Aktif' : 'Active') : (language === 'tr' ? 'Pasif' : 'Passive')}
                    </button>
                  </td>

                  {/* Action Buttons */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/agents/${agent.id}/edit`)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-primary-400 bg-primary-500/10 rounded-lg hover:bg-primary-500/20 font-semibold transition"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        {t('ui.edit')}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t('agents.confirm_delete').replace('{name}', agent.name)))
                            deleteMutation.mutate(agent.id);
                        }}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title={t('ui.delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

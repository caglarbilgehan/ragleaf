import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { templateApi, type AgentTemplate } from '@/services/ragleafApi';
import {
  SparklesIcon,
  TrashIcon,
  PencilSquareIcon,
  PlusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CATEGORY_LABELS: Record<string, string> = {
  beauty: 'Güzellik & Bakım',
  health: 'Sağlık',
  retail: 'Perakende & E-Ticaret',
  food: 'Yeme & İçme',
  finance: 'Finans',
  education: 'Eğitim & Kurs',
  general: 'Genel Destek',
};

export default function TemplateManagementPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Fetch templates
  const { data: templates = [], isLoading, refetch } = useQuery<AgentTemplate[]>({
    queryKey: ['templates-admin'],
    queryFn: () => templateApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => templateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-admin'] });
      toast.success('Şablon silindi.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Şablon silinemedi.');
    },
  });



  const handleDeleteTemplate = (id: number, templateName: string) => {
    if (confirm(`"${templateName}" şablonunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      deleteMutation.mutate(id);
    }
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <span>✨ Hazır Asistan & Şablon Yönetimi</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistemdeki sektörel hazır AI asistan şablonlarını ekleyin, düzenleyin ve döküman atayın.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg border border-white/[0.06] transition-colors"
            title="Yenile"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate('/admin/templates/new')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Yeni Şablon Ekle
          </button>
        </div>
      </div>

      {/* Templates List Table Layout */}
      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] bg-dark-900/40 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-6">Şablon</th>
                <th className="py-4 px-6">Kategori</th>
                <th className="py-4 px-6">Değişkenler</th>
                <th className="py-4 px-6">Örnek Sorular</th>
                <th className="py-4 px-6">Durum</th>
                <th className="py-4 px-6 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    Kayıtlı asistan şablonu bulunamadı.
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.01] transition-colors text-sm group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl bg-dark-700/50 p-2 rounded-lg border border-white/[0.06]">
                          {t.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-200">{t.name}</span>
                            {t.is_featured && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <SparklesIcon className="h-3 w-3" /> Öne Çıkan
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-gray-500">{t.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium bg-dark-700 text-gray-300 border border-white/[0.04]">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs text-gray-300">
                        {t.config_schema?.length || 0} Değişken
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs text-gray-300">
                        {t.preview_questions?.length || 0} Soru
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.is_active ? 'text-green-400' : 'text-gray-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${t.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                        {t.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/admin/templates/${t.slug}/edit`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white border border-white/[0.06] transition-colors"
                          title="Şablonu Düzenle"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5 text-blue-400" />
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(t.id, t.name)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                          title="Şablonu Sil"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

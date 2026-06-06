// platform/src/pages/admin/TemplateManagementPage.tsx
// Admin — Hazır AI asistan şablon yönetimi

import { useQuery } from '@tanstack/react-query';
import { templateApi, type AgentTemplate } from '@/services/ragleafApi';
import {
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const CATEGORY_LABELS: Record<string, string> = {
  beauty: 'Güzellik & Bakım',
  health: 'Sağlık',
  retail: 'Perakende & E-Ticaret',
  food: 'Yeme & İçme',
};

export default function TemplateManagementPage() {
  const { data: templates = [], isLoading } = useQuery<AgentTemplate[]>({
    queryKey: ['templates-admin'],
    queryFn: () => templateApi.list(),
  });

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
          <h1 className="text-2xl font-bold text-gray-100">✨ Hazır Asistan Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hazır sektörel AI asistan şablonlarını yönetin
          </p>
        </div>
        <div className="bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/20 px-4 py-2 rounded-lg text-sm font-medium">
          {templates.length} Şablon Aktif
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <div
            key={t.slug}
            className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 hover: transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{t.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-100">{t.name}</h3>
                  <p className="text-xs text-gray-500">
                    {CATEGORY_LABELS[t.category] || t.category} • <code className="bg-dark-600 px-1 rounded">{t.slug}</code>
                  </p>
                </div>
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                t.is_featured
                  ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                  : 'bg-dark-600 text-gray-400'
              }`}>
                {t.is_featured ? (
                  <><SparklesIcon className="h-3 w-3" /> Öne Çıkan</>
                ) : (
                  'Normal'
                )}
              </span>
            </div>

            <p className="text-sm text-gray-400 mt-3">{t.description}</p>

            {/* Config Fields */}
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Yapılandırma Alanları ({t.config_schema?.length || 0})
              </p>
              <div className="flex flex-wrap gap-1">
                {t.config_schema?.map((field: any) => (
                  <span
                    key={field.key}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      field.required
                        ? 'bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/20'
                        : 'bg-dark-600 text-gray-400'
                    }`}
                  >
                    {field.label}
                    {field.required && ' *'}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview Questions */}
            {t.preview_questions && t.preview_questions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                <p className="text-xs font-medium text-gray-500 mb-1">Örnek Sorular</p>
                <div className="flex flex-wrap gap-1">
                  {t.preview_questions.map((q: string, i: number) => (
                    <span key={i} className="text-xs bg-green-500/10 text-green-400 ring-1 ring-green-500/20 px-2 py-0.5 rounded-full">
                      "{q}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircleIcon className="h-4 w-4" /> Aktif
              </span>
              <span className="text-xs text-gray-400">
                sort: {t.sort_order}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// platform/src/pages/tenant/TenantWriter.tsx
// AI Writer yönetim sayfası — blog makaleleri üretimi ve yönetimi
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  writerApi,
  agentApi,
  type WriterArticle,
  type Agent,
} from '@/services/ragleafApi';
import {
  SparklesIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  EyeIcon,
  ArrowPathIcon,
  BookOpenIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Taslak', color: 'text-gray-400', bg: 'bg-dark-600 ring-1 ring-white/[0.06]' },
  pending_review: { label: 'Onay Bekliyor', color: 'text-amber-400', bg: 'bg-amber-500/10 ring-1 ring-amber-500/20' },
  approved: { label: 'Onaylandı', color: 'text-blue-400', bg: 'bg-blue-500/10 ring-1 ring-blue-500/20' },
  published: { label: 'Yayınlandı', color: 'text-green-400', bg: 'bg-green-500/10 ring-1 ring-green-500/20' },
};

const PLATFORM_LABELS: Record<string, string> = {
  nextjs: 'Next.js Blog',
  wordpress: 'WordPress',
  ghost: 'Ghost CMS',
};

// Simple Markdown to HTML compiler for preview tab
const renderMarkdown = (content: string | null) => {
  if (!content) return '';
  
  let html = content
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3 text-white font-[\'Outfit\']">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4 text-white font-[\'Outfit\'] border-b border-white/5 pb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold mt-10 mb-6 text-white font-[\'Outfit\']">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-300">$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-white/5 px-1.5 py-0.5 rounded text-sm text-emerald-400 font-mono">$1</code>')
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-primary-500 bg-primary-500/5 px-5 py-3 italic rounded-r-lg my-6 text-gray-300">$1</blockquote>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:underline">$1</a>');

  const lines = html.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      let prefix = '';
      if (!inList) {
        inList = true;
        prefix = '<ul class="list-disc pl-6 mb-4 space-y-2 text-gray-300">';
      }
      return `${prefix}<li>${content}</li>`;
    } else {
      let suffix = '';
      if (inList) {
        inList = false;
        suffix = '</ul>';
      }
      return `${suffix}${line}`;
    }
  });
  
  if (inList) {
    processedLines.push('</ul>');
  }
  
  html = processedLines.join('\n');

  const paragraphs = html.split('\n\n');
  const formatted = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('<h') || 
      trimmed.startsWith('<ul') || 
      trimmed.startsWith('<blockquote') || 
      trimmed.startsWith('<ul>') ||
      trimmed.startsWith('<li>')
    ) {
      return trimmed;
    }
    return `<p class="mb-4 text-gray-300 leading-relaxed">${trimmed.replace(/\n/g, '<br/>')}</p>`;
  });

  return formatted.join('');
};

export default function TenantWriter() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Modals state
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Loading steps animation during generation
  const [genStep, setGenStep] = useState(0);
  const loadingSteps = [
    'Makale konusu ve pazar eğilimleri analiz ediliyor...',
    'SEO hedefleri doğrultusunda anahtar kelimeler optimize ediliyor...',
    'Kapsamlı makale taslağı ve başlıkları yapılandırılıyor...',
    'LLM modeli ile detaylı blog içeriği yazılıyor (~1000 kelime)...',
    'SEO meta açıklaması ve dil denetimi yapılıyor...',
    'Yazı tamamlanıyor ve veri tabanına kaydediliyor...'
  ];

  // Forms state
  const [topic, setTopic] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [lang, setLang] = useState('tr');
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [mode, setMode] = useState<'autonomous' | 'semi-autonomous'>('semi-autonomous');
  const [platform, setPlatform] = useState<'nextjs' | 'wordpress' | 'ghost'>('nextjs');

  // Selected article for editing
  const [selectedArticle, setSelectedArticle] = useState<WriterArticle | null>(null);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editOutline, setEditOutline] = useState('');

  // Queries
  const { data: articles = [], isLoading } = useQuery<WriterArticle[]>({
    queryKey: ['writer-articles', statusFilter],
    queryFn: () => writerApi.list(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: agentApi.list,
  });

  // Loading steps timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenModalOpen && genStep < loadingSteps.length - 1) {
      timer = setTimeout(() => {
        setGenStep(prev => prev + 1);
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [isGenModalOpen, genStep]);

  // Mutations
  const generateMutation = useMutation({
    mutationFn: () => {
      const keywords = keywordsInput
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      return writerApi.generate({
        topic,
        keywords,
        language: lang,
        agent_id: selectedAgentId ? Number(selectedAgentId) : null,
        mode,
        publishing_platform: platform,
      });
    },
    onSuccess: (newArticle) => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success('Yapay zeka makalesi başarıyla üretildi!');
      setIsGenModalOpen(false);
      // Reset form
      setTopic('');
      setKeywordsInput('');
      setGenStep(0);
      // Open editor directly for preview
      handleOpenEdit(newArticle);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Makale üretilirken bir hata oluştu.');
      setGenStep(0);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ publicId, data }: { publicId: string; data: any }) =>
      writerApi.update(publicId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success('Makale güncellendi');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Güncelleme başarısız');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (publicId: string) => writerApi.publish(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success('Makale başarıyla yayınlandı!');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Yayınlama başarısız');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (publicId: string) => writerApi.delete(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success('Makale silindi');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Silme başarısız');
    },
  });

  // Stats calculation
  const stats = {
    total: articles.length,
    pending: articles.filter(a => a.status === 'pending_review').length,
    draft: articles.filter(a => a.status === 'draft').length,
    published: articles.filter(a => a.status === 'published').length,
  };

  const handleOpenEdit = (article: WriterArticle) => {
    setSelectedArticle(article);
    setEditTitle(article.title);
    setEditSlug(article.slug);
    setEditSummary(article.summary || '');
    setEditContent(article.content || '');
    setEditKeywords(article.keywords ? article.keywords.join(', ') : '');
    setEditOutline(article.outline ? article.outline.join('\n') : '');
    setEditorTab('edit');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (statusOverride?: 'draft' | 'pending_review' | 'approved') => {
    if (!selectedArticle) return;
    const keywords = editKeywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    const outline = editOutline
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);

    const payload: any = {
      title: editTitle,
      slug: editSlug,
      summary: editSummary,
      content: editContent,
      keywords,
      outline,
    };

    if (statusOverride) {
      payload.status = statusOverride;
    }

    updateMutation.mutate({
      publicId: selectedArticle.public_id,
      data: payload,
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <SparklesIcon className="h-6 w-6 text-primary-400" />
            AI Yazar (Blog Otomasyonu)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Yapay zeka ile SEO uyumlu blog makaleleri üretin, düzenleyin ve yayınlayın
          </p>
        </div>
        <button
          onClick={() => {
            setGenStep(0);
            setIsGenModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors self-start md:self-auto"
        >
          <PlusIcon className="h-4 w-4" />
          Yeni Makale Üret
        </button>
      </div>

      {/* Analytics Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Makale', value: stats.total, color: 'bg-dark-800 border-white/[0.06]' },
          { label: 'Onay Bekleyen', value: stats.pending, color: 'border-amber-500/20 bg-amber-500/[0.02] text-amber-400' },
          { label: 'Taslaklar', value: stats.draft, color: 'bg-dark-800 border-white/[0.06] text-gray-400' },
          { label: 'Yayınlanan', value: stats.published, color: 'border-green-500/20 bg-green-500/[0.02] text-green-400' },
        ].map((s, idx) => (
          <div key={idx} className={`rounded-xl border p-4 flex flex-col justify-between ${s.color}`}>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-60">{s.label}</span>
            <span className="text-3xl font-extrabold mt-2">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-dark-800/40 p-4 rounded-xl border border-white/[0.04]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-gray-400 font-medium">Durum Filtresi:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="pending_review">Onay Bekliyor</option>
            <option value="approved">Onaylandı</option>
            <option value="published">Yayınlandı</option>
          </select>
        </div>
      </div>

      {/* Article Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-12 text-center">
          <BookOpenIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-100">Makale bulunamadı</h3>
          <p className="text-gray-500 mt-1">
            Yapay zeka yazarını kullanarak ilk makalenizi üretmeye başlayın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((art) => {
            const statusInfo = STATUS_LABELS[art.status] || STATUS_LABELS.draft;
            return (
              <div
                key={art.public_id}
                className="bg-dark-800/50 rounded-2xl border border-white/[0.06] p-6 flex flex-col justify-between hover:border-primary-500/30 transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(art.created_at)}</span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-100 leading-snug mb-2 group-hover:text-white line-clamp-2">
                    {art.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-3 mb-4">
                    {art.summary || 'Özet belirtilmemiş.'}
                  </p>

                  {/* Keywords tags */}
                  {art.keywords && art.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {art.keywords.slice(0, 3).map((kw, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-300">
                          #{kw}
                        </span>
                      ))}
                      {art.keywords.length > 3 && (
                        <span className="text-[10px] text-gray-500">+{art.keywords.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/[0.04] pt-4 flex items-center justify-between text-xs text-gray-400 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">Platform</span>
                    <span className="font-medium text-gray-300">{PLATFORM_LABELS[art.publishing_platform] || art.publishing_platform}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(art)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 transition-colors"
                      title="İncele & Düzenle"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Bu makaleyi silmek istediğinize emin misiniz?')) {
                          deleteMutation.mutate(art.public_id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Sil"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generation Wizard Modal */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !generateMutation.isPending && setIsGenModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-dark-800 rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl">
            {generateMutation.isPending ? (
              /* Generation Loading State */
              <div className="p-10 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-primary-500 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-white/5 border-b-emerald-400 animate-spin [animation-duration:3s]" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">✍️</div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Yapay Zeka Blog Yazısı Üretiyor</h3>
                  <p className="text-sm text-gray-400 transition-all duration-500 animate-pulse">
                    {loadingSteps[genStep]}
                  </p>
                  <p className="text-[11px] text-gray-500">Bu işlem yaklaşık 15-30 saniye sürebilir.</p>
                </div>
              </div>
            ) : (
              /* Generation Form State */
              <>
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    <SparklesIcon className="h-5 w-5 text-primary-400" />
                    AI ile Blog Yazısı Üret
                  </h3>
                  <button
                    onClick={() => setIsGenModalOpen(false)}
                    className="p-1 text-gray-400 hover:text-white rounded-lg"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Topic */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Makale Konusu veya Başlığı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Örn: E-ticarette Sepet Terk Oranını Düşürme Yolları"
                      className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  {/* Keywords */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      SEO Anahtar Kelimeleri (virgülle ayırın)
                    </label>
                    <input
                      type="text"
                      value={keywordsInput}
                      onChange={(e) => setKeywordsInput(e.target.value)}
                      placeholder="Örn: e-ticaret, sepet terk oranı, satış artırma"
                      className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 placeholder:text-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Language */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Dil</label>
                      <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        <option value="tr">Türkçe 🇹🇷</option>
                        <option value="en">İngilizce 🇬🇧</option>
                      </select>
                    </div>

                    {/* Agent selection */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Asistan İlişkisi (Opsiyonel)</label>
                      <select
                        value={selectedAgentId}
                        onChange={(e) => setSelectedAgentId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        <option value="">İlişkilendirme Yok</option>
                        {agents.map(ag => (
                          <option key={ag.id} value={ag.id}>{ag.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {/* Mode */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Çalışma Modu</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMode('semi-autonomous')}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                            mode === 'semi-autonomous'
                              ? 'bg-primary-600/10 text-primary-400 border-primary-500'
                              : 'bg-dark-700/30 text-gray-400 border-white/[0.06] hover:bg-dark-700/50'
                          }`}
                        >
                          Onaylı (Yarı Otonom)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode('autonomous')}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                            mode === 'autonomous'
                              ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500'
                              : 'bg-dark-700/30 text-gray-400 border-white/[0.06] hover:bg-dark-700/50'
                          }`}
                          title="Hemen yayınlanır"
                        >
                          Otonom (Doğrudan)
                        </button>
                      </div>
                    </div>

                    {/* Publishing Platform */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Hedef Platform</label>
                      <select
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value as any)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        <option value="nextjs">Next.js Blog</option>
                        <option value="wordpress">WordPress</option>
                        <option value="ghost">Ghost CMS</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-dark-900/40 border-t border-white/[0.06] flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsGenModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={() => generateMutation.mutate()}
                    disabled={!topic || generateMutation.isPending}
                    className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    Makaleyi Üret
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Detail Split-Pane Editor Modal */}
      {isEditModalOpen && selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm" onClick={() => !updateMutation.isPending && setIsEditModalOpen(false)} />
          
          <div className="relative w-full max-w-6xl h-[90vh] bg-dark-800 rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-dark-800">
              <div className="flex items-center gap-3">
                <span className="text-xl">📰</span>
                <div>
                  <h3 className="text-base font-bold text-white leading-none mb-1">
                    Yapay Zeka Makale İncelemesi
                  </h3>
                  <p className="text-xs text-gray-500">
                    Makaleyi gözden geçirin, başlıkları ve metni dilediğiniz gibi düzenleyerek onaylayın.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="border border-white/[0.08] rounded-lg p-0.5 flex bg-dark-900/50">
                  <button
                    onClick={() => setEditorTab('edit')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      editorTab === 'edit' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      editorTab === 'preview' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Önizleme
                  </button>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg text-lg ml-2"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex bg-dark-900/20">
              {editorTab === 'edit' ? (
                /* Editor Form */
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Title */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Başlık</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Slug */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">URL (Slug)</label>
                      <input
                        type="text"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Summary */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">SEO Özet (Meta Description)</label>
                      <textarea
                        rows={3}
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none resize-none"
                      />
                    </div>
                    {/* Keywords & Outline */}
                    <div className="col-span-2 sm:col-span-1 flex flex-col justify-between gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">Anahtar Kelimeler (virgülle ayırın)</label>
                        <input
                          type="text"
                          value={editKeywords}
                          onChange={(e) => setEditKeywords(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">Makale Başlık Taslağı (Her satıra bir başlık)</label>
                        <textarea
                          rows={2}
                          value={editOutline}
                          onChange={(e) => setEditOutline(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">İçerik (Markdown)</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1 w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none font-mono resize-none min-h-[250px]"
                    />
                  </div>
                </div>
              ) : (
                /* Markdown Live Preview */
                <div className="flex-1 p-8 overflow-y-auto bg-dark-900/60">
                  <div className="max-w-[720px] mx-auto space-y-6">
                    <header className="border-b border-white/[0.08] pb-6 mb-8">
                      <div className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-2">
                        ✨ {editKeywords.split(',')[0] || 'RAG'}
                      </div>
                      <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                        {editTitle}
                      </h1>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>Oluşturulma: {formatDate(selectedArticle.created_at)}</span>
                        <span>•</span>
                        <span>Platform: {PLATFORM_LABELS[selectedArticle.publishing_platform] || selectedArticle.publishing_platform}</span>
                      </div>
                    </header>

                    {editSummary && (
                      <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-xl text-sm italic text-gray-400 mb-6 leading-relaxed">
                        <strong>SEO Özeti:</strong> {editSummary}
                      </div>
                    )}

                    <div
                      className="prose prose-invert max-w-none text-base leading-relaxed text-gray-300"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(editContent) }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-dark-800 border-t border-white/[0.06] flex items-center justify-between">
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <CpuChipIcon className="h-4 w-4" />
                Model: {selectedArticle.extra_data?.model || 'LLM Default'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-lg transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={() => handleSaveEdit('draft')}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/[0.06]"
                >
                  Taslak Olarak Kaydet
                </button>
                {selectedArticle.status !== 'published' ? (
                  <button
                    onClick={() => publishMutation.mutate(selectedArticle.public_id)}
                    disabled={publishMutation.isPending}
                    className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Onayla & Yayınla
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveEdit()}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  >
                    Değişiklikleri Kaydet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

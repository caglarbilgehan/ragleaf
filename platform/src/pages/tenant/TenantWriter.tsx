// platform/src/pages/tenant/TenantWriter.tsx
// AI Writer yönetim sayfası — blog makaleleri üretimi ve yönetimi
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTranslation } from '@/contexts/LanguageContext';
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
  ragleaf: 'Ragleaf Blog',
  nextjs: 'Ragleaf Blog',
  wordpress: 'WordPress',
  ghost: 'Ghost CMS',
};

// Simple Markdown to HTML compiler for preview tab
const renderMarkdown = (content: string | null) => {
  if (!content) return '';
  
  // Normalize literal \n string representations to actual newlines
  const normalizedContent = content.replace(/\\n/g, '\n');
  
  let html = normalizedContent
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-300">$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-white/5 px-1.5 py-0.5 rounded text-sm text-emerald-400 font-mono">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:underline">$1</a>');

  const lines = html.split('\n');
  let inList = false;
  let inNumList = false;
  let inTable = false;
  let inCodeBlock = false;
  let inBlockquote = false;

  const htmlLines = lines.map(line => {
    const trimmed = line.trim();
    
    // 1. Fenced code block check
    if (trimmed.startsWith('```')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }

      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = trimmed.substring(3).trim();
        return `${prefix}<pre class="bg-black/30 p-4 rounded-lg border border-white/5 overflow-x-auto font-mono text-sm my-6 text-emerald-400"><code class="${lang}">`;
      } else {
        inCodeBlock = false;
        return '</code></pre>';
      }
    }

    // If inside a code block, just output raw content encoded/escaped
    if (inCodeBlock) {
      return line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
    }

    // 2. Horizontal rule check
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
      return `${prefix}<hr class="border-t border-white/10 my-6"/>`;
    }

    // 3. Header check
    if (trimmed.startsWith('#')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
      
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const title = trimmed.replace(/^#+\s*/, '');
      if (level === 1) {
        return `${prefix}<h1 class="text-3xl font-extrabold mt-10 mb-6 text-white">${title}</h1>`;
      } else if (level === 2) {
        return `${prefix}<h2 class="text-2xl font-bold mt-8 mb-4 text-white border-b border-white/5 pb-2">${title}</h2>`;
      } else {
        return `${prefix}<h3 class="text-xl font-bold mt-6 mb-3 text-white">${title}</h3>`;
      }
    }

    // 4. Table check
    if (trimmed.startsWith('|')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }

      const isSeparator = /^[|:\s-]+$/.test(trimmed);
      if (isSeparator) {
        return ''; // skip separator lines
      }

      const cells = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      if (!inTable) {
        inTable = true;
        const headerCols = cells.map(c => `<th class="border border-white/10 bg-white/5 px-4 py-2 text-left font-semibold text-white">${c}</th>`).join('');
        return `${prefix}<div class="overflow-x-auto my-6"><table class="min-w-full border-collapse border border-white/10 text-sm"><thead><tr>${headerCols}</tr></thead><tbody>`;
      } else {
        const rowCols = cells.map(c => `<td class="border border-white/10 px-4 py-2 text-gray-300">${c}</td>`).join('');
        return `<tr>${rowCols}</tr>`;
      }
    }

    // 5. Blockquote check
    if (trimmed.startsWith('>')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const quoteContent = trimmed.replace(/^>\s*/, '');
      if (!inBlockquote) {
        inBlockquote = true;
        return `${prefix}<blockquote class="border-l-4 border-primary-500 bg-primary-500/5 px-5 py-3 italic rounded-r-lg my-6 text-gray-300">${quoteContent}`;
      } else {
        return `<br/>${quoteContent}`;
      }
    }

    // Close any open blockquote if current line isn't one
    let closingPrefix = '';
    if (inBlockquote) {
      inBlockquote = false;
      closingPrefix = '</blockquote>';
    }

    // 6. Unordered list check
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      let prefix = closingPrefix;
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const contentStr = trimmed.substring(2);
      if (!inList) {
        inList = true;
        prefix += '<ul class="list-disc pl-6 mb-4 space-y-2 text-gray-300">';
      }
      return `${prefix}<li>${contentStr}</li>`;
    }

    // 7. Numbered list check
    const numListMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numListMatch) {
      let prefix = closingPrefix;
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const contentStr = numListMatch[2];
      if (!inNumList) {
        inNumList = true;
        prefix += '<ol class="list-decimal pl-6 mb-4 space-y-2 text-gray-300">';
      }
      return `${prefix}<li>${contentStr}</li>`;
    }

    // Regular line formatting
    let prefix = closingPrefix;
    if (inList) { inList = false; prefix += '</ul>'; }
    if (inNumList) { inNumList = false; prefix += '</ol>'; }
    if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

    return `${prefix}${line}`;
  });

  // Final cleanup for open tags
  let completedLines = [...htmlLines];
  let finalCleanup = '';
  if (inCodeBlock) finalCleanup += '</code></pre>';
  if (inTable) finalCleanup += '</tbody></table></div>';
  if (inList) finalCleanup += '</ul>';
  if (inNumList) finalCleanup += '</ol>';
  if (inBlockquote) finalCleanup += '</blockquote>';
  if (finalCleanup) {
    completedLines.push(finalCleanup);
  }

  // Group adjacent plain text lines into paragraphs
  let finalHtml: string[] = [];
  let currentParagraph: string[] = [];
  
  completedLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (currentParagraph.length > 0) {
        finalHtml.push(`<p class="mb-4 text-gray-300 leading-relaxed">${currentParagraph.join('<br/>')}</p>`);
        currentParagraph = [];
      }
      return;
    }
    
    const isBlock = 
      trimmed.startsWith('<h') || 
      trimmed.startsWith('<ul') || 
      trimmed.startsWith('</ul') || 
      trimmed.startsWith('<ol') || 
      trimmed.startsWith('</ol') || 
      trimmed.startsWith('<li') || 
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('</blockquote') ||
      trimmed.startsWith('<div') ||
      trimmed.startsWith('</div') ||
      trimmed.startsWith('<table') ||
      trimmed.startsWith('</table') ||
      trimmed.startsWith('<tr') ||
      trimmed.startsWith('</tr') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('</pre') ||
      trimmed.startsWith('<hr');

    if (isBlock) {
      if (currentParagraph.length > 0) {
        finalHtml.push(`<p class="mb-4 text-gray-300 leading-relaxed">${currentParagraph.join('<br/>')}</p>`);
        currentParagraph = [];
      }
      finalHtml.push(line);
    } else {
      currentParagraph.push(line);
    }
  });

  if (currentParagraph.length > 0) {
    finalHtml.push(`<p class="mb-4 text-gray-300 leading-relaxed">${currentParagraph.join('<br/>')}</p>`);
  }

  return finalHtml.join('');
};

export default function TenantWriter() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Modals state
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Loading steps animation during generation
  const [genStep, setGenStep] = useState(0);
  const loadingSteps = [
    t('writer.gen.step_0'),
    t('writer.gen.step_1'),
    t('writer.gen.step_2'),
    t('writer.gen.step_3'),
    t('writer.gen.step_4'),
    t('writer.gen.step_5')
  ];

  // Forms state
  const [topic, setTopic] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [lang, setLang] = useState('tr');
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [mode, setMode] = useState<'autonomous' | 'semi-autonomous'>('autonomous');
  const [platform, setPlatform] = useState<'ragleaf' | 'wordpress' | 'ghost'>('ragleaf');

  // Selected article for editing
  const [selectedArticle, setSelectedArticle] = useState<WriterArticle | null>(null);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editOutline, setEditOutline] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState<string>('');
  
  useEffect(() => {
    if (window.location.pathname.endsWith('/automations')) {
      setStatusFilter('scheduled');
    } else {
      setStatusFilter('');
    }
  }, [window.location.pathname]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (prefix: string, suffix: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = selectedText ? (prefix + selectedText + suffix) : (prefix + placeholder + suffix);

    setEditContent(text.substring(0, start) + replacement + text.substring(end));

    // Refocus and set selection range
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + (selectedText ? selectedText.length : placeholder.length) + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Queries
  const { data: articles = [], isLoading } = useQuery<WriterArticle[]>({
    queryKey: ['writer-articles', statusFilter === 'scheduled' ? '' : statusFilter],
    queryFn: () => writerApi.list((statusFilter && statusFilter !== 'scheduled') ? { status: statusFilter } : undefined),
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
      if (!selectedAgentId) {
        toast.error(language === 'tr' ? 'Lütfen bir yazar asistanı (kimliği) seçin.' : 'Please select a writer agent (identity).');
        throw new Error('Agent required');
      }
      const keywords = keywordsInput
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      return writerApi.generate({
        topic,
        keywords,
        language: lang,
        agent_id: Number(selectedAgentId),
        mode,
        publishing_platform: platform,
      });
    },
    onSuccess: (newArticle) => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success(t('writer.toast.gen_success'));
      setIsGenModalOpen(false);
      // Reset form
      setTopic('');
      setKeywordsInput('');
      setGenStep(0);
      // Open editor directly for preview
      handleOpenEdit(newArticle);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('writer.toast.gen_error'));
      setGenStep(0);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ publicId, data }: { publicId: string; data: any }) =>
      writerApi.update(publicId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success(t('writer.toast.update_success'));
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('writer.toast.update_error'));
    },
  });

  const publishMutation = useMutation({
    mutationFn: (publicId: string) => writerApi.publish(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success(t('writer.toast.publish_success'));
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('writer.toast.publish_error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (publicId: string) => writerApi.delete(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-articles'] });
      toast.success(t('writer.toast.delete_success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('writer.toast.delete_error'));
    },
  });

  // Group articles by translation_group_id
  const filteredArticles = articles.filter(art => {
    if (statusFilter === 'scheduled') {
      return art.scheduled_at !== null && art.status !== 'published';
    }
    return true;
  });

  const groupedArticles = filteredArticles.reduce((acc: any[], article) => {
    if (article.translation_group_id) {
      const existing = acc.find(g => g.translation_group_id === article.translation_group_id);
      if (existing) {
        existing.translations.push(article);
        if (article.language === language || (!existing.primary && article.language === 'tr')) {
          existing.primary = article;
        }
      } else {
        acc.push({
          translation_group_id: article.translation_group_id,
          primary: article,
          translations: [article]
        });
      }
    } else {
      acc.push({
        translation_group_id: null,
        primary: article,
        translations: [article]
      });
    }
    return acc;
  }, []);

  // Stats calculation
  const stats = {
    total: groupedArticles.length,
    pending: groupedArticles.filter(g => g.primary.status === 'pending_review').length,
    draft: groupedArticles.filter(g => g.primary.status === 'draft').length,
    published: groupedArticles.filter(g => g.primary.status === 'published').length,
  };

  const handleOpenEdit = (article: WriterArticle) => {
    setSelectedArticle(article);
    setEditTitle(article.title);
    setEditSlug(article.slug);
    setEditSummary(article.summary || '');
    setEditContent(article.content || '');
    setEditKeywords(article.keywords ? article.keywords.join(', ') : '');
    setEditOutline(article.outline ? article.outline.join('\n') : '');
    setEditScheduledAt(article.scheduled_at ? new Date(article.scheduled_at).toISOString().substring(0, 16) : '');
    setEditorTab('edit');
    setIsEditModalOpen(true);
  };

  const handleSwitchLanguage = (newArticle: WriterArticle) => {
    setSelectedArticle(newArticle);
    setEditTitle(newArticle.title);
    setEditSlug(newArticle.slug);
    setEditSummary(newArticle.summary || '');
    setEditContent(newArticle.content || '');
    setEditKeywords(newArticle.keywords ? newArticle.keywords.join(', ') : '');
    setEditOutline(newArticle.outline ? newArticle.outline.join('\n') : '');
    setEditScheduledAt(newArticle.scheduled_at ? new Date(newArticle.scheduled_at).toISOString().substring(0, 16) : '');
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
      scheduled_at: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
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
    return d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
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
            <span className="text-primary-500">AI</span>writer / {language === 'tr' ? 'Makaleler' : 'Articles'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('writer.subtitle')}
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
          {t('writer.btn_new_article')}
        </button>
      </div>

      {/* Analytics Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('writer.stat_total'), value: stats.total, color: 'bg-dark-800 border-white/[0.06]' },
          { label: t('writer.stat_pending'), value: stats.pending, color: 'border-amber-500/20 bg-amber-500/[0.02] text-amber-400' },
          { label: t('writer.stat_draft'), value: stats.draft, color: 'bg-dark-800 border-white/[0.06] text-gray-400' },
          { label: t('writer.stat_published'), value: stats.published, color: 'border-green-500/20 bg-green-500/[0.02] text-green-400' },
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
          <label className="text-xs text-gray-400 font-medium">{t('writer.filter_status')}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">{t('writer.filter_all')}</option>
            <option value="draft">{t('writer.status.draft')}</option>
            <option value="pending_review">{t('writer.status.pending_review')}</option>
            <option value="approved">{t('writer.status.approved')}</option>
            <option value="published">{t('writer.status.published')}</option>
            <option value="scheduled">{language === 'tr' ? 'Zamanlanmış' : 'Scheduled'}</option>
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
          <h3 className="text-lg font-medium text-gray-100">{t('writer.no_articles')}</h3>
          <p className="text-gray-500 mt-1">
            {t('writer.no_articles_desc')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupedArticles.map((group) => {
            const art = group.primary;
            const statusInfo = STATUS_LABELS[art.status] || STATUS_LABELS.draft;
            return (
              <div
                key={art.public_id}
                className="bg-dark-800/50 rounded-2xl border border-white/[0.06] p-6 flex flex-col justify-between hover:border-primary-500/30 transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                      {t('writer.status.' + art.status) || statusInfo.label}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(art.created_at)}</span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-100 leading-snug mb-2 group-hover:text-white line-clamp-2">
                    {art.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-3 mb-4">
                    {art.summary || t('writer.summary_none')}
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

                  {/* Language indicators */}
                  {group.translations.length > 1 && (
                    <div className="flex gap-1.5 mb-4">
                      {group.translations.map(t => (
                        <span key={t.id} className="text-[10px] px-2.5 py-1 rounded bg-primary-500/10 text-primary-400 font-semibold flex items-center gap-1 border border-primary-500/10">
                          {t.language === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}
                        </span>
                      ))}
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
                      title={t('writer.btn_inspect_edit')}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t('writer.confirm_delete_group'))) {
                          group.translations.forEach(t => deleteMutation.mutate(t.public_id));
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      title={t('ui.delete')}
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
          
          <div className="relative w-full max-w-3xl bg-dark-800 rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl">
            {generateMutation.isPending ? (
              /* Generation Loading State */
              <div className="p-10 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-primary-500 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-white/5 border-b-emerald-400 animate-spin [animation-duration:3s]" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">✍️</div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">{t('writer.gen.loading_title')}</h3>
                  <p className="text-sm text-gray-400 transition-all duration-500 animate-pulse">
                    {loadingSteps[genStep]}
                  </p>
                  <p className="text-[11px] text-gray-500">{t('writer.gen.loading_hint')}</p>
                </div>
              </div>
            ) : (
              /* Generation Form State */
              <>
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-dark-800">
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    <SparklesIcon className="h-5 w-5 text-primary-400" />
                    {t('writer.gen.modal_title')}
                  </h3>
                  <button
                    onClick={() => setIsGenModalOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Topic */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                      {t('writer.gen.topic_label')}
                    </label>
                    <input
                      type="text"
                      required
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={t('writer.gen.topic_placeholder')}
                      className="w-full px-4 py-2.5 text-sm border border-white/[0.1] bg-dark-900 text-gray-100 placeholder:text-gray-500 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                    />
                  </div>

                  {/* Keywords */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                      {t('writer.gen.keywords_label')}
                    </label>
                    <input
                      type="text"
                      value={keywordsInput}
                      onChange={(e) => setKeywordsInput(e.target.value)}
                      placeholder={t('writer.gen.keywords_placeholder')}
                      className="w-full px-4 py-2.5 text-sm border border-white/[0.1] bg-dark-900 text-gray-100 placeholder:text-gray-500 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Multilingual Info Box */}
                    <div className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-3.5 flex items-start gap-3">
                      <span className="text-xl">🌐</span>
                      <div className="text-xs text-gray-400">
                        <p className="font-bold text-gray-200 mb-1">{t('writer.gen.multi_lang_active')}</p>
                        {t('writer.gen.multi_lang_desc')}
                      </div>
                    </div>

                    {/* Agent selection */}
                    <div className="flex flex-col justify-between">
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">{t('writer.gen.agent_label')}</label>
                      <select
                        value={selectedAgentId}
                        onChange={(e) => setSelectedAgentId(e.target.value ? Number(e.target.value) : '')}
                        required
                        className="w-full px-4 py-2.5 text-sm border border-white/[0.1] bg-dark-900 text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                      >
                        <option value="">{language === 'tr' ? 'Lütfen Yazar Kimliği Seçin (Zorunlu)...' : 'Please Select a Writer Identity (Required)...'}</option>
                        {agents.map(ag => (
                          <option key={ag.id} value={ag.id}>{ag.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mode Selector Cards */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">{t('writer.gen.mode_label')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => setMode('semi-autonomous')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          mode === 'semi-autonomous'
                            ? 'border-primary-500 bg-primary-500/[0.03] shadow-[0_0_15px_rgba(34,197,94,0.05)]'
                            : 'border-white/[0.06] bg-dark-900/50 hover:bg-dark-900/80 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-gray-200">{t('writer.gen.mode_semi')}</span>
                          <span className="text-sm">📝</span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          {t('writer.gen.mode_semi_desc')}
                        </p>
                      </div>

                      <div
                        onClick={() => setMode('autonomous')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          mode === 'autonomous'
                            ? 'border-emerald-500 bg-emerald-500/[0.03] shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                            : 'border-white/[0.06] bg-dark-900/50 hover:bg-dark-900/80 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-gray-200">{t('writer.gen.mode_auto')}</span>
                          <span className="text-sm">⚡</span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          {t('writer.gen.mode_auto_desc')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Publishing Platform Selector Cards */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">{t('writer.gen.platform_label')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'ragleaf', name: 'Ragleaf Blog', desc: t('writer.gen.plat_ragleaf_desc'), icon: '🍃' },
                        { key: 'wordpress', name: 'WordPress', desc: t('writer.gen.plat_wp_desc'), icon: '📝' },
                        { key: 'ghost', name: 'Ghost CMS', desc: t('writer.gen.plat_ghost_desc'), icon: '👻' }
                      ].map(plat => (
                        <div
                          key={plat.key}
                          onClick={() => setPlatform(plat.key as any)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                            platform === plat.key
                              ? 'border-primary-500 bg-primary-500/[0.03] shadow-[0_0_15px_rgba(34,197,94,0.05)]'
                              : 'border-white/[0.06] bg-dark-900/50 hover:bg-dark-900/80 text-gray-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-gray-200">{plat.name}</span>
                            <span className="text-xs">{plat.icon}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-snug">
                            {plat.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-dark-900/40 border-t border-white/[0.06] flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsGenModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    {t('ui.cancel')}
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedAgentId) {
                        toast.error(language === 'tr' ? 'Lütfen bir yazar asistanı (kimliği) seçin.' : 'Please select a writer agent (identity).');
                        return;
                      }
                      generateMutation.mutate();
                    }}
                    disabled={!topic || !selectedAgentId || generateMutation.isPending}
                    className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {t('writer.gen.btn_generate')}
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
                    {t('writer.edit.modal_title')}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t('writer.edit.modal_subtitle')}
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
                    {t('writer.edit.tab_edit')}
                  </button>
                  <button
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      editorTab === 'preview' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('writer.edit.tab_preview')}
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

            {/* Language Switcher Tabs for Multilingual articles */}
            {selectedArticle.translation_group_id && (
              <div className="px-6 py-2.5 border-b border-white/[0.06] bg-dark-900/30 flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('writer.edit.lang_selection')}</span>
                {articles
                  .filter(a => a.translation_group_id === selectedArticle.translation_group_id)
                  .map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSwitchLanguage(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        selectedArticle.language === t.language
                          ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-[0_0_10px_rgba(34,197,94,0.05)]'
                          : 'bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent'
                      }`}
                    >
                      {t.language === 'tr' ? '🇹🇷 Türkçe' : '🇬🇧 English'}
                    </button>
                  ))
                }
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex bg-dark-900/20">
              {editorTab === 'edit' ? (
                /* Editor Form */
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Title */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">{t('writer.edit.title_label')}</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Slug */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">{t('writer.edit.slug_label')}</label>
                      <input
                        type="text"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Scheduled At */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        {language === 'tr' ? 'Yayınlanma Zamanı (Otomatik Zamanlama)' : 'Publication Schedule (Auto Publish)'}
                      </label>
                      <input
                        type="datetime-local"
                        value={editScheduledAt}
                        onChange={(e) => setEditScheduledAt(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Summary */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">{t('writer.edit.summary_label')}</label>
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
                        <label className="block text-xs font-semibold text-gray-300 mb-1">{t('writer.edit.keywords_label')}</label>
                        <input
                          type="text"
                          value={editKeywords}
                          onChange={(e) => setEditKeywords(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-white/[0.1] bg-dark-700/50 text-gray-100 rounded-lg focus:ring-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">{t('writer.edit.outline_label')}</label>
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <label className="block text-xs font-semibold text-gray-300">{t('writer.edit.content_label')}</label>
                      
                      {/* Markdown Toolbar */}
                      <div className="flex flex-wrap items-center gap-1 bg-white/[0.02] border border-white/[0.06] p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => insertMarkdown('**', '**', 'Kalın Yazı')}
                          className="px-2 py-0.5 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Kalın (Bold)"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('*', '*', 'Eğik Yazı')}
                          className="px-2 py-0.5 text-xs italic text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Eğik (Italic)"
                        >
                          I
                        </button>
                        <span className="w-[1px] h-3 bg-white/10 mx-0.5" />
                        <button
                          type="button"
                          onClick={() => insertMarkdown('# ', '', 'Başlık 1')}
                          className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Başlık 1"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('## ', '', 'Başlık 2')}
                          className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Başlık 2"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('### ', '', 'Başlık 3')}
                          className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Başlık 3"
                        >
                          H3
                        </button>
                        <span className="w-[1px] h-3 bg-white/10 mx-0.5" />
                        <button
                          type="button"
                          onClick={() => insertMarkdown('- ', '', 'Liste öğesi')}
                          className="px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Liste"
                        >
                          • Liste
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('> ', '', 'Alıntı')}
                          className="px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Alıntı"
                        >
                          ” Alıntı
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('`', '`', 'kod')}
                          className="px-1.5 py-0.5 text-[10px] font-mono text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Kod Bloğu"
                        >
                          &lt;/&gt;
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('[', '](url)', 'Bağlantı Metni')}
                          className="px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Link Ekle"
                        >
                          🔗 Link
                        </button>
                      </div>
                    </div>
                    <textarea
                      ref={textareaRef}
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
                        <span>{t('writer.edit.created_at')} {formatDate(selectedArticle.created_at)}</span>
                        <span>•</span>
                        <span>Platform: {PLATFORM_LABELS[selectedArticle.publishing_platform] || selectedArticle.publishing_platform}</span>
                      </div>
                    </header>

                    {editSummary && (
                      <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-xl text-sm italic text-gray-400 mb-6 leading-relaxed">
                        <strong>{t('writer.edit.seo_summary')}</strong> {editSummary}
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
                  {t('ui.cancel')}
                </button>
                <button
                  onClick={() => handleSaveEdit('draft')}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/[0.06]"
                >
                  {t('writer.edit.btn_save_draft')}
                </button>
                {selectedArticle.status !== 'published' ? (
                  <button
                    onClick={() => publishMutation.mutate(selectedArticle.public_id)}
                    disabled={publishMutation.isPending}
                    className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    {t('writer.edit.btn_approve_publish')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveEdit()}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  >
                    {t('writer.edit.btn_save_changes')}
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

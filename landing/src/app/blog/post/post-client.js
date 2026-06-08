"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLang } from '../../../context/LangContext';
import PageLayout from '../../../components/PageLayout';
import { getApiBaseUrl } from '../../../utils/api';

function BlogPostContent() {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  
  let slug = searchParams.get('slug');
  if (!slug && typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/');
    if (parts.length >= 3 && parts[1] === 'blog' && parts[2] !== 'post') {
      slug = parts[2];
    }
  }

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('No slug provided');
      return;
    }

    setLoading(true);
    setError(null);

    const fetchArticle = async () => {
      const apiBase = getApiBaseUrl();

      try {
        const response = await fetch(`${apiBase}/api/public/blog/ragleaf-platform?lang=${lang}`);
        if (!response.ok) {
          throw new Error('Failed to fetch article');
        }
        const data = await response.json();
        let found = data.find(art => art.slug === slug);
        
        // Fallback: If not found in current language, check the other language
        if (!found) {
          const otherLang = lang === 'tr' ? 'en' : 'tr';
          const otherResponse = await fetch(`${apiBase}/api/public/blog/ragleaf-platform?lang=${otherLang}`);
          if (otherResponse.ok) {
            const otherData = await otherResponse.json();
            found = otherData.find(art => art.slug === slug);
          }
        }

        if (!found) {
          throw new Error('Article not found');
        }
        setArticle(found);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug, lang]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderMarkdown = (content) => {
    if (!content) return '';
    
    // Normalize literal \n string representations to actual newlines
    const normalizedContent = content.replace(/\\n/g, '\n');
    
    let html = normalizedContent
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

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
        if (inTable) { inTable = false; prefix += '</table></div>'; }
        if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }

        if (!inCodeBlock) {
          inCodeBlock = true;
          const lang = trimmed.substring(3).trim();
          return `${prefix}<pre class="bg-white/5 p-4 rounded-lg border border-white/5 overflow-x-auto font-mono text-sm my-6 text-emerald-400"><code class="${lang}">`;
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
        if (inTable) { inTable = false; prefix += '</table></div>'; }
        if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
        return `${prefix}<hr class="border-t border-white/10 my-6"/>`;
      }

      // 3. Header check
      if (trimmed.startsWith('#')) {
        let prefix = '';
        if (inList) { inList = false; prefix += '</ul>'; }
        if (inNumList) { inNumList = false; prefix += '</ol>'; }
        if (inTable) { inTable = false; prefix += '</table></div>'; }
        if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
        
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const title = trimmed.replace(/^#+\s*/, '');
        if (level === 1) {
          return `${prefix}<h1>${title}</h1>`;
        } else if (level === 2) {
          return `${prefix}<h2>${title}</h2>`;
        } else {
          return `${prefix}<h3>${title}</h3>`;
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
          const headerCols = cells.map(c => `<th class="bg-white/5 border border-white/10 p-3 text-left font-bold text-white">${c}</th>`).join('');
          return `${prefix}<div class="overflow-x-auto my-6"><table class="w-full border-collapse border border-white/10 text-sm"><thead><tr>${headerCols}</tr></thead><tbody>`;
        } else {
          const rowCols = cells.map(c => `<td class="border border-white/10 p-3 text-left text-text-secondary">${c}</td>`).join('');
          return `<tr>${rowCols}</tr>`;
        }
      }

      // 5. Blockquote check
      if (trimmed.startsWith('>')) {
        let prefix = '';
        if (inList) { inList = false; prefix += '</ul>'; }
        if (inNumList) { inNumList = false; prefix += '</ol>'; }
        if (inTable) { inTable = false; prefix += '</table></div>'; }

        const quoteContent = trimmed.replace(/^>\s*/, '');
        if (!inBlockquote) {
          inBlockquote = true;
          return `${prefix}<blockquote>${quoteContent}`;
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
        if (inTable) { inTable = false; prefix += '</table></div>'; }

        const contentStr = trimmed.substring(2);
        if (!inList) {
          inList = true;
          prefix += '<ul>';
        }
        return `${prefix}<li>${contentStr}</li>`;
      }

      // 7. Numbered list check
      const numListMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numListMatch) {
        let prefix = closingPrefix;
        if (inList) { inList = false; prefix += '</ul>'; }
        if (inTable) { inTable = false; prefix += '</table></div>'; }

        const contentStr = numListMatch[2];
        if (!inNumList) {
          inNumList = true;
          prefix += '<ol>';
        }
        return `${prefix}<li>${contentStr}</li>`;
      }

      // Regular line formatting
      let prefix = closingPrefix;
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</table></div>'; }

      return `${prefix}${line}`;
    });

    // Final cleanup for open tags
    let completedLines = [...htmlLines];
    let finalCleanup = '';
    if (inCodeBlock) finalCleanup += '</code></pre>';
    if (inTable) finalCleanup += '</table></div>';
    if (inList) finalCleanup += '</ul>';
    if (inNumList) finalCleanup += '</ol>';
    if (inBlockquote) finalCleanup += '</blockquote>';
    if (finalCleanup) {
      completedLines.push(finalCleanup);
    }

    // Group adjacent plain text lines into paragraphs
    let finalHtml = [];
    let currentParagraph = [];
    
    completedLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed === '') {
        if (currentParagraph.length > 0) {
          finalHtml.push(`<p>${currentParagraph.join('<br/>')}</p>`);
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
          finalHtml.push(`<p>${currentParagraph.join('<br/>')}</p>`);
          currentParagraph = [];
        }
        finalHtml.push(line);
      } else {
        currentParagraph.push(line);
      }
    });

    if (currentParagraph.length > 0) {
      finalHtml.push(`<p>${currentParagraph.join('<br/>')}</p>`);
    }

    return finalHtml.join('\n');
  };

  return (
    <PageLayout>
      <div className="max-w-[800px] mx-auto px-6 pb-24 pt-12">
        <Link href="/blog" className="inline-flex items-center gap-2 text-text-secondary no-underline font-medium text-[15px] mb-8 transition-colors duration-300 hover:text-accent">
          ← {lang === 'tr' ? 'Tüm Makalelere Dön' : 'Back to All Articles'}
        </Link>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="border-4 border-white/10 rounded-full border-t-4 border-t-accent w-10 h-10 animate-spin mb-4"></div>
            <p>{lang === 'tr' ? 'Makale yükleniyor...' : 'Loading article...'}</p>
          </div>
        ) : error ? (
          <div className="text-center py-24 px-5 [&_h2]:font-['Outfit'] [&_h2]:mb-4">
            <h2>{lang === 'tr' ? 'Makale Bulunamadı' : 'Article Not Found'}</h2>
            <p>{lang === 'tr' ? 'Aradığınız blog yazısı mevcut değil veya yayından kaldırılmış.' : 'The article you are looking for does not exist or has been unpublished.'}</p>
            <Link href="/blog" style={{ color: 'var(--accent)', marginTop: '20px', display: 'inline-block' }}>
              {lang === 'tr' ? 'Blog Anasayfasına Git' : 'Go to Blog Home'}
            </Link>
          </div>
        ) : (
          <article>
            <header className="mb-10">
              <span className="text-accent font-semibold text-[13px] uppercase tracking-wider mb-4 block">
                ✨ {article.keywords && article.keywords[0] ? article.keywords[0] : 'RAG'}
              </span>
              <h1 className="font-['Outfit'] text-[44px] max-md:text-[32px] font-extrabold leading-tight text-text-primary mb-5 tracking-tight">{article.title}</h1>
              <div className="text-[15px] text-text-secondary flex items-center gap-4 border-b border-border-custom pb-6">
                <span>{formatDate(article.published_at)}</span>
                <span>•</span>
                <span>{lang === 'tr' ? 'Okuma Süresi: ~5 dk' : 'Reading Time: ~5 min'}</span>
              </div>
            </header>

            <div 
              className="text-[17px] leading-relaxed text-text-primary [&_p]:mb-6 [&_p]:opacity-90 [&_h2]:font-['Outfit'] [&_h2]:text-[28px] max-md:[&_h2]:text-[24px] [&_h2]:font-bold [&_h2]:mt-12 [&_h2]:mb-5 [&_h2]:text-white [&_h2]:tracking-tight [&_h3]:font-['Outfit'] [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:mt-9 [&_h3]:mb-4 [&_h3]:text-white [&_ul]:mb-6 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:mb-2 [&_li]:opacity-90 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-accent/3 [&_blockquote]:p-5 [&_blockquote]:px-6 [&_blockquote]:rounded-r-2xl [&_blockquote]:italic [&_blockquote]:my-8 [&_blockquote]:opacity-95 [&_code]:bg-white/5 [&_code]:p-1 [&_code]:px-1.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-emerald-400"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
            />
          </article>
        )}
      </div>
    </PageLayout>
  );
}

export default function BlogPostClient() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    }>
      <BlogPostContent />
    </Suspense>
  );
}

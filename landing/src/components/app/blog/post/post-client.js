"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLang } from '../../../context/LangContext';
import PageLayout from '../../../components/PageLayout';

function BlogPostContent() {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('No slug provided');
      return;
    }

    const fetchArticle = async () => {
      // Determine backend base url
      let apiBase = 'http://localhost:1306';
      if (typeof window !== 'undefined' && window.location.origin.includes('ragleaf.com')) {
        apiBase = 'https://api.ragleaf.com';
      }

      try {
        const response = await fetch(`${apiBase}/api/public/blog/ragleaf-platform?lang=${lang}`);
        if (!response.ok) {
          throw new Error('Failed to fetch article');
        }
        const data = await response.json();
        const found = data.find(art => art.slug === slug);
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
    
    // Simple markdown helper
    let html = content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Parse list items
    const lines = html.split('\n');
    let inList = false;
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        let prefix = '';
        if (!inList) {
          inList = true;
          prefix = '<ul>';
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

    // Split into paragraphs
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
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    });

    return formatted.join('');
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

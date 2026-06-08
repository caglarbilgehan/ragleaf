"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';
import { getApiBaseUrl } from '../../utils/api';

export default function BlogClient() {
  const { lang } = useLang();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArticles = async () => {
      const apiBase = getApiBaseUrl();

      try {
        const response = await fetch(`${apiBase}/api/public/blog/ragleaf-platform?lang=${lang}`);
        if (!response.ok) {
          throw new Error('Failed to fetch blog posts');
        }
        const data = await response.json();
        setArticles(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [lang]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <PageLayout>
      {/* HERO */}
      <div className="relative text-center px-5 pb-16 pt-8 max-w-[800px] mx-auto overflow-hidden border-b border-white/10">
        <div className="hero-glow" style={{ top: '-200px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            {lang === 'tr' ? 'Teknik İçerikler' : 'Technical Content'}
          </span>
          <h1 className="font-['Outfit'] text-[56px] max-md:text-[38px] font-black tracking-tight mb-6 leading-tight">
            {lang === 'tr' ? (
              <>Ragleaf <span className="gradient-text">Blog</span></>
            ) : (
              <>Ragleaf <span className="gradient-text">Blog</span></>
            )}
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed max-w-xl mx-auto">
            {lang === 'tr' 
              ? 'Yapay zeka, Retrieval-Augmented Generation (RAG) technologies, bilgi yönetimi ve akıllı asistanlar hakkında teknik makaleler ve rehberler.' 
              : 'Technical articles and guides on artificial intelligence, Retrieval-Augmented Generation (RAG) technologies, and intelligent assistants.'}
          </p>
        </div>
      </div>

      {/* ARTICLES */}
      <div className="max-w-[1200px] mx-auto px-6 pb-24 mt-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px]">
            <div className="border-4 border-white/10 rounded-full border-t-4 border-t-accent w-10 h-10 animate-spin mb-4"></div>
            <p className="text-text-secondary text-sm">{lang === 'tr' ? 'Makaleler yükleniyor...' : 'Loading articles...'}</p>
          </div>
        ) : error ? (
          <div className="text-center p-14 px-5 bg-white/[0.02] border border-dashed border-border-custom rounded-3xl text-text-secondary backdrop-blur-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="font-['Outfit'] text-xl font-bold text-text-primary mb-3">{lang === 'tr' ? 'Bir Hata Oluştu' : 'An Error Occurred'}</h3>
            <p className="text-sm text-text-secondary max-w-md mx-auto">{lang === 'tr' ? 'Makaleler yüklenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.' : 'We encountered a problem loading the articles. Please try again later.'}</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center p-14 px-5 bg-white/[0.02] border border-dashed border-border-custom rounded-3xl text-text-secondary backdrop-blur-md">
            <div className="text-5xl mb-5">✍️</div>
            <h3 className="font-['Outfit'] text-2xl font-bold text-text-primary mb-3">{lang === 'tr' ? 'Henüz Makale Yayınlanmadı' : 'No Articles Published Yet'}</h3>
            <p className="text-sm text-text-secondary max-w-md mx-auto">{lang === 'tr' ? 'Bu alanda yakında çok güzel yazılar yayınlanacak. Takipte kalın!' : 'Exciting articles will be published here soon. Stay tuned!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-10">
            {articles.map((article) => (
              <a key={article.public_id} href={`/blog/${article.slug}`} className="group bg-white/[0.02] border border-border-custom rounded-3xl p-10 backdrop-blur-md transition-all duration-300 flex flex-col justify-between h-full hover:-translate-y-2 hover:border-accent/30 hover:bg-white/[0.03] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_30px_rgba(16,185,129,0.05)] no-underline">
                <div>
                  <div className="text-[13px] text-accent font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span>✨ {article.keywords && article.keywords[0] ? article.keywords[0] : 'RAG'}</span>
                  </div>
                  <h2 className="font-['Outfit'] text-2xl font-bold leading-snug mb-3.5 text-text-primary transition-colors duration-300 group-hover:text-white">{article.title}</h2>
                  <p className="text-[15px] text-text-secondary leading-relaxed mb-6 flex-grow line-clamp-3">{article.summary}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-text-secondary border-t border-white/5 pt-5 mt-auto">
                  <span>{formatDate(article.published_at)}</span>
                  <span className="text-accent font-semibold flex items-center gap-1.5 transition-all duration-300 group-hover:gap-2.5">
                    {lang === 'tr' ? 'Devamını Oku' : 'Read More'} →
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

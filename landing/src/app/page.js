"use client";

import React from 'react';
import { useLang } from '../context/LangContext';
import { useUI } from '../context/UIContext';
import PageLayout from '../components/PageLayout';

export default function Home() {
  const { lang, t } = useLang();
  const { openSignup, setHowItWorksOpen } = useUI();

  return (
    <PageLayout>
      <section className="hero">
        <div className="hero-glow"></div>
      <div className="container hero-container">
        <div className="hero-row">
          {/* Left Column: Copy & Highlights */}
          <div className="hero-text-col">
            <h1 dangerouslySetInnerHTML={{ __html: t('hero_h1') }} />
            <p>{t('hero_p')}</p>

            <div className="hero-doc-highlight">
              <div className="hero-doc-highlight-text">
                <strong>{t('hero_doc_title')?.toLocaleUpperCase(lang)}</strong>
                <span>{t('hero_doc_desc')}</span>
              </div>
            </div>

            <div className="hero-rag-highlight">
              <div className="hero-rag-highlight-text">
                <strong>{t('rag_cta_title')?.toLocaleUpperCase(lang)}</strong>
                <span>{t('rag_cta_desc')}</span>
              </div>
            </div>

            <div className="hero-leaves-highlight">
              <div className="hero-leaves-highlight-text">
                <strong>{t('leaves_cta_title')?.toLocaleUpperCase(lang)}</strong>
                <span>{t('leaves_cta_desc')}</span>
              </div>
            </div>

            <div className="hero-buttons">
              <button 
                onClick={() => openSignup()} 
                className="btn btn-primary btn-lg-hero"
                style={{ cursor: 'pointer' }}
              >
                {t('hero_btn1')}
              </button>
              <button 
                onClick={() => setHowItWorksOpen(true)} 
                className="btn btn-ghost btn-lg-hero desktop-only"
                style={{ cursor: 'pointer' }}
              >
                {t('hero_btn2')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </PageLayout>
  );
}

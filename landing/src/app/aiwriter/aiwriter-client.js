"use client";

import React, { useState } from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';

export default function AIWriterClient() {
  const { lang } = useLang();
  
  // Interactive preview state
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: lang === 'tr' ? '1. Trend & Anahtar Kelime Analizi' : '1. Trend & Keyword Analysis',
      desc: lang === 'tr' 
        ? 'AIwriter, sektörünüzdeki Google arama trendlerini ve en iyi anahtar kelimeleri tespit eder.'
        : 'AIwriter identifies search trends and optimal SEO keywords relevant to your industry.',
      details: lang === 'tr' 
        ? 'Arama hacimleri, zorluk dereceleri ve rakip analizleri ile en doğru başlıklar otomatik belirlenir.'
        : 'Google Search volumes, difficulties, and competitor analysis are automated to select themes.'
    },
    {
      title: lang === 'tr' ? '2. Çok Dilli Taslak Yazımı' : '2. Multi-Language Draft Generation',
      desc: lang === 'tr' 
        ? 'Tek bir taslaktan Türkçe, İngilizce veya Almanca gibi farklı dil varyasyonları eş zamanlı üretilir.'
        : 'Generate localized drafts in Turkish, English, German, or other tongues concurrently.',
      details: lang === 'tr'
        ? 'Her dil varyasyonu çeviri kokmaz; ilgili dildeki SEO kurallarına ve kültürel terimlere göre baştan yazılır.'
        : 'Each variant is written from scratch targeting native SEO structures instead of literal translation.'
    },
    {
      title: lang === 'tr' ? '3. İnsan Onayı & Revizyon' : '3. Editor Review & Human-in-the-Loop',
      desc: lang === 'tr' 
        ? 'Yazılar doğrudan yayına alınmadan önce editör panelinizde taslak olarak onayınızı bekler.'
        : 'Articles wait in your dashboard as drafts for editor verification before going live.',
      details: lang === 'tr'
        ? 'Tek tıkla başlıkları güncelleyebilir, paragrafları düzenleyebilir veya yapay zekadan yeni bir revizyon isteyebilirsiniz.'
        : 'Edit headers, rewrite sentences, or prompt the AI for adjustments with direct inline controls.'
    },
    {
      title: lang === 'tr' ? '4. Otomatik Yayınlama & CMS Entegrasyonu' : '4. Automated Sync & CMS Integration',
      desc: lang === 'tr' 
        ? 'Onaylanan yazılar belirlediğiniz içerik takvimine göre sitenizde otomatik yayınlanır.'
        : 'Approved articles publish automatically to your website via scheduled publishing calendars.',
      details: lang === 'tr'
        ? 'WordPress, Ghost, Next.js veya diğer popüler CMS altyapılarınızla entegre olarak içeriklerinizi saniyeler içinde yayına alır.'
        : 'Integrate with WordPress, Ghost, Next.js, or other popular CMS systems to push your content live in seconds.'
    }
  ];

  return (
    <PageLayout className="min-h-screen" container={false}>
      {/* Hero Header */}
      <div className="relative text-center px-5 pb-10 pt-16 max-w-[900px] mx-auto overflow-hidden">
        <div className="hero-glow" style={{ top: '-150px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            ✍️ AIwriter
          </span>
          <h1 className="font-['Outfit'] text-[50px] max-md:text-[34px] font-black tracking-tight mb-4 leading-tight">
            {lang === 'tr' ? (
              <>Kişiselleştirilmiş AI <span className="gradient-text">İçerik</span> Üreticisi</>
            ) : (
              <>Autonomous AI <span className="gradient-text">Content</span> Creator</>
            )}
          </h1>
          <p className="text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            {lang === 'tr'
              ? 'Asistanınızın kimliği, kişiliği ve ses tonuyla eşleşen blog yazıları, raporlar, taslaklar, sosyal medya gönderileri ve her türlü yazılı içeriği otonom olarak üreten yapay zeka robotu.'
              : 'The autonomous content engine that drafts customized reports, social media posts, localized articles, and documents matching your AI assistant’s unique identity and brand voice.'}
          </p>
        </div>
      </div>

      {/* Pipeline Visual Container */}
      <div className="container" style={{ paddingBottom: '80px', position: 'relative', zIndex: 2 }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-10 items-center">
          
          {/* Left: Step selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
              {lang === 'tr' ? 'Otonom Yayınlama Akışı' : 'Autonomous Publishing Pipeline'}
            </h3>
            {steps.map((step, index) => (
              <div
                key={index}
                onClick={() => setActiveStep(index)}
                style={{
                  background: activeStep === index ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.01)',
                  border: '1px solid',
                  borderColor: activeStep === index ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: activeStep === index ? 'var(--accent)' : '#ffffff', marginBottom: '6px' }}>
                  {step.title}
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0, lineHeight: '1.4' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
 
          {/* Right: Step detailed preview card */}
          <div 
            style={{ 
              background: 'rgba(10, 10, 15, 0.5)', 
              border: '1px solid rgba(34, 197, 94, 0.15)', 
              borderRadius: '24px', 
              minHeight: '320px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            className="p-6 md:p-10"
          >
            {/* Visual background badge */}
            <div style={{ position: 'absolute', top: '24px', right: '32px', fontSize: '3rem', opacity: 0.1 }} className="hidden sm:block">
              {activeStep === 0 ? '🔍' : activeStep === 1 ? '🌐' : activeStep === 2 ? '👨‍💻' : '⚡'}
            </div>
 
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', trackingWidth: '0.1em', marginBottom: '8px', display: 'block' }}>
              {lang === 'tr' ? 'Detaylı İnceleme' : 'Deep Dive'}
            </span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ffffff', marginBottom: '16px' }}>
              {steps[activeStep].title}
            </h3>
            <p style={{ color: '#d1d5db', fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px' }}>
              {steps[activeStep].details}
            </p>
            
            {/* Action hint */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping flex-shrink-0"></span>
              <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>
                {lang === 'tr' ? 'Tüm içerik türleri ve asistan kimlikleri desteklenir' : 'All content formats and assistant personas are supported'}
              </span>
            </div>
          </div>
 
        </div>
      </div>
    </PageLayout>
  );
}

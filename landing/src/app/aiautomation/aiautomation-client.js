"use client";

import React, { useState } from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';

export default function AIAutomationClient() {
  const { lang } = useLang();
  
  // Interactive preview state
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: lang === 'tr' ? '1. Telegram & Mesajlaşma Tetikleyicileri' : '1. Telegram & Chat Messaging Triggers',
      desc: lang === 'tr' 
        ? 'Telegram veya diğer mesaj kanallarından gelen mesajları asistanınız için tetikleyici olarak kullanın.'
        : 'Use incoming Telegram messages or direct chatbot prompts as immediate automation triggers.',
      details: lang === 'tr' 
        ? 'Grup sohbetlerini veya doğrudan mesajları dinleyin. Belirli anahtar kelimeler veya kullanıcı talepleri geldiğinde asistanınız konuyu analiz eder, veri tabanını sorgular veya doğrudan CRM sisteminize kayıt açar.'
        : 'Listen to group chats or direct bot messages. When specific keywords or customer inquiries arrive, your assistant reviews docs, queries databases, or registers lead cards directly inside your CRM.'
    },
    {
      title: lang === 'tr' ? '2. Ziyaretçi Davranış Tetikleyicileri' : '2. Visitor Behavior & Landings Triggers',
      desc: lang === 'tr' 
        ? 'Ziyaretçilerin web sitenizdeki davranışlarına ve bekleme sürelerine göre asistan aksiyonları kurun.'
        : 'Initialize target chatbot interventions based on visitor dwell times, page visits, or exit intent.',
      details: lang === 'tr'
        ? 'Ziyaretçinin sayfada 2 dakikadan uzun kalması, sepete ürün atıp bekletmesi veya sekmeyi kapatmaya yeltenmesi gibi anlarda asistanınız devreye girerek onlara özel indirimler sunabilir veya sorularını yanıtlayabilir.'
        : 'If a user stays over 2 minutes, stalls their checkout cart, or exhibits exit intent, the AI assistant proactively opens the chat, offering custom discounts or answering pre-purchase doubts.'
    },
    {
      title: lang === 'tr' ? '3. Web Kancaları & API Koşulları' : '3. Webhooks & Custom API Conditions',
      desc: lang === 'tr' 
        ? 'Üçüncü parti sistemlerden gelen verileri asistanınızın zekasıyla işleyin ve yönetin.'
        : 'Process data payloads from external billing, CRM, or payment systems through your assistant.',
      details: lang === 'tr'
        ? 'Ödeme sisteminizden (Stripe, iyzico) veya CRM servisinizden gelen web kancalarını dinleyin. Asistanınız müşteri statüsünü analiz edip onlara otomatik teşekkür yazısı yazar veya özel rapor hazırlayıp teslim eder.'
        : 'Capture incoming webhooks from platforms like Stripe, Hubspot, or custom databases. The assistant evaluates the status updates, drafts custom emails, or aggregates files automatically.'
    },
    {
      title: lang === 'tr' ? '4. Zamanlanmış Otonom Akışlar' : '4. Scheduled & Recurring Workflows',
      desc: lang === 'tr' 
        ? 'Düzenli aralıklarla çalışan ve veri kaynaklarınızı tarayıp raporlayan döngüler kurun.'
        : 'Establish routine cycles that read target databases, compile data, and publish notifications.',
      details: lang === 'tr'
        ? 'Belirli zaman aralıklarında veri tabanlarınızı, doküman havuzlarınızı veya harici API\'leri tarayın. Asistanınız elde ettiği verilerden haftalık özet raporlar çıkartarak Slack, Discord veya E-posta kanalıyla ekiplerinize göndersin.'
        : 'Set up cron-like intervals to crawl your databases, files, or external endpoints. The assistant digests the delta changes, writes brief update reports, and pushes them to Slack or via emails.'
    }
  ];

  return (
    <PageLayout className="min-h-screen" container={false}>
      {/* Hero Header */}
      <div className="relative text-center px-5 pb-10 pt-16 max-w-[900px] mx-auto overflow-hidden">
        <div className="hero-glow" style={{ top: '-150px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            ⚡ AIautomation
          </span>
          <h1 className="font-['Outfit'] text-[50px] max-md:text-[34px] font-black tracking-tight mb-4 leading-tight">
            {lang === 'tr' ? (
              <>Tetikleyici Tabanlı <span className="gradient-text">Otonom</span> İş Akışları</>
            ) : (
              <>Trigger-Based <span className="gradient-text">Autonomous</span> Workflows</>
            )}
          </h1>
          <p className="text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            {lang === 'tr'
              ? 'Yapay zeka asistanlarınızı Telegram mesajları, kullanıcı ziyaretleri, web kancaları veya zamanlanmış koşullar gibi tetikleyicilerle donatın; iş süreçlerinizi otonom olarak çalıştırın.'
              : 'Empower your AI assistants with event-based triggers such as Telegram messages, web visits, webhooks, or scheduled intervals to execute complex workflow automations on autopilot.'}
          </p>
        </div>
      </div>

      {/* Pipeline Visual Container */}
      <div className="container" style={{ paddingBottom: '80px', position: 'relative', zIndex: 2 }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-10 items-center">
          
          {/* Left: Step selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
              {lang === 'tr' ? 'Desteklenen Tetikleyici Tipleri' : 'Supported Trigger Scopes'}
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
              {activeStep === 0 ? '💬' : activeStep === 1 ? '🎯' : activeStep === 2 ? '🔌' : '⏳'}
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
                {lang === 'tr' ? 'Tüm Ragleaf asistanları ve modülleri ile entegre çalışır' : 'Works natively with all Ragleaf assistant types and modules'}
              </span>
            </div>
          </div>
 
        </div>
      </div>
    </PageLayout>
  );
}

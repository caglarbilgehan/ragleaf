"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useLang } from '../context/LangContext';
import { useUI } from '../context/UIContext';
import PageLayout from '../components/PageLayout';

export default function Home() {
  const { lang, t } = useLang();
  const { openSignup } = useUI();
  const [consoleTab, setConsoleTab] = useState('aichat');
  const [mockSector, setMockSector] = useState('kuafor');

  // Interactive UI Mockup states
  const [chatStep, setChatStep] = useState(0); // for AIchat mock interactions
  const [writerTone, setWriterTone] = useState('prof'); // for AIwriter mock tone selection
  const [writerWordCount, setWriterWordCount] = useState(450); // for AIwriter mock length

  const sectorChatsMock = {
    kuafor: {
      name: lang === 'tr' ? 'Bella Kuaför' : 'Bella Hair Salon',
      icon: '✂️',
      messages: [
        { role: 'bot', text: lang === 'tr' ? 'Bella Kuaför asistanına hoş geldiniz! ✂️ Saç tasarımı, kesim ve boyama hizmetlerimiz hakkında bilgi alabilir veya randevu oluşturabilirsiniz.' : 'Welcome to Bella Hair Salon! ✂️ You can check styling rates or book a session.' },
        { role: 'user', text: lang === 'tr' ? 'Saç kesimi ve fön fiyatı nedir?' : 'What are the prices for haircut and blowdry?' },
        { role: 'bot', text: lang === 'tr' ? 'Saç Kesim & Fön: ₺450. Randevu oluşturmamı ister misiniz?' : 'Haircut & Blowdry is $45. Would you like to schedule an appointment?' },
        { role: 'user', text: lang === 'tr' ? 'Evet, randevu alayım.' : 'Yes, let\'s book.' },
        { role: 'bot', text: lang === 'tr' ? 'Randevunuz başarıyla oluşturuldu!\n📅 Bugün 14:00 - Onaylandı ✓' : 'Appointment booked!\n📅 Today 14:00 - Confirmed ✓' }
      ]
    },
    restoran: {
      name: lang === 'tr' ? 'Gusto Restoran' : 'Gusto Restaurant',
      icon: '🍽️',
      messages: [
        { role: 'bot', text: lang === 'tr' ? 'Gusto Restoran asistanına hoş geldiniz! 🍽️ Menümüzü inceleyebilir, masa rezervasyonu yapabilir veya paket servis isteyebilirsiniz.' : 'Welcome to Gusto! 🍽️ You can view our menu or reserve a table.' },
        { role: 'user', text: lang === 'tr' ? 'Bu akşam için 2 kişilik masa rezervasyonu yapmak istiyorum.' : 'I want to reserve a table for 2 people tonight.' },
        { role: 'bot', text: lang === 'tr' ? 'Harika! Masa rezervasyonunuz onaylandı.\n🍽️ Masa #12 - Bugün 20:00 ✓' : 'Excellent! Reservation confirmed.\n🍽️ Table #12 - Tonight 20:00 ✓' }
      ]
    },
    ecommerce: {
      name: lang === 'tr' ? 'TrendModa Destek' : 'TrendModa Support',
      icon: '🛒',
      messages: [
        { role: 'bot', text: lang === 'tr' ? 'TrendModa Alışveriş Asistanı\'na hoş geldiniz! 🛒 Sipariş takibi veya ödemeler hakkında yardımcı olabilirim.' : 'Welcome to TrendModa! 🛒 I can assist with order tracking and secure payments.' },
        { role: 'user', text: lang === 'tr' ? 'Sepetimdeki ürünlerin ödemesini yapmak istiyorum.' : 'I want to check out my cart.' },
        { role: 'bot', text: lang === 'tr' ? 'Kredi kartınızla güvenli ödemenizi doğrudan sohbet penceresinden yapabilirsiniz:\n💳 ÖDEME YAPILDI ($45.00) ✓' : 'You can pay securely via the chat screen:\n💳 PAYMENT COMPLETED ($45.00) ✓' }
      ]
    }
  };

  const sectionDesc = lang === 'tr' 
    ? 'İşletmenizin büyümesini ve otomasyonunu sağlayacak premium ürün ailemizle tanışın.' 
    : 'Meet our suite of premium AI products designed to automate and grow your business.';

  const products = [
    {
      id: 'aichat',
      icon: '💬',
      title: 'AIchat',
      desc: lang === 'tr' 
        ? 'Sınırsız özelleştirilebilir canlı sohbet deneyimi, sektörel simülasyonlar ve gerçek zamanlı müşteri diyalog yönetimi.' 
        : 'Limitless customizable live chat experience with instant sector-specific simulations and real-time conversation consoles.',
      link: '/aichat',
      cta: lang === 'tr' ? 'Simülasyonu İncele →' : 'Explore Simulator →',
      badge: null
    },
    {
      id: 'aiassistant',
      icon: '🍃',
      title: 'AIassistant',
      desc: lang === 'tr' 
        ? 'Kurumsal dokümanlarınızı (PDF, Excel, katalog) yükleyip; isim, logo ve konuşma tonu belirleyerek markanıza özel kimlikli bir yapay zeka asistanı oluşturun.' 
        : 'Upload corporate documents (PDFs, spreadsheets, catalogs) and define a custom name, logo, and brand tone to build a unique, custom-identity AI assistant.',
      link: '/aiassistant',
      cta: lang === 'tr' ? 'Detayları Keşfet →' : 'Explore Details →',
      badge: null
    },
    {
      id: 'aiwriter',
      icon: '✍️',
      title: 'AIwriter',
      desc: lang === 'tr' 
        ? 'Asistan kimliği ve üslubuyla otonom içerik, blog, makale ve sosyal medya gönderileri üreten yapay zeka yazar modülü.' 
        : 'Autonomous content engine that drafts customized reports, social posts, and documents matching your AI assistant’s unique identity.',
      link: '/aiwriter',
      cta: lang === 'tr' ? 'İçerik Otomasyonu →' : 'Content Automation →',
      badge: null
    },
    {
      id: 'aiautomation',
      icon: '⚡',
      title: 'AIautomation',
      desc: lang === 'tr' 
        ? 'Asistanlarınızı Telegram, web ziyaretleri veya webhook tetikleyicileri ile bağlayan otonom iş akışı otomasyon sistemi.' 
        : 'Autonomous workflow automation connecting your assistants with Telegram messages, web visits, or webhook triggers.',
      link: '/aiautomation',
      cta: lang === 'tr' ? 'Otomasyonları Keşfet →' : 'Explore Workflows →',
      badge: null
    }
  ];

  // Helper for generating simulated writer text
  const getSimulatedWriterText = () => {
    if (lang === 'tr') {
      if (writerTone === 'prof') {
        return `Ragleaf RAG teknolojisi, kurumsal bilgi yönetiminde devrim yaratıyor. Klasik LLM'lerin aksine, verilerinizi gerçek zamanlı olarak indeksleyip doğru kaynak atıfları ile cevap üretir. Bu yaklaşım bilgi kirliğini en aza indirger.`;
      } else if (writerTone === 'friendly') {
        return `Selamlar! Yapay zeka asistanları işinizi ne kadar kolaylaştırabilir hiç düşündünüz mü? Ragleaf ile tüm Word, PDF ve Excel dosyalarınızı asistanınıza yükleyin; o sizin yerinize müşterilerinizin sorularını anında yanıtlasın!`;
      } else {
        return `Yapay zeka devrimi burada! Ragleaf ile asistanınızı dakikalar içinde kurup, rakiplerinize dev fark atın. Randevular, siparişler ve ödemeler tek panelde otonom çalışsın. Şimdi geleceğe adım atın!`;
      }
    } else {
      if (writerTone === 'prof') {
        return `Ragleaf Retrieval-Augmented Generation (RAG) technology revolutionizes enterprise knowledge management. Unlike traditional LLMs, it parses custom data sources dynamically to retrieve facts with precise citations.`;
      } else if (writerTone === 'friendly') {
        return `Hey there! Ever wondered how to automate customer support without losing your brand touch? Simply upload your PDFs or spreadsheets to Ragleaf, and let the AI handle bookings and queries in seconds!`;
      } else {
        return `The AI revolution is happening now! Supercharge your business workflows with Ragleaf's autonomous assistants. Manage conversational payments, bookings, and sync content instantly. Don't fall behind!`;
      }
    }
  };

  return (
    <PageLayout container={false}>
      {/* Hero Section */}
      <section className="hero" style={{ paddingTop: '40px', paddingBottom: '40px', height: 'calc(100vh - 152px)', minHeight: '0px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div className="hero-glow"></div>
        <div className="container">
          <div className="hero-row">
            
            {/* Left Column: Headline and Products Showcase */}
            <div className="hero-text-col" style={{ paddingRight: '20px' }}>
              
              <h1 style={{ marginBottom: '16px', textAlign: 'left', fontSize: '2.1rem', fontWeight: '900', lineHeight: '1.2' }}>
                {lang === 'tr' ? 'Ragleaf ' : 'Ragleaf '}
                <span className="gradient-text">
                  {lang === 'tr' ? 'AI Ürün Ailesi' : 'AI Product Family'}
                </span>
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '1.05rem', textAlign: 'left', margin: '0 0 32px 0', maxWidth: '600px', lineHeight: '1.6' }}>
                {lang === 'tr' 
                  ? 'İşletmenizin büyümesini ve otomasyonunu sağlayacak premium ürün ailemizle tanışın.' 
                  : 'Meet our suite of premium AI products designed to automate and grow your business.'}
              </p>

              {/* Ragleaf Ürün Ailesi Grid */}
              <div style={{ width: '100%' }}>
                <div className="hero-products-grid">
                  {products.map((prod) => (
                    <div 
                      key={prod.id} 
                      className="hero-product-card"
                    >
                      <div className="hero-product-card-header">
                        <span className="hero-product-icon">{prod.icon}</span>
                        <h4 className="hero-product-title">
                          <span style={{ color: 'var(--accent)' }}>{prod.title.substring(0,2)}</span>{prod.title.substring(2)}
                        </h4>
                      </div>
                      <p className="hero-product-desc">
                        {prod.desc}
                      </p>
                      <Link 
                        href={prod.link} 
                        className="hero-product-link"
                      >
                        {prod.cta}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Live Mockup Console */}
            <div style={{ width: '100%', position: 'relative', zIndex: 5 }}>
              <div className="mockup-console">
                {/* Header bar */}
                <div className="console-header">
                  <div className="console-dots">
                    <span className="console-dot red"></span>
                    <span className="console-dot yellow"></span>
                    <span className="console-dot green"></span>
                  </div>
                  
                   {/* Console Tabs switcher */}
                  <div className="console-tabs">
                    <button 
                      onClick={() => setConsoleTab('aichat')}
                      className={`console-tab-btn ${consoleTab === 'aichat' ? 'active' : ''}`}
                    >
                      <span className="brand-ai">AI</span><span className="brand-rest">chat</span>
                    </button>
                    <button 
                      onClick={() => setConsoleTab('aiassistant')}
                      className={`console-tab-btn ${consoleTab === 'aiassistant' ? 'active' : ''}`}
                    >
                      <span className="brand-ai">AI</span><span className="brand-rest">assistant</span>
                    </button>
                    <button 
                      onClick={() => setConsoleTab('aiwriter')}
                      className={`console-tab-btn ${consoleTab === 'aiwriter' ? 'active' : ''}`}
                    >
                      <span className="brand-ai">AI</span><span className="brand-rest">writer</span>
                    </button>
                    <button 
                      onClick={() => setConsoleTab('aiautomation')}
                      className={`console-tab-btn ${consoleTab === 'aiautomation' ? 'active' : ''}`}
                    >
                      <span className="brand-ai">AI</span><span className="brand-rest">automation</span>
                    </button>
                  </div>
                </div>

                {/* Console Body */}
                <div className="console-body">
                  
                  {/* TAB 1: AIassistant Mock */}
                  {consoleTab === 'aiassistant' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '16px' }} className="max-md:flex-col">
                        
                        {/* Box 1: Document Upload */}
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                            📂 {lang === 'tr' ? 'BİLGİ TABANI / DOKÜMANLAR' : 'KNOWLEDGE BASE / DOCS'}
                          </span>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              <span style={{ color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px' }}>📄 fiyat_listesi.pdf</span>
                              <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold' }}>{lang === 'tr' ? 'Eğitildi ✓' : 'Trained ✓'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              <span style={{ color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px' }}>📄 urun_katalogu.docx</span>
                              <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold' }}>{lang === 'tr' ? 'Eğitildi ✓' : 'Trained ✓'}</span>
                            </div>
                            
                            {/* Drag and drop zone mockup */}
                            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', textAlign: 'center', fontSize: '13px', color: '#9ca3af', cursor: 'pointer' }}>
                              ➕ {lang === 'tr' ? 'Yeni Dosya Yükle (.pdf, .docx, .txt)' : 'Drag & Drop File (.pdf, .docx, .txt)'}
                            </div>
                          </div>
                        </div>

                        {/* Box 2: Identity / Setup */}
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                          <span style={{ fontSize: '12px', color: '#06b6d4', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '14px' }}>
                            👤 {lang === 'tr' ? 'ASİSTAN KİMLİK & AYARLARI' : 'ASSISTANT PERSONA & SETUP'}
                          </span>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                            <div>
                              <span style={{ color: '#6b7280', display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>{lang === 'tr' ? 'ASİSTAN İSMİ' : 'ASSISTANT NAME'}</span>
                              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', color: '#ffffff', border: '1px solid rgba(255,255,255,0.04)', fontWeight: '600' }}>
                                🍃 Ragleaf Destek Botu
                              </div>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280', display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>{lang === 'tr' ? 'KONUŞMA TONU' : 'TONE OF VOICE'}</span>
                              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', color: '#ffffff', border: '1px solid rgba(255,255,255,0.04)', fontWeight: '600' }}>
                                🤝 {lang === 'tr' ? 'Profesyonel & Samimi' : 'Professional & Friendly'}
                              </div>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280', display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>{lang === 'tr' ? 'OTOMASYON ÖZELLİKLERİ' : 'AUTOMATED ACTIONS'}</span>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '11px', padding: '4px 10px', borderRadius: '100px', border: '1px solid rgba(34,197,94,0.2)', fontWeight: '600' }}>
                                  📅 {lang === 'tr' ? 'Randevu' : 'Booking'}
                                </span>
                                <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '11px', padding: '4px 10px', borderRadius: '100px', border: '1px solid rgba(34,197,94,0.2)', fontWeight: '600' }}>
                                  💳 {lang === 'tr' ? 'Ödeme' : 'Payment'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* TAB 2: AIchat Mock */}
                  {consoleTab === 'aichat' && (
                    <div style={{ display: 'flex', gap: '20px', height: '100%', padding: '10px' }} className="max-md:flex-col">
                      
                      {/* Sector tabs select */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '170px' }} className="max-md:w-full">
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase' }}>
                          {lang === 'tr' ? 'ŞABLONLAR' : 'TEMPLATES'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button 
                            onClick={() => setMockSector('kuafor')} 
                            style={{ 
                              background: mockSector === 'kuafor' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)', 
                              border: '1px solid', 
                              borderColor: mockSector === 'kuafor' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', 
                              borderRadius: '8px', 
                              color: '#ffffff', 
                              fontSize: '13px', 
                              padding: '8px 12px', 
                              cursor: 'pointer', 
                              textAlign: 'left',
                              fontWeight: '600'
                            }}
                          >
                            💇‍♀️ {lang === 'tr' ? 'Bella Kuaför' : 'Hair Salon'}
                          </button>
                          <button 
                            onClick={() => setMockSector('restoran')} 
                            style={{ 
                              background: mockSector === 'restoran' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)', 
                              border: '1px solid', 
                              borderColor: mockSector === 'restoran' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', 
                              borderRadius: '8px', 
                              color: '#ffffff', 
                              fontSize: '13px', 
                              padding: '8px 12px', 
                              cursor: 'pointer', 
                              textAlign: 'left',
                              fontWeight: '600'
                            }}
                          >
                            🍽️ {lang === 'tr' ? 'Gusto Restoran' : 'Restaurant'}
                          </button>
                          <button 
                            onClick={() => setMockSector('ecommerce')} 
                            style={{ 
                              background: mockSector === 'ecommerce' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)', 
                              border: '1px solid', 
                              borderColor: mockSector === 'ecommerce' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', 
                              borderRadius: '8px', 
                              color: '#ffffff', 
                              fontSize: '13px', 
                              padding: '8px 12px', 
                              cursor: 'pointer', 
                              textAlign: 'left',
                              fontWeight: '600'
                            }}
                          >
                            🛒 {lang === 'tr' ? 'E-Ticaret' : 'E-Commerce'}
                          </button>
                        </div>
                      </div>

                      {/* Chat dialog preview */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden', height: '420px' }}>
                        <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '14px' }}>{sectorChatsMock[mockSector].icon}</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>
                            {sectorChatsMock[mockSector].name}
                          </span>
                          <span style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                        </div>

                        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {sectorChatsMock[mockSector].messages.map((msg, i) => (
                            <div 
                              key={i} 
                              style={{ 
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                background: msg.role === 'user' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid',
                                borderColor: msg.role === 'user' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                color: msg.role === 'user' ? '#ffffff' : '#e5e7eb',
                                padding: '8px 12px',
                                borderRadius: '12px',
                                borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                                borderTopLeftRadius: msg.role === 'bot' ? '2px' : '12px',
                                fontSize: '13px',
                                maxWidth: '85%',
                                whiteSpace: 'pre-line',
                                lineHeight: '1.4'
                              }}
                            >
                              {msg.text}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 3: AIwriter Mock */}
                  {consoleTab === 'aiwriter' && (
                    <div style={{ display: 'flex', gap: '20px', height: '100%', padding: '10px' }} className="max-md:flex-col">
                      
                      {/* Configurations panel */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '185px' }} className="max-md:w-full">
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', uppercase: true }}>{lang === 'tr' ? 'ÜSLUP' : 'TONE OF VOICE'}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button onClick={() => setWriterTone('prof')} style={{ background: writerTone === 'prof' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: writerTone === 'prof' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', padding: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: '600' }}>
                            👔 {lang === 'tr' ? 'Profesyonel' : 'Professional'}
                          </button>
                          <button onClick={() => setWriterTone('friendly')} style={{ background: writerTone === 'friendly' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: writerTone === 'friendly' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', padding: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: '600' }}>
                            🤝 {lang === 'tr' ? 'Samimi / Dostane' : 'Friendly'}
                          </button>
                          <button onClick={() => setWriterTone('bold')} style={{ background: writerTone === 'bold' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: writerTone === 'bold' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', padding: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: '600' }}>
                            💥 {lang === 'tr' ? 'Cesur / Dikkat Çekici' : 'Bold'}
                          </button>
                        </div>

                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', uppercase: true, marginTop: '10px' }}>{lang === 'tr' ? 'KELİME LİMİTİ' : 'LENGTH'}</span>
                        <input 
                          type="range" 
                          min="200" 
                          max="1000" 
                          value={writerWordCount} 
                          onChange={(e) => setWriterWordCount(parseInt(e.target.value))}
                          style={{ accentColor: 'var(--accent)', width: '100%', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>{writerWordCount} {lang === 'tr' ? 'Kelime' : 'Words'}</span>
                      </div>

                      {/* Content preview panel */}
                      <div className="writer-preview-card">
                        <div className="writer-header-bar">
                          <span className="writer-tag">{lang === 'tr' ? 'ASİSTAN KALEMİNDEN' : 'DRAFT'}</span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>⚡ Ragleaf <span className="brand-ai">AI</span>writer</span>
                        </div>
                        <div className="writer-content-area">
                          {getSimulatedWriterText()}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 4: AIautomation Mock */}
                  {consoleTab === 'aiautomation' && (
                    <div className="automation-canvas">
                      
                      <div className="automation-node trigger">
                        <span style={{ fontSize: '1.5rem' }}>💬</span>
                        <div>
                          <span style={{ fontSize: '11px', color: '#eab308', display: 'block', fontWeight: 'bold', uppercase: true, marginBottom: '2px' }}>{lang === 'tr' ? 'TETİKLEYİCİ' : 'TRIGGER'}</span>
                          <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 'bold' }}>{lang === 'tr' ? 'Telegram Mesajı Geldi' : 'Telegram Msg Received'}</span>
                        </div>
                      </div>

                      <div className="automation-line">
                        <span className="automation-pulse-dot"></span>
                      </div>

                      <div className="automation-node assistant">
                        <span style={{ fontSize: '1.5rem' }}>🤖</span>
                        <div>
                          <span style={{ fontSize: '11px', color: '#22c55e', display: 'block', fontWeight: 'bold', uppercase: true, marginBottom: '2px' }}>{lang === 'tr' ? 'ASİSTAN FİLTRESİ' : 'AI ASSISTANT'}</span>
                          <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 'bold' }}>{lang === 'tr' ? 'Destek Asistanı Analiz Etti' : 'Support Assistant Evaluates'}</span>
                        </div>
                      </div>

                      <div className="automation-line second">
                        <span className="automation-pulse-dot"></span>
                      </div>

                      <div className="automation-node action">
                        <span style={{ fontSize: '1.5rem' }}>📧</span>
                        <div>
                          <span style={{ fontSize: '11px', color: '#06b6d4', display: 'block', fontWeight: 'bold', uppercase: true, marginBottom: '2px' }}>{lang === 'tr' ? 'OTONOM EYLEM' : 'AUTOMATED ACTION'}</span>
                          <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 'bold' }}>{lang === 'tr' ? 'Müşteriye E-Posta Gönderme' : 'Send Email to Customer'}</span>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Styled card hover effect in globals.css or head style tag */}
      <style jsx global>{`
        .hero-products-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 16px;
          width: 100%;
        }
        @media (max-width: 640px) {
          .hero-products-grid {
            grid-template-columns: 1fr;
          }
        }
        .hero-product-card {
          background: rgba(15, 15, 25, 0.45);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(34, 197, 94, 0.12);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          text-align: left;
        }
        .hero-product-card:hover {
          transform: translateY(-3px);
          border-color: rgba(34, 197, 94, 0.35) !important;
          box-shadow: 0 12px 24px rgba(34, 197, 94, 0.05) !important;
          background: rgba(15, 15, 25, 0.6);
        }
        .hero-product-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .hero-product-icon {
          font-size: 1.5rem;
        }
        .hero-product-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }
        .hero-product-desc {
          color: #9ca3af;
          font-size: 0.825rem;
          line-height: 1.5;
          margin: 0 0 16px 0;
        }
        .hero-product-link {
          display: inline-flex;
          align-items: center;
          color: #ffffff;
          font-weight: 600;
          font-size: 0.825rem;
          text-decoration: none;
          gap: 4px;
          transition: color 0.2s ease;
          margin-top: auto;
        }
        .hero-product-link:hover {
          color: var(--accent) !important;
        }
      `}</style>
    </PageLayout>
  );
}

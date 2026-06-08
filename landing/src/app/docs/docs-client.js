"use client";

import React, { useState, useEffect } from 'react';
import { useLang } from '../../context/LangContext';
import { useUI } from '../../context/UIContext';
import PageLayout from '../../components/PageLayout';

export default function DocsClient() {
  const { lang, t } = useLang();
  const { openSignup } = useUI();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('user-intro');
  const [sidebarStyle, setSidebarStyle] = useState({});

  // Interactive states for mockups
  const [selectedTemplate, setSelectedTemplate] = useState('kuafor');
  const [uploadedDocs, setUploadedDocs] = useState([
    { name: lang === 'tr' ? 'fiyat-listesi-2026.pdf' : 'price-list-2026.pdf', status: 'done', size: '1.2 MB' },
    { name: lang === 'tr' ? 'hizmet-menusu.docx' : 'service-menu.docx', status: 'done', size: '850 KB' }
  ]);
  const [newDocName, setNewDocName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Prompt builder states
  const [mockPrompt, setMockPrompt] = useState(
    lang === 'tr' 
      ? 'Bella Kuaför asistanısın. Müşterilere saç kesimi, boya ve fön fiyatlarını söyle, randevu oluştur.'
      : 'You are Bella Hair Salon assistant. Tell clients haircut, coloring and blowdry prices, book appointments.'
  );
  const [enableBooking, setEnableBooking] = useState(true);
  const [enablePayments, setEnablePayments] = useState(true);
  const [enableWhatsApp, setEnableWhatsApp] = useState(false);

  // Booking states
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Payment states
  const [cardHolder, setCardHolder] = useState('Mehmet Yılmaz');
  const [payLoading, setPayLoading] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  // Theme customizer states
  const [customTheme, setCustomTheme] = useState('dark');
  const [customColor, setCustomColor] = useState('#22c55e');
  const [customGreeting, setCustomGreeting] = useState(
    lang === 'tr' ? 'Merhaba! Bella Güzellik Salonuna hoş geldiniz. 💅' : 'Hello! Welcome to Bella Nails & Beauty. 💅'
  );

  // Analytics states
  const [analyticsRange, setAnalyticsRange] = useState('week');

  const copyCode = (e, text) => {
    const btn = e.currentTarget;
    const oldText = btn.textContent;
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = lang === 'tr' ? '✓ Kopyalandı' : '✓ Copied';
      setTimeout(() => {
        btn.textContent = oldText;
      }, 2000);
    });
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newTop = Math.max(70, 70 - scrollY);
      setSidebarStyle({ top: `${newTop}px` });

      const sections = document.querySelectorAll('.docs-section');
      let current = 'user-intro';
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 120) {
          current = section.id;
        }
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSidebarClick = (e, targetId) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileSidebarOpen(false);
    }
  };

  const handleAddDoc = (e) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    setIsUploading(true);
    const docName = newDocName.endsWith('.pdf') || newDocName.endsWith('.docx') || newDocName.endsWith('.txt') 
      ? newDocName 
      : `${newDocName}.pdf`;
    
    setTimeout(() => {
      setUploadedDocs([...uploadedDocs, { name: docName, status: 'done', size: '420 KB' }]);
      setNewDocName('');
      setIsUploading(false);
    }, 1500);
  };

  const handlePayment = (e) => {
    e.preventDefault();
    setPayLoading(true);
    setTimeout(() => {
      setPayLoading(false);
      setPaySuccess(true);
    }, 1200);
  };

  const sidebarLinks = [
    {
      label: { tr: '📖 Kullanıcı Rehberi', en: '📖 User Guide' },
      links: [
        { id: 'user-intro', label: { tr: 'Giriş & Hesap Kurulumu', en: 'Introduction & Signup' } },
        { id: 'user-templates', label: { tr: 'Sektörel Şablonlar', en: 'Industry Templates' } },
        { id: 'user-prompt', label: { tr: 'Kişilik & Prompt Tanımı', en: 'Persona & System Prompt' } },
        { id: 'user-knowledge', label: { tr: 'Doküman Yükleme & RAG', en: 'Knowledge base & Ingestion' } },
        { id: 'user-booking', label: { tr: 'Randevu & Rezervasyon', en: 'Appointments Module' } },
        { id: 'user-payments', label: { tr: 'Canlı Sohbet İçi Ödeme', en: 'In-Chat Payments' } },
        { id: 'user-widget', label: { tr: 'Widget Görünüm & Tasarım', en: 'Widget Theme Design' } },
        { id: 'user-analytics', label: { tr: 'Analitik & Konuşmalar', en: 'Analytics & Conversation Logs' } }
      ]
    },
    {
      label: { tr: '⚡ Geliştirici Dokümanları', en: '⚡ Developer Docs' },
      links: [
        { id: 'quick-start', label: { tr: 'Hızlı Başlangıç', en: 'Quick Start' } },
        { id: 'authentication', label: { tr: 'Kimlik Doğrulama', en: 'Authentication' } },
        { id: 'widget-setup', label: { tr: 'Widget Kurulumu', en: 'Widget Installation' } },
        { id: 'widget-config', label: { tr: 'Yapılandırma Seçenekleri', en: 'Configuration Options' } },
        { id: 'widget-theme', label: { tr: 'Tema Özelleştirme', en: 'Theme Customization' } },
        { id: 'shadow-dom', label: { tr: 'Shadow DOM İzolasyonu', en: 'Shadow DOM Isolation' } },
        { id: 'chat-completions', label: { tr: 'Chat Completions API', en: 'Chat Completions API' } },
        { id: 'documents-api', label: { tr: 'Doküman API', en: 'Document API' } },
        { id: 'agents-api', label: { tr: 'Agent API', en: 'Agent API' } },
        { id: 'webhook-events', label: { tr: 'Webhook Olay Tipleri', en: 'Webhook Event Types' } },
        { id: 'webhook-security', label: { tr: 'Webhook Güvenliği', en: 'Webhook Security' } },
        { id: 'int-wordpress', label: { tr: 'Platform Entegrasyonları', en: 'Platform Integrations' } },
        { id: 'error-codes', label: { tr: 'Hata Kodları', en: 'Error Codes' } },
        { id: 'rate-limits', label: { tr: 'Rate Limiting', en: 'Rate Limiting' } },
        { id: 'changelog', label: { tr: 'Changelog', en: 'Changelog' } }
      ]
    }
  ];

  return (
    <PageLayout>
      <div className="page-layout installation-page">
        <div className="flex mt-0 max-lg:block max-w-full mx-auto w-full px-0 relative">
          
          {/* SIDEBAR */}
          <aside 
            className={`w-[280px] shrink-0 sticky top-[70px] h-[calc(100vh-70px)] overflow-y-auto bg-[#0a0a0f]/95 border-r border-border-custom py-6 pl-0 pr-4 z-10 max-lg:fixed max-lg:top-[60px] max-lg:w-[280px] max-lg:h-[calc(100vh-60px)] max-lg:transition-[left] max-lg:duration-300 max-lg:z-50 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full ${mobileSidebarOpen ? "max-lg:left-0!" : "max-lg:-left-[300px]"}`} 
            id="docsSidebar" 
            style={sidebarStyle}
          >
            {sidebarLinks.map((section, idx) => (
              <div key={idx} className="px-4 mb-3">
                <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold py-3 flex items-center gap-1.5 border-b border-white/5 mb-1.5">
                  {lang === 'en' ? section.label.en : section.label.tr}
                </div>
                {section.links.map((link) => (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    onClick={(e) => handleSidebarClick(e, link.id)}
                    className={`block px-3 py-2 text-[13px] font-semibold no-underline rounded-md transition-all hover:bg-white/4 hover:text-text-primary ${activeSection === link.id ? "bg-accent/8 !text-accent border-l-2 border-accent" : "text-text-secondary"}`}
                  >
                    {lang === 'en' ? link.label.en : link.label.tr}
                  </a>
                ))}
              </div>
            ))}
          </aside>

          {/* MAIN CONTENT CONTAINER */}
          <main className="flex-1 max-w-full p-10 pb-20 max-lg:p-5 max-lg:pb-20 overflow-hidden">
            
            {/* ========================================================================= */}
            {/* ======================= KULLANICI REHBERİ (USER GUIDE) ================== */}
            {/* ========================================================================= */}

            {/* INTRO */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-intro">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 bg-accent/8 border border-accent/20 text-accent">
                📖 {lang === 'tr' ? 'Kullanıcı Rehberi' : 'User Guide'}
              </span>
              <h1 className="text-4xl font-extrabold text-text-primary mb-4 leading-tight">
                {lang === 'tr' ? 'Ragleaf Kullanım Kılavuzu' : 'Ragleaf Platform Guide'}
              </h1>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-8">
                {lang === 'tr' 
                  ? 'Ragleaf, işletmenize özel akıllı yapay zeka asistanları oluşturmanızı ve bunları kod yazmadan sitenize eklemenizi sağlar. Bu kılavuzda yönetim panelinizi nasıl kullanacağınızı, asistanınızı nasıl eğiteceğinizi ve özellikleri nasıl devreye alacağınızı adım adım inceleyeceğiz.'
                  : 'Ragleaf allows you to build custom smart AI assistants for your business and embed them without coding. In this guide, we will walk you through how to use the dashboard, train your agent, and activate booking or payment features.'}
              </p>

              {/* MOCKUP: Kayıt olma & Profil */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-6">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-[11px] text-text-muted font-medium ml-4 tracking-wider uppercase">
                    {lang === 'tr' ? 'Yönetim Paneli — Giriş Ekranı' : 'Admin Portal — Login Screen'}
                  </span>
                </div>

                <div className="flex max-md:flex-col items-center gap-10">
                  <div className="flex-1 w-full">
                    <div className="text-sm font-semibold text-text-primary mb-3">
                      {lang === 'tr' ? '1. Adım: Hesap Oluşturun ve Giriş Yapın' : 'Step 1: Sign up and Authenticate'}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed mb-4">
                      {lang === 'tr'
                        ? 'Yönetim paneline erişmek için e-posta adresinizle ücretsiz bir hesap oluşturun. E-postanıza gönderilen 6 haneli doğrulama kodunu girerek hesabınızı saniyeler içinde aktif edebilirsiniz.'
                        : 'Create a free account with your email address to access the workspace. Enter the 6-digit confirmation code sent to your email to verify and activate your dashboard in seconds.'}
                    </p>
                    <button onClick={openSignup} className="btn btn-primary btn-sm py-2 px-5 font-semibold text-xs cursor-pointer">
                      {lang === 'tr' ? 'Hemen Ücretsiz Kayıt Ol →' : 'Register Free Now →'}
                    </button>
                  </div>
                  
                  {/* Visual card */}
                  <div className="w-[260px] shrink-0 bg-black/40 border border-white/5 rounded-2xl p-5 shadow-lg relative">
                    <div className="text-center mb-4">
                      <span className="text-2xl">🍃</span>
                      <div className="text-xs font-bold text-text-primary mt-1">Ragleaf Verification</div>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[10px] text-text-muted font-semibold text-center">
                        {lang === 'tr' ? 'E-postanıza gelen 6 haneli kodu girin' : 'Enter 6-digit code sent to your email'}
                      </span>
                      <div className="flex justify-between gap-1">
                        {['4', '9', '2', '8', '0', '3'].map((n, i) => (
                          <div key={i} className="w-8 h-9 border border-accent/40 bg-accent/5 rounded-lg flex items-center justify-center text-accent font-bold text-sm shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                            {n}
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-center text-accent font-semibold mt-1">
                        ✓ {lang === 'tr' ? 'Doğrulandı! Giriş yapılıyor...' : 'Verified! Redirecting...'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* TEMPLATES */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-templates">
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                {lang === 'tr' ? '2. Sektörel Hazır Şablonlar' : '2. Pre-Built Industry Templates'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Sıfırdan bir asistan tasarlamak yerine, sektörünüze özel olarak eğitilmiş ve yapılandırılmış şablonlardan birini seçebilirsiniz. Bu şablonlar ilgili randevu limitleri, form soruları ve konuşma tonları ile hazır gelir.'
                  : 'Instead of designing an assistant from scratch, you can deploy a pre-configured template customized for your sector. These templates arrive fully loaded with optimized prompts, forms, and service flows.'}
              </p>

              {/* Template selector UI mockup */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  {lang === 'tr' ? 'Şablon Seçim Sihirbazı' : 'Template Wizard Selection'}
                </div>
                
                <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2">
                  {[
                    { id: 'kuafor', name: { tr: 'Kuaför', en: 'Hair Salon' }, icon: '✂️', color: 'var(--accent)' },
                    { id: 'dental', name: { tr: 'Diş Hekimi', en: 'Dentist' }, icon: '🦷', color: '#06b6d4' },
                    { id: 'restoran', name: { tr: 'Restoran', en: 'Restaurant' }, icon: '🍽️', color: '#f59e0b' },
                    { id: 'ecommerce', name: { tr: 'E-Ticaret', en: 'E-Commerce' }, icon: '🛒', color: '#ec4899' },
                    { id: 'otel', name: { tr: 'Otel', en: 'Hotel' }, icon: '🏨', color: '#8b5cf6' },
                    { id: 'influencer', name: { tr: 'Influencer', en: 'Influencer' }, icon: '🔮', color: '#10b981' }
                  ].map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedTemplate(item.id)}
                      className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 ${selectedTemplate === item.id ? 'bg-white/[0.04] border-accent shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-xs text-text-primary font-bold">{lang === 'tr' ? item.name.tr : item.name.en}</span>
                      {selectedTemplate === item.id && (
                        <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-accent text-black text-[9px] font-bold rounded-full flex items-center justify-center">✓</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs text-text-primary font-bold mb-1">
                    {lang === 'tr' ? 'Seçilen Şablon Ayrıntıları:' : 'Selected Template Specifications:'}
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed m-0">
                    {selectedTemplate === 'kuafor' && (lang === 'tr' ? 'Kuaför şablonu: Randevu rezervasyonu, kesim/boyama hizmet fiyatları, çalışma saatleri sorgulama ve sohbet içi kapora ödemesi aktif.' : 'Hair Salon template: Appointment scheduler, service pricing, working hours inquiries, and in-chat deposit payments activated.')}
                    {selectedTemplate === 'dental' && (lang === 'tr' ? 'Diş Hekimi şablonu: Muayene randevusu, uzman hekim seçimi, tedavi hizmet açıklamaları ve SGK anlaşma detayları aktif.' : 'Dentist template: Medical appointment booking, specialist selection, treatment descriptions, and insurance details activated.')}
                    {selectedTemplate === 'restoran' && (lang === 'tr' ? 'Restoran şablonu: Anlık masa rezervasyonu, kapasite kontrolü, günlük menü bilgisi ve sipariş oluşturma aktif.' : 'Restaurant template: Real-time table booking, seat capacity checks, daily specials, and quick order collection activated.')}
                    {selectedTemplate === 'ecommerce' && (lang === 'tr' ? 'E-Ticaret şablonu: Sipariş durumu takibi, sepet ödeme linki, iade politikası bilgilendirmesi ve kargo bilgisi aktif.' : 'E-Commerce template: Order status tracking, checkout payments, return policy explanation, and shipping inquiries activated.')}
                    {selectedTemplate === 'otel' && (lang === 'tr' ? 'Otel şablonu: Check-in/check-out tarihi sorgulama, oda doluluk kontrolü, oda özellikleri ve rezervasyon tamamlama aktif.' : 'Hotel template: Check-in/check-out inquiries, room availability lookup, luxury specifications, and reservation confirmation activated.')}
                    {selectedTemplate === 'influencer' && (lang === 'tr' ? 'Influencer şablonu: Reklam/sponsorluk teklif alımı, medya kiti yönlendirmesi, sponsorluk bütçe hesaplaması aktif.' : 'Influencer template: Ad/sponsorship proposal intake, media kit redirection, custom sponsorship budget calculator activated.')}
                  </p>
                </div>
              </div>
            </section>

            {/* PROMPT EDITOR */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-prompt">
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                {lang === 'tr' ? '3. Kişilik & Prompt Yapılandırması' : '3. Assistant Persona & System Prompt'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Asistanınızın adını, avatarını ve en önemlisi sistem talimatını (system prompt) yönetim panelinden ayarlayabilirsiniz. Sistem talimatı, asistanın hangi kurallara uyacağını ve müşterilere nasıl hitap edeceğini belirler.'
                  : 'Configure your assistant\'s name, visual avatar, and system instructions (system prompt) in the editor. The system prompt controls how the assistant behaves, what rules it obeys, and how it talks to clients.'}
              </p>

              {/* Prompt configuration mockup */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  {lang === 'tr' ? 'Asistan Ayrıntılı Ayarları' : 'Assistant Settings & Prompt Editor'}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 max-md:flex-col">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <span className="text-[11px] text-text-secondary font-semibold">{lang === 'tr' ? 'Asistan İsmi' : 'Agent Name'}</span>
                      <input 
                        className="bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-text-primary focus:outline-none focus:border-accent" 
                        value={lang === 'tr' ? 'Bella Güzellik Asistanı 💅' : 'Bella Beauty Agent 💅'} 
                        readOnly 
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <span className="text-[11px] text-text-secondary font-semibold">{lang === 'tr' ? 'Model Sıcaklığı (Yaratıcılık)' : 'Model Temperature (Creativity)'}</span>
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-xl h-[42px]">
                        <input type="range" min="0" max="100" defaultValue="20" className="flex-1 accent-accent" disabled />
                        <span className="text-[11px] font-mono font-bold text-accent">0.2</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-text-secondary font-semibold">{lang === 'tr' ? 'Sistem İstem İnce Ayarı' : 'System Prompt Tuning'}</span>
                    <textarea 
                      className="bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-text-primary focus:outline-none focus:border-accent resize-none h-20 leading-relaxed font-sans" 
                      value={mockPrompt}
                      onChange={(e) => setMockPrompt(e.target.value)}
                    />
                  </div>

                  {/* Toggle buttons */}
                  <div className="mt-2 grid grid-cols-3 gap-3 max-md:grid-cols-1">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5">
                      <span className="text-xs text-text-secondary">📅 {lang === 'tr' ? 'Randevu Modülü' : 'Appointments'}</span>
                      <button 
                        onClick={() => setEnableBooking(!enableBooking)}
                        className={`w-8 h-4 rounded-full relative transition-all ${enableBooking ? 'bg-accent' : 'bg-white/10'}`}
                      >
                        <span className={`w-3 h-3 bg-black rounded-full absolute top-0.5 transition-all ${enableBooking ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5">
                      <span className="text-xs text-text-secondary">💳 {lang === 'tr' ? 'Ödeme Toplama' : 'In-Chat Payments'}</span>
                      <button 
                        onClick={() => setEnablePayments(!enablePayments)}
                        className={`w-8 h-4 rounded-full relative transition-all ${enablePayments ? 'bg-accent' : 'bg-white/10'}`}
                      >
                        <span className={`w-3 h-3 bg-black rounded-full absolute top-0.5 transition-all ${enablePayments ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5">
                      <span className="text-xs text-text-secondary">💬 {lang === 'tr' ? 'WhatsApp Desteği' : 'WhatsApp Support'}</span>
                      <button 
                        onClick={() => setEnableWhatsApp(!enableWhatsApp)}
                        className={`w-8 h-4 rounded-full relative transition-all ${enableWhatsApp ? 'bg-accent' : 'bg-white/10'}`}
                      >
                        <span className={`w-3 h-3 bg-black rounded-full absolute top-0.5 transition-all ${enableWhatsApp ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* KNOWLEDGE BASE */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-knowledge">
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                {lang === 'tr' ? '4. Bilgi Tabanı & Doküman Yükleme' : '4. Knowledge Base & Document Upload'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Asistanınızın yanıt vermesi gereken özel verileri (örneğin hizmet sözleşmeleri, fiyat listesi, PDF broşürleri) buraya yüklersiniz. Ragleaf, dokümanı otomatik olarak parçalara ayırır (chunking), vektör veri tabanına işler (embedding) ve asistanın hafızasına ekler.'
                  : 'Upload business data like service menus, pricing sheets, or custom PDFs here. Ragleaf automatically fragments documents (chunking), generates embeddings, and indexes them into the vector database.'}
              </p>

              {/* Upload interface mockup */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  {lang === 'tr' ? 'Doküman Yönetim Sistemi' : 'Document Ingestion Console'}
                </div>

                <form onSubmit={handleAddDoc} className="flex gap-2 mb-5">
                  <input 
                    className="flex-1 bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs text-text-primary focus:outline-none focus:border-accent"
                    placeholder={lang === 'tr' ? 'Örn: yeni-katalog.pdf' : 'E.g: new-catalog.pdf'}
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    disabled={isUploading}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary px-4 text-xs font-semibold rounded-xl cursor-pointer"
                    disabled={isUploading || !newDocName.trim()}
                  >
                    {isUploading ? (lang === 'tr' ? 'Yükleniyor...' : 'Uploading...') : (lang === 'tr' ? 'Dosya Ekle' : 'Add File')}
                  </button>
                </form>

                <div className="flex flex-col gap-2">
                  {uploadedDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">📄</span>
                        <div className="flex flex-col">
                          <span className="text-text-primary font-medium">{doc.name}</span>
                          <span className="text-[10px] text-text-muted">{doc.size}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-green-500/10 border border-green-500/20 text-accent">
                        ✓ {lang === 'tr' ? 'İşlendi (RAG Hazır)' : 'Processed (RAG Ready)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* BOOKINGS */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-booking">
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                {lang === 'tr' ? '5. Randevu & Rezervasyon Yapılandırması' : '5. Appointments & Booking Settings'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Yapay zeka asistanının müşterilerinizden randevu toplayabilmesi için yönetim panelinden uygun günleri, çalışma saatlerini, seans sürelerini ve kapasite limitlerini ayarlarsınız. Asistan bu saatlere sadık kalarak boş slots listeler ve randevu oluşturur.'
                  : 'Configure available calendar slots, working hours, service durations, and seat capacities in the bookings panel. The AI assistant references this live database to coordinate, recommend, and book reservations.'}
              </p>

              {/* Booking calendar mockup */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  {lang === 'tr' ? 'Müşteri Randevu Modülü Önizleme' : 'Client-Side Scheduler Preview'}
                </div>

                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
                  <div className="text-xs text-text-secondary text-center">
                    {lang === 'tr' ? '12 Haziran Cuma — Lütfen bir saat dilimi seçin:' : 'Friday, June 12 — Please select a time slot:'}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {['09:00', '11:00', '14:00', '16:00'].map((time, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedSlot(time);
                          setBookingConfirmed(false);
                        }}
                        className={`p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${selectedSlot === time ? 'bg-accent/15 border-accent text-accent' : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>

                  {selectedSlot && !bookingConfirmed && (
                    <button
                      onClick={() => setBookingConfirmed(true)}
                      className="bg-accent text-[#000] border-none font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer w-full text-center hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all"
                    >
                      {lang === 'tr' ? `${selectedSlot} Randevusunu Onayla` : `Confirm Booking at ${selectedSlot}`}
                    </button>
                  )}

                  {bookingConfirmed && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 text-accent rounded-xl text-center text-xs font-semibold">
                      🎉 {lang === 'tr' ? 'Randevunuz Başarıyla Oluşturuldu!' : 'Booking Successfully Confirmed!'}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* PAYMENTS */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-payments">
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                {lang === 'tr' ? '6. Sohbet İçi Güvenli Ödeme' : '6. Secure In-Chat Payment Collection'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Randevu veya sipariş esnasında, asistanınız müşterinizden doğrudan sohbet penceresinden kredi kartı ile ödeme tahsil edebilir. Yönetim panelinden Iyzico veya Stripe hesabınızı bağlayarak anında kapora veya tam ücret almaya başlayabilirsiniz.'
                  : 'Collect deposits or full payments directly inside the chat window. Integrate Stripe or Iyzico credentials in the billing panel to authorize and process secure credit card payments.'}
              </p>

              {/* CC payment mockup inside widget */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  {lang === 'tr' ? 'Sohbet İçi Ödeme Formu' : 'In-Chat Checkout Window'}
                </div>

                <div className="max-w-[340px] mx-auto bg-black/40 border border-white/5 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <span className="text-[11px] font-bold text-text-primary">💳 {lang === 'tr' ? 'Güvenli Ödeme' : 'Secure Checkout'}</span>
                    <span className="text-[11px] font-mono font-bold text-accent">₺450.00</span>
                  </div>

                  {paySuccess ? (
                    <div className="py-6 text-center">
                      <span className="text-2xl">✅</span>
                      <div className="text-xs font-bold text-accent mt-2">{lang === 'tr' ? 'Ödeme Başarılı!' : 'Payment Approved!'}</div>
                      <div className="text-[9px] text-text-muted mt-1">{lang === 'tr' ? 'Sipariş Kodu: #RG-9034' : 'Order ID: #RG-9034'}</div>
                    </div>
                  ) : (
                    <form onSubmit={handlePayment} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-text-secondary">{lang === 'tr' ? 'Kart Üzerindeki İsim' : 'Cardholder Name'}</span>
                        <input 
                          className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-text-secondary">{lang === 'tr' ? 'Kart Numarası' : 'Card Number'}</span>
                        <input 
                          className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent"
                          placeholder="4355 •••• •••• ••••"
                          disabled
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <span className="text-[9px] text-text-secondary">MM/YY</span>
                          <input className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent" placeholder="12/28" disabled />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <span className="text-[9px] text-text-secondary">CVC</span>
                          <input className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent" placeholder="•••" disabled />
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        className="bg-accent text-[#000] border-none font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer w-full text-center hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all mt-2"
                        disabled={payLoading}
                      >
                        {payLoading ? (lang === 'tr' ? 'İşleniyor...' : 'Processing...') : (lang === 'tr' ? '450.00 TL Öde' : 'Pay 450.00 TL')}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </section>

            {/* WIDGET CUSTOMIZE */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-widget">
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                {lang === 'tr' ? '7. Widget Görünüm & Tema Ayarları' : '7. Widget Theme Customization'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Sitenize eklediğiniz sohbet penceresinin (widget) rengini, simgesini, karşılama mesajını, yuvarlaklık detaylarını ve koyu/açık mod durumunu yönetim panelinden tek tıkla sitenizle uyumlu hale getirebilirsiniz.'
                  : 'Match the chatbot widget with your corporate branding in the themes panel. Change primary brand colors, switch between dark and light themes, configure layouts, and customize the greeting message.'}
              </p>

              {/* Theme customization mockup with interactive theme sync */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  {lang === 'tr' ? 'Görsel Özelleştirici ve Canlı Önizleme' : 'Visual Customizer & Live Sync Preview'}
                </div>

                <div className="flex max-md:flex-col gap-6">
                  {/* Controls */}
                  <div className="flex-1 flex flex-col gap-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{lang === 'tr' ? 'Tema Seçimi' : 'Select Theme'}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setCustomTheme('light')}
                          className={`flex-1 py-1.5 px-3 rounded-lg border text-xs cursor-pointer font-semibold ${customTheme === 'light' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'}`}
                        >
                          ☀️ {lang === 'tr' ? 'Açık' : 'Light'}
                        </button>
                        <button 
                          onClick={() => setCustomTheme('dark')}
                          className={`flex-1 py-1.5 px-3 rounded-lg border text-xs cursor-pointer font-semibold ${customTheme === 'dark' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'}`}
                        >
                          🌙 {lang === 'tr' ? 'Koyu' : 'Dark'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{lang === 'tr' ? 'Ana Marka Rengi' : 'Primary Color'}</span>
                      <div className="flex gap-2">
                        {['#22c55e', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444'].map(color => (
                          <button
                            key={color}
                            onClick={() => setCustomColor(color)}
                            className="w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                            style={{ 
                              backgroundColor: color, 
                              borderColor: customColor === color ? '#fff' : 'transparent' 
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{lang === 'tr' ? 'Karşılama Mesajı' : 'Welcome Message'}</span>
                      <input 
                        className="bg-white/5 border border-white/10 p-2.5 rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent"
                        value={customGreeting}
                        onChange={(e) => setCustomGreeting(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Mock Chatbot Preview */}
                  <div className="w-[260px] shrink-0 rounded-2xl shadow-xl border overflow-hidden flex flex-col transition-all"
                    style={{ 
                      backgroundColor: customTheme === 'light' ? '#ffffff' : '#0d0d12',
                      borderColor: customTheme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)' 
                    }}
                  >
                    {/* Header */}
                    <div className="p-3.5 flex items-center justify-between text-white" style={{ backgroundColor: customColor }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍃</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold leading-tight">Ragleaf Bot</span>
                          <span className="text-[8px] text-white/80">{lang === 'tr' ? 'Çevrimiçi' : 'Online'}</span>
                        </div>
                      </div>
                      <span className="text-[10px] opacity-80">✕</span>
                    </div>

                    {/* Chat log */}
                    <div className="flex-1 p-3 flex flex-col gap-3 min-h-[140px] justify-end">
                      <div className="p-2.5 rounded-xl rounded-tl-none text-[11px] leading-relaxed max-w-[85%]"
                        style={{ 
                          backgroundColor: customTheme === 'light' ? '#f3f4f6' : 'rgba(255,255,255,0.04)',
                          color: customTheme === 'light' ? '#374151' : 'rgba(255,255,255,0.8)'
                        }}
                      >
                        {customGreeting}
                      </div>

                      <div className="p-2.5 rounded-xl rounded-tr-none text-[11px] leading-relaxed max-w-[85%] self-end text-white"
                        style={{ backgroundColor: customColor }}
                      >
                        {lang === 'tr' ? 'Merhaba! Bilgi alabilir miyim?' : 'Hi! Can I get some info?'}
                      </div>
                    </div>

                    {/* Input */}
                    <div className="p-2 border-t flex items-center justify-between gap-1.5"
                      style={{ 
                        borderColor: customTheme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' 
                      }}
                    >
                      <div className="text-[10px] text-text-muted ml-1">{lang === 'tr' ? 'Cevap yazın...' : 'Type a reply...'}</div>
                      <button className="border-none w-6 h-6 rounded-md flex items-center justify-center text-white cursor-pointer" style={{ backgroundColor: customColor }}>
                        ➢
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ANALYTICS */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="user-analytics">
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                {lang === 'tr' ? '8. Analitik & Konuşma Raporları' : '8. Dashboard Analytics & Reports'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Yönetim panelindeki Analitik menüsünden asistanınızın günlük sohbet sayılarını, rezervasyon başarı oranlarını, en çok sorulan kelimeleri, token harcamalarını ve biriken Ragleaf yaprağı (Leaves) loyalty puanlarınızı grafiklerle takip edebilirsiniz.'
                  : 'Track real-time conversation volumes, booking conversion rates, top FAQs, billing details, and accumulated Ragleaf loyalty points in the analytics dashboard.'}
              </p>

              {/* Analytics graph mockup */}
              <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-5 backdrop-blur-md w-full shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-5">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {lang === 'tr' ? 'Analitik Özet Dashboard' : 'Analytics Summary Panel'}
                  </div>
                  <div className="flex gap-1.5">
                    {['day', 'week', 'month'].map(r => (
                      <button
                        key={r}
                        onClick={() => setAnalyticsRange(r)}
                        className={`border-none px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${analyticsRange === r ? 'bg-accent text-black' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                      >
                        {r === 'day' && (lang === 'tr' ? 'Bugün' : 'Today')}
                        {r === 'week' && (lang === 'tr' ? 'Hafta' : 'Week')}
                        {r === 'month' && (lang === 'tr' ? 'Ay' : 'Month')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6 max-md:grid-cols-1">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                    <span className="text-[9px] uppercase tracking-wider text-text-muted">{lang === 'tr' ? 'Konuşmalar' : 'Conversations'}</span>
                    <div className="text-xl font-extrabold text-text-primary mt-1">
                      {analyticsRange === 'day' ? '142' : analyticsRange === 'week' ? '1,247' : '5,420'}
                    </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                    <span className="text-[9px] uppercase tracking-wider text-text-muted">{lang === 'tr' ? 'Rezervasyonlar' : 'Bookings'}</span>
                    <div className="text-xl font-extrabold text-text-primary mt-1">
                      {analyticsRange === 'day' ? '9' : analyticsRange === 'week' ? '89' : '390'}
                    </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                    <span className="text-[9px] uppercase tracking-wider text-text-muted">{lang === 'tr' ? 'Yaprak Birikimi' : 'Leaves loyalty'}</span>
                    <div className="text-xl font-extrabold text-accent mt-1 flex items-center gap-1">
                      {analyticsRange === 'day' ? '1,420' : analyticsRange === 'week' ? '12,470' : '54,200'} 🍃
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-text-muted uppercase tracking-wider mb-2">{lang === 'tr' ? 'Konuşma Yoğunluk Grafiği' : 'Conversation Volume Trend'}</div>
                <div className="flex items-end justify-between h-16 gap-1 bg-white/[0.01] p-2 rounded-lg border border-white/5">
                  {(analyticsRange === 'day' ? [20, 35, 48, 65, 80, 95, 85, 100] : analyticsRange === 'week' ? [30, 45, 40, 60, 55, 75, 85, 78, 90, 95, 88, 100] : [10, 20, 15, 30, 25, 40, 35, 50, 45, 60, 55, 70, 65, 80, 75, 90, 85, 100]).map((h, i) => (
                    <div 
                      key={i} 
                      className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-500" 
                      style={{ height: `${h}%` }} 
                    />
                  ))}
                </div>
              </div>
            </section>


            {/* ========================================================================= */}
            {/* ==================== GELİŞTİRİCİ DOKÜMANLARI (DEVELOPERS) ================ */}
            {/* ========================================================================= */}

            {/* QUICK START */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="quick-start">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 bg-accent/8 border border-accent/20 text-accent">
                ⚡ {lang === 'tr' ? 'Geliştirici Dokümanları' : 'Developer Docs'}
              </span>
              <h1 className="text-3xl font-extrabold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Hızlı Başlangıç' : 'Quick Start'}
              </h1>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' 
                  ? 'Ragleaf AI asistanınızı web sitenize entegre etmek sadece birkaç dakika sürer. Aşağıdaki adımları takip ederek hemen başlayın.'
                  : 'Integrating Ragleaf AI assistant to your website takes only a few minutes. Follow the steps below to start.'}
              </p>

              <h3 className="text-lg font-bold text-text-primary mt-8 mb-3">
                {lang === 'tr' ? '1. Script Etiketini Ekleyin' : '1. Add the Script Tag'}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-4">
                {lang === 'tr' ? 'HTML sayfanızın <body> tagının kapanışından önce aşağıdaki kodu ekleyin:' : 'Insert this snippet right before the closing </body> tag of your HTML pages:'}
              </p>
              
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTML</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `<script\n  src="https://cdn.ragleaf.com/widget.js"\n  data-agent-id="ag_your_agent_id"\n  data-api-key="rk_live_your_key"\n></script>`)}>
                    {lang === 'tr' ? 'Kopyala' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre">
                  <span className="text-cyan-400">&lt;script</span><br />
                  &nbsp;&nbsp;<span className="text-amber-300">src</span>=<span className="text-green-300">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;<span className="text-amber-300">data-agent-id</span>=<span className="text-green-300">"ag_your_agent_id"</span><br />
                  &nbsp;&nbsp;<span className="text-amber-300">data-api-key</span>=<span className="text-green-300">"rk_live_your_key"</span><br />
                  <span className="text-cyan-400">&gt;&lt;/script&gt;</span>
                </div>
              </div>

              <div className="p-3.5 px-4.5 rounded-lg mb-4 text-xs leading-relaxed flex gap-2.5 items-start bg-green-500/6 border border-green-500/15 text-text-secondary">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <div>
                  <strong>{lang === 'tr' ? 'İpucu:' : 'Tip:'}</strong> {lang === 'tr' ? 'Agent ID ve API Key değerlerinizi yönetim panelinizden bulabilirsiniz. Widget Kodu sayfasında kopyala-yapıştır hazır kodunuz sizi bekliyor.' : 'You can find your Agent ID and API Key inside your admin portal. A pre-built script snippet is ready for you.'}
                </div>
              </div>
            </section>

            {/* AUTHENTICATION */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="authentication">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Kimlik Doğrulama' : 'Authentication'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Tüm API istekleri, Authorization header\'ında Bearer token gerektirir. API anahtarınızı yönetim panelindeki "API Tokenları" sayfasından oluşturabilirsiniz.'
                  : 'All REST API queries require a Bearer token inside the Authorization header. You can generate API credentials in the API Tokens page of your dashboard.'}
              </p>
              
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTTP Header</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, 'Authorization: Bearer rk_live_your_api_key_here')}>
                    {lang === 'tr' ? 'Kopyala' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto">Authorization: Bearer rk_live_your_api_key_here</div>
              </div>
            </section>

            {/* WIDGET SETUP */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="widget-setup">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Widget Kurulumu' : 'Widget Installation'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Ragleaf sohbet widget\'ı, Shadow DOM izolasyonu kullanarak web sitenizin stillerini etkilemeden çalışır. Herhangi bir HTML sayfasına tek satır kodla entegre edilebilir.'
                  : 'Ragleaf chat widget runs isolated within the Shadow DOM to protect your page styling. Insert the script into any HTML index file to load the assistant.'}
              </p>
            </section>

            {/* WIDGET CONFIG */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="widget-config">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Widget Yapılandırma Seçenekleri' : 'Widget Configuration Options'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'Widget\'ın davranışını ve görünümünü data attribute\'ları ile kontrol edin.' : 'Configure parameters and metadata using HTML data attributes.'}
              </p>

              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead>
                  <tr>
                    <th>{lang === 'tr' ? 'Parametre' : 'Parameter'}</th>
                    <th>{lang === 'tr' ? 'Tip' : 'Type'}</th>
                    <th>{lang === 'tr' ? 'Varsayılan' : 'Default'}</th>
                    <th>{lang === 'tr' ? 'Açıklama' : 'Description'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono text-xs text-accent font-medium">data-agent-id</td>
                    <td className="text-[11px] text-text-muted italic">string</td>
                    <td><span className="text-red-500 text-[9px] font-bold uppercase">{lang === 'tr' ? 'zorunlu' : 'required'}</span></td>
                    <td>{lang === 'tr' ? 'Asistanınızın benzersiz kimliği' : 'Unique ID of the agent'}</td>
                  </tr>
                  <tr>
                    <td className="font-mono text-xs text-accent font-medium">data-api-key</td>
                    <td className="text-[11px] text-text-muted italic">string</td>
                    <td><span className="text-red-500 text-[9px] font-bold uppercase">{lang === 'tr' ? 'zorunlu' : 'required'}</span></td>
                    <td>{lang === 'tr' ? 'Widget API anahtarı' : 'Widget API credentials key'}</td>
                  </tr>
                  <tr>
                    <td className="font-mono text-xs text-accent font-medium">data-theme</td>
                    <td className="text-[11px] text-text-muted italic">string</td>
                    <td>light</td>
                    <td><code>light</code> {lang === 'tr' ? 'veya' : 'or'} <code>dark</code></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-xs text-accent font-medium">data-position</td>
                    <td className="text-[11px] text-text-muted italic">string</td>
                    <td>bottom-right</td>
                    <td><code>bottom-right</code>, <code>bottom-left</code></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-xs text-accent font-medium">data-primary-color</td>
                    <td className="text-[11px] text-text-muted italic">string</td>
                    <td>#22c55e</td>
                    <td>{lang === 'tr' ? 'Ana tema rengi (HEX)' : 'Primary brand theme color (HEX)'}</td>
                  </tr>
                  <tr>
                    <td className="font-mono text-xs text-accent font-medium">data-language</td>
                    <td className="text-[11px] text-text-muted italic">string</td>
                    <td>auto</td>
                    <td>{lang === 'tr' ? 'Widget dili (tr, en, de, fr vb.)' : 'Default widget locale (tr, en, de, etc.)'}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* WIDGET THEME */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="widget-theme">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Tema Özelleştirme (CSS)' : 'Theme Customization (CSS)'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'Widget\'ın görünümünü CSS değişkenleri ile tamamen özelleştirin.' : 'Override layout variables inside the shadow root using custom CSS custom properties.'}
              </p>
              
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">CSS</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `ragleaf-widget {\n  --rg-primary: #22c55e;\n  --rg-bg: #ffffff;\n  --rg-text: #1a1a1a;\n  --rg-border-radius: 16px;\n  --rg-font: 'Inter', sans-serif;\n}`)}>
                    {lang === 'tr' ? 'Kopyala' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre">
                  <span className="text-slate-500">/* Widget CSS variables */</span><br />
                  ragleaf-widget &#123;<br />
                  &nbsp;&nbsp;<span className="text-amber-300">--rg-primary</span>: <span className="text-green-300">#22c55e</span>;<br />
                  &nbsp;&nbsp;<span className="text-amber-300">--rg-bg</span>: <span className="text-green-300">#ffffff</span>;<br />
                  &nbsp;&nbsp;<span className="text-amber-300">--rg-text</span>: <span className="text-green-300">#1a1a1a</span>;<br />
                  &nbsp;&nbsp;<span className="text-amber-300">--rg-border-radius</span>: <span className="text-green-300">16px</span>;<br />
                  &nbsp;&nbsp;<span className="text-amber-300">--rg-font</span>: <span className="text-green-300">'Inter', sans-serif</span>;<br />
                  &#125;
                </div>
              </div>
            </section>

            {/* SHADOW DOM */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="shadow-dom">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Shadow DOM İzolasyonu' : 'Shadow DOM Isolation'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr'
                  ? 'Ragleaf widget\'ı Shadow DOM kullanarak çalışır. Bu, widget\'ın stillerinin sitenizin CSS\'ini etkilememesini ve sitenizin stillerinin widget\'ı bozmamasını garanti eder.'
                  : 'The chat element renders encapsulated inside a Shadow Root, protecting your website layout styles from being modified by the chat components and vice-versa.'}
              </p>
            </section>

            {/* CHAT COMPLETIONS */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="chat-completions">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                Chat Completions API
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'OpenAI uyumlu chat completions endpoint\'i. Mevcut uygulamalarınızı minimum değişiklikle Ragleaf\'e bağlayın.' : 'OpenAI-compliant chat completion endpoint. Connect custom web/mobile apps to Ragleaf database backend with minimal refactoring.'}
              </p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/v1/chat/completions</span>
                </div>
                <div className="p-5">
                  <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                    <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                      <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">cURL</span>
                      <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `curl -X POST https://api.ragleaf.com/v1/chat/completions \\\n  -H "Authorization: Bearer rk_live_xxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "messages": [\n      {"role": "user", "content": "Yarın saat 14:00 için randevu alabilir miyim?"}\n    ],\n    "stream": false\n  }'`)}>
                        {lang === 'tr' ? 'Kopyala' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre">
                      curl -X POST https://api.ragleaf.com/v1/chat/completions \<br />
                      &nbsp;&nbsp;-H <span className="text-green-300">"Authorization: Bearer rk_live_xxxxx"</span> \<br />
                      &nbsp;&nbsp;-H <span className="text-green-300">"Content-Type: application/json"</span> \<br />
                      &nbsp;&nbsp;-d <span className="text-green-300">{`'{
    "messages": [
      {"role": "user", "content": "Hello, how do I sign up?"}
    ],
    "stream": false
  }'`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* DOCUMENTS API */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="documents-api">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Doküman Yönetimi API' : 'Document Management API'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'AI asistanınızın bilgi tabanını programatik olarak yönetin. Doküman yükleme, listeleme ve silme.' : 'Programmatically manage the knowledge base vector entries of your chatbot. Upload, query, and delete documents.'}
              </p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/documents/upload</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-2">{lang === 'tr' ? 'Yeni bir doküman yükleyin (multipart/form-data).' : 'Ingest a new file (multipart/form-data).'}</p>
                </div>
              </div>
            </section>

            {/* AGENTS API */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="agents-api">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Agent Yönetimi API' : 'Agent Management API'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'AI asistanlarınızı oluşturun, yapılandırın ve yönetin.' : 'Create, customize, and deploy AI assistants.'}
              </p>
            </section>

            {/* WEBHOOK EVENTS */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="webhook-events">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Webhook Olay Tipleri' : 'Webhook Event Types'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'Ragleaf, belirli olaylar gerçekleştiğinde belirttiğiniz URL\'ye HTTP POST isteği gönderir.' : 'Receive automated event callbacks to a specified callback endpoint URL.'}
              </p>

              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead>
                  <tr><th>Olay</th><th>Açıklama</th></tr>
                </thead>
                <tbody>
                  <tr><td className="font-mono text-xs text-accent font-medium">conversation.started</td><td>{lang === 'tr' ? 'Yeni bir konuşma başladığında' : 'When a conversation starts'}</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">appointment.created</td><td>{lang === 'tr' ? 'Randevu oluşturulduğunda' : 'When an appointment is booked'}</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">payment.completed</td><td>{lang === 'tr' ? 'Ödeme tamamlandığında' : 'When an in-chat checkout finishes'}</td></tr>
                </tbody>
              </table>
            </section>

            {/* WEBHOOK SECURITY */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="webhook-security">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Webhook Güvenliği' : 'Webhook Security'}
              </h2>
              
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Node.js</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `const crypto = require('crypto');\n\nfunction verifyWebhook(payload, signature, secret) {\n  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');\n  return hash === signature;\n}`)}>
                    {lang === 'tr' ? 'Kopyala' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre">
                  <span className="text-fuchsia-400">const</span> crypto = <span className="text-blue-400">require</span>(<span className="text-green-300">'crypto'</span>);<br /><br />
                  <span className="text-fuchsia-400">function</span> <span className="text-blue-400">verifyWebhook</span>(payload, signature, secret) &#123;<br />
                  &nbsp;&nbsp;<span className="text-fuchsia-400">const</span> hash = crypto<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-blue-400">createHmac</span>(<span className="text-green-300">'sha256'</span>, secret)<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-blue-400">update</span>(payload)<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-blue-400">digest</span>(<span className="text-green-300">'hex'</span>);<br />
                  &nbsp;&nbsp;<span className="text-fuchsia-400">return</span> hash === signature;<br />
                  &#125;
                </div>
              </div>
            </section>

            {/* INTEGRATIONS */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="int-wordpress">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Platform Entegrasyonları' : 'Platform Integrations'}
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'WordPress veya React uygulamalarınız için aşağıdaki hazır kodları kullanabilirsiniz:' : 'Copy-paste code blocks to integrate directly with WordPress or React:'}
              </p>

              <h3 className="text-base font-bold text-text-primary mt-6 mb-2">WordPress (functions.php)</h3>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">PHP</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `add_action('wp_footer', function() {\n  echo '<script src="https://cdn.ragleaf.com/widget.js"\\n    data-agent-id="ag_xxxxx"\\n    data-api-key="rk_live_xxxxx"></script>';\n});`)}>
                    {lang === 'tr' ? 'Kopyala' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre">
                  <span className="text-blue-400">add_action</span>(<span className="text-green-300">'wp_footer'</span>, <span className="text-fuchsia-400">function</span>() &#123;<br />
                  &nbsp;&nbsp;<span className="text-fuchsia-400">echo</span> <span className="text-green-300">'&lt;script src="https://cdn.ragleaf.com/widget.js"<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;data-agent-id="ag_xxxxx"<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;data-api-key="rk_live_xxxxx"&gt;&lt;/script&gt;'</span>;<br />
                  &#125;);
                </div>
              </div>

              <h3 className="text-base font-bold text-text-primary mt-6 mb-2">React Component</h3>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">React</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `import { useEffect } from 'react';\n\nexport default function RagleafWidget() {\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = 'https://cdn.ragleaf.com/widget.js';\n    script.setAttribute('data-agent-id', 'ag_xxxxx');\n    script.setAttribute('data-api-key', 'rk_live_xxxxx');\n    document.body.appendChild(script);\n    return () => document.body.removeChild(script);\n  }, []);\n  return null;\n}`)}>
                    {lang === 'tr' ? 'Kopyala' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre">
                  <span className="text-fuchsia-400">import</span> &#123; useEffect &#125; <span className="text-fuchsia-400">from</span> <span className="text-green-300">'react'</span>;<br /><br />
                  <span className="text-fuchsia-400">export default function</span> <span className="text-blue-400">RagleafWidget</span>() &#123;<br />
                  &nbsp;&nbsp;<span className="text-blue-400">useEffect</span>(() =&gt; &#123;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-fuchsia-400">const</span> script = document.<span className="text-blue-400">createElement</span>(<span className="text-green-300">'script'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.src = <span className="text-green-300">'https://cdn.ragleaf.com/widget.js'</span>;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.setAttribute(<span className="text-green-300">'data-agent-id'</span>, <span className="text-green-300">'ag_xxxxx'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.setAttribute(<span className="text-green-300">'data-api-key'</span>, <span className="text-green-300">'rk_live_xxxxx'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;document.body.<span className="text-blue-400">appendChild</span>(script);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-fuchsia-400">return</span> () =&gt; document.body.<span className="text-blue-400">removeChild</span>(script);<br />
                  &nbsp;&nbsp;&#125;, []);<br />
                  &nbsp;&nbsp;<span className="text-fuchsia-400">return null</span>;<br />
                  &#125;
                </div>
              </div>
            </section>

            {/* ERROR CODES */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="error-codes">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                {lang === 'tr' ? 'Hata Kodları' : 'Error Codes'}
              </h2>
              
              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead>
                  <tr><th>Code</th><th>HTTP Status</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr><td className="font-mono text-accent">UNAUTHORIZED</td><td>401</td><td>{lang === 'tr' ? 'Geçersiz API Token' : 'Invalid API token credential'}</td></tr>
                  <tr><td className="font-mono text-accent">AGENT_NOT_FOUND</td><td>404</td><td>{lang === 'tr' ? 'Asistan bulunamadı' : 'The specified Agent ID does not exist'}</td></tr>
                  <tr><td className="font-mono text-accent">LIMIT_EXCEEDED</td><td>429</td><td>{lang === 'tr' ? 'Aylık sorgu limiti doldu' : 'Monthly search/query credits depleted'}</td></tr>
                </tbody>
              </table>
            </section>

            {/* RATE LIMITS */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom" id="rate-limits">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                Rate Limiting
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                {lang === 'tr' ? 'API rate limit limitleri dakikalık 120 istek ile sınırlandırılmıştır.' : 'Standard API endpoints limits are configured at a maximum of 120 requests per minute.'}
              </p>
            </section>

            {/* CHANGELOG */}
            <section className="docs-section mb-16 pb-12 border-b border-border-custom last:border-b-0" id="changelog">
              <h2 className="text-2xl font-bold text-text-primary mb-3 scroll-mt-20">
                Changelog
              </h2>
              <div className="flex flex-col gap-6">
                <div className="p-5 rounded-xl bg-white/[0.01] border border-white/5">
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-text-primary">v1.1.0 — {lang === 'tr' ? 'Canlı Destek & Rezervasyon Akışları' : 'Live widget & reservation modules'}</span>
                    <span className="text-[10px] text-text-muted">June 2026</span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed m-0">
                    {lang === 'tr' ? 'Canlı randevu, masa rezervasyonu ve sohbet içi kredi kartı ile ödeme modülleri yayına alındı.' : 'Released live appointment schedules, table reservations, and secure in-chat credit card payment integration.'}
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-white/[0.01] border border-white/5">
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-text-primary">v1.0.0 — {lang === 'tr' ? 'İlk Sürüm Yayını' : 'Initial Public Release'}</span>
                    <span className="text-[10px] text-text-muted">May 2026</span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed m-0">
                    {lang === 'tr' ? 'Ragleaf platformunun temeli, veri yükleme/RAG servisleri ve chat widget entegrasyonu tamamlandı.' : 'Initial release of core RAG indexing, custom knowledge ingestion systems, and embeddable widget.'}
                  </p>
                </div>
              </div>
            </section>

          </main>
        </div>
      </div>

      {/* MOBILE SIDEBAR TOGGLE */}
      <button
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-accent text-white border-none text-xl cursor-pointer flex items-center justify-center shadow-[0_4px_20px_rgba(34,197,94,0.4)] hidden max-lg:flex"
        id="docsSidebarToggle"
        aria-label="Menü"
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      >
        ☰
      </button>
    </PageLayout>
  );
}

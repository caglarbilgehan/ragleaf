"use client";

import React, { useState, useEffect } from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';


export default function DevelopersClient() {
  const { lang, t } = useLang();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('quick-start');
  const [sidebarStyle, setSidebarStyle] = useState({});

  const copyCode = (e, text) => {
    const btn = e.currentTarget;
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = t('dev_copied');
      setTimeout(() => {
        btn.textContent = t('dev_copy');
      }, 2000);
    });
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newTop = Math.max(70, 70 - scrollY);
      setSidebarStyle({ top: `${newTop}px` });

      const sections = document.querySelectorAll('.docs-section');
      let current = 'quick-start';
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

  const sidebarLinks = [
    {
      label: { tr: '🚀 Başlangıç', en: '🚀 Getting Started' },
      links: [
        { id: 'quick-start', label: { tr: 'Hızlı Başlangıç', en: 'Quick Start' } },
        { id: 'authentication', label: { tr: 'Kimlik Doğrulama', en: 'Authentication' } }
      ]
    },
    {
      label: { tr: '🧩 Web SDK', en: '🧩 Web SDK' },
      links: [
        { id: 'widget-setup', label: { tr: 'Widget Kurulumu', en: 'Widget Installation' } },
        { id: 'widget-config', label: { tr: 'Yapılandırma', en: 'Configuration' } },
        { id: 'widget-theme', label: { tr: 'Tema Özelleştirme', en: 'Theme Customization' } },
        { id: 'shadow-dom', label: { tr: 'Shadow DOM', en: 'Shadow DOM' } }
      ]
    },
    {
      label: { tr: '⚡ REST API', en: '⚡ REST API' },
      links: [
        { id: 'chat-completions', label: { tr: 'Chat Completions', en: 'Chat Completions' } },
        { id: 'documents-api', label: { tr: 'Doküman Yönetimi', en: 'Document Management' } },
        { id: 'agents-api', label: { tr: 'Agent Yönetimi', en: 'Agent Management' } },
        { id: 'templates-api', label: { tr: 'Şablon API', en: 'Template API' } }
      ]
    },
    {
      label: { tr: '🔗 Webhook', en: '🔗 Webhook' },
      links: [
        { id: 'webhook-events', label: { tr: 'Olay Tipleri', en: 'Event Types' } },
        { id: 'webhook-security', label: { tr: 'Webhook Güvenliği', en: 'Webhook Security' } }
      ]
    },
    {
      label: { tr: '📦 Entegrasyonlar', en: '📦 Integrations' },
      links: [
        { id: 'int-wordpress', label: { tr: 'WordPress', en: 'WordPress' } },
        { id: 'int-shopify', label: { tr: 'Shopify', en: 'Shopify' } },
        { id: 'int-react', label: { tr: 'React / Vue', en: 'React / Vue' } },
        { id: 'int-nextjs', label: { tr: 'Next.js', en: 'Next.js' } },
        { id: 'int-webflow', label: { tr: 'Webflow', en: 'Webflow' } }
      ]
    },
    {
      label: { tr: '📋 Referans', en: '📋 Reference' },
      links: [
        { id: 'error-codes', label: { tr: 'Hata Kodları', en: 'Error Codes' } },
        { id: 'rate-limits', label: { tr: 'Rate Limiting', en: 'Rate Limiting' } },
        { id: 'changelog', label: { tr: 'Changelog', en: 'Changelog' } }
      ]
    }
  ];

  return (
    <>
      

      <div className="page-layout">
        <div className="flex mt-0 max-lg:block max-w-[1280px] mx-auto w-full px-0 relative">
          {/* SIDEBAR */}
          <aside className={`w-[280px] shrink-0 sticky top-[70px] h-[calc(100vh-70px)] overflow-y-auto bg-[#0a0a0f]/95 border-r border-border-custom py-6 pl-0 pr-4 z-10 max-lg:fixed max-lg:top-[60px] max-lg:w-[280px] max-lg:h-[calc(100vh-60px)] max-lg:transition-[left] max-lg:duration-300 max-lg:z-50 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full ${mobileSidebarOpen ? "max-lg:left-0!" : "max-lg:-left-[300px]"}`} id="docsSidebar" style={sidebarStyle}>
          {sidebarLinks.map((section, idx) => (
            <div key={idx} className="px-4 mb-3">
              <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold py-3 flex items-center gap-1.5">
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

        {/* CONTENT */}
        {lang === 'tr' ? (
          <main className="flex-1 max-w-[900px] p-10 pb-20 max-lg:p-5 max-lg:pb-20">
            {/* QUICK START */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="quick-start">
              <h1 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Hızlı Başlangıç</h1>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                Ragleaf AI asistanınızı web sitenize entegre etmek sadece birkaç dakika sürer.
                Aşağıdaki adımları takip ederek hemen başlayın.
              </p>

              <h3 className="text-xl font-bold text-text-primary mt-8 mb-3 scroll-mt-20">1. Script Tag'ını Ekleyin</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">HTML sayfanızın <code>&lt;body&gt;</code> tagının kapanışından önce aşağıdaki kodu ekleyin:</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTML</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `<script\n  src="https://cdn.ragleaf.com/widget.js"\n  data-agent-id="ag_your_agent_id"\n  data-api-key="rk_live_your_key"\n></script>`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="tag">&lt;script</span><br />
                  &nbsp;&nbsp;<span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_your_agent_id"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_your_key"</span><br />
                  <span className="tag">&gt;&lt;/script&gt;</span>
                </div>
              </div>

              <div className="p-3.5 px-4.5 rounded-lg mb-4 text-xs leading-relaxed flex gap-2.5 items-start bg-green-500/6 border border-green-500/15 text-text-secondary">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <div><strong>İpucu:</strong> Agent ID and API Key değerlerinizi <a href="#" className="text-accent hover:underline">yönetim panelinizden</a> bulabilirsiniz. Widget Kodu sayfasında kopyala-yapıştır hazır kodunuz sizi bekliyor.</div>
              </div>

              <h3 className="text-xl font-bold text-text-primary mt-8 mb-3 scroll-mt-20">2. Yapılandırın (Opsiyonel)</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">Widget'ın görünümünü ve davranışını data attribute'ları ile özelleştirin:</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTML</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `<script\n  src="https://cdn.ragleaf.com/widget.js"\n  data-agent-id="ag_your_agent_id"\n  data-api-key="rk_live_your_key"\n  data-theme="dark"\n  data-position="bottom-right"\n  data-primary-color="#22c55e"\n  data-language="tr"\n></script>`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="tag">&lt;script</span><br />
                  &nbsp;&nbsp;<span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_your_agent_id"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_your_key"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-theme</span>=<span className="str">"dark"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-position</span>=<span className="str">"bottom-right"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-primary-color</span>=<span className="str">"#22c55e"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-language</span>=<span className="str">"tr"</span><br />
                  <span className="tag">&gt;&lt;/script&gt;</span>
                </div>
              </div>
            </section>

            {/* AUTHENTICATION */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="authentication">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Kimlik Doğrulama</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                Tüm API istekleri, <code>Authorization</code> header'ında Bearer token gerektirir.
                API anahtarınızı yönetim panelindeki "API Tokenları" sayfasından oluşturabilirsiniz.
              </p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTTP Header</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, 'Authorization: Bearer rk_live_your_api_key_here')}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">Authorization: Bearer rk_live_your_api_key_here</div>
              </div>
              <div className="p-3.5 px-4.5 rounded-lg mb-4 text-xs leading-relaxed flex gap-2.5 items-start bg-amber-500/6 border border-amber-500/15 text-text-secondary">
                <span className="text-base shrink-0 mt-0.5">⚠️</span>
                <div><strong>Dikkat:</strong> API anahtarınızı asla istemci tarafında (frontend) açık olarak kullanmayın. Widget entegrasyonu için ayrı bir <code>data-api-key</code> kullanılır, bu anahtar sadece chat iletişimi için yetkilendirilmiştir.</div>
              </div>
            </section>

            {/* WIDGET SETUP */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="widget-setup">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Widget Kurulumu</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                Ragleaf sohbet widget'ı, Shadow DOM izolasyonu kullanarak web sitenizin stillerini etkilemeden çalışır.
                Herhangi bir HTML sayfasına tek satır kodla entegre edilebilir.
              </p>

              <h3 className="text-xl font-bold text-text-primary mt-8 mb-3 scroll-mt-20">Temel Kurulum</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">Aşağıdaki script tag'ını sitenizin herhangi bir yerine ekleyin. Widget otomatik olarak yüklenir ve sağ alt köşede görünür.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTML</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `<script src="https://cdn.ragleaf.com/widget.js"\n  data-agent-id="ag_xxxxx"\n  data-api-key="rk_live_xxxxx"></script>`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="tag">&lt;script</span> <span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_xxxxx"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_xxxxx"</span><br />
                  <span className="tag">&gt;&lt;/script&gt;</span>
                </div>
              </div>
            </section>

            {/* WIDGET CONFIG */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="widget-config">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Widget Yapılandırma Seçenekleri</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Widget'ın davranışını ve görünümünü data attribute'ları ile kontrol edin.</p>
              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead>
                  <tr><th>Parametre</th><th>Tip</th><th>Varsayılan</th><th>Açıklama</th></tr>
                </thead>
                <tbody>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-agent-id</td><td className="text-[11px] text-text-muted italic">string</td><td><span className="text-red-500 text-[9px] font-bold uppercase">zorunlu</span></td><td>Asistanınızın benzersiz kimliği</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-api-key</td><td className="text-[11px] text-text-muted italic">string</td><td><span className="text-red-500 text-[9px] font-bold uppercase">zorunlu</span></td><td>Widget API anahtarı</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-theme</td><td className="text-[11px] text-text-muted italic">string</td><td>light</td><td><code>light</code> veya <code>dark</code></td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-position</td><td className="text-[11px] text-text-muted italic">string</td><td>bottom-right</td><td><code>bottom-right</code>, <code>bottom-left</code></td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-primary-color</td><td className="text-[11px] text-text-muted italic">string</td><td>#22c55e</td><td>Ana tema rengi (HEX)</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-language</td><td className="text-[11px] text-text-muted italic">string</td><td>auto</td><td>Widget dili (tr, en, de, fr, vb.)</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-greeting</td><td className="text-[11px] text-text-muted italic">string</td><td>-</td><td>Özel karşılama mesajı</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-avatar</td><td className="text-[11px] text-text-muted italic">string</td><td>-</td><td>Asistan avatar URL'si</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-auto-open</td><td className="text-[11px] text-text-muted italic">boolean</td><td>false</td><td>Sayfa yüklendiğinde otomatik aç</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-hide-branding</td><td className="text-[11px] text-text-muted italic">boolean</td><td>false</td><td>Ragleaf markasını gizle (Pro+)</td></tr>
                </tbody>
              </table>
            </section>

            {/* WIDGET THEME */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="widget-theme">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Tema Özelleştirme</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Widget'ın görünümünü CSS değişkenleri ile tamamen özelleştirin.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">CSS</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `/* Widget CSS değişkenleri */\nragleaf-widget {\n  --rg-primary: #22c55e;\n  --rg-bg: #ffffff;\n  --rg-text: #1a1a1a;\n  --rg-border-radius: 16px;\n  --rg-font: 'Inter', sans-serif;\n}`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="cm">/* Widget CSS değişkenleri */</span><br />
                  ragleaf-widget &#123;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-primary</span>: <span className="str">#22c55e</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-bg</span>: <span className="str">#ffffff</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-text</span>: <span className="str">#1a1a1a</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-border-radius</span>: <span className="str">16px</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-font</span>: <span className="str">'Inter', sans-serif</span>;<br />
                  &#125;
                </div>
              </div>
            </section>

            {/* SHADOW DOM */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="shadow-dom">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Shadow DOM İzolasyonu</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                Ragleaf widget'ı Shadow DOM kullanarak çalışır. Bu, widget'ın stillerinin sitenizin CSS'ini etkilememesini
                ve sitenizin stillerinin widget'ı bozmamasını garanti eder.
              </p>
              <div className="p-3.5 px-4.5 rounded-lg mb-4 text-xs leading-relaxed flex gap-2.5 items-start bg-green-500/6 border border-green-500/15 text-text-secondary">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <div>Shadow DOM izolasyonu sayesinde widget, WordPress tema çakışmaları, Tailwind CSS sıfırlamaları ve Bootstrap stilleriyle sorunsuz çalışır.</div>
              </div>
            </section>

            {/* CHAT COMPLETIONS API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="chat-completions">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Chat Completions API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">OpenAI uyumlu chat completions endpoint'i. Mevcut uygulamalarınızı minimum değişiklikle Ragleaf'e bağlayın.</p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/v1/chat/completions</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">AI asistanınıza mesaj gönderin ve RAG destekli yanıt alın. Streaming ve JSON modlarını destekler.</p>
                  <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                    <thead>
                      <tr><th>Parametre</th><th>Tip</th><th></th><th>Açıklama</th></tr>
                    </thead>
                    <tbody>
                      <tr><td className="font-mono text-xs text-accent font-medium">messages</td><td className="text-[11px] text-text-muted italic">array</td><td><span className="text-red-500 text-[9px] font-bold uppercase">zorunlu</span></td><td>Konuşma mesajları dizisi</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">stream</td><td className="text-[11px] text-text-muted italic">boolean</td><td></td><td>SSE streaming aktif mi</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">temperature</td><td className="text-[11px] text-text-muted italic">number</td><td></td><td>Yaratıcılık seviyesi (0-2)</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">max_tokens</td><td className="text-[11px] text-text-muted italic">number</td><td></td><td>Maksimum yanıt uzunluğu</td></tr>
                    </tbody>
                  </table>
                  <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                    <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                      <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">cURL</span>
                      <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `curl -X POST https://api.ragleaf.com/v1/chat/completions \\\n  -H "Authorization: Bearer rk_live_xxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "messages": [\n      {"role": "user", "content": "Yarın saat 14:00 için randevu alabilir miyim?"}\n    ],\n    "stream": false\n  }'`)}>Kopyala</button>
                    </div>
                    <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                      curl -X POST https://api.ragleaf.com/v1/chat/completions \<br />
                      &nbsp;&nbsp;-H <span className="str">"Authorization: Bearer rk_live_xxxxx"</span> \<br />
                      &nbsp;&nbsp;-H <span className="str">"Content-Type: application/json"</span> \<br />
                      &nbsp;&nbsp;-d <span className="str">{`'{
    "messages": [
      {"role": "user", "content": "Yarın saat 14:00 için randevu alabilir miyim?"}
    ],
    "stream": false
  }'`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* DOCUMENTS API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="documents-api">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Doküman Yönetimi API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">AI asistanınızın bilgi tabanını programatik olarak yönetin. Doküman yükleme, listeleme ve silme.</p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/documents/upload</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Yeni bir doküman yükleyin. Desteklenen formatlar: PDF, DOCX, TXT, MD, HTML, PNG, JPG.</p>
                  <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                    <thead><tr><th>Parametre</th><th>Tip</th><th></th><th>Açıklama</th></tr></thead>
                    <tbody>
                      <tr><td className="font-mono text-xs text-accent font-medium">file</td><td className="text-[11px] text-text-muted italic">file</td><td><span className="text-red-500 text-[9px] font-bold uppercase">zorunlu</span></td><td>Yüklenecek dosya (multipart/form-data)</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">agent_id</td><td className="text-[11px] text-text-muted italic">string</td><td><span className="text-red-500 text-[9px] font-bold uppercase">zorunlu</span></td><td>Hedef asistanın ID'si</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">category</td><td className="text-[11px] text-text-muted italic">string</td><td></td><td>Doküman kategorisi</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">GET</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/documents</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Tüm dokümanları listeleyin. Sayfalama ve filtreleme destekler.</p>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-red-500/15 text-red-500 border border-red-500/30">DELETE</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/documents/&#123;id&#125;</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Belirtilen dokümanı ve ilişkili vektörlerini kalıcı olarak silin.</p>
                </div>
              </div>
            </section>

            {/* AGENTS API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="agents-api">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Agent Yönetimi API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">AI asistanlarınızı oluşturun, yapılandırın ve yönetin.</p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">GET</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/org/agents</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Organizasyonunuzdaki tüm asistanları listeleyin.</p>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/agents</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Yeni bir AI asistanı oluşturun.</p>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-amber-500/15 text-amber-500 border border-amber-500/30">PUT</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/agents/&#123;id&#125;</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Mevcut asistanın ayarlarını güncelleyin (prompt, isim, yapılandırma vb.).</p>
                </div>
              </div>
            </section>

            {/* TEMPLATES API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="templates-api">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Şablon API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Hazır sektörel şablonları listeleyin ve kullanarak hızlıca asistan oluşturun.</p>
              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">GET</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/templates</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Tüm kullanılabilir sektörel şablonları listeleyin.</p>
                </div>
              </div>
            </section>

            {/* WEBHOOK EVENTS */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="webhook-events">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Webhook Olay Tipleri</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Ragleaf, belirli olaylar gerçekleştiğinde belirttiğiniz URL'ye HTTP POST isteği gönderir.</p>
              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead><tr><th>Olay</th><th>Açıklama</th></tr></thead>
                <tbody>
                  <tr><td className="font-mono text-xs text-accent font-medium">conversation.started</td><td>Yeni bir konuşma başladığında</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">conversation.ended</td><td>Konuşma sonlandığında</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">message.received</td><td>Kullanıcıdan yeni mesaj geldiğinde</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">appointment.created</td><td>Randevu oluşturulduğunda</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">payment.completed</td><td>Ödeme tamamlandığında</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">document.processed</td><td>Doküman işleme tamamlandığında</td></tr>
                </tbody>
              </table>
            </section>

            {/* WEBHOOK SECURITY */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="webhook-security">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Webhook Güvenliği</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Her webhook isteği, <code>X-Ragleaf-Signature</code> header'ı ile imzalanır. Bu imzayı doğrulayarak isteğin gerçekten Ragleaf'ten geldiğinden emin olun.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Node.js</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `const crypto = require('crypto');\n\nfunction verifyWebhook(payload, signature, secret) {\n  const hash = crypto\n    .createHmac('sha256', secret)\n    .update(payload)\n    .digest('hex');\n  return hash === signature;\n}`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="kw">const</span> crypto = <span className="fn">require</span>(<span className="str">'crypto'</span>);<br /><br />
                  <span className="kw">function</span> <span className="fn">verifyWebhook</span>(payload, signature, secret) &#123;<br />
                  &nbsp;&nbsp;<span className="kw">const</span> hash = crypto<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="fn">createHmac</span>(<span className="str">'sha256'</span>, secret)<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="fn">update</span>(payload)<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="fn">digest</span>(<span className="str">'hex'</span>);<br />
                  &nbsp;&nbsp;<span className="kw">return</span> hash === signature;<br />
                  &#125;
                </div>
              </div>
            </section>

            {/* INTEGRATIONS */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-wordpress">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">WordPress Entegrasyonu</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">WordPress sitenize Ragleaf widget'ını eklemenin en kolay yolu, temanızın <code>functions.php</code> dosyasına aşağıdaki kodu eklemektir.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">PHP</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `// functions.php dosyanıza ekleyin\nadd_action('wp_footer', function() {\n  echo '<script src="https://cdn.ragleaf.com/widget.js"\\n    data-agent-id="ag_xxxxx"\\n    data-api-key="rk_live_xxxxx"></script>';\n});`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="cm">// functions.php dosyanıza ekleyin</span><br />
                  <span className="fn">add_action</span>(<span className="str">'wp_footer'</span>, <span className="kw">function</span>() &#123;<br />
                  &nbsp;&nbsp;<span className="kw">echo</span> <span className="str">'&lt;script src="https://cdn.ragleaf.com/widget.js"<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;data-agent-id="ag_xxxxx"<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;data-api-key="rk_live_xxxxx"&gt;&lt;/script&gt;'</span>;<br />
                  &#125;);
                </div>
              </div>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-shopify">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Shopify Entegrasyonu</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Shopify mağazanıza widget eklemek için <strong>Online Store → Themes → Edit Code</strong> yolunu izleyin ve <code>theme.liquid</code> dosyasının kapanış <code>&lt;/body&gt;</code> etiketinden önce script tag'ını ekleyin.</p>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-react">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">React / Vue Entegrasyonu</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">SPA uygulamalarında widget'ı dinamik olarak yükleyin.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">React</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `import { useEffect } from 'react';\n\nfunction RagleafWidget() {\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = 'https://cdn.ragleaf.com/widget.js';\n    script.setAttribute('data-agent-id', 'ag_xxxxx');\n    script.setAttribute('data-api-key', 'rk_live_xxxxx');\n    document.body.appendChild(script);\n    return () => document.body.removeChild(script);\n  }, []);\n  return null;\n}`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="kw">import</span> &#123; <span className="fn">useEffect</span> &#125; <span className="kw">from</span> <span className="str">'react'</span>;<br /><br />
                  <span className="kw">function</span> <span className="fn">RagleafWidget</span>() &#123;<br />
                  &nbsp;&nbsp;<span className="fn">useEffect</span>(() =&gt; &#123;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="kw">const</span> script = document.<span className="fn">createElement</span>(<span className="str">'script'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.src = <span className="str">'https://cdn.ragleaf.com/widget.js'</span>;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.setAttribute(<span className="str">'data-agent-id'</span>, <span className="str">'ag_xxxxx'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.setAttribute(<span className="str">'data-api-key'</span>, <span className="str">'rk_live_xxxxx'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;document.body.<span className="fn">appendChild</span>(script);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="kw">return</span> () =&gt; document.body.<span className="fn">removeChild</span>(script);<br />
                  &nbsp;&nbsp;&#125;, []);<br />
                  &nbsp;&nbsp;<span className="kw">return null</span>;<br />
                  &#125;
                </div>
              </div>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-nextjs">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Next.js Entegrasyonu</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Next.js'in <code>Script</code> bileşeni ile optimum yükleme.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Next.js</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `import Script from 'next/script';\n\nexport default function Layout({ children }) {\n  return (\n    <>\n      {children}\n      <Script\n        src="https://cdn.ragleaf.com/widget.js"\n        data-agent-id="ag_xxxxx"\n        data-api-key="rk_live_xxxxx"\n        strategy="lazyOnload"\n      />\n    </>\n  );\n}`)}>Kopyala</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="kw">import</span> Script <span className="kw">from</span> <span className="str">'next/script'</span>;<br /><br />
                  <span className="kw">export default function</span> <span className="fn">Layout</span>(&#123; children &#125;) &#123;<br />
                  &nbsp;&nbsp;<span className="kw">return</span> (<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&lt;&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#123;children&#125;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;Script<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_xxxxx"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_xxxxx"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">strategy</span>=<span className="str">"lazyOnload"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&lt;/&gt;<br />
                  &nbsp;&nbsp;);<br />
                  &#125;
                </div>
              </div>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-webflow">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Webflow Entegrasyonu</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6"><strong>Project Settings → Custom Code → Footer Code</strong> bölümüne widget script tag'ını ekleyin. Webflow'un custom code alanı widget ile sorunsuz çalışır.</p>
            </section>

            {/* ERROR CODES */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="error-codes">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Hata Kodları</h2>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-green-500">200</span>
                  <span className="text-xs text-text-secondary">Başarılı — İstek başarıyla işlendi</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-green-500">201</span>
                  <span className="text-xs text-text-secondary">Oluşturuldu — Kaynak başarıyla oluşturuldu</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">400</span>
                  <span className="text-xs text-text-secondary">Kötü İstek — İstek parametreleri hatalı</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">401</span>
                  <span className="text-xs text-text-secondary">Yetkisiz — Geçersiz veya eksik API anahtarı</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">403</span>
                  <span className="text-xs text-text-secondary">Yasaklandı — Bu kaynağa erişim yetkiniz yok</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">404</span>
                  <span className="text-xs text-text-secondary">Bulunamadı — İstenen kaynak mevcut değil</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">429</span>
                  <span className="text-xs text-text-secondary">Rate Limit — Çok fazla istek gönderildi</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-red-500">500</span>
                  <span className="text-xs text-text-secondary">Sunucu Hatası — Beklenmeyen bir hata oluştu</span>
                </div>
              </div>
            </section>

            {/* RATE LIMITS */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="rate-limits">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Rate Limiting</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">API istekleri, planınıza göre rate limit'e tabidir. Limitleri aşarsanız <code>429</code> yanıt kodu alırsınız.</p>
              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead><tr><th>Plan</th><th>Chat API</th><th>Document API</th><th>Diğer</th></tr></thead>
                <tbody>
                  <tr><td className="font-mono text-xs text-accent font-medium">Free</td><td>60 req/dk</td><td>10 req/dk</td><td>30 req/dk</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">Starter</td><td>300 req/dk</td><td>60 req/dk</td><td>120 req/dk</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">Pro</td><td>1000 req/dk</td><td>200 req/dk</td><td>500 req/dk</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">Enterprise</td><td>Özel</td><td>Özel</td><td>Özel</td></tr>
                </tbody>
              </table>
            </section>

            {/* CHANGELOG */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="changelog">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Changelog</h2>
              <div className="flex flex-col gap-4">
                <div className="py-4 px-5 bg-white/[0.02] border border-border-custom rounded-[10px]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="py-[3px] px-2 bg-accent/10 border border-accent/20 rounded text-[11px] font-bold text-accent">v1.4.0</span>
                    <span className="text-[11px] text-text-muted">Haziran 2026</span>
                  </div>
                  <ul className="list-none p-0 m-0 text-[13px] text-text-secondary leading-[1.8]">
                    <li>✅ Çoklu dil desteği (42 dil)</li>
                    <li>✅ WhatsApp ve Telegram entegrasyonu</li>
                    <li>✅ Sektörel şablon sistemi</li>
                    <li>✅ Randevu ve ödeme akışları</li>
                  </ul>
                </div>
                <div className="py-4 px-5 bg-white/[0.02] border border-border-custom rounded-[10px]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="py-[3px] px-2 bg-text-muted/10 border border-text-muted/20 rounded text-[11px] font-bold text-text-muted">v1.3.0</span>
                    <span className="text-[11px] text-text-muted">Mayıs 2026</span>
                  </div>
                  <ul className="list-none p-0 m-0 text-[13px] text-text-secondary leading-[1.8]">
                    <li>✅ OCR destekli doküman işleme</li>
                    <li>✅ Chunk enrichment pipeline</li>
                    <li>✅ RAG Analytics dashboard</li>
                  </ul>
                </div>
              </div>
            </section>
          </main>
        ) : (
          <main className="flex-1 max-w-[900px] p-10 pb-20 max-lg:p-5 max-lg:pb-20">
            {/* QUICK START */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="quick-start">
              <h1 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Quick Start</h1>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                Integrating your Ragleaf AI assistant into your website only takes a few minutes.
                Follow the steps below to get started immediately.
              </p>

              <h3 className="text-xl font-bold text-text-primary mt-8 mb-3 scroll-mt-20">1. Add the Script Tag</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">Add the following code before the closing <code>&lt;/body&gt;</code> tag of your HTML page:</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTML</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `<script\n  src="https://cdn.ragleaf.com/widget.js"\n  data-agent-id="ag_your_agent_id"\n  data-api-key="rk_live_your_key"\n></script>`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="tag">&lt;script</span><br />
                  &nbsp;&nbsp;<span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_your_agent_id"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_your_key"</span><br />
                  <span className="tag">&gt;&lt;/script&gt;</span>
                </div>
              </div>

              <div className="p-3.5 px-4.5 rounded-lg mb-4 text-xs leading-relaxed flex gap-2.5 items-start bg-green-500/6 border border-green-500/15 text-text-secondary">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <div><strong>Tip:</strong> You can find your Agent ID and API Key values in your <a href="#" className="text-accent hover:underline">admin panel</a>. Your ready-to-use copy-paste code is waiting for you on the Widget Code page.</div>
              </div>

              <h3 className="text-xl font-bold text-text-primary mt-8 mb-3 scroll-mt-20">2. Configure (Optional)</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">Customize the appearance and behavior of the widget with data attributes:</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTML</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `<script\n  src="https://cdn.ragleaf.com/widget.js"\n  data-agent-id="ag_your_agent_id"\n  data-api-key="rk_live_your_key"\n  data-theme="dark"\n  data-position="bottom-right"\n  data-primary-color="#22c55e"\n  data-language="en"\n></script>`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="tag">&lt;script</span><br />
                  &nbsp;&nbsp;<span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_your_agent_id"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_your_key"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-theme</span>=<span className="str">"dark"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-position</span>=<span className="str">"bottom-right"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-primary-color</span>=<span className="str">"#22c55e"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-language</span>=<span className="str">"en"</span><br />
                  <span className="tag">&gt;&lt;/script&gt;</span>
                </div>
              </div>
            </section>

            {/* AUTHENTICATION */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="authentication">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Authentication</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                All API requests require a Bearer token in the <code>Authorization</code> header.
                You can create your API key on the "API Tokens" page in the admin panel.
              </p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTTP Header</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, 'Authorization: Bearer rk_live_your_api_key_here')}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">Authorization: Bearer rk_live_your_api_key_here</div>
              </div>
              <div className="p-3.5 px-4.5 rounded-lg mb-4 text-xs leading-relaxed flex gap-2.5 items-start bg-amber-500/6 border border-amber-500/15 text-text-secondary">
                <span className="text-base shrink-0 mt-0.5">⚠️</span>
                <div><strong>Caution:</strong> Never expose your API key on the client side (frontend). A separate <code>data-api-key</code> is used for widget integration, which is only authorized for chat communication.</div>
              </div>
            </section>

            {/* WIDGET SETUP */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="widget-setup">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Widget Installation</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                The Ragleaf chat widget runs using Shadow DOM isolation to ensure widget styles do not affect your site's CSS and vice versa.
                It can be integrated into any HTML page with a single line of code.
              </p>

              <h3 className="text-xl font-bold text-text-primary mt-8 mb-3 scroll-mt-20">Basic Setup</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">Add the following script tag anywhere in your site. The widget will load automatically and appear in the bottom right corner.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">HTML</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `<script src="https://cdn.ragleaf.com/widget.js"\n  data-agent-id="ag_xxxxx"\n  data-api-key="rk_live_xxxxx"></script>`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="tag">&lt;script</span> <span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_xxxxx"</span><br />
                  &nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_xxxxx"</span><br />
                  <span className="tag">&gt;&lt;/script&gt;</span>
                </div>
              </div>
            </section>

            {/* WIDGET CONFIG */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="widget-config">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Widget Configuration Options</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Control the behavior and appearance of the widget using data attributes.</p>
              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead>
                  <tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-agent-id</td><td className="text-[11px] text-text-muted italic">string</td><td><span className="text-red-500 text-[9px] font-bold uppercase">required</span></td><td>Your assistant's unique ID</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-api-key</td><td className="text-[11px] text-text-muted italic">string</td><td><span className="text-red-500 text-[9px] font-bold uppercase">required</span></td><td>Widget API key</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-theme</td><td className="text-[11px] text-text-muted italic">string</td><td>light</td><td><code>light</code> or <code>dark</code></td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-position</td><td className="text-[11px] text-text-muted italic">string</td><td>bottom-right</td><td><code>bottom-right</code>, <code>bottom-left</code></td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-primary-color</td><td className="text-[11px] text-text-muted italic">string</td><td>#22c55e</td><td>Primary theme color (HEX)</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-language</td><td className="text-[11px] text-text-muted italic">string</td><td>auto</td><td>Widget language (tr, en, de, fr, etc.)</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-greeting</td><td className="text-[11px] text-text-muted italic">string</td><td>-</td><td>Custom greeting message</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-avatar</td><td className="text-[11px] text-text-muted italic">string</td><td>-</td><td>Assistant avatar URL</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-auto-open</td><td className="text-[11px] text-text-muted italic">boolean</td><td>false</td><td>Auto open when page loads</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">data-hide-branding</td><td className="text-[11px] text-text-muted italic">boolean</td><td>false</td><td>Hide Ragleaf branding (Pro+)</td></tr>
                </tbody>
              </table>
            </section>

            {/* WIDGET THEME */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="widget-theme">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Theme Customization</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Fully customize the appearance of the widget using CSS variables.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">CSS</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `/* Widget CSS variables */\nragleaf-widget {\n  --rg-primary: #22c55e;\n  --rg-bg: #ffffff;\n  --rg-text: #1a1a1a;\n  --rg-border-radius: 16px;\n  --rg-font: 'Inter', sans-serif;\n}`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="cm">/* Widget CSS variables */</span><br />
                  ragleaf-widget &#123;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-primary</span>: <span className="str">#22c55e</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-bg</span>: <span className="str">#ffffff</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-text</span>: <span className="str">#1a1a1a</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-border-radius</span>: <span className="str">16px</span>;<br />
                  &nbsp;&nbsp;<span className="attr">--rg-font</span>: <span className="str">'Inter', sans-serif</span>;<br />
                  &#125;
                </div>
              </div>
            </section>

            {/* SHADOW DOM */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="shadow-dom">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Shadow DOM Isolation</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
                The Ragleaf widget runs inside a Shadow DOM. This guarantees that the widget's styles do not affect your site's CSS, and your site's styles do not break the widget.
              </p>
              <div className="p-3.5 px-4.5 rounded-lg mb-4 text-xs leading-relaxed flex gap-2.5 items-start bg-green-500/6 border border-green-500/15 text-text-secondary">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <div>Thanks to Shadow DOM isolation, the widget runs smoothly with WordPress theme conflicts, Tailwind CSS resets, and Bootstrap styles.</div>
              </div>
            </section>

            {/* CHAT COMPLETIONS API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="chat-completions">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Chat Completions API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">OpenAI-compatible chat completions endpoint. Connect your existing applications to Ragleaf with minimal changes.</p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/v1/chat/completions</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Send a message to your AI assistant and get a RAG-powered response. Supports streaming and JSON modes.</p>
                  <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                    <thead>
                      <tr><th>Parameter</th><th>Type</th><th></th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr><td className="font-mono text-xs text-accent font-medium">messages</td><td className="text-[11px] text-text-muted italic">array</td><td><span className="text-red-500 text-[9px] font-bold uppercase">required</span></td><td>Array of conversation messages</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">stream</td><td className="text-[11px] text-text-muted italic">boolean</td><td></td><td>Whether SSE streaming is enabled</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">temperature</td><td className="text-[11px] text-text-muted italic">number</td><td></td><td>Creativity level (0-2)</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">max_tokens</td><td className="text-[11px] text-text-muted italic">number</td><td></td><td>Maximum response length</td></tr>
                    </tbody>
                  </table>
                  <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                    <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                      <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">cURL</span>
                      <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `curl -X POST https://api.ragleaf.com/v1/chat/completions \\\n  -H "Authorization: Bearer rk_live_xxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "messages": [\n      {"role": "user", "content": "Can I book an appointment for tomorrow at 2:00 PM?"}\n    ],\n    "stream": false\n  }'`)}>Copy</button>
                    </div>
                    <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                      curl -X POST https://api.ragleaf.com/v1/chat/completions \<br />
                      &nbsp;&nbsp;-H <span className="str">"Authorization: Bearer rk_live_xxxxx"</span> \<br />
                      &nbsp;&nbsp;-H <span className="str">"Content-Type: application/json"</span> \<br />
                      &nbsp;&nbsp;-d <span className="str">{`'{
    "messages": [
      {"role": "user", "content": "Can I book an appointment for tomorrow at 2:00 PM?"}
    ],
    "stream": false
  }'`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* DOCUMENTS API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="documents-api">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Document Management API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Programmatically manage your AI assistant's knowledge base. Upload, list, and delete documents.</p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/documents/upload</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Upload a new document. Supported formats: PDF, DOCX, TXT, MD, HTML, PNG, JPG.</p>
                  <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                    <thead><tr><th>Parameter</th><th>Type</th><th></th><th>Description</th></tr></thead>
                    <tbody>
                      <tr><td className="font-mono text-xs text-accent font-medium">file</td><td className="text-[11px] text-text-muted italic">file</td><td><span className="text-red-500 text-[9px] font-bold uppercase">required</span></td><td>File to upload (multipart/form-data)</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">agent_id</td><td className="text-[11px] text-text-muted italic">string</td><td><span className="text-red-500 text-[9px] font-bold uppercase">required</span></td><td>Target assistant ID</td></tr>
                      <tr><td className="font-mono text-xs text-accent font-medium">category</td><td className="text-[11px] text-text-muted italic">string</td><td></td><td>Document category</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">GET</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/documents</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">List all documents. Supports pagination and filtering.</p>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-red-500/15 text-red-500 border border-red-500/30">DELETE</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/documents/&#123;id&#125;</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Permanently delete the specified document and its associated vectors.</p>
                </div>
              </div>
            </section>

            {/* AGENTS API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="agents-api">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Agent Management API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Create, configure, and manage your AI assistants.</p>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">GET</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/org/agents</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">List all assistants in your organization.</p>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-green-500/15 text-green-500 border border-green-500/30">POST</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/agents</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Create a new AI assistant.</p>
                </div>
              </div>

              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-amber-500/15 text-amber-500 border border-amber-500/30">PUT</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/agents/&#123;id&#125;</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">Update settings of an existing assistant (prompt, name, configuration, etc.).</p>
                </div>
              </div>
            </section>

            {/* TEMPLATES API */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="templates-api">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Template API</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">List pre-built industry templates and quickly create assistants using them.</p>
              <div className="bg-white/4 border border-border-custom rounded-xl mb-5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 px-5 border-b border-border-custom bg-white/2">
                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">GET</span>
                  <span className="font-mono text-xs text-text-primary font-medium">/api/templates</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">List all available industry templates.</p>
                </div>
              </div>
            </section>

            {/* WEBHOOK EVENTS */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="webhook-events">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Webhook Event Types</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Ragleaf sends an HTTP POST request to your specified URL when certain events occur.</p>
              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead><tr><th>Event</th><th>Description</th></tr></thead>
                <tbody>
                  <tr><td className="font-mono text-xs text-accent font-medium">conversation.started</td><td>When a new conversation starts</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">conversation.ended</td><td>When a conversation ends</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">message.received</td><td>When a new message is received from a user</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">appointment.created</td><td>When an appointment is scheduled</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">payment.completed</td><td>When a payment is completed</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">document.processed</td><td>When document processing is complete</td></tr>
                </tbody>
              </table>
            </section>

            {/* WEBHOOK SECURITY */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="webhook-security">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Webhook Security</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Each webhook request is signed with an <code>X-Ragleaf-Signature</code> header. Verify this signature to ensure the request genuinely came from Ragleaf.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Node.js</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `const crypto = require('crypto');\n\nfunction verifyWebhook(payload, signature, secret) {\n  const hash = crypto\n    .createHmac('sha256', secret)\n    .update(payload)\n    .digest('hex');\n  return hash === signature;\n}`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="kw">const</span> crypto = <span className="fn">require</span>(<span className="str">'crypto'</span>);<br /><br />
                  <span className="kw">function</span> <span className="fn">verifyWebhook</span>(payload, signature, secret) &#123;<br />
                  &nbsp;&nbsp;<span className="kw">const</span> hash = crypto<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="fn">createHmac</span>(<span className="str">'sha256'</span>, secret)<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="fn">update</span>(payload)<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;.<span className="fn">digest</span>(<span className="str">'hex'</span>);<br />
                  &nbsp;&nbsp;<span className="kw">return</span> hash === signature;<br />
                  &#125;
                </div>
              </div>
            </section>

            {/* INTEGRATIONS */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-wordpress">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">WordPress Integration</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">The easiest way to add the Ragleaf widget to your WordPress site is by adding the following code to your theme's <code>functions.php</code> file.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">PHP</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `// Add to your functions.php file\nadd_action('wp_footer', function() {\n  echo '<script src="https://cdn.ragleaf.com/widget.js"\\n    data-agent-id="ag_xxxxx"\\n    data-api-key="rk_live_xxxxx"></script>';\n});`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="cm">// Add to your functions.php file</span><br />
                  <span className="fn">add_action</span>(<span className="str">'wp_footer'</span>, <span className="kw">function</span>() &#123;<br />
                  &nbsp;&nbsp;<span className="kw">echo</span> <span className="str">'&lt;script src="https://cdn.ragleaf.com/widget.js"<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;data-agent-id="ag_xxxxx"<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;data-api-key="rk_live_xxxxx"&gt;&lt;/script&gt;'</span>;<br />
                  &#125;);
                </div>
              </div>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-shopify">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Shopify Integration</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">To add the widget to your Shopify store, go to <strong>Online Store → Themes → Edit Code</strong> and add the script tag before the closing <code>&lt;/body&gt;</code> tag of your <code>theme.liquid</code> file.</p>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-react">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">React / Vue Integration</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Load the widget dynamically in SPA applications.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">React</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `import { useEffect } from 'react';\n\nfunction RagleafWidget() {\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = 'https://cdn.ragleaf.com/widget.js';\n    script.setAttribute('data-agent-id', 'ag_xxxxx');\n    script.setAttribute('data-api-key', 'rk_live_xxxxx');\n    document.body.appendChild(script);\n    return () => document.body.removeChild(script);\n  }, []);\n  return null;\n}`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="kw">import</span> &#123; <span className="fn">useEffect</span> &#125; <span className="kw">from</span> <span className="str">'react'</span>;<br /><br />
                  <span className="kw">function</span> <span className="fn">RagleafWidget</span>() &#123;<br />
                  &nbsp;&nbsp;<span className="fn">useEffect</span>(() =&gt; &#123;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="kw">const</span> script = document.<span className="fn">createElement</span>(<span className="str">'script'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.src = <span className="str">'https://cdn.ragleaf.com/widget.js'</span>;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.setAttribute(<span className="str">'data-agent-id'</span>, <span className="str">'ag_xxxxx'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;script.setAttribute(<span className="str">'data-api-key'</span>, <span className="str">'rk_live_xxxxx'</span>);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;document.body.<span className="fn">appendChild</span>(script);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="kw">return</span> () =&gt; document.body.<span className="fn">removeChild</span>(script);<br />
                  &nbsp;&nbsp;&#125;, []);<br />
                  &nbsp;&nbsp;<span className="kw">return null</span>;<br />
                  &#125;
                </div>
              </div>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-nextjs">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Next.js Integration</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Optimized loading using Next.js's <code>Script</code> component.</p>
              <div className="relative bg-[#0d0d14] border border-border-custom rounded-lg mb-4 overflow-hidden">
                <div className="flex items-center justify-between p-2 px-3.5 bg-white/2 border-b border-border-custom">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Next.js</span>
                  <button className="bg-transparent border border-border-custom rounded py-0.5 px-2 text-[10px] text-text-muted cursor-pointer transition-all hover:border-accent hover:text-accent font-sans" onClick={(e) => copyCode(e, `import Script from 'next/script';\n\nexport default function Layout({ children }) {\n  return (\n    <>\n      {children}\n      <Script\n        src="https://cdn.ragleaf.com/widget.js"\n        data-agent-id="ag_xxxxx"\n        data-api-key="rk_live_xxxxx"\n        strategy="lazyOnload"\n      />\n    </>\n  );\n}`)}>Copy</button>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed text-text-secondary overflow-x-auto white-space-pre [&_.kw]:text-fuchsia-400 [&_.str]:text-green-300 [&_.num]:text-orange-400 [&_.cm]:text-slate-500 [&_.cm]:italic [&_.fn]:text-blue-400 [&_.tag]:text-cyan-400 [&_.attr]:text-amber-300">
                  <span className="kw">import</span> Script <span className="kw">from</span> <span className="str">'next/script'</span>;<br /><br />
                  <span className="kw">export default function</span> <span className="fn">Layout</span>(&#123; children &#125;) &#123;<br />
                  &nbsp;&nbsp;<span className="kw">return</span> (<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&lt;&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#123;children&#125;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;Script<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_xxxxx"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_xxxxx"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="attr">strategy</span>=<span className="str">"lazyOnload"</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&gt;<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&lt;/&gt;<br />
                  &nbsp;&nbsp;);<br />
                  &#125;
                </div>
              </div>
            </section>

            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="int-webflow">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Webflow Integration</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">Add the widget script tag to <strong>Project Settings → Custom Code → Footer Code</strong>. Webflow's custom code area runs perfectly with the widget.</p>
            </section>

            {/* ERROR CODES */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="error-codes">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Error Codes</h2>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-green-500">200</span>
                  <span className="text-xs text-text-secondary">OK — Request completed successfully</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-green-500">201</span>
                  <span className="text-xs text-text-secondary">Created — Resource created successfully</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">400</span>
                  <span className="text-xs text-text-secondary">Bad Request — Invalid request parameters</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">401</span>
                  <span className="text-xs text-text-secondary">Unauthorized — Missing or invalid API key</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">403</span>
                  <span className="text-xs text-text-secondary">Forbidden — You do not have permission for this resource</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">404</span>
                  <span className="text-xs text-text-secondary">Not Found — The requested resource does not exist</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-amber-500">429</span>
                  <span className="text-xs text-text-secondary">Rate Limit — Too many requests sent</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 px-3.5 bg-white/2 border border-border-custom rounded-lg">
                  <span className="font-mono font-bold text-sm w-9 text-red-500">500</span>
                  <span className="text-xs text-text-secondary">Server Error — An unexpected error occurred</span>
                </div>
              </div>
            </section>

            {/* RATE LIMITS */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="rate-limits">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Rate Limiting</h2>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-6">API requests are subject to rate limiting based on your plan. If you exceed the limits, you will receive a <code>429</code> status code.</p>
              <table className="w-full border-collapse text-xs mb-4 max-lg:block max-lg:overflow-x-auto [&_th]:text-left [&_th]:p-2 [&_th]:px-3 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted [&_th]:border-b [&_th]:border-border-custom [&_th]:font-semibold [&_td]:p-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-white/3 [&_td]:text-text-secondary">
                <thead><tr><th>Plan</th><th>Chat API</th><th>Document API</th><th>Other</th></tr></thead>
                <tbody>
                  <tr><td className="font-mono text-xs text-accent font-medium">Free</td><td>60 req/min</td><td>10 req/min</td><td>30 req/min</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">Starter</td><td>300 req/min</td><td>60 req/min</td><td>120 req/min</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">Pro</td><td>1000 req/min</td><td>200 req/min</td><td>500 req/min</td></tr>
                  <tr><td className="font-mono text-xs text-accent font-medium">Enterprise</td><td>Custom</td><td>Custom</td><td>Custom</td></tr>
                </tbody>
              </table>
            </section>

            {/* CHANGELOG */}
            <section className="mb-16 pb-10 border-b border-border-custom last:border-b-0" id="changelog">
              <h2 className="text-[28px] max-lg:text-2xl font-extrabold text-text-primary mb-3 scroll-mt-20">Changelog</h2>
              <div className="flex flex-col gap-4">
                <div className="py-4 px-5 bg-white/[0.02] border border-border-custom rounded-[10px]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="py-[3px] px-2 bg-accent/10 border border-accent/20 rounded text-[11px] font-bold text-accent">v1.4.0</span>
                    <span className="text-[11px] text-text-muted">June 2026</span>
                  </div>
                  <ul className="list-none p-0 m-0 text-[13px] text-text-secondary leading-[1.8]">
                    <li>✅ Multilingual support (42 languages)</li>
                    <li>✅ WhatsApp and Telegram integration</li>
                    <li>✅ Industry-specific template system</li>
                    <li>✅ Appointment and payment flows</li>
                  </ul>
                </div>
                <div className="py-4 px-5 bg-white/[0.02] border border-border-custom rounded-[10px]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="py-[3px] px-2 bg-text-muted/10 border border-text-muted/20 rounded text-[11px] font-bold text-text-muted">v1.3.0</span>
                    <span className="text-[11px] text-text-muted">May 2026</span>
                  </div>
                  <ul className="list-none p-0 m-0 text-[13px] text-text-secondary leading-[1.8]">
                    <li>✅ Document processing with OCR support</li>
                    <li>✅ Chunk enrichment pipeline</li>
                    <li>✅ RAG Analytics dashboard</li>
                  </ul>
                </div>
              </div>
            </section>
          </main>
        )}
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
    </>
  );
}

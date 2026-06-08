"use client";

import React, { useState } from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';

export default function AIAssistantClient() {
  const { lang } = useLang();
  
  // Interactive mockup state
  const [activeTab, setActiveTab] = useState('rag');
  const [simulationMsg, setSimulationMsg] = useState('');

  const getRAGData = () => {
    if (lang === 'tr') {
      return {
        title: "RAG Mimarisi ile Sınırsız Bilgi",
        desc: "İşletmenizin PDF el kitaplarını, fiyat listelerini, SSS sayfalarını veya web URL'lerini sisteme yükleyin. AIassistant, RAG (Retrieval-Augmented Generation) altyapısını kullanarak verilerinizi güvenli bir vektör hafızaya alır.",
        highlight: "Asla uydurma (halüsinasyon) yanıtlar vermez. Her zaman yüklediğiniz belgelere atıfta bulunarak (citation) konuşur."
      };
    }
    return {
      title: "Limitless Knowledge via RAG",
      desc: "Upload PDFs, catalogs, support tickets, price sheets, or web URLs. AIassistant parses them into a secure semantic vector index using state-of-the-art RAG architecture.",
      highlight: "Eliminates hallucinations. The assistant strictly references your documents (citations) to output verified answers."
    };
  };

  const getIdentityData = () => {
    if (lang === 'tr') {
      return {
        title: "Özgün Kimlik, Karakter ve Kurallar",
        desc: "Asistanınıza kurumsal kimliğinize uygun bir isim, avatar ve konuşma stili tanımlayın. 'Sistem Talimatı' (System Prompt) alanından asistanın uyması gereken katı davranış kurallarını ve hitap şeklini belirleyin.",
        highlight: "Belirlediğiniz marka sınırlarının dışına çıkmaz, müşterilere tıpkı profesyonel bir çalışanınız gibi yanıt verir."
      };
    }
    return {
      title: "Unique Persona, Guidelines & Tone",
      desc: "Define a custom name, avatar, and style sheet that matches your corporate voice. Set strict behavioral system prompts and conversation constraints.",
      highlight: "Guarantees brand safety. The assistant acts precisely like an experienced, polite customer success assistant."
    };
  };

  const getCrossProductData = () => {
    if (lang === 'tr') {
      return {
        title: "Çoklu Ürün ve Kanal Entegrasyonu",
        desc: "Oluşturduğunuz yapay zeka asistanı, Ragleaf bünyesindeki tüm diğer ürünlerimizle entegre çalışır. Sadece basit bir web sohbet balonu değildir. Aynı asistanı AIchat canlı destek widget'ında kullanabilir, AIwriter blog otomasyonunda makale konularını tasarlayan ve yazan zeka olarak görevlendirebilir veya REST API ile kendi mobil/web uygulamalarınıza bağlayabilirsiniz.",
        highlight: "Tek merkezden eğitilen tek bir yapay zeka asistan aklı, tüm diğer ürünlerimiz ve dijital kanallarınızla entegre çalışır."
      };
    }
    return {
      title: "Omnichannel & Cross-Product Hub",
      desc: "The AI assistant integrates seamlessly with all our other products. It is not just a web chat bubble. Connect it to your AIchat widget on website, link it as the research and writing strategist in AIwriter, or bind it directly to your apps using developer REST API keys.",
      highlight: "Train once, deploy everywhere. A single cognitive assistant powers all your other products and touchpoints."
    };
  };

  const getActiveData = () => {
    if (activeTab === 'rag') return getRAGData();
    if (activeTab === 'identity') return getIdentityData();
    return getCrossProductData();
  };

  return (
    <PageLayout className="min-h-screen" container={false}>
      {/* Hero Header */}
      <div className="relative text-center px-5 pb-8 pt-16 max-w-[900px] mx-auto overflow-hidden">
        <div className="hero-glow" style={{ top: '-150px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            🍃 AIassistant
          </span>
          <h1 className="font-['Outfit'] text-[50px] max-md:text-[34px] font-black tracking-tight mb-4 leading-tight">
            {lang === 'tr' ? (
              <>Çok Kanallı Bilişsel <span className="gradient-text">Yapay Zeka</span> Asistanı</>
            ) : (
              <>Centralized Cognitive <span className="gradient-text">AI Assistant</span> Brain</>
            )}
          </h1>
          <p className="text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            {lang === 'tr'
              ? 'AIassistant sadece bir sohbet balonu değil; markanızın kimliğini taşıyan, dökümanlarınızla RAG mimarisinde eğitilen ve tüm Ragleaf ürün ailesini otonom olarak besleyen merkezi bilişsel zekadır.'
              : 'AIassistant is not just a widget; it is the core intelligence hub that holds your brand identity, masters files via RAG, and autonomously powers the entire Ragleaf product family.'}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="container" style={{ paddingBottom: '80px', position: 'relative', zIndex: 2 }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1.6fr] gap-10 items-start">
          
          {/* Left Column: Visual Assistant Config & RAG State Mockup */}
          <div style={{ background: 'rgba(10, 10, 15, 0.5)', border: '1px solid rgba(34, 197, 94, 0.15)', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }} className="p-6 md:p-8">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '16px' }} className="flex-col sm:flex-row gap-4 sm:gap-0 text-center sm:text-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="flex-col sm:flex-row">
                <span style={{ fontSize: '1.5rem' }}>⚙️</span>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                    {lang === 'tr' ? 'Asistan Yapılandırma Paneli' : 'Assistant Configuration Panel'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>ID: ag_ragleaf_system01</span>
                </div>
              </div>
              <span className="badge-soon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                {lang === 'tr' ? 'Yayında' : 'Live'}
              </span>
            </div>
 
            {/* Assistant Identity Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {lang === 'tr' ? 'Asistan Adı & Kimliği' : 'Assistant Name & Persona'}
                </label>
                <input 
                  type="text" 
                  value={lang === 'tr' ? 'Ragleaf Kurumsal Destek' : 'Ragleaf Corporate Support'} 
                  readOnly 
                  style={{ width: '100%', background: '#07070c', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem', color: '#ffffff' }}
                />
              </div>
 
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {lang === 'tr' ? 'RAG Bilgi Tabanı Dökümanları' : 'RAG Knowledge Base Files'}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { name: 'fiyat_listesi_2026.pdf', size: '1.2 MB' },
                    { name: 'kullanim_kilavuzu.docx', size: '840 KB' },
                    { name: 'sik_sorulan_sorular.json', size: '120 KB' }
                  ].map((file, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }} className="flex-col sm:flex-row gap-2 sm:gap-0 text-center sm:text-left">
                      <span style={{ fontSize: '0.8rem', color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🍃</span> {file.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{file.size}</span>
                    </div>
                  ))}
                </div>
              </div>
 
              {/* Connected Products Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {lang === 'tr' ? 'Beslenen Ürünler / Servisler' : 'Connected Products & Channels'}
                </label>
                 <div className="grid grid-cols-1 gap-2">
                  {[
                    { icon: '💬', prefix: 'AI', rest: 'chat', active: true },
                    { icon: '✍️', prefix: 'AI', rest: 'writer', active: true }
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: item.active ? '#ffffff' : '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: item.active ? '#10b981' : '#6b7280', flexShrink: 0 }}></span>
                        <span style={{ marginRight: '2px' }}>{item.icon}</span>
                        {item.prefix && <span className="brand-ai" style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{item.prefix}</span>}
                        <span>{item.rest}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
 
            </div>
          </div>
 
          {/* Right Column: Tab Selector & Core Conceptual Pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Tab buttons */}
            <div className="flex flex-col sm:flex-row bg-white/[0.02] border border-white/[0.05] rounded-2xl p-1.5 gap-1">
              {[
                { id: 'rag', label: lang === 'tr' ? '1. RAG Zekası' : '1. RAG Intelligence' },
                { id: 'identity', label: lang === 'tr' ? '2. Kimlik & Persona' : '2. Identity & Persona' },
                { id: 'cross', label: lang === 'tr' ? '3. Çok Kanallı Hub' : '3. Omnichannel Hub' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 font-bold text-xs sm:text-sm py-2.5 px-3 rounded-xl cursor-pointer transition-all duration-200 border-none ${
                    activeTab === tab.id ? 'bg-[var(--accent)] text-black font-black' : 'bg-transparent text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
 
            {/* Content Display Panel */}
            <div 
              style={{ 
                background: 'rgba(10, 10, 15, 0.3)', 
                border: '1px solid rgba(34, 197, 94, 0.15)', 
                borderRadius: '24px', 
                minHeight: '280px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                position: 'relative'
              }}
              className="p-6 md:p-10"
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', trackingWidth: '0.1em', marginBottom: '8px', display: 'block' }}>
                {lang === 'tr' ? 'BİLİŞSEL ASİSTAN ÖZELLİĞİ' : 'COGNITIVE ASSISTANT FEATURE'}
              </span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ffffff', marginBottom: '16px' }}>
                {getActiveData().title}
              </h3>
              <p style={{ color: '#d1d5db', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '20px' }}>
                {getActiveData().desc}
              </p>
              
              <div style={{ background: 'rgba(34, 197, 94, 0.04)', border: '1px solid rgba(34, 197, 94, 0.1)', borderRadius: '12px', padding: '12px 16px', fontSize: '0.85rem', color: '#ffffff', display: 'flex', gap: '8px', alignItems: 'start' }}>
                <span style={{ fontSize: '1.1rem' }}>💡</span>
                <span>{getActiveData().highlight}</span>
              </div>
            </div>
 
            {/* Omnichannel deployment note */}
            <div style={{ background: 'rgba(10, 10, 15, 0.1)', border: '1px solid rgba(255, 255, 255, 0.03)', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse flex-shrink-0"></span>
              <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>
                {lang === 'tr' ? 'Asistanınızı bir kez eğitin, tüm Ragleaf ürün ailesiyle otomatik senkronize çalışsın.' : 'Train your cognitive brain once, and sync automatically across all products.'}
              </span>
            </div>
 
          </div>

        </div>
      </div>
    </PageLayout>
  );
}

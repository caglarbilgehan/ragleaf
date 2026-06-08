"use client";

import React, { useState, useEffect } from 'react';
import { useLang } from '../../context/LangContext';
import { useUI } from '../../context/UIContext';
import PageLayout from '../../components/PageLayout';
import { getApiBaseUrl } from '../../utils/api';

export default function PricingClient() {
  const { lang, t } = useLang();
  const { openSignup } = useUI();
  const [isYearly, setIsYearly] = useState(false);
  const [plansData, setPlansData] = useState([]);

  useEffect(() => {
    async function fetchPlans() {
      const API_BASE = getApiBaseUrl();
      try {
        const res = await fetch(`${API_BASE}/api/public/plans`);
        if (res.ok) {
          const data = await res.json();
          setPlansData(data);
        }
      } catch (e) {
        console.error("Dynamic pricing fetch error:", e);
      }
    }
    fetchPlans();
  }, []);

  const isEn = lang === 'en';

  // Fallbacks
  const starter = plansData.find(p => p.key === 'starter') || { price: 50, max_agents: 3, max_documents: 100, max_queries_per_month: 5000, max_storage_mb: 500 };
  const pro = plansData.find(p => p.key === 'pro') || { price: 200, max_agents: 10, max_documents: 500, max_queries_per_month: 25000, max_storage_mb: 2000 };
  const ultimate = plansData.find(p => p.key === 'ultimate') || { price: 350, max_agents: 50, max_documents: 2000, max_queries_per_month: 100000, max_storage_mb: 10000 };
  const ent = plansData.find(p => p.key === 'ultra') || { price: 600, max_agents: 999, max_documents: 9999, max_queries_per_month: 999999, max_storage_mb: 50000 };

  const formatPrice = (basePrice) => {
    let finalPrice = basePrice;
    if (isYearly) {
      finalPrice = basePrice * 0.8;
    }
    return `$${Math.round(finalPrice)}`;
  };

  const formatStorage = (mb) => {
    if (mb >= 1000) {
      return `${mb / 1000} GB`;
    }
    return `${mb} MB`;
  };

  const formatQueries = (num) => {
    if (!num) return "0";
    return num.toLocaleString(isEn ? 'en-US' : 'tr-TR');
  };

  return (
    <PageLayout className="min-h-screen">
      {/* HERO */}
      <div className="relative text-center px-5 pb-16 pt-8 max-w-[800px] mx-auto overflow-hidden">
        <div className="hero-glow" style={{ top: '-200px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            {lang === 'tr' ? 'Esnek Planlar' : 'Flexible Plans'}
          </span>
          <h1 className="font-['Outfit'] text-[56px] max-md:text-[38px] font-black tracking-tight mb-6 leading-tight">
            {lang === 'tr' ? (
              <>İhtiyacınıza <span className="gradient-text">Uygun</span> Planlar</>
            ) : (
              <>Plans That <span className="gradient-text">Fit</span> Your Needs</>
            )}
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed max-w-xl mx-auto">
            {lang === 'tr' 
              ? 'İster küçük bir ekiple başlayın, ister büyük bir kuruluş yönetin - ihtiyaçlarınıza uygun planı seçin.' 
              : 'Start with a small team or manage a large organization - choose the plan that fits your needs.'}
          </p>
        </div>
      </div>

      {/* BILLING TOGGLE */}
      <div className="flex items-center justify-center gap-4 mb-12 max-md:mb-8">
        <span 
          className={`text-sm font-semibold cursor-pointer transition-colors duration-200 ${!isYearly ? 'text-text-primary' : 'text-text-secondary'}`} 
          onClick={() => setIsYearly(false)}
        >
          {t('pricing_monthly')}
        </span>
        <label className="relative inline-block w-[50px] h-7 cursor-pointer">
          <input 
            type="checkbox" 
            checked={isYearly} 
            onChange={(e) => setIsYearly(e.target.checked)} 
            className="sr-only peer"
          />
          <span className="absolute inset-0 bg-white/[0.06] border border-border-custom rounded-full transition-all duration-300 peer-checked:bg-accent/20"></span>
          <span className="absolute left-[3px] top-[4px] w-5 h-5 bg-accent rounded-full shadow-[0_0_10px_var(--accent-glow)] transition-all duration-300 peer-checked:translate-x-[24px]"></span>
        </label>
        <span 
          className={`text-sm font-semibold cursor-pointer transition-colors duration-200 ${isYearly ? 'text-text-primary' : 'text-text-secondary'}`} 
          onClick={() => setIsYearly(true)}
        >
          {t('pricing_yearly')}
        </span>
        <span className="bg-accent/15 border border-accent/30 text-accent px-2.5 py-0.5 rounded-full text-xs font-bold max-md:text-[10px] max-md:px-1.5">{t('pricing_discount')}</span>
      </div>

      {/* PRICING GRID */}
      <div className="grid grid-cols-4 max-lg:grid-cols-2 max-md:grid-cols-1 gap-6 max-w-[1400px] mx-auto px-5 pb-20 max-md:px-4 max-md:pb-16">
        {/* Starter Card */}
        <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-10 py-8 max-md:p-6 backdrop-blur-md transition-all duration-300 flex flex-col justify-between relative hover:-translate-y-2 hover:border-accent/30 hover:shadow-[0_12px_40px_rgba(34,197,94,0.05)] max-w-[380px] w-full mx-auto">
          <div>
            <div className="font-['Outfit'] text-2xl max-md:text-xl font-extrabold mb-2">Starter</div>
            <p className="text-sm max-md:text-xs text-text-secondary leading-snug mb-6 min-h-[48px]">{t('pricing_starter_desc')}</p>
            <div className="mb-8 flex items-baseline gap-1.5">
              <span className="text-[48px] max-md:text-[36px] font-black font-['Outfit'] tracking-tighter">{formatPrice(starter.price)}</span>
              <span className="text-sm text-text-muted">
                {isYearly 
                  ? (isEn ? " / mo (billed annually)" : " / ay (yıllık faturalandırılır)") 
                  : (isEn ? " / mo" : " / ay")}
              </span>
            </div>
            <ul className="list-none p-0 mt-0 mx-0 mb-10 max-md:mb-6 flex flex-col gap-4 max-md:gap-3">
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${starter.max_agents} AI Assistants` : `${starter.max_agents} Yapay Zeka Asistanı`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${starter.max_documents} Document Knowledge Base` : `${starter.max_documents} Doküman Bilgi Tabanı`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${formatQueries(starter.max_queries_per_month)} Queries / Month` : `${formatQueries(starter.max_queries_per_month)} Sorgu / Ay`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${formatStorage(starter.max_storage_mb)} File Storage` : `${formatStorage(starter.max_storage_mb)} Dosya Depolama`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{t('pricing_starter_feat_trial')}</span>
              </li>
            </ul>
          </div>
          <button onClick={() => openSignup('starter')} className="w-full text-center font-bold p-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer btn btn-primary">
            {t('pricing_starter_btn')}
          </button>
        </div>

        {/* Pro Card */}
        <div className="bg-[#0d0d15]/60 border border-accent/40 rounded-3xl p-10 py-8 max-md:p-6 backdrop-blur-md transition-all duration-300 flex flex-col justify-between relative hover:-translate-y-2 hover:border-accent hover:shadow-[0_12px_48px_rgba(34,197,94,0.15)] shadow-[0_8px_32px_rgba(34,197,94,0.08)] max-w-[380px] w-full mx-auto">
          <div className="absolute -top-3.5 right-8 bg-gradient-to-r from-emerald-500 to-cyan-500 text-[#000] px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-[0_0_12px_rgba(34,197,94,0.3)]">{t('pricing_popular')}</div>
          <div>
            <div className="font-['Outfit'] text-2xl max-md:text-xl font-extrabold mb-2">Pro</div>
            <p className="text-sm max-md:text-xs text-text-secondary leading-snug mb-6 min-h-[48px]">{t('pricing_pro_desc')}</p>
            <div className="mb-8 flex items-baseline gap-1.5">
              <span className="text-[48px] max-md:text-[36px] font-black font-['Outfit'] tracking-tighter">{formatPrice(pro.price)}</span>
              <span className="text-sm text-text-muted">
                {isYearly 
                  ? (isEn ? " / mo (billed annually)" : " / ay (yıllık faturalandırılır)") 
                  : (isEn ? " / mo" : " / ay")}
              </span>
            </div>
            <ul className="list-none p-0 mt-0 mx-0 mb-10 max-md:mb-6 flex flex-col gap-4 max-md:gap-3">
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${pro.max_agents} AI Assistants` : `${pro.max_agents} Yapay Zeka Asistanı`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${pro.max_documents} Document Knowledge Base` : `${pro.max_documents} Doküman Bilgi Tabanı`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${formatQueries(pro.max_queries_per_month)} Queries / Month` : `${formatQueries(pro.max_queries_per_month)} Sorgu / Ay`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${formatStorage(pro.max_storage_mb)} File Storage` : `${formatStorage(pro.max_storage_mb)} Dosya Depolama`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{t('pricing_pro_feat_payment')}</span>
              </li>
            </ul>
          </div>
          <button 
            onClick={() => openSignup('pro')} 
            className="w-full text-center font-bold p-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#34d399] hover:to-[#22d3ee] text-[#000] hover:shadow-[0_8px_24px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 border-none"
          >
            {t('pricing_pro_btn')}
          </button>
        </div>

        {/* Ultimate Card */}
        <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-10 py-8 max-md:p-6 backdrop-blur-md transition-all duration-300 flex flex-col justify-between relative hover:-translate-y-2 hover:border-accent/30 hover:shadow-[0_12px_40px_rgba(34,197,94,0.05)] max-w-[380px] w-full mx-auto">
          <div>
            <div className="font-['Outfit'] text-2xl max-md:text-xl font-extrabold mb-2">Ultimate</div>
            <p className="text-sm max-md:text-xs text-text-secondary leading-snug mb-6 min-h-[48px]">
              {isEn ? "For multi-department setups and teams requiring high volumes." : "Çoklu departman yönetimi ve yüksek hacimli sorgu ihtiyacı olanlar için."}
            </p>
            <div className="mb-8 flex items-baseline gap-1.5">
              <span className="text-[48px] max-md:text-[36px] font-black font-['Outfit'] tracking-tighter">{formatPrice(ultimate.price)}</span>
              <span className="text-sm text-text-muted">
                {isYearly 
                  ? (isEn ? " / mo (billed annually)" : " / ay (yıllık faturalandırılır)") 
                  : (isEn ? " / mo" : " / ay")}
              </span>
            </div>
            <ul className="list-none p-0 mt-0 mx-0 mb-10 max-md:mb-6 flex flex-col gap-4 max-md:gap-3">
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${ultimate.max_agents} AI Assistants` : `${ultimate.max_agents} Yapay Zeka Asistanı`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${ultimate.max_documents} Document Knowledge Base` : `${ultimate.max_documents} Doküman Bilgi Tabanı`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${formatQueries(ultimate.max_queries_per_month)} Queries / Month` : `${formatQueries(ultimate.max_queries_per_month)} Sorgu / Ay`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${formatStorage(ultimate.max_storage_mb)} File Storage` : `${formatStorage(ultimate.max_storage_mb)} Dosya Depolama`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? "Advanced analytics & Whitelabel" : "Gelişmiş analitik & Markasız kullanım"}</span>
              </li>
            </ul>
          </div>
          <button onClick={() => openSignup('ultimate')} className="w-full text-center font-bold p-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer btn btn-primary">
            {isEn ? "Get Started" : "Şimdi Başla"}
          </button>
        </div>

        {/* Ultra Card */}
        <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-10 py-8 max-md:p-6 backdrop-blur-md transition-all duration-300 flex flex-col justify-between relative hover:-translate-y-2 hover:border-accent/30 hover:shadow-[0_12px_40px_rgba(34,197,94,0.05)] max-w-[380px] w-full mx-auto">
          <div>
            <div className="font-['Outfit'] text-2xl max-md:text-xl font-extrabold mb-2">Ultra</div>
            <p className="text-sm max-md:text-xs text-text-secondary leading-snug mb-6 min-h-[48px]">{t('pricing_ent_desc')}</p>
            <div className="mb-8 flex items-baseline gap-1.5">
              <span className="text-[48px] max-md:text-[36px] font-black font-['Outfit'] tracking-tighter">{formatPrice(ent.price)}</span>
              <span className="text-sm text-text-muted">
                {isYearly 
                  ? (isEn ? " / mo (billed annually)" : " / ay (yıllık faturalandırılır)") 
                  : (isEn ? " / mo" : " / ay")}
              </span>
            </div>
            <ul className="list-none p-0 mt-0 mx-0 mb-10 max-md:mb-6 flex flex-col gap-4 max-md:gap-3">
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{ent.max_agents >= 999 ? (isEn ? "Unlimited AI Assistants" : "Sınırsız AI Asistanı") : (isEn ? `${ent.max_agents} AI Assistants` : `${ent.max_agents} Yapay Zeka Asistanı`)}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{ent.max_documents >= 9999 ? (isEn ? "Unlimited Document Upload" : "Sınırsız Doküman Yükleme") : (isEn ? `${ent.max_documents} Document Knowledge Base` : `${ent.max_documents} Doküman Bilgi Tabanı`)}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{ent.max_queries_per_month >= 999999 ? (isEn ? "Millions of Queries / Month" : "Milyonlarca Sorgu / Ay") : (isEn ? `${formatQueries(ent.max_queries_per_month)} Queries / Month` : `${formatQueries(ent.max_queries_per_month)} Sorgu / Ay`)}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{isEn ? `${formatStorage(ent.max_storage_mb)} Custom Storage` : `${formatStorage(ent.max_storage_mb)} Dosya Depolama`}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <svg className="text-accent flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>{t('pricing_ent_feat_support')}</span>
              </li>
            </ul>
          </div>
          <a 
            href="mailto:hello@ragleaf.com?subject=Ultra%20Plan%20Requirements" 
            className="w-full text-center font-bold p-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer border border-white/10 bg-transparent hover:bg-white/5 text-text-primary block no-underline hover:border-white/30 hover:-translate-y-0.5"
          >
            {t('pricing_ent_btn')}
          </a>
        </div>
      </div>

      {/* COMPARISON TABLE */}
      <div className="max-w-[1000px] mx-auto mb-24 max-md:mb-16 px-5 max-md:px-4">
        <h2 className="font-['Outfit'] text-3xl max-md:text-[22px] font-extrabold text-center mb-12 max-md:mb-8">{t('pricing_comp_title')}</h2>
        <div className="overflow-x-auto bg-[#0d0d15]/40 border border-white/5 rounded-[20px] backdrop-blur">
          <table className="w-full min-w-[650px] border-collapse text-left text-sm max-md:text-xs">
            <thead>
              <tr className="[&_th]:p-5 max-md:[&_th]:p-3 max-md:[&_th]:px-2.5 [&_th]:border-b [&_th]:border-white/[0.04] [&_th]:font-bold [&_th]:text-text-primary [&_th]:uppercase [&_th]:text-[12px] [&_th]:tracking-wider [&_th]:bg-white/[0.01]">
                <th>{t('pricing_comp_col_feature')}</th>
                <th>Starter</th>
                <th>Pro</th>
                <th>Ultimate</th>
                <th>Ultra</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-5 max-md:[&_td]:p-3 max-md:[&_td]:px-2.5 [&_td]:border-b [&_td]:border-white/[0.04] [&_td]:text-text-secondary [&_tr]:hover:bg-white/[0.01]">
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_agents')}</td>
                <td>{isEn ? `${starter.max_agents} Qty` : `${starter.max_agents} Adet`}</td>
                <td>{isEn ? `${pro.max_agents} Qty` : `${pro.max_agents} Adet`}</td>
                <td>{isEn ? `${ultimate.max_agents} Qty` : `${ultimate.max_agents} Adet`}</td>
                <td>{ent.max_agents >= 999 ? (isEn ? "Unlimited" : "Sınırsız") : (isEn ? `${ent.max_agents} Qty` : `${ent.max_agents} Adet`)}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_docs')}</td>
                <td>{isEn ? `${starter.max_documents} Qty` : `${starter.max_documents} Adet`}</td>
                <td>{isEn ? `${pro.max_documents} Qty` : `${pro.max_documents} Adet`}</td>
                <td>{isEn ? `${ultimate.max_documents} Qty` : `${ultimate.max_documents} Adet`}</td>
                <td>{ent.max_documents >= 9999 ? (isEn ? "Unlimited" : "Sınırsız") : (isEn ? `${ent.max_documents} Qty` : `${ent.max_documents} Adet`)}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_queries')}</td>
                <td>{isEn ? `${formatQueries(starter.max_queries_per_month)} / Mo` : `${formatQueries(starter.max_queries_per_month)} / Ay`}</td>
                <td>{isEn ? `${formatQueries(pro.max_queries_per_month)} / Mo` : `${formatQueries(pro.max_queries_per_month)} / Ay`}</td>
                <td>{isEn ? `${formatQueries(ultimate.max_queries_per_month)} / Mo` : `${formatQueries(ultimate.max_queries_per_month)} / Ay`}</td>
                <td>{ent.max_queries_per_month >= 999999 ? (isEn ? "Unlimited / Custom" : "Sınırsız / Özel") : (isEn ? `${formatQueries(ent.max_queries_per_month)} / Mo` : `${formatQueries(ent.max_queries_per_month)} / Ay`)}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_storage')}</td>
                <td>{formatStorage(starter.max_storage_mb)}</td>
                <td>{formatStorage(pro.max_storage_mb)}</td>
                <td>{formatStorage(ultimate.max_storage_mb)}</td>
                <td>{formatStorage(ent.max_storage_mb)}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_booking')}</td>
                <td>{t('pricing_comp_val_formonly')}</td>
                <td>{t('pricing_comp_val_dynamic')}</td>
                <td>{t('pricing_comp_val_dynamic')}</td>
                <td>{t('pricing_comp_val_customcrm')}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_payment')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_active_nocomm')}</td>
                <td>{t('pricing_comp_val_active_nocomm')}</td>
                <td>{t('pricing_comp_val_active_multi')}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_ocr')}</td>
                <td>{t('pricing_comp_val_active_basic')}</td>
                <td>{t('pricing_comp_val_active_adv')}</td>
                <td>{t('pricing_comp_val_active_adv')}</td>
                <td>{t('pricing_comp_val_active_fast')}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_whitelabel')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_active_basic')}</td>
                <td>{t('pricing_comp_val_active_basic')}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_finetune')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_active_basic')}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_sso')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_passive')}</td>
                <td>{t('pricing_comp_val_active_basic')}</td>
                <td>{t('pricing_comp_val_active_basic')}</td>
              </tr>
              <tr>
                <td className="font-semibold text-text-secondary w-[40%] max-md:w-[35%] max-md:pl-2">{t('pricing_comp_row_support')}</td>
                <td>{t('pricing_comp_val_email')}</td>
                <td>{t('pricing_comp_val_priority')}</td>
                <td>{t('pricing_comp_val_priority')}</td>
                <td>{t('pricing_comp_val_dedicated')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}

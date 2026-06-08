"use client";

import React, { useState } from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';

export default function AffiliateClient() {
  const { lang } = useLang();
  
  // Calculator state
  const [leaves, setLeaves] = useState(45);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://ragleaf.com/?ref=usr_947056");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const freeQueries = Math.floor(leaves / 5);
  const discountPercent = Math.min(30, Math.floor(leaves * 0.4));

  return (
    <PageLayout className="min-h-screen" container={false}>
      {/* Hero Header */}
      <div className="relative text-center px-5 pb-24 pt-16 max-w-[900px] mx-auto overflow-hidden mb-12">
        <div className="hero-glow" style={{ top: '-150px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            🤝 {lang === 'tr' ? 'Satış Ortaklığı & Sadakat' : 'Affiliate & Loyalty'}
          </span>
          <h1 className="font-['Outfit'] text-[50px] max-md:text-[34px] font-black tracking-tight mb-4 leading-tight">
            {lang === 'tr' ? (
              <>Tavsiye Et, <span className="gradient-text">Yaprak</span> Kazan</>
            ) : (
              <>Refer & Earn <span className="gradient-text">Leaves</span></>
            )}
          </h1>
          <p className="text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            {lang === 'tr'
              ? 'Ragleaf asistanınızı sitenize ekleyip ziyaretçilerinizin asistan üzerindeki linklere tıklayarak kaydolmasını sağlayın. Her başarılı yönlendirmede yaprak biriktirin, ücretsiz sorgular ve indirimler kazanın.'
              : 'Add your Ragleaf assistant to your site. When visitors click the footer link in your widget and sign up, you accumulate leaves. Redeem them for free AI queries or premium billing discounts.'}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="container" style={{ paddingBottom: '80px', position: 'relative', zIndex: 2 }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1.6fr] gap-10 items-start">
          
          {/* Left: Referral link copy & rewards details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Copy link simulator */}
            <div style={{ background: 'rgba(10, 10, 15, 0.5)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '24px' }} className="p-6 md:p-8">
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                {lang === 'tr' ? 'Tavsiye Bağlantınız' : 'Your Referral Link'}
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px' }}>
                {lang === 'tr'
                   ? 'Giriş yaptıktan sonra size özel üretilen bu bağlantıyı veya sitenizdeki widget\'ı kullanarak 50 yaprak kazanmaya başlayabilirsiniz.'
                   : 'Use this personal link or keep the "Powered by Ragleaf" footer active on your widget to automatically collect 50 leaves per signup.'}
              </p>
              
              <div style={{ display: 'flex', gap: '8px' }} className="flex-col sm:flex-row">
                <input 
                  type="text" 
                  value="https://ragleaf.com/?ref=*************" 
                  readOnly 
                  style={{
                    flex: 1,
                    background: '#07070c',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  disabled
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#6b7280',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    cursor: 'not-allowed',
                    fontSize: '0.85rem'
                  }}
                >
                  {lang === 'tr' ? 'Kopyala' : 'Copy'}
                </button>
              </div>
            </div>
 
            {/* Loyalty rules cards */}
            <div style={{ background: 'rgba(10, 10, 15, 0.3)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '24px' }} className="p-6 md:p-8">
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                {lang === 'tr' ? 'Yaprak Kuralları & Detaylar' : 'Leaf Conversion Rules'}
              </h3>
              <ul style={{ paddingLeft: '20px', color: '#9ca3af', fontSize: '0.95rem', lineHeight: '1.8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li>
                  <strong>{lang === 'tr' ? 'Her 5 Yaprak = 1 Ücretsiz AI Sorgusu: ' : 'Every 5 Leaves = 1 Free Query: '}</strong>
                  {lang === 'tr' ? 'Biriktirdiğiniz yapraklar panelinizde otomatik olarak ücretsiz sorgu hakkına dönüştürülür.' : 'Accumulated leaves instantly translate into free queries credited to your account.'}
                </li>
                <li>
                  <strong>{lang === 'tr' ? 'Sınırsız Büyüme: ' : 'Unlimited Cap: '}</strong>
                  {lang === 'tr' ? 'Tavsiye edebileceğiniz kişi sayısında ve kazanabileceğiniz yaprak miktarında limit yoktur.' : 'There is no upper limit on referrals or the total leaf balances you can accumulate.'}
                </li>
              </ul>
            </div>
 
          </div>
 
          {/* Right: Leaf Balance simulation card with slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Interactive Slider customizer */}
            <div style={{ background: 'rgba(10, 10, 15, 0.5)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '24px' }} className="p-6 md:p-8">
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                {lang === 'tr' ? 'Kazanç Hesaplayıcı' : 'Earnings Calculator'}
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '20px' }}>
                {lang === 'tr' ? 'Kazandığınız yaprak miktarına göre ödüllerinizi canlı hesaplayın:' : 'Drag the slider to see what rewards you unlock based on your leaf count:'}
              </p>
              
              <div style={{ marginBottom: '24px' }}>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={leaves} 
                  onChange={(e) => setLeaves(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent)',
                    background: 'rgba(255,255,255,0.1)',
                    height: '6px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginTop: '8px', fontWeight: 'bold' }}>
                  <span>0 {lang === 'tr' ? 'Yaprak' : 'Leaves'}</span>
                  <span>50 {lang === 'tr' ? 'Yaprak' : 'Leaves'}</span>
                  <span>100 {lang === 'tr' ? 'Yaprak' : 'Leaves'}</span>
                </div>
              </div>
 
              {/* The premium Leaf Balance card updated dynamically */}
              <div 
                style={{ 
                  background: 'linear-gradient(to bottom right, rgba(20, 83, 45, 0.4), rgba(10, 10, 15, 0.8))', 
                  borderRadius: '24px', 
                  border: '1px solid rgba(34, 197, 94, 0.2)', 
                  padding: '24px', 
                  textAlign: 'center', 
                  position: 'relative', 
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(34, 197, 94, 0.08)'
                }}
              >
                {/* SVG badge decor */}
                <div style={{ position: 'absolute', top: 0, right: 0, padding: '12px', opacity: 0.1 }} className="hidden sm:block">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-award h-24 w-24 text-primary-400">
                    <circle cx="12" cy="8" r="6"></circle>
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path>
                  </svg>
                </div>
 
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 'bold', uppercase: true, letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  {lang === 'tr' ? 'MEVCUT BAKİYENİZ' : 'YOUR CURRENT BALANCE'}
                </span>
                
                <div style={{ fontSize: '3rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '12px 0' }}>
                  <span>🍃</span>
                  <span style={{ background: 'linear-gradient(to right, #4ade80, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {leaves}
                  </span>
                </div>
 
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', fontWeight: '600' }}>
                  {lang === 'tr' ? 'Yaprak (Leaf)' : 'Leaves (Leaf)'}
                </span>
 
                {/* Dynamically calculated items */}
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#9ca3af', display: 'block', marginBottom: '6px', textAlign: 'center' }}>
                      {lang === 'tr' ? 'Ücretsiz Sorgular' : 'Free Queries'}
                    </span>
                    <strong style={{ fontSize: '1.8rem', color: '#ffffff', display: 'block', textAlign: 'center' }}>
                      {freeQueries}
                    </strong>
                  </div>
                </div>
 
              </div>
 
            </div>
          </div>
 
        </div>
      </div>
    </PageLayout>
  );
}

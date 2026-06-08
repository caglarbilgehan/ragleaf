"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';

// Load SectorSimulator dynamically to bypass SSR issues with window/dates
const SectorSimulator = dynamic(() => import('../../components/SectorSimulator'), {
  ssr: false,
});

export default function AIChatClient() {
  const { lang } = useLang();

  const title = lang === 'tr' ? 'AIchat Canlı Simülatörü' : 'AIchat Live Simulator';
  const desc = lang === 'tr' 
    ? 'Ragleaf AIchat\'in gücünü canlı olarak deneyimleyin. Sektörünüzü seçin, asistanın otomatik randevu, rezervasyon ve ödeme alma süreçlerini ve arka plan loglarını gerçek zamanlı takip edin.'
    : 'Experience the power of Ragleaf AIchat live. Select your sector and watch the assistant handle appointments, reservations, card payments, and live action logs in real-time.';

  return (
    <PageLayout className="min-h-screen" container={false}>
      {/* Intro Header */}
      <div className="relative text-center px-5 pb-10 pt-12 max-w-[900px] mx-auto overflow-hidden">
        <div className="hero-glow" style={{ top: '-150px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            {lang === 'tr' ? 'Etkileşimli Simülasyon' : 'Interactive Simulation'}
          </span>
          <h1 className="font-['Outfit'] text-[50px] max-md:text-[34px] font-black tracking-tight mb-4 leading-tight">
            {lang === 'tr' ? (
              <>Canlı <span className="gradient-text">AIchat</span> Deneyimi</>
            ) : (
              <>Live <span className="gradient-text">AIchat</span> Experience</>
            )}
          </h1>
          <p className="text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            {desc}
          </p>
        </div>
      </div>

      {/* Simulator Container */}
      <div className="container" style={{ paddingBottom: '40px', position: 'relative', zIndex: 2 }}>
        <div 
          style={{ 
            background: 'rgba(10, 10, 15, 0.4)', 
            backdropFilter: 'blur(16px)', 
            border: '1px solid rgba(34, 197, 94, 0.15)', 
            borderRadius: '24px', 
            padding: '12px', 
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)' 
          }}
        >
          <SectorSimulator />
        </div>
      </div>

      {/* Sectoral Modules Details Grid */}
      <div className="container" style={{ paddingBottom: '100px', position: 'relative', zIndex: 2 }}>
        <div className="text-center mb-12">
          <h2 className="font-['Outfit'] text-[32px] max-md:text-[26px] font-bold tracking-tight mb-4 text-white">
            {lang === 'tr' ? 'Sektörünüze Özel Hazır Modüller' : 'Ready-to-Use Sectoral Modules'}
          </h2>
          <p className="text-sm text-text-secondary max-w-xl mx-auto leading-relaxed">
            {lang === 'tr'
              ? 'Ragleaf AIchat sadece mesajlaşmaz; rezervasyon, ödeme alma ve bilet satışı gibi gelişmiş özellikleri kendi içerisindeki interaktif arayüzlerle yönetir.'
              : 'Ragleaf AIchat does not just send messages; it manages advanced actions like reservations, payments, and ticket sales through interactive built-in interfaces.'}
          </p>
        </div>

        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            marginTop: '20px'
          }}
        >
          {/* Card 1: Randevu ve Rezervasyon */}
          <div className="glass-card-hover" style={cardStyle}>
            <div style={iconWrapperStyle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            </div>
            <h3 style={cardTitleStyle}>
              {lang === 'tr' ? 'Randevu & Rezervasyon' : 'Appointments & Booking'}
            </h3>
            <p style={cardDescStyle}>
              {lang === 'tr'
                ? 'Kuaförler, diş hekimleri, güzellik salonları ve oteller için otomatik takvim entegrasyonlu randevu oluşturma ve masa/oda rezervasyonu.'
                : 'Automated calendar-integrated appointment scheduling and table/room booking for hair salons, dentists, beauty clinics, and hotels.'}
            </p>
          </div>

          {/* Card 2: Sipariş & Ödeme Altyapısı */}
          <div className="glass-card-hover" style={cardStyle}>
            <div style={iconWrapperStyle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <h3 style={cardTitleStyle}>
              {lang === 'tr' ? 'Sipariş & Kartlı Ödeme' : 'Ordering & Payments'}
            </h3>
            <p style={cardDescStyle}>
              {lang === 'tr'
                ? 'Restoranlar ve e-ticaret siteleri için doğrudan sohbet penceresinden ürün siparişi alma ve 3D Secure uyumlu güvenli kredi kartı ödeme altyapısı.'
                : 'Browse products, order items directly inside the chat window, and collect card payments securely via integrated 3D Secure support.'}
            </p>
          </div>

          {/* Card 3: Bilet Satış & Koltuk Seçimi */}
          <div className="glass-card-hover" style={cardStyle}>
            <div style={iconWrapperStyle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
            </div>
            <h3 style={cardTitleStyle}>
              {lang === 'tr' ? 'Bilet Satış & Koltuk Seçimi' : 'Ticketing & Seat Selection'}
            </h3>
            <p style={cardDescStyle}>
              {lang === 'tr'
                ? 'Seyahat, tiyatro, konser ve etkinlik biletleri için interaktif koltuk şeması üzerinden koltuk seçimi, bilet kesme ve PNR oluşturma.'
                : 'Interactive seat selection layout for travel, theater, concerts, and events. Automate ticket generation and PNR ticketing on the fly.'}
            </p>
          </div>

          {/* Card 4: Özel Sektörel Form Akışları */}
          <div className="glass-card-hover" style={cardStyle}>
            <div style={iconWrapperStyle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <h3 style={cardTitleStyle}>
              {lang === 'tr' ? 'Özel Form & İş Akışları' : 'Custom Forms & Workflows'}
            </h3>
            <p style={cardDescStyle}>
              {lang === 'tr'
                ? 'Emlak sunumları, teknik servis talepleri veya sponsorluk teklifleri gibi işletmenize özel form yapılarını ve bilgi toplama adımlarını tasarlayın.'
                : 'Design custom collection forms and conversational steps for real estate viewings, technical support, or corporate sponsorships.'}
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

// Styling tokens for dynamic sectoral modules grid
const cardStyle = {
  background: 'rgba(255, 255, 255, 0.015)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '20px',
  padding: '32px 28px',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)'
};

const iconWrapperStyle = {
  background: 'rgba(34, 197, 94, 0.08)',
  border: '1px solid rgba(34, 197, 94, 0.2)',
  borderRadius: '12px',
  padding: '10px',
  marginBottom: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const cardTitleStyle = {
  fontFamily: "'Outfit', sans-serif",
  fontSize: '20px',
  fontWeight: '700',
  color: 'white',
  marginBottom: '12px'
};

const cardDescStyle = {
  fontSize: '14px',
  color: 'var(--text-secondary)',
  lineHeight: '1.6',
  margin: '0'
};

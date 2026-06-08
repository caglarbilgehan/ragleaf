"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '../context/LangContext';
import { useUI } from '../context/UIContext';
import LangModal from './LangModal';

export default function Header() {
  const { lang, t } = useLang();
  const { openLogin, openSignup } = useUI();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);

  // Determine active route
  const getActiveStyle = (path) => {
    const active = pathname === path || (path === '/' && pathname === '');
    return active
      ? { color: 'var(--accent)', textShadow: '0 0 10px var(--accent-glow)' }
      : {};
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsProductsOpen(false);
  };

  const handleLoginClick = () => {
    closeMenu();
    openLogin();
  };

  const handleSignupClick = () => {
    closeMenu();
    openSignup();
  };

  return (
    <>
      <nav className="nav" id="nav" lang={lang} style={{ background: 'rgba(10, 10, 15, 0.8)' }}>
        <div className="container nav-inner">
          {/* Left: Hamburger (visible only on mobile) */}
          <button 
            className={`nav-hamburger-animated ${isMenuOpen ? 'open' : ''}`} 
            onClick={toggleMenu} 
            aria-label="Menü"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          <div className="nav-brand-group">
            {/* Logo */}
            <Link href="/" className="nav-logo" onClick={closeMenu}>
              <svg className="leaf" width="30" height="30" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.4))' }}>
                <defs>
                  <linearGradient id="logo-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <path d="M32 6C48 18 52 36 44 48C38 56 32 58 32 58C32 58 26 56 20 48C12 36 16 18 32 6Z" stroke="url(#logo-grad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M32 58V14" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" />
                <path d="M32 44L18 34" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M32 36L46 26" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M32 26L20 16" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M32 20L44 10" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="32" cy="14" r="3" fill="#06b6d4" filter="url(#glow)" />
                <circle cx="18" cy="34" r="2.5" fill="#22c55e" />
                <circle cx="46" cy="26" r="2.5" fill="#06b6d4" />
                <circle cx="20" cy="16" r="2.5" fill="#22c55e" />
                <circle cx="44" cy="10" r="2.5" fill="#06b6d4" filter="url(#glow)" />
              </svg>
              <span className="nav-logo-text">Ragleaf</span>
            </Link>
          </div>

          {/* Mobile Action Buttons (visible only on mobile) */}
          <div className="nav-mobile-actions">
            <button 
              className="lang-globe-btn lang-mobile-btn" 
              onClick={() => setIsLangOpen(true)}
              aria-label="Language"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"></path></svg>
            </button>
            <button onClick={handleLoginClick} className="btn btn-ghost btn-login-mobile">{t('nav_login')}</button>
            <button onClick={handleSignupClick} className="btn btn-primary btn-signup-mobile">{t('nav_start')}</button>
          </div>

          {/* Right: Nav Links */}
          <div className={`nav-links ${isMenuOpen ? 'open' : ''}`} id="navLinks">
            {/* Products Dropdown */}
            <div className={`nav-dropdown ${isProductsOpen ? 'mobile-open' : ''}`}>
              <button 
                className="nav-dropdown-trigger"
                onClick={(e) => {
                  if (window.innerWidth < 1024) {
                    e.preventDefault();
                    setIsProductsOpen(!isProductsOpen);
                  }
                }}
              >
                {t('nav_products')}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="nav-dropdown-menu">
                <div className="mega-menu-grid">
                  <div className="mega-menu-col">
                    <span className="mega-menu-heading">{lang === 'tr' ? 'Aktif Ürünler' : 'Active Products'}</span>
                    <Link href="/aiassistant" className="nav-dropdown-item" onClick={closeMenu}>
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>assistant
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Dokümanlarınızla eğitilen akıllı asistan' : 'Smart assistant trained on your docs'}</span>
                    </Link>
                    <Link href="/aichat" className="nav-dropdown-item" onClick={closeMenu}>
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>chat
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Rezervasyon, randevu, sipariş ve bilet modüllü canlı sohbet' : 'Live chatbot with reservation, appointment, order, and ticket modules'}</span>
                    </Link>
                    <Link href="/aiwriter" className="nav-dropdown-item" onClick={closeMenu}>
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>writer
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Asistan kimliği ve ses tonuyla otonom içerik üretici' : 'Autonomous content creator with assistant identity and tone of voice'}</span>
                    </Link>
                    <Link href="/aiautomation" className="nav-dropdown-item" onClick={closeMenu}>
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>automation
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Tetikleyici tabanlı otonom asistan iş akışları' : 'Trigger-based autonomous assistant workflows'}</span>
                    </Link>
                  </div>
                  <div className="mega-menu-col desktop-only">
                    <span className="mega-menu-heading">{lang === 'tr' ? 'Çok Yakında' : 'Coming Soon'}</span>
                    <div className="nav-dropdown-item disabled">
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>social <span className="badge-soon">{lang === 'tr' ? 'Yakında' : 'Soon'}</span>
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Yapay zeka sosyal medya yöneticisi' : 'AI social media manager'}</span>
                    </div>
                    <div className="nav-dropdown-item disabled">
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>mail <span className="badge-soon">{lang === 'tr' ? 'Yakında' : 'Soon'}</span>
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Yapay zeka e-posta asistanı' : 'AI email assistant'}</span>
                    </div>
                    <div className="nav-dropdown-item disabled">
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M22 4s-.7 2.1-2 3.4c-1.6 1.6-3.8 1.6-3.8 1.6M22 4v4M22 4h-4M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>call <span className="badge-soon">{lang === 'tr' ? 'Yakında' : 'Soon'}</span>
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Sesli yapay zeka görüşme botu' : 'Voice-based AI calling bot'}</span>
                    </div>
                    <div className="nav-dropdown-item disabled">
                      <span className="nav-dropdown-item-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                        <span style={{ color: 'var(--accent)' }}>AI</span>promotion <span className="badge-soon">{lang === 'tr' ? 'Yakında' : 'Soon'}</span>
                      </span>
                      <span className="nav-dropdown-item-desc">{lang === 'tr' ? 'Yapay zeka pazarlama ve kampanya otomasyonu' : 'AI marketing and promotion automation'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Link href="/pricing" style={getActiveStyle('/pricing')} onClick={closeMenu}>{t('nav_packages')}</Link>
            <Link href="/docs" style={getActiveStyle('/docs')} onClick={closeMenu}>{t('nav_installation')}</Link>
            <Link href="/blog" style={getActiveStyle('/blog')} onClick={closeMenu}>Blog</Link>
            <Link href="/affiliate" style={getActiveStyle('/affiliate')} onClick={closeMenu}>{t('nav_affiliate')}</Link>

            <span className="nav-separator desktop-only"></span>

            <button 
              className="lang-globe-btn desktop-only" 
              onClick={() => setIsLangOpen(true)} 
              aria-label="Language"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"></path></svg>
            </button>
            <button onClick={handleLoginClick} className="btn btn-primary desktop-only" style={{ padding: '8px 20px', cursor: 'pointer' }}>{t('nav_login')}</button>
            <button onClick={handleSignupClick} className="btn btn-primary desktop-only" style={{ padding: '8px 20px', cursor: 'pointer' }}>{t('nav_start')}</button>

            {/* Mobile Drawer Only Links */}
            <Link href="/about" className="mobile-only-link" onClick={closeMenu}>{t('nav_about')}</Link>
            <Link href="/legal" className="mobile-only-link" onClick={closeMenu}>{t('flegal')}</Link>
            <Link href="/contact" className="mobile-only-link" onClick={closeMenu}>{t('fcont')}</Link>

            {/* Mobile-only interactive assistant section */}
            <div className="mobile-menu-footer">
              <button 
                onClick={handleSignupClick}
                className="mobile-menu-ai-btn"
              >
                <span>{lang === 'tr' ? 'Şimdi Başla' : 'Get Started'}</span>
                <span className="ai-btn-sparkle" style={{ marginLeft: '4px' }}>→</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <LangModal isOpen={isLangOpen} onClose={() => setIsLangOpen(false)} />
    </>
  );
}

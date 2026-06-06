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
            className="nav-hamburger" 
            onClick={toggleMenu} 
            aria-label="Menü"
          >
            {isMenuOpen ? '✕' : '☰'}
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
          </div>

          {/* Right: Nav Links */}
          <div className={`nav-links ${isMenuOpen ? 'open' : ''}`} id="navLinks">
            <Link href="/installation" style={getActiveStyle('/installation')} onClick={closeMenu}>{t('nav_installation')}</Link>
            <Link href="/pricing" style={getActiveStyle('/pricing')} onClick={closeMenu}>{t('nav_packages')}</Link>
            <Link href="/developers" style={getActiveStyle('/developers')} onClick={closeMenu}>{t('nav_developers')}</Link>
            <Link href="/blog" style={getActiveStyle('/blog')} onClick={closeMenu}>Blog</Link>

            <span className="nav-separator desktop-only"></span>

            <button 
              className="lang-globe-btn desktop-only" 
              onClick={() => setIsLangOpen(true)} 
              aria-label="Language"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"></path></svg>
            </button>
            <button onClick={handleLoginClick} className="btn btn-ghost desktop-only" style={{ padding: '8px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>{t('nav_login')}</button>
            <button onClick={handleSignupClick} className="btn btn-primary" style={{ padding: '8px 20px', cursor: 'pointer' }}>{t('nav_start')}</button>

            {/* Mobile Drawer Only Links */}
            <Link href="/about" className="mobile-only-link" onClick={closeMenu}>{t('nav_about')}</Link>
            <Link href="/legal" className="mobile-only-link" onClick={closeMenu}>{t('flegal')}</Link>
            <Link href="/contact" className="mobile-only-link" onClick={closeMenu}>{t('fcont')}</Link>
          </div>
        </div>
      </nav>

      <LangModal isOpen={isLangOpen} onClose={() => setIsLangOpen(false)} />
    </>
  );
}

"use client";

import React from 'react';
import Link from 'next/link';
import { useLang } from '../context/LangContext';
import { useAssistant } from '../context/AssistantContext';
import { useUI } from '../context/UIContext';

export default function Footer() {
  const { lang, t } = useLang();
  const { toggleAssistant } = useAssistant();
  const { setHowItWorksOpen } = useUI();

  return (
    <footer className="footer" lang={lang}>
      <div className="container footer-inner">
        {/* Desktop Footer Logo */}
        <Link href="/" className="footer-logo desktop-only" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg className="leaf" width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.3))' }}>
            <defs>
              <linearGradient id="logo-grad-footer" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <filter id="glow-footer" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <path d="M32 6C48 18 52 36 44 48C38 56 32 58 32 58C32 58 26 56 20 48C12 36 16 18 32 6Z" stroke="url(#logo-grad-footer)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M32 58V14" stroke="url(#logo-grad-footer)" strokeWidth="2" strokeLinecap="round" />
            <path d="M32 44L18 34" stroke="url(#logo-grad-footer)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M32 36L46 26" stroke="url(#logo-grad-footer)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M32 26L20 16" stroke="url(#logo-grad-footer)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M32 20L44 10" stroke="url(#logo-grad-footer)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="32" cy="14" r="3" fill="#06b6d4" filter="url(#glow-footer)" />
            <circle cx="18" cy="34" r="2.5" fill="#22c55e" />
            <circle cx="46" cy="26" r="2.5" fill="#06b6d4" />
            <circle cx="20" cy="16" r="2.5" fill="#22c55e" />
            <circle cx="44" cy="10" r="2.5" fill="#06b6d4" filter="url(#glow-footer)" />
          </svg>
          Ragleaf
        </Link>

        <div className="footer-links desktop-only">
          <Link href="/about">{t('nav_about')}</Link>
          <Link href="/legal">{t('flegal')}</Link>
          <Link href="/contact">{t('fcont')}</Link>
        </div>

        {/* Mobile Footer Content */}
        <div className="footer-mobile-row mobile-only-flex" style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          <button 
            onClick={() => setHowItWorksOpen(true)}
            className="btn btn-ghost btn-sm" 
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            {t('hero_btn2')}
          </button>
          <button 
            onClick={() => toggleAssistant(true)}
            className="mobile-footer-assistant-btn" 
            style={{ 
              textDecoration: 'none', 
              color: 'var(--accent)', 
              fontWeight: 600, 
              fontSize: '13px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 12px', 
              background: 'rgba(34, 197, 94, 0.08)', 
              borderRadius: '12px', 
              border: '1px solid rgba(34, 197, 94, 0.2)' 
            }}
          >
            <span>{t('footer_ask_ai')}</span> 🍃
          </button>
        </div>
      </div>
    </footer>
  );
}

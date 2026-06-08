"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LangContext';
import { LANGS, MODAL_TEXT } from '../i18n/translations';

const renderFlag = (code) => {
  if (code === 'tr') {
    return (
      <svg width="20" height="14" viewBox="0 0 24 16" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
        <rect width="24" height="16" fill="#E30A17" />
        <circle cx="9.6" cy="8" r="4.2" fill="#FFFFFF" />
        <circle cx="10.8" cy="8" r="3.4" fill="#E30A17" />
        <polygon points="14.2,8 15.6,9.1 15.1,7.3 16.5,6.2 14.8,6.2 14.2,4.4 13.6,6.2 11.9,6.2 13.3,7.3 12.8,9.1" fill="#FFFFFF" />
      </svg>
    );
  }
  if (code === 'en') {
    return (
      <svg width="20" height="14" viewBox="0 0 24 16" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
        <rect width="24" height="16" fill="#00247D" />
        <path d="M0 0 L24 16 M24 0 L0 16" stroke="#FFFFFF" strokeWidth="2.8" />
        <path d="M0 0 L24 16 M24 0 L0 16" stroke="#CF142B" strokeWidth="1.2" />
        <path d="M12 0 V16 M0 8 H24" stroke="#FFFFFF" strokeWidth="4.4" />
        <path d="M12 0 V16 M0 8 H24" stroke="#CF142B" strokeWidth="2.8" />
      </svg>
    );
  }
  return null;
};

export default function LangModal({ isOpen, onClose }) {
  const { lang, changeLang } = useLang();
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const t = (key) => MODAL_TEXT[lang]?.[key] || MODAL_TEXT['tr']?.[key] || key;

  const filteredLangs = LANGS.filter(
    (l) =>
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.native.toLowerCase().includes(search.toLowerCase()) ||
      l.code.includes(search.toLowerCase())
  );

  return (
    <>
      <div className="lang-overlay open" onClick={onClose}></div>
      <div className="lang-modal open">
        <div className="lang-modal-header">
          <h3>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--accent-glow)',
              color: 'var(--accent)',
              fontSize: '16px',
              marginRight: '8px'
            }}>⊕</span>
            <span>{t('title')}</span>
          </h3>
          <button className="lang-modal-close" onClick={onClose}>&times;</button>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          className="lang-search"
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ display: 'none' }}
        />
        <div className="lang-grid" style={{ marginTop: '16px' }}>
          {filteredLangs.map((l) => (
            <button
              key={l.code}
              className={`lang-option ${l.code === lang ? 'active' : ''}`}
              onClick={() => {
                changeLang(l.code);
                onClose();
              }}
            >
              <span className="flag" style={{ display: 'flex', alignItems: 'center' }}>{renderFlag(l.code)}</span>
              <span className="lang-name">{l.native}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

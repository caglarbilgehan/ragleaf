"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LangContext';
import { LANGS, MODAL_TEXT } from '../i18n/translations';

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
        />
        <div className="lang-grid">
          {filteredLangs.map((l) => (
            <button
              key={l.code}
              className={`lang-option ${l.code === lang ? 'active' : ''}`}
              onClick={() => {
                changeLang(l.code);
                onClose();
              }}
            >
              <span className="flag">{l.flag}</span>
              <span className="lang-name">{l.native}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

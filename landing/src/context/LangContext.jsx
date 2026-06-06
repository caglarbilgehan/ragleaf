"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { T } from '../i18n/translations';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved && (saved === 'tr' || saved === 'en')) {
      setLang(saved);
    }
  }, []);

  const changeLang = (code) => {
    if (code === 'tr' || code === 'en') {
      setLang(code);
      localStorage.setItem('lang', code);
    }
  };

  const t = (key) => {
    return T[lang]?.[key] || T['tr']?.[key] || key;
  };

  return (
    <LangContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error('useLang must be used within a LangProvider');
  }
  return context;
}

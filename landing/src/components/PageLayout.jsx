import React from 'react';
import { useLang } from '../context/LangContext';

export default function PageLayout({ children, className = '' }) {
  const { lang } = useLang();
  return (
    <div className="page-layout" lang={lang}>
      <div className={`container ${className}`}>
        {children}
      </div>
    </div>
  );
}

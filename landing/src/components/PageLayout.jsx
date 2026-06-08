import React from 'react';
import { useLang } from '../context/LangContext';

export default function PageLayout({ children, className = '', container = true }) {
  const { lang } = useLang();
  return (
    <div className="page-layout" lang={lang}>
      {container ? (
        <div className={`container ${className}`}>
          {children}
        </div>
      ) : (
        <div className={className}>
          {children}
        </div>
      )}
    </div>
  );
}

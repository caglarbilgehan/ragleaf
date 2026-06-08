"use client";

import React, { useState, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { useLang } from '../context/LangContext';
import { getApiBaseUrl } from '../utils/api';

const trans = {
  tr: {
    title: "🍃 Giriş Yap",
    emailLabel: "E-posta",
    emailPlaceholder: "ornek@firma.com",
    passwordLabel: "Şifre",
    loggingIn: "Giriş yapılıyor...",
    login: "Giriş Yap",
    noAccount: "Hesabınız yok mu? ",
    register: "Kayıt olun",
    errLoginFailed: "Giriş başarısız"
  },
  en: {
    title: "🍃 Log In",
    emailLabel: "Email",
    emailPlaceholder: "example@company.com",
    passwordLabel: "Password",
    loggingIn: "Logging in...",
    login: "Log In",
    noAccount: "Don't have an account? ",
    register: "Register",
    errLoginFailed: "Login failed"
  }
};

export default function LoginModal() {
  const { isLoginOpen, setLoginOpen, openSignup, closeAll } = useUI();
  const { lang } = useLang();
  const t = trans[lang || 'en'] || trans.en;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoginOpen) {
      setEmail('');
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [isLoginOpen]);

  if (!isLoginOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const API_BASE = getApiBaseUrl();
    const APP_URL = window.location.hostname.includes('ragleaf.com') 
      ? 'https://app.ragleaf.com' 
      : `${window.location.protocol}//${window.location.hostname}:1398`;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t.errLoginFailed);

      localStorage.setItem('ragleaf_token', data.access_token);
      localStorage.setItem('ragleaf_user', JSON.stringify(data.user));
      
      // Redirect to panel dashboard with token parameter
      window.location.href = `${APP_URL}/login?token=${encodeURIComponent(data.access_token)}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="modal-overlay open" onClick={closeAll}></div>
      <div className="modal-box modal-sm open" id="loginModal">
        <div className="modal-header">
          <h3>{t.title}</h3>
          <button className="modal-close" onClick={closeAll}>&times;</button>
        </div>
        <div className="modal-body">
          <form id="loginForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{t.emailLabel}</label>
              <input
                type="email"
                className="form-input"
                id="loginEmail"
                placeholder={t.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>{t.passwordLabel}</label>
              <div className="pw-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  id="loginPassword"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>
            
            {error && (
              <div id="loginError" className="form-error" style={{ display: 'block', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="btn btn-primary"
              id="loginBtn"
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
              disabled={isLoading}
            >
              {isLoading ? t.loggingIn : t.login}
            </button>
          </form>
          
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
            {t.noAccount}{' '}
            <a 
              className="modal-link" 
              onClick={() => openSignup()}
              style={{ cursor: 'pointer' }}
            >
              {t.register}
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

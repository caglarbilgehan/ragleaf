"use client";

import React, { useState, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { useLang } from '../context/LangContext';

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

    const API_BASE = window.location.hostname.includes('ragleaf.com') 
      ? 'https://api.ragleaf.com' 
      : 'http://localhost:1306';
    const APP_URL = window.location.hostname.includes('ragleaf.com') 
      ? 'https://app.ragleaf.com' 
      : 'http://localhost:5173';

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
                >
                  {showPassword ? '🙈' : '👁️'}
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

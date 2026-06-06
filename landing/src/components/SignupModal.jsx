"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../context/UIContext';
import { useLang } from '../context/LangContext';

const COUNTRIES = [
  { flag: '🇹🇷', name: 'Türkiye', code: '+90', min: 10, max: 10 },
  { flag: '🇩🇪', name: 'Almanya', code: '+49', min: 10, max: 11 },
  { flag: '🇦🇱', name: 'Arnavutluk', code: '+355', min: 9, max: 9 },
  { flag: '🇦🇹', name: 'Avusturya', code: '+43', min: 10, max: 11 },
  { flag: '🇧🇾', name: 'Belarus', code: '+375', min: 9, max: 10 },
  { flag: '🇧🇪', name: 'Belçika', code: '+32', min: 9, max: 9 },
  { flag: '🇧🇦', name: 'Bosna Hersek', code: '+387', min: 8, max: 9 },
  { flag: '🇧🇬', name: 'Bulgaristan', code: '+359', min: 8, max: 9 },
  { flag: '🇨🇿', name: 'Çekya', code: '+420', min: 9, max: 9 },
  { flag: '🇩🇰', name: 'Danimarka', code: '+45', min: 8, max: 8 },
  { flag: '🇪🇪', name: 'Estonya', code: '+372', min: 7, max: 8 },
  { flag: '🇫🇮', name: 'Finlandiya', code: '+358', min: 9, max: 10 },
  { flag: '🇫🇷', name: 'Fransa', code: '+33', min: 9, max: 9 },
  { flag: '🇭🇷', name: 'Hırvatistan', code: '+385', min: 8, max: 9 },
  { flag: '🇳🇱', name: 'Hollanda', code: '+31', min: 9, max: 9 },
  { flag: '🇬🇧', name: 'İngiltere', code: '+44', min: 10, max: 10 },
  { flag: '🇮🇪', name: 'İrlanda', code: '+353', min: 9, max: 9 },
  { flag: '🇪🇸', name: 'İspanya', code: '+34', min: 9, max: 9 },
  { flag: '🇮🇸', name: 'İzlanda', code: '+354', min: 7, max: 7 },
  { flag: '🇨🇭', name: 'İsviçre', code: '+41', min: 9, max: 9 },
  { flag: '🇸🇪', name: 'İsveç', code: '+46', min: 9, max: 9 },
  { flag: '🇮🇹', name: 'İtalya', code: '+39', min: 9, max: 10 },
  { flag: '🇽🇰', name: 'Kosova', code: '+383', min: 8, max: 8 },
  { flag: '🇱🇻', name: 'Letonya', code: '+371', min: 8, max: 8 },
  { flag: '🇱🇹', name: 'Litvanya', code: '+370', min: 8, max: 8 },
  { flag: '🇱🇺', name: 'Lüksemburg', code: '+352', min: 8, max: 9 },
  { flag: '🇭🇺', name: 'Macaristan', code: '+36', min: 9, max: 9 },
  { flag: '🇲🇰', name: 'Kuzey Makedonya', code: '+389', min: 8, max: 8 },
  { flag: '🇲🇹', name: 'Malta', code: '+356', min: 8, max: 8 },
  { flag: '🇲🇩', name: 'Moldova', code: '+373', min: 8, max: 8 },
  { flag: '🇲🇪', name: 'Karadağ', code: '+382', min: 8, max: 8 },
  { flag: '🇳🇴', name: 'Norveç', code: '+47', min: 8, max: 8 },
  { flag: '🇵🇱', name: 'Polonya', code: '+48', min: 9, max: 9 },
  { flag: '🇵🇹', name: 'Portekiz', code: '+351', min: 9, max: 9 },
  { flag: '🇷🇴', name: 'Romanya', code: '+40', min: 9, max: 9 },
  { flag: '🇷🇺', name: 'Rusya', code: '+7', min: 10, max: 10 },
  { flag: '🇷🇸', name: 'Sırbistan', code: '+381', min: 8, max: 9 },
  { flag: '🇸🇰', name: 'Slovakya', code: '+421', min: 9, max: 9 },
  { flag: '🇸🇮', name: 'Slovenya', code: '+386', min: 8, max: 8 },
  { flag: '🇺🇦', name: 'Ukrayna', code: '+380', min: 9, max: 9 },
  { flag: '🇬🇷', name: 'Yunanistan', code: '+30', min: 10, max: 10 },
  { flag: '🇨🇾', name: 'Kıbrıs', code: '+357', min: 8, max: 8 },
  { flag: '🇺🇸', name: 'Amerika (ABD)', code: '+1', min: 10, max: 10 },
];

const trans = {
  tr: {
    title: "🍃 Markanızı Oluşturun",
    step1: "Marka",
    step2: "Hesap Bilgileri",
    brandDesc: "Markanızı tanıtın — bu bilgiler AI asistanınızın temelini oluşturacak.",
    brandNameLabel: "Marka / İşletme Adı *",
    brandNamePlaceholder: "ör: Bella Güzellik Salonu",
    phoneLabel: "Telefon *",
    websiteLabel: "Website *",
    websitePlaceholder: "markaniz.com",
    brandHint: "💡 Bu bilgiler AI asistanınızın temelini oluşturacak.",
    searchCountry: "Ülke ara...",
    accountDesc: "Yönetim panelinize erişmek için bir hesap oluşturun.",
    firstNameLabel: "Ad *",
    firstNamePlaceholder: "Adınız",
    lastNameLabel: "Soyad *",
    lastNamePlaceholder: "Soyadınız",
    emailLabel: "E-posta *",
    emailPlaceholder: "ornek@markaniz.com",
    passwordLabel: "Şifre *",
    passwordPlaceholder: "En az 8 karakter",
    passwordConfirmLabel: "Şifre Tekrar *",
    passwordConfirmPlaceholder: "Şifreyi tekrar girin",
    kvkkPrefix: "KVKK Aydınlatma Metni",
    kvkkMid: "'ni ve ",
    kvkkSuffix: "Kullanıcı Sözleşmesi'ni okudum, kabul ediyorum. *",
    kvkkAlert: "Ragleaf KVKK Aydınlatma Metni:\n\nKişisel verileriniz, 6698 sayılı KVKK kapsamında servislerimizi sunabilmek amacıyla işlenmektedir. Detaylı bilgi için müşteri paneli üzerinden belgelere erişebilirsiniz.",
    weak: "Zayıf",
    fair: "Orta",
    good: "İyi",
    strong: "Güçlü",
    back: "← Geri",
    continue: "Devam →",
    registering: "Kaydediliyor...",
    register: "Kayıt Ol ve Paneli Aç ✓",
    alreadyHaveAccount: "Zaten hesabınız var mı? ",
    login: "Giriş yapın",
    errBrandNameRequired: "Marka / işletme adı zorunludur.",
    errBrandNameLength: "Marka adı en az 2 karakter olmalıdır.",
    errPhoneRequired: "Telefon numarası zorunludur.",
    errPhoneDigits: "Telefon numarası sadece rakam içermelidir.",
    errPhoneLength: (min, max, current) => `Seçilen ülke kodu için telefon numarası ${min === max ? min : min + '-' + max} haneli olmalıdır. (Girilen: ${current} hane)`,
    errWebsiteRequired: "Website adresi zorunludur.",
    errWebsiteInvalid: "Geçerli bir website adresi girin. (ör: markaniz.com)",
    errNameRequired: "Ad ve soyad zorunludur.",
    errEmailInvalid: "Geçerli bir e-posta adresi girin.",
    errPasswordLength: "Şifre en az 8 karakter olmalıdır.",
    errPasswordMismatch: "Şifreler eşleşmiyor.",
    errKvkkRequired: "KVKK ve Kullanıcı Sözleşmesi onaylanmalıdır.",
    errRegisterFailed: "Kayıt başarısız"
  },
  en: {
    title: "🍃 Create Your Brand",
    step1: "Brand",
    step2: "Account Info",
    brandDesc: "Introduce your brand — this information will form the foundation of your AI assistant.",
    brandNameLabel: "Brand / Business Name *",
    brandNamePlaceholder: "e.g., Bella Beauty Salon",
    phoneLabel: "Phone *",
    websiteLabel: "Website *",
    websitePlaceholder: "yourbrand.com",
    brandHint: "💡 This information will form the foundation of your AI assistant.",
    searchCountry: "Search country...",
    accountDesc: "Create an account to access your management panel.",
    firstNameLabel: "First Name *",
    firstNamePlaceholder: "Your first name",
    lastNameLabel: "Last Name *",
    lastNamePlaceholder: "Your last name",
    emailLabel: "Email *",
    emailPlaceholder: "example@yourbrand.com",
    passwordLabel: "Password *",
    passwordPlaceholder: "At least 8 characters",
    passwordConfirmLabel: "Confirm Password *",
    passwordConfirmPlaceholder: "Enter password again",
    kvkkPrefix: "KVKK Clarification Text",
    kvkkMid: " and the ",
    kvkkSuffix: "User Agreement, and I agree. *",
    kvkkAlert: "Ragleaf KVKK & Terms Policy:\n\nYour personal data is processed within the scope of our services in compliance with KVKK & GDPR regulations. You can access detailed documents on your customer dashboard.",
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
    back: "← Back",
    continue: "Continue →",
    registering: "Registering...",
    register: "Register & Open Panel ✓",
    alreadyHaveAccount: "Already have an account? ",
    login: "Log in",
    errBrandNameRequired: "Brand / business name is required.",
    errBrandNameLength: "Brand name must be at least 2 characters.",
    errPhoneRequired: "Phone number is required.",
    errPhoneDigits: "Phone number must contain digits only.",
    errPhoneLength: (min, max, current) => `Phone number for the selected country code must be ${min === max ? min : min + '-' + max} digits. (Entered: ${current} digits)`,
    errWebsiteRequired: "Website address is required.",
    errWebsiteInvalid: "Enter a valid website address. (e.g., yourbrand.com)",
    errNameRequired: "First name and last name are required.",
    errEmailInvalid: "Enter a valid email address.",
    errPasswordLength: "Password must be at least 8 characters.",
    errPasswordMismatch: "Passwords do not match.",
    errKvkkRequired: "KVKK and User Agreement must be approved.",
    errRegisterFailed: "Registration failed"
  }
};

export default function SignupModal() {
  const { isSignupOpen, signupPlan, openLogin, closeAll } = useUI();
  const { lang } = useLang();
  const t = trans[lang || 'en'] || trans.en;
  
  const [step, setStep] = useState(0);

  // Form states
  const [brandName, setBrandName] = useState('');
  const [brandPhone, setBrandPhone] = useState('');
  const [brandWebsite, setBrandWebsite] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isKvkkChecked, setIsKvkkChecked] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const countryPickerRef = useRef(null);

  useEffect(() => {
    if (isSignupOpen) {
      setStep(0);
      setBrandName('');
      setBrandPhone('');
      setBrandWebsite('');
      setSelectedCountry(COUNTRIES[0]);
      setIsCountryDropdownOpen(false);
      setCountrySearch('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setIsKvkkChecked(false);
      setError('');
    }
  }, [isSignupOpen]);

  // Click outside listener for country dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (countryPickerRef.current && !countryPickerRef.current.contains(e.target)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isSignupOpen) return null;

  const getCountryName = (c) => {
    if (lang === 'en') {
      const enNames = {
        'Türkiye': 'Turkey',
        'Almanya': 'Germany',
        'Arnavutluk': 'Albania',
        'Avusturya': 'Austria',
        'Belarus': 'Belarus',
        'Belçika': 'Belgium',
        'Bosna Hersek': 'Bosnia and Herzegovina',
        'Bulgaristan': 'Bulgaria',
        'Çekya': 'Czechia',
        'Danimarka': 'Denmark',
        'Estonya': 'Estonia',
        'Finlandiya': 'Finland',
        'Fransa': 'France',
        'Hırvatistan': 'Croatia',
        'Hollanda': 'Netherlands',
        'İngiltere': 'United Kingdom',
        'İrlanda': 'Ireland',
        'İspanya': 'Spain',
        'İzlanda': 'Iceland',
        'İsviçre': 'Switzerland',
        'İsveç': 'Sweden',
        'İtalya': 'Italy',
        'Kosova': 'Kosovo',
        'Letonya': 'Latvia',
        'Litvanya': 'Lithuania',
        'Lüksemburg': 'Luxembourg',
        'Macaristan': 'Hungary',
        'Kuzey Makedonya': 'North Macedonia',
        'Malta': 'Malta',
        'Moldova': 'Moldova',
        'Karadağ': 'Montenegro',
        'Norveç': 'Norway',
        'Polonya': 'Poland',
        'Portekiz': 'Portugal',
        'Romanya': 'Romania',
        'Rusya': 'Russia',
        'Sırbistan': 'Serbia',
        'Slovakya': 'Slovakia',
        'Slovenya': 'Slovenia',
        'Ukrayna': 'Ukraine',
        'Yunanistan': 'Greece',
        'Kıbrıs': 'Cyprus',
        'Amerika (ABD)': 'United States'
      };
      return enNames[c.name] || c.name;
    }
    return c.name;
  };

  // Password strength check
  const getPasswordStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (password.length === 0) return { className: '', label: '' };
    if (score <= 1) return { className: 'weak', label: t.weak };
    if (score === 2) return { className: 'fair', label: t.fair };
    if (score === 3) return { className: 'good', label: t.good };
    return { className: 'strong', label: t.strong };
  };

  const pwStrength = getPasswordStrength();

  const handleNext = () => {
    setError('');

    if (step === 0) {
      const nameTrimmed = brandName.trim();
      if (!nameTrimmed) { setError(t.errBrandNameRequired); return; }
      if (nameTrimmed.length < 2) { setError(t.errBrandNameLength); return; }

      const phoneDigits = brandPhone.replace(/[\s\-\(\)]/g, '');
      if (!phoneDigits) { setError(t.errPhoneRequired); return; }
      if (!/^\d+$/.test(phoneDigits)) { setError(t.errPhoneDigits); return; }
      
      const { min, max } = selectedCountry;
      if (phoneDigits.length < min || phoneDigits.length > max) {
        setError(t.errPhoneLength(min, max, phoneDigits.length));
        return;
      }

      let website = brandWebsite.trim();
      if (!website) { setError(t.errWebsiteRequired); return; }
      if (!/^https?:\/\//i.test(website)) { website = 'https://' + website; }
      
      const domainPattern = /^https?:\/\/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
      if (!domainPattern.test(website)) {
        setError(t.errWebsiteInvalid);
        return;
      }
      setBrandWebsite(website);
      setStep(1);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(0);
  };

  const handleKvkkClick = (e) => {
    e.preventDefault();
    alert(t.kvkkAlert);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) { setError(t.errNameRequired); return; }
    if (!email.trim() || !email.includes('@')) { setError(t.errEmailInvalid); return; }
    if (password.length < 8) { setError(t.errPasswordLength); return; }
    if (password !== passwordConfirm) { setError(t.errPasswordMismatch); return; }
    if (!isKvkkChecked) { setError(t.errKvkkRequired); return; }

    setIsLoading(true);

    const API_BASE = window.location.hostname.includes('ragleaf.com') 
      ? 'https://api.ragleaf.com' 
      : 'http://localhost:1306';
    const APP_URL = window.location.hostname.includes('ragleaf.com') 
      ? 'https://app.ragleaf.com' 
      : 'http://localhost:5173';

    const phoneDigits = brandPhone.replace(/[\s\-\(\)]/g, '');
    const fullPhone = selectedCountry.code + phoneDigits;

    const body = {
      name: firstName.trim(),
      surname: lastName.trim(),
      email: email.trim(),
      password: password,
      phone: fullPhone || null,
      company_name: brandName.trim() || null,
      website: brandWebsite || null,
      sector: null,
      plan: signupPlan,
      template_slug: null,
      agent_name: null,
      welcome_message: null,
      agent_description: null,
      brand_config: {
        firma_adi: brandName.trim(),
        telefon: fullPhone,
        website: brandWebsite
      }
    };

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t.errRegisterFailed);

      localStorage.setItem('ragleaf_token', data.access_token);
      localStorage.setItem('ragleaf_user', JSON.stringify(data.user));
      localStorage.setItem('show_onboarding_wizard', 'true');
      
      // Redirect to panel app
      window.location.href = `${APP_URL}/login?token=${encodeURIComponent(data.access_token)}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
    c.code.includes(countrySearch)
  );

  return (
    <>
      <div className="modal-overlay open" onClick={closeAll}></div>
      <div className="modal-box modal-lg open" id="signupModal">
        <div className="modal-header">
          <h3>{t.title}</h3>
          <button className="modal-close" onClick={closeAll}>&times;</button>
        </div>
        
        <div className="modal-body">
          {/* Step Indicator */}
          <div className="wizard-steps" style={{ justifyContent: 'center', gap: '40px', marginBottom: '24px' }}>
            <div className={`wizard-step ${step === 0 ? 'active' : 'done'}`}>
              <div className="step-dot">1</div>
              <span className="step-label">{t.step1}</span>
            </div>
            <div className={`wizard-step ${step === 1 ? 'active' : ''}`}>
              <div className="step-dot">2</div>
              <span className="step-label">{t.step2}</span>
            </div>
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Step 1: Marka Bilgileri */}
            {step === 0 && (
              <div className="wizard-page active">
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {t.brandDesc}
                </p>
                
                <div className="form-group">
                  <label>{t.brandNameLabel}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t.brandNamePlaceholder}
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t.phoneLabel}</label>
                  <div className="phone-input-wrap">
                    <div className="country-picker" ref={countryPickerRef}>
                      <button
                        type="button"
                        className="country-picker-btn"
                        onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                      >
                        <span className="cp-flag">{selectedCountry.flag}</span>
                        <span className="cp-code">{selectedCountry.code}</span>
                        <span className="cp-arrow">▾</span>
                      </button>
                      
                      {isCountryDropdownOpen && (
                        <div className="country-dropdown open">
                          <input
                            type="text"
                            className="country-search"
                            placeholder={t.searchCountry}
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                          />
                          <div className="country-list">
                            {filteredCountries.map((c, i) => (
                              <div
                                key={`${c.code}-${i}`}
                                className={`country-item ${c.code === selectedCountry.code ? 'active' : ''}`}
                                onClick={() => {
                                  setSelectedCountry(c);
                                  setIsCountryDropdownOpen(false);
                                }}
                              >
                                <span className="ci-flag">{c.flag}</span>
                                <span className="ci-name">{getCountryName(c)}</span>
                                <span className="ci-code">{c.code}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      className="form-input phone-number"
                      placeholder="5XX XXX XX XX"
                      value={brandPhone}
                      onChange={(e) => setBrandPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t.websiteLabel}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t.websitePlaceholder}
                    value={brandWebsite}
                    onChange={(e) => setBrandWebsite(e.target.value)}
                    required
                  />
                </div>
                <p className="form-hint" style={{ marginTop: '8px' }}>{t.brandHint}</p>
              </div>
            )}

            {/* Step 2: Hesap Bilgileri */}
            {step === 1 && (
              <div className="wizard-page active">
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {t.accountDesc}
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.firstNameLabel}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t.firstNamePlaceholder}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t.lastNameLabel}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t.lastNamePlaceholder}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t.emailLabel}</label>
                  <input
                    type="email"
                    className="form-input"
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
                      placeholder={t.passwordPlaceholder}
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
                  
                  {password.length > 0 && (
                    <div className="pw-strength">
                      <div className="pw-bar">
                        <div className={`pw-bar-fill ${pwStrength.className}`}></div>
                      </div>
                      <div className="pw-label">{pwStrength.label}</div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>{t.passwordConfirmLabel}</label>
                  <div className="pw-input-wrap">
                    <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      className="form-input"
                      placeholder={t.passwordConfirmPlaceholder}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      tabIndex="-1"
                    >
                      {showPasswordConfirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: 'normal', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={isKvkkChecked}
                      onChange={(e) => setIsKvkkChecked(e.target.checked)}
                      style={{ marginTop: '3px' }}
                      required
                    />
                    <span>
                      <a href="#" className="modal-link" onClick={handleKvkkClick}>{t.kvkkPrefix}</a>{t.kvkkMid}<a href="#" className="modal-link" onClick={handleKvkkClick}>{t.kvkkSuffix.split("'ni ve ").pop().split("'nı ve ").pop().replace("'ni okudum, kabul ediyorum. *", "").replace("'nı okudum, kabul ediyorum. *", "")}</a>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="form-error" style={{ display: 'block', marginTop: '12px' }}>
                {error}
              </div>
            )}

            {/* Wizard Actions */}
            <div className="wizard-actions">
              {step > 0 ? (
                <button type="button" className="btn btn-ghost" onClick={handleBack}>
                  {t.back}
                </button>
              ) : (
                <div />
              )}
              
              {step === 0 ? (
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  {t.continue}
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? t.registering : t.register}
                </button>
              )}
            </div>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
            {t.alreadyHaveAccount}{' '}
            <a
              className="modal-link"
              onClick={openLogin}
              style={{ cursor: 'pointer' }}
            >
              {t.login}
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

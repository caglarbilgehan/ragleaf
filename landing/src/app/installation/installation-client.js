"use client";

import React from 'react';
import { useLang } from '../../context/LangContext';
import { useUI } from '../../context/UIContext';
import PageLayout from '../../components/PageLayout';

export default function InstallationClient() {
  const { lang, t } = useLang();
  const { openSignup } = useUI();

  return (
    <PageLayout>
      {/* HERO */}
      <section className="relative w-full text-center pb-14 pt-8 px-4 max-w-4xl mx-auto overflow-hidden">
        <div className="hero-glow -top-[200px]"></div>
        <div className="relative z-1">
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 bg-accent/8 border border-accent/20 text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            {lang === 'tr' ? 'Adım Adım Rehber' : 'Step-by-Step Guide'}
          </span>
          <h1 className="font-['Outfit'] text-[56px] max-md:text-[32px] font-black tracking-tight mb-6 leading-tight">
            {lang === 'tr' ? (
              <>
                <span className="gradient-text">6 Kolay Adımda</span> AI Asistanınız Hazır
              </>
            ) : (
              <>
                Your AI Assistant is Ready in <span className="gradient-text">6 Easy Steps</span>
              </>
            )}
          </h1>
          <p className="text-lg max-md:text-base text-text-secondary leading-relaxed max-w-xl mx-auto">
            {lang === 'tr' 
              ? 'Kayıt olun, sektörünüzü seçin, dokümanlarınızı yükleyin — asistanınız dakikalar içinde çalışmaya başlasın. Kod bilmenize gerek yok.'
              : 'Sign up, choose your industry, upload your documents — your assistant starts working in minutes. No coding required.'}
          </p>
        </div>
      </section>

      {/* STEPS */}
      <div className="max-w-[1200px] mx-auto px-6 py-20 max-md:py-10 flex flex-col gap-24 max-md:gap-16 relative">
        {/* Vertical connector line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent max-md:hidden"></div>
        {/* STEP 1 */}
        <div className="flex max-md:flex-col items-center justify-between gap-16 max-md:gap-8">
          <div className="flex-1 max-w-[500px]">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-['Outfit'] text-4xl font-extrabold text-accent">01</span>
              <h2 className="font-['Outfit'] text-[28px] max-md:text-2xl font-bold text-text-primary m-0">
                {lang === 'tr' ? 'Hesap Oluşturun' : 'Create an Account'}
              </h2>
            </div>
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              {lang === 'tr'
                ? 'E-posta adresiniz ve şifrenizle saniyeler içinde ücretsiz hesabınızı oluşturun. Kredi kartı gerekmez. Ücretsiz plan ile hemen test etmeye başlayın.'
                : 'Create your free account in seconds with your email address and password. No credit card required. Start testing immediately with our free plan.'}
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Ücretsiz plan ile başlayın' : 'Start with the free plan'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Kredi kartı gerekmez' : 'No credit card required'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? '30 saniyede kayıt' : 'Sign up in 30 seconds'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'E-posta doğrulama ile güvenli giriş' : 'Secure login with email verification'}</span></li>
            </ul>
          </div>
          <div className="flex-1 flex justify-center max-w-[500px] w-full">
            <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-4 backdrop-blur-md w-full shadow-2xl">
              <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-6">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-text-muted font-medium ml-4 tracking-wider uppercase">
                  {lang === 'tr' ? 'ragleaf.com — Kayıt' : 'ragleaf.com — Sign Up'}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="text-center mb-5">
                  <span className="text-[32px]">🍃</span>
                  <div className="text-[18px] font-bold text-text-primary mt-1">
                    {lang === 'tr' ? "Ragleaf'e Katılın" : 'Join Ragleaf'}
                  </div>
                </div>
                <div className="mb-4 flex flex-col gap-1.5">
                  <span className="text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Ad Soyad' : 'Full Name'}</span>
                  <input className="bg-white/5 border border-border-custom p-3 rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent w-full" value="Mehmet Yılmaz" readOnly />
                </div>
                <div className="mb-4 flex flex-col gap-1.5">
                  <span className="text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'E-posta' : 'Email'}</span>
                  <input className="bg-white/5 border border-border-custom p-3 rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent w-full" value="mehmet@firmaadi.com" readOnly />
                </div>
                <div className="mb-4 flex flex-col gap-1.5">
                  <span className="text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Şifre' : 'Password'}</span>
                  <input className="bg-white/5 border border-border-custom p-3 rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent w-full" type="password" value="••••••••" readOnly />
                </div>
                <button className="bg-accent text-[#000] border-none font-bold py-3.5 px-6 rounded-xl text-sm cursor-pointer w-full text-center hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all mt-4" type="button" onClick={() => openSignup()}>
                  {lang === 'tr' ? 'Ücretsiz Hesap Oluştur →' : 'Create Free Account →'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        <div className="flex max-md:flex-col items-center justify-between gap-16 max-md:gap-8 flex-row-reverse">
          <div className="flex-1 max-w-[500px]">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-['Outfit'] text-4xl font-extrabold text-accent">02</span>
              <h2 className="font-['Outfit'] text-[28px] max-md:text-2xl font-bold text-text-primary m-0">
                {lang === 'tr' ? 'Sektörünüzü Seçin' : 'Choose Your Industry'}
              </h2>
            </div>
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              {lang === 'tr'
                ? 'Hazır sektörel şablonlardan birini seçerek asistanınızı saniyeler içinde oluşturun. Kuaför, diş hekimi, restoran, e-ticaret ve daha fazlası için optimize edilmiş şablonlar.'
                : 'Create your assistant in seconds by choosing one of the pre-built industry templates. Optimized templates for hair salons, dentists, restaurants, e-commerce, and more.'}
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Sektöre özel hazır şablonlar' : 'Industry-specific pre-built templates'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Randevu, rezervasyon, ödeme akışları dahil' : 'Includes appointment, booking, and payment flows'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Şablonu sonradan tamamen özelleştirin' : 'Fully customize the template later'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Sıfırdan boş asistan da oluşturabilirsiniz' : 'You can also start from scratch with a blank assistant'}</span></li>
            </ul>
          </div>
          <div className="flex-1 flex justify-center max-w-[500px] w-full">
            <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-4 backdrop-blur-md w-full shadow-2xl">
              <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-6">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-text-muted font-medium ml-4 tracking-wider uppercase">
                  {lang === 'tr' ? 'Asistan Oluşturucu — Şablon Seçimi' : 'Agent Builder — Select Template'}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-semibold text-text-primary mb-3.5">
                  {lang === 'tr' ? 'Sektörünüzü seçin' : 'Choose your industry'}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-white/[0.05] hover:border-accent"><span className="icon">✂️</span><span className="name text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Kuaför' : 'Hair Salon'}</span></div>
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-white/[0.05] hover:border-accent"><span className="icon">💅</span><span className="name text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Güzellik' : 'Beauty'}</span></div>
                  <div className="bg-white/[0.02] rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-white/[0.05] border-accent bg-white/[0.05] shadow-[0_0_15px_rgba(34,197,94,0.1)]"><span className="icon">🦷</span><span className="name text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Diş Hekimi' : 'Dentist'}</span></div>
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-white/[0.05] hover:border-accent"><span className="icon">🍽️</span><span className="name text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Restoran' : 'Restaurant'}</span></div>
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-white/[0.05] hover:border-accent"><span className="icon">🛒</span><span className="name text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'E-Ticaret' : 'E-Commerce'}</span></div>
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-white/[0.05] hover:border-accent"><span className="icon">🏨</span><span className="name text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Otel' : 'Hotel'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="flex max-md:flex-col items-center justify-between gap-16 max-md:gap-8">
          <div className="flex-1 max-w-[500px]">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-['Outfit'] text-4xl font-extrabold text-accent">03</span>
              <h2 className="font-['Outfit'] text-[28px] max-md:text-2xl font-bold text-text-primary m-0">
                {lang === 'tr' ? 'Dokümanlarınızı Yükleyin' : 'Upload Your Documents'}
              </h2>
            </div>
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              {lang === 'tr'
                ? 'Fiyat listenizi, hizmet menünüzü, ürün kataloğunuzu, sık sorulan sorularınızı yükleyin. RAG teknolojisi ile asistanınız bu bilgileri öğrenir ve müşterilerinize doğru yanıtlar verir.'
                : 'Upload your price list, service menu, product catalog, or FAQs. Using RAG technology, your assistant learns this information and provides accurate responses to your customers.'}
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'PDF, DOCX, TXT, Markdown, HTML destekli' : 'PDF, DOCX, TXT, Markdown, HTML supported'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Görselli dokümanlar için OCR desteği' : 'OCR support for scanned document files'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Otomatik chunk\'lama ve vektörleme' : 'Automatic chunking and vectorization'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Sürükle-bırak ile kolay yükleme' : 'Easy upload with drag & drop'}</span></li>
            </ul>
          </div>
          <div className="flex-1 flex justify-center max-w-[500px] w-full">
            <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-4 backdrop-blur-md w-full shadow-2xl">
              <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-6">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-text-muted font-medium ml-4 tracking-wider uppercase">
                  {lang === 'tr' ? 'Doküman Yönetimi — Yükleme' : 'Document Management — Upload'}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="border-2 border-dashed border-border-custom rounded-xl p-6 text-center mb-4 flex flex-col items-center gap-2">
                  <div className="text-3xl">📁</div>
                  <div className="text-xs text-text-secondary font-medium">
                    {lang === 'tr' ? 'Dosyalarınızı sürükleyip bırakın' : 'Drag and drop your files here'}
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-center mt-2">
                    <span className="bg-white/5 text-text-muted text-[9px] font-bold px-2 py-0.5 rounded">PDF</span>
                    <span className="bg-white/5 text-text-muted text-[9px] font-bold px-2 py-0.5 rounded">DOCX</span>
                    <span className="bg-white/5 text-text-muted text-[9px] font-bold px-2 py-0.5 rounded">TXT</span>
                    <span className="bg-white/5 text-text-muted text-[9px] font-bold px-2 py-0.5 rounded">MD</span>
                    <span className="bg-white/5 text-text-muted text-[9px] font-bold px-2 py-0.5 rounded">HTML</span>
                    <span className="bg-white/5 text-text-muted text-[9px] font-bold px-2 py-0.5 rounded">PNG/JPG</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-white/[0.02] border border-border-custom p-3 rounded-xl text-xs">
                    <span className="text-lg">📄</span>
                    <span className="text-text-primary font-medium flex-1 ml-2">{lang === 'tr' ? 'fiyat-listesi-2026.pdf' : 'price-list-2026.pdf'}</span>
                    <span className="text-accent font-bold">{lang === 'tr' ? '✓ İşlendi' : '✓ Processed'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/[0.02] border border-border-custom p-3 rounded-xl text-xs">
                    <span className="text-lg">📋</span>
                    <span className="text-text-primary font-medium flex-1 ml-2">{lang === 'tr' ? 'hizmet-menusu.docx' : 'service-menu.docx'}</span>
                    <span className="text-accent font-bold">{lang === 'tr' ? '✓ İşlendi' : '✓ Processed'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 4 */}
        <div className="flex max-md:flex-col items-center justify-between gap-16 max-md:gap-8 flex-row-reverse">
          <div className="flex-1 max-w-[500px]">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-['Outfit'] text-4xl font-extrabold text-accent">04</span>
              <h2 className="font-['Outfit'] text-[28px] max-md:text-2xl font-bold text-text-primary m-0">
                {lang === 'tr' ? 'Asistanınızı Özelleştirin' : 'Customize Your Assistant'}
              </h2>
            </div>
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              {lang === 'tr'
                ? 'Asistanınızın kimliğini, davranışlarını ve konuşma stilini belirleyin. Sistem istemini düzenleyerek, hangi konularda yanıt vereceğini ve nasıl bir üslup kullanacağını tanımlayın.'
                : 'Define your assistant\'s identity, behaviors, and tone of voice. Edit the system prompt to specify what it should answer and what tone it should use.'}
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Özel sistem istemi (prompt) tanımlayın' : 'Define custom system prompt'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Asistan adı, karakter ve avatar ayarlayın' : 'Set assistant name, persona, and avatar'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Randevu, ödeme, rezervasyon özelliklerini aktifleştirin' : 'Activate booking, payment, and reservation features'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Çoklu dil desteği etkinleştirin' : 'Enable multi-language support'}</span></li>
            </ul>
          </div>
          <div className="flex-1 flex justify-center max-w-[500px] w-full">
            <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-4 backdrop-blur-md w-full shadow-2xl">
              <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-6">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-text-muted font-medium ml-4 tracking-wider uppercase">
                  {lang === 'tr' ? 'Asistan Ayarları — Yapılandırma' : 'Assistant Settings — Configuration'}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex flex-col gap-1.5">
                  <span className="text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Sistem İstemi (Prompt)' : 'System Prompt'}</span>
                  <textarea 
                    className="bg-white/5 border border-border-custom p-3 rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent w-full resize-none h-24" 
                    value={lang === 'tr' 
                      ? 'Sen bir diş kliniği asistanısın. Hastaları nazik ve profesyonel bir şekilde karşıla, randevu oluştur ve tedavi hizmetleri hakkında bilgi ver.'
                      : 'You are a dental clinic assistant. Greet patients politely, book appointments, and give information about dental services.'} 
                    readOnly 
                  />
                </div>
                <div className="mb-4 flex flex-col gap-1.5">
                  <span className="text-xs text-text-secondary font-semibold">{lang === 'tr' ? 'Asistan Adı' : 'Assistant Name'}</span>
                  <input className="bg-white/5 border border-border-custom p-3 rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent w-full" value={lang === 'tr' ? 'Dr. Smile Asistanı 🦷' : 'Dr. Smile Assistant 🦷'} readOnly />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                    <span className="text-sm text-text-secondary">{lang === 'tr' ? '📅 Randevu sistemi' : '📅 Appointment system'}</span>
                    <div className="w-9 h-5 bg-accent rounded-full relative after:absolute after:w-3.5 after:h-3.5 after:bg-[#000] after:rounded-full after:top-[3px] after:right-[3px] after:transition-all"></div>
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                    <span className="text-sm text-text-secondary">{lang === 'tr' ? '💳 Ödeme entegrasyonu' : '💳 Payment integration'}</span>
                    <div className="w-9 h-5 bg-accent rounded-full relative after:absolute after:w-3.5 after:h-3.5 after:bg-[#000] after:rounded-full after:top-[3px] after:right-[3px] after:transition-all"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 5 */}
        <div className="flex max-md:flex-col items-center justify-between gap-16 max-md:gap-8">
          <div className="flex-1 max-w-[500px]">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-['Outfit'] text-4xl font-extrabold text-accent">05</span>
              <h2 className="font-['Outfit'] text-[28px] max-md:text-2xl font-bold text-text-primary m-0">
                {lang === 'tr' ? 'Web Sitenize Entegre Edin' : 'Integrate Into Your Website'}
              </h2>
            </div>
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              {lang === 'tr'
                ? 'Tek satır JavaScript kodu ile asistanınızı web sitenize ekleyin. WordPress, Shopify, Webflow, React, Vue — hangi platformda olursanız olun, entegrasyon dakikalar alır.'
                : 'Add your assistant to your website with a single line of JavaScript code. WordPress, Shopify, Webflow, React, Vue — whichever platform you use, integration takes minutes.'}
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Tek satır <script> tag\'ı ile kurulum' : 'Installation with a single line <script> tag'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Shadow DOM izolasyonu — sitenizi etkilemez' : 'Shadow DOM isolation — does not affect your site'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Tema ve renk özelleştirmesi' : 'Theme and color customization'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'WhatsApp, Telegram, Instagram entegrasyonu' : 'WhatsApp, Telegram, Instagram integrations'}</span></li>
            </ul>
          </div>
          <div className="flex-1 flex justify-center max-w-[500px] w-full">
            <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-4 backdrop-blur-md w-full shadow-2xl">
              <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-6">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-text-muted font-medium ml-4 tracking-wider uppercase">
                  {lang === 'tr' ? 'Widget Kodu — Entegrasyon' : 'Widget Code — Integration'}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="text-xs text-text-muted mb-2.5 font-medium">
                  {lang === 'tr' ? 'HTML sitenize ekleyin' : 'Add to your HTML site'}
                </div>
                <div className="bg-[#0a0a0f] border border-border-custom rounded-xl p-4 font-mono text-[11px] leading-relaxed text-text-secondary overflow-x-auto">
                  <div><span className="tag">&lt;script</span></div>
                  <div>&nbsp;&nbsp;<span className="attr">src</span>=<span className="str">"https://cdn.ragleaf.com/widget.js"</span></div>
                  <div>&nbsp;&nbsp;<span className="attr">data-agent-id</span>=<span className="str">"ag_dr_smile"</span></div>
                  <div>&nbsp;&nbsp;<span className="attr">data-api-key</span>=<span className="str">"rk_live_xxxxx"</span></div>
                  <div>&nbsp;&nbsp;<span className="attr">data-theme</span>=<span className="str">"dark"</span></div>
                  <div>&nbsp;&nbsp;<span className="attr">data-position</span>=<span className="str">"bottom-right"</span></div>
                  <div><span className="tag">&gt;&lt;/script&gt;</span></div>
                </div>
                <div className="mt-3.5 flex gap-2 flex-wrap">
                  <span className="py-1 px-2.5 rounded-md bg-accent/8 border border-accent/20 text-[10px] text-accent font-semibold">WordPress</span>
                  <span className="py-1 px-2.5 rounded-md bg-accent/8 border border-accent/20 text-[10px] text-accent font-semibold">Shopify</span>
                  <span className="py-1 px-2.5 rounded-md bg-accent/8 border border-accent/20 text-[10px] text-accent font-semibold">React/Vue</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 6 */}
        <div className="flex max-md:flex-col items-center justify-between gap-16 max-md:gap-8 flex-row-reverse">
          <div className="flex-1 max-w-[500px]">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-['Outfit'] text-4xl font-extrabold text-accent">06</span>
              <h2 className="font-['Outfit'] text-[28px] max-md:text-2xl font-bold text-text-primary m-0">
                {lang === 'tr' ? 'İzleyin ve Geliştirin' : 'Monitor and Improve'}
              </h2>
            </div>
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              {lang === 'tr'
                ? 'Yönetim panelinden tüm konuşmaları gerçek zamanlı izleyin. Analitik verilerle asistanınızın performansını ölçün, müşteri memnuniyetini artırın ve sürekli geliştirin.'
                : 'Monitor all conversations in real-time from the dashboard. Measure your assistant\'s performance with analytics, increase customer satisfaction, and iterate.'}
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Gerçek zamanlı konuşma izleme' : 'Real-time conversation monitoring'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Detaylı analitik dashboard' : 'Detailed analytics dashboard'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Token kullanımı ve maliyet takibi' : 'Token usage and cost tracking'}</span></li>
              <li className="flex items-center gap-3 text-sm text-text-secondary"><span className="text-accent font-bold">✓</span><span>{lang === 'tr' ? 'Müşteri memnuniyet metrikleri' : 'Customer satisfaction metrics'}</span></li>
            </ul>
          </div>
          <div className="flex-1 flex justify-center max-w-[500px] w-full">
            <div className="bg-[#0d0d15]/40 border border-white/5 rounded-3xl p-8 max-md:p-4 backdrop-blur-md w-full shadow-2xl">
              <div className="flex items-center gap-1.5 pb-4 border-b border-white/5 mb-6">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-text-muted font-medium ml-4 tracking-wider uppercase">
                  {lang === 'tr' ? 'Yönetim Paneli — Analitik' : 'Admin Panel — Analytics'}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4">
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">{lang === 'tr' ? 'Konuşmalar' : 'Conversations'}</div>
                    <div className="text-2xl font-bold text-text-primary">1,247</div>
                    <div className="text-[10px] text-accent font-bold mt-1">{lang === 'tr' ? '↑ %23 artış' : '↑ 23% increase'}</div>
                  </div>
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4">
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">{lang === 'tr' ? 'Randevular' : 'Appointments'}</div>
                    <div className="text-2xl font-bold text-text-primary">89</div>
                    <div className="text-[10px] text-accent font-bold mt-1">{lang === 'tr' ? '↑ %12 artış' : '↑ 12% increase'}</div>
                  </div>
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4">
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">{lang === 'tr' ? 'Memnuniyet' : 'Satisfaction'}</div>
                    <div className="text-2xl font-bold text-text-primary">%94</div>
                    <div className="text-[10px] text-accent font-bold mt-1">{lang === 'tr' ? '↑ %3 artış' : '↑ 3% increase'}</div>
                  </div>
                  <div className="bg-white/[0.02] border border-border-custom rounded-xl p-4">
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">{lang === 'tr' ? 'Çözüm Oranı' : 'Resolution Rate'}</div>
                    <div className="text-2xl font-bold text-text-primary">%87</div>
                    <div className="text-[10px] text-accent font-bold mt-1">{lang === 'tr' ? '↑ %5 artış' : '↑ 5% increase'}</div>
                  </div>
                </div>
                <div className="text-[10px] text-text-muted mb-1.5 uppercase tracking-wider">
                  {lang === 'tr' ? 'Haftalık Konuşma Trendi' : 'Weekly Conversation Trend'}
                </div>
                <div className="flex items-end justify-between h-20 gap-1 mt-3">
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '35%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '48%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '42%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '65%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '58%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '72%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '85%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '78%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '90%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '95%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '88%' }}></div>
                  <div className="w-full rounded-t bg-gradient-to-t from-accent to-accent/20 transition-all duration-300" style={{ height: '100%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <section className="relative text-center py-24 px-6 max-w-4xl mx-auto flex flex-col items-center gap-6 overflow-hidden">
        <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.04)_0%,transparent_70%)]"></div>
        <div className="relative z-1 flex flex-col items-center gap-6">
          <h2 className="font-['Outfit'] text-[40px] max-md:text-3xl font-black text-text-primary mb-0">
            {lang === 'tr' ? (
              <>
                Hemen <span className="gradient-text">Başlayın</span>
              </>
            ) : (
              <>
                Get Started <span className="gradient-text">Now</span>
              </>
            )}
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            {lang === 'tr' 
              ? 'İlk asistanınızı oluşturmak 5 dakikadan az sürer. Ücretsiz plan ile deneyin.'
              : 'Creating your first assistant takes less than 5 minutes. Try it with the free plan.'}
          </p>
          <button 
            onClick={() => openSignup()} 
            className="btn btn-primary py-3.5 px-10 text-base cursor-pointer"
          >
            {lang === 'tr' ? 'Ücretsiz Hesap Oluştur →' : 'Create Free Account →'}
          </button>
        </div>
      </section>
    </PageLayout>
  );
}

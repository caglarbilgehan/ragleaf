"use client";

import React, { useState } from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';
import { getApiBaseUrl } from '../../utils/api';

export default function ContactClient() {
  const { lang } = useLang();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' or 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const apiBase = getApiBaseUrl();

    try {
      const response = await fetch(`${apiBase}/v1/contact/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, subject, message })
      });

      if (!response.ok) {
        throw new Error('Form submission failed');
      }

      const data = await response.json();
      if (data.success) {
        setStatus('success');
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Submission error:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      {/* HERO */}
      <div className="relative text-center px-5 pb-16 pt-8 max-w-[800px] mx-auto overflow-hidden">
        <div className="hero-glow" style={{ top: '-200px' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            {lang === 'tr' ? 'İletişim' : 'Contact'}
          </span>
          <h1 className="font-['Outfit'] text-[56px] max-md:text-[38px] font-black tracking-tight mb-6 leading-tight">
            {lang === 'tr' ? (
              <>Bizimle <span className="gradient-text">İletişime Geçin</span></>
            ) : (
              <>Get In <span className="gradient-text">Touch</span></>
            )}
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed max-w-xl mx-auto">
            {lang === 'tr'
              ? 'Sorularınız, iş birliği teklifleriniz veya destek talepleriniz için aşağıdaki formu doldurarak bize ulaşabilirsiniz. Ekibimiz en kısa sürede size dönüş yapacaktır.'
              : 'Have questions, partnerships, or support requests? Fill out the form below to get in touch with us. Our team will get back to you as soon as possible.'}
          </p>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-6 pb-24">
        <div className="bg-white/[0.01] border border-border-custom rounded-3xl p-12 max-md:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-1 before:bg-gradient-to-r before:from-emerald-500 before:via-green-500 before:to-cyan-500">
          {/* Success Alert */}
          {status === 'success' && (
            <div className="p-4 rounded-xl text-[15px] font-medium mb-6 animate-fade-in bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              {lang === 'tr' 
                ? '✓ Mesajınız başarıyla iletildi! En kısa sürede yanıtlayacağız.' 
                : "✓ Your message has been sent successfully! We'll reply soon."}
            </div>
          )}

          {/* Error Alert */}
          {status === 'error' && (
            <div className="p-4 rounded-xl text-[15px] font-medium mb-6 animate-fade-in bg-red-500/10 border border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              {lang === 'tr' 
                ? '✗ Mesaj gönderilirken hata oluştu. Lütfen tekrar deneyin.' 
                : '✗ Failed to send message. Please try again.'}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Name */}
            <div className="mb-6">
              <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-2">
                {lang === 'tr' ? 'Adınız Soyadınız *' : 'Full Name *'}
              </label>
              <input 
                type="text" 
                id="name" 
                className="w-full bg-slate-900/60 border border-border-custom rounded-xl p-3.5 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:bg-slate-900/80 focus:shadow-[0_0_12px_rgba(34,197,94,0.25)] transition-all box-border" 
                required 
                placeholder="Jane Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                {lang === 'tr' ? 'E-Posta Adresiniz *' : 'Email Address *'}
              </label>
              <input 
                type="email" 
                id="email" 
                className="w-full bg-slate-900/60 border border-border-custom rounded-xl p-3.5 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:bg-slate-900/80 focus:shadow-[0_0_12px_rgba(34,197,94,0.25)] transition-all box-border" 
                required 
                placeholder="jane@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Subject */}
            <div className="mb-6">
              <label htmlFor="subject" className="block text-sm font-medium text-text-primary mb-2">
                {lang === 'tr' ? 'Konu' : 'Subject'}
              </label>
              <input 
                type="text" 
                id="subject" 
                className="w-full bg-slate-900/60 border border-border-custom rounded-xl p-3.5 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:bg-slate-900/80 focus:shadow-[0_0_12px_rgba(34,197,94,0.25)] transition-all box-border" 
                placeholder={lang === 'tr' ? 'Destek, İş birliği vb.' : 'Support, Partnership, etc.'} 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Message */}
            <div className="mb-6">
              <label htmlFor="message" className="block text-sm font-medium text-text-primary mb-2">
                {lang === 'tr' ? 'Mesajınız *' : 'Message *'}
              </label>
              <textarea 
                id="message" 
                className="w-full bg-slate-900/60 border border-border-custom rounded-xl p-3.5 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:bg-slate-900/80 focus:shadow-[0_0_12px_rgba(34,197,94,0.25)] transition-all box-border resize-y min-h-[140px]" 
                required 
                placeholder={lang === 'tr' ? 'Mesajınızı buraya yazın...' : 'Write your message here...'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <button type="submit" className="w-full flex justify-center items-center gap-2.5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-base font-semibold border-none rounded-xl p-4 cursor-pointer transition-all duration-300 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] hover:from-emerald-400 hover:to-emerald-700 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" disabled={loading}>
              {loading ? (
                <div className="border-[3px] border-white/30 rounded-full border-t-[3px] border-t-white w-5 h-5 animate-spin"></div>
              ) : (
                <span>{lang === 'tr' ? 'Gönder' : 'Send Message'}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}

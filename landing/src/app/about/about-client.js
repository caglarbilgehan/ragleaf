"use client";

import React from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';

export default function AboutClient() {
  const { lang, t } = useLang();

  return (
    <PageLayout>
      <div className="text-center px-5 pb-10 pt-0 max-w-[800px] mx-auto">
        <h1 
          className="font-['Outfit'] text-5xl max-md:text-[32px] font-black tracking-tight mb-5 leading-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent"
          dangerouslySetInnerHTML={{ __html: t('about_h1') }} 
        />
        <p className="text-lg text-text-secondary leading-relaxed">{t('about_p')}</p>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 pb-20 max-md:pb-10">
        <section className="bg-white/[0.01] border border-border-custom rounded-[20px] p-10 mb-20 max-md:p-6 max-md:mb-10 backdrop-blur-md shadow-2xl">
          <h2 className="font-['Outfit'] text-[28px] font-bold text-text-primary mt-0 mb-4">{t('about_intro_title')}</h2>
          <p className="text-base text-text-secondary leading-relaxed m-0">{t('about_intro_desc')}</p>
        </section>

        <section className="mb-16">
          <div className="text-center mb-16">
            <h2 className="font-['Outfit'] text-4xl font-extrabold text-text-primary mb-3">{t('about_milestones_title')}</h2>
            <p className="text-base text-text-muted">{t('about_milestones_desc')}</p>
          </div>

          <div className="relative max-w-[1000px] mx-auto py-10 after:absolute after:w-[2px] after:bg-gradient-to-b after:from-accent after:via-green-500/20 after:to-transparent after:top-0 after:bottom-0 after:left-1/2 after:-ml-[1px] max-md:after:left-[31px]">
            {/* Milestone 1 */}
            <div className="relative w-1/2 p-5 px-10 box-border after:absolute after:w-4 after:h-4 after:bg-[#090d16] after:border-4 after:border-accent after:rounded-full after:z-10 after:shadow-[0_0_10px_rgba(34,197,94,0.15)] after:top-8 after:transition-all after:duration-300 hover:after:bg-accent hover:after:scale-110 left-0 text-right after:-right-2 max-md:w-full max-md:pl-[70px] max-md:pr-5 max-md:text-left max-md:left-0 max-md:after:left-[23px] max-md:after:right-auto">
              <div className="bg-white/[0.02] border border-border-custom p-7 rounded-2xl relative transition-all duration-300 shadow-lg hover:-translate-y-1 hover:bg-white/[0.04] hover:border-green-500/25 hover:shadow-2xl text-right max-md:text-left">
                <span className="font-['Outfit'] text-sm font-bold text-accent uppercase tracking-wider mb-2 inline-block">{t('m1_date')}</span>
                <h3 className="font-['Outfit'] text-xl font-bold text-text-primary mt-0 mb-0">{t('m1_title')}</h3>
              </div>
            </div>

            {/* Milestone 2 */}
            <div className="relative w-1/2 p-5 px-10 box-border after:absolute after:w-4 after:h-4 after:bg-[#090d16] after:border-4 after:border-accent after:rounded-full after:z-10 after:shadow-[0_0_10px_rgba(34,197,94,0.15)] after:top-8 after:transition-all after:duration-300 hover:after:bg-accent hover:after:scale-110 left-1/2 text-left after:-left-2 max-md:w-full max-md:pl-[70px] max-md:pr-5 max-md:text-left max-md:left-0 max-md:after:left-[23px] max-md:after:right-auto">
              <div className="bg-white/[0.02] border border-border-custom p-7 rounded-2xl relative transition-all duration-300 shadow-lg hover:-translate-y-1 hover:bg-white/[0.04] hover:border-green-500/25 hover:shadow-2xl text-left" style={{ borderColor: 'rgba(255, 153, 0, 0.25)', background: 'rgba(255, 153, 0, 0.01)' }}>
                <span className="font-['Outfit'] text-sm font-bold uppercase tracking-wider mb-2 inline-block" style={{ color: '#ff9900' }}>{t('m2_date')}</span>
                <h3 className="font-['Outfit'] text-xl font-bold text-text-primary mt-0 mb-0">{t('m2_title')}</h3>
              </div>
            </div>

            {/* Milestone 3 */}
            <div className="relative w-1/2 p-5 px-10 box-border after:absolute after:w-4 after:h-4 after:bg-[#090d16] after:border-4 after:border-accent after:rounded-full after:z-10 after:shadow-[0_0_10px_rgba(34,197,94,0.15)] after:top-8 after:transition-all after:duration-300 hover:after:bg-accent hover:after:scale-110 left-0 text-right after:-right-2 max-md:w-full max-md:pl-[70px] max-md:pr-5 max-md:text-left max-md:left-0 max-md:after:left-[23px] max-md:after:right-auto">
              <div className="bg-white/[0.02] border border-border-custom p-7 rounded-2xl relative transition-all duration-300 shadow-lg hover:-translate-y-1 hover:bg-white/[0.04] hover:border-green-500/25 hover:shadow-2xl text-right max-md:text-left">
                <span className="font-['Outfit'] text-sm font-bold text-accent uppercase tracking-wider mb-2 inline-block">{t('m3_date')}</span>
                <h3 className="font-['Outfit'] text-xl font-bold text-text-primary mt-0 mb-0">{t('m3_title')}</h3>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

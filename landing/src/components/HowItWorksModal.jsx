"use client";

import React, { useEffect } from 'react';
import { useUI } from '../context/UIContext';
import dynamic from 'next/dynamic';

const SectorSimulator = dynamic(() => import('./SectorSimulator'), {
  ssr: false,
});

export default function HowItWorksModal() {
  const { isHowItWorksOpen, setHowItWorksOpen } = useUI();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setHowItWorksOpen(false);
      }
    };
    if (isHowItWorksOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.classList.add('how-it-works-open');
      document.documentElement.classList.add('how-it-works-open');
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('how-it-works-open');
      document.documentElement.classList.remove('how-it-works-open');
    };
  }, [isHowItWorksOpen, setHowItWorksOpen]);

  if (!isHowItWorksOpen) return null;

  return (
    <div id="howItWorksModal" className="how-it-works-modal open">
      <div className="modal-backdrop" onClick={() => setHowItWorksOpen(false)}></div>
      <div className="modal-content-wrapper">
        <button className="modal-close-btn" onClick={() => setHowItWorksOpen(false)}>✕</button>
        <div className="modal-body-container" id="howItWorksModalBody">
          <SectorSimulator />
        </div>
      </div>
    </div>
  );
}

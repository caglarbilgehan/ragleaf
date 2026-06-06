"use client";

import React, { createContext, useContext, useState } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [isHowItWorksOpen, setHowItWorksOpen] = useState(false);
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [isSignupOpen, setSignupOpen] = useState(false);
  const [signupPlan, setSignupPlan] = useState('starter');

  const openLogin = () => {
    setSignupOpen(false);
    setLoginOpen(true);
  };

  const openSignup = (plan = 'starter') => {
    setLoginOpen(false);
    setSignupPlan(plan);
    setSignupOpen(true);
  };

  const closeAll = () => {
    setHowItWorksOpen(false);
    setLoginOpen(false);
    setSignupOpen(false);
  };

  return (
    <UIContext.Provider value={{
      isHowItWorksOpen,
      setHowItWorksOpen,
      isLoginOpen,
      setLoginOpen,
      isSignupOpen,
      setSignupOpen,
      signupPlan,
      setSignupPlan,
      openLogin,
      openSignup,
      closeAll
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

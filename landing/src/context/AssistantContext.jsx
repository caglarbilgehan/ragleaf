"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLang } from './LangContext';

const AssistantContext = createContext(null);

const RAGLEAF_API_BASE = 'http://localhost:1306'; // Falls back to localhost in local dev, in prod we could use dynamic url, but we'll preserve the original logic.

export function AssistantProvider({ children }) {
  const { lang } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [agentName, setAgentName] = useState('Ragleaf Asistanı');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Fetch Agent Info on mount or when language changes
  useEffect(() => {
    async function loadAgentInfo() {
      try {
        const apiBase = window.location.hostname.includes('ragleaf.com') 
          ? 'https://api.ragleaf.com' 
          : 'http://localhost:1306';

        const res = await fetch(`${apiBase}/v1/agents/ag_ragleaf_system01/info?lang=${lang}`, {
          headers: {
            'Authorization': 'Bearer ak_0001bf4f0faa39f6fb0c7429cbc8b301bdf23fdd8874fc90',
            'X-Language': lang
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.name) {
            setAgentName(data.name);
            setWelcomeMessage(data.welcome_message);
            
            // Set first message if chat history is empty
            setMessages((prev) => {
              if (prev.length === 0) {
                return [{ role: 'bot', content: data.welcome_message }];
              }
              // If welcome message is the only message, update it to the new language's welcome message
              if (prev.length === 1 && prev[0].role === 'bot') {
                return [{ role: 'bot', content: data.welcome_message }];
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error('Error fetching agent info:', err);
        // Fallback welcome message
        const fallback = lang === 'tr'
          ? 'Merhaba! 👋 Ben Ragleaf Asistanı. Platform kullanımı, agent oluşturma, entegrasyonlar ve teknik destek konularında size yardımcı olabilirim. Nasıl yardımcı olabilirim?'
          : 'Hello! 👋 I am Ragleaf Assistant. I can help you with platform usage, agent creation, integrations, and technical support. How can I help you?';
        setWelcomeMessage(fallback);
        setMessages((prev) => {
          if (prev.length === 0 || (prev.length === 1 && prev[0].role === 'bot')) {
            return [{ role: 'bot', content: fallback }];
          }
          return prev;
        });
      }
    }
    loadAgentInfo();
  }, [lang]);

  const toggleAssistant = (open) => {
    setIsOpen(open);
  };

  const clearChat = () => {
    setMessages([{ role: 'bot', content: welcomeMessage }]);
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    // Add user message
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const apiBase = window.location.hostname.includes('ragleaf.com') 
        ? 'https://api.ragleaf.com' 
        : 'http://localhost:1306';

      // We slice last 10 messages in chronological order
      const history = [...messages, userMsg];
      const payload = {
        messages: history.slice(-10).map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.content })),
        session_id: 'landing_session_ragleaf',
        metadata: { lang }
      };

      const res = await fetch(`${apiBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ak_0001bf4f0faa39f6fb0c7429cbc8b301bdf23fdd8874fc90',
          'X-Language': lang
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Yanıt alınamadı.';

      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'bot', content: reply }]);
    } catch (err) {
      console.error('Error calling Ragleaf assistant:', err);
      setIsTyping(false);
      const errMsg = lang === 'tr'
        ? 'Bağlantı hatası. Lütfen backend servislerinin çalıştığından emin olun.'
        : 'Connection error. Please ensure backend services are running.';
      setMessages(prev => [...prev, { role: 'bot', content: errMsg }]);
    }
  };

  return (
    <AssistantContext.Provider value={{
      isOpen,
      toggleAssistant,
      messages,
      isTyping,
      agentName,
      sendMessage,
      clearChat
    }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}

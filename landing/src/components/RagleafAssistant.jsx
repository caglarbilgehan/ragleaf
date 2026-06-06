"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LangContext';
import { useAssistant } from '../context/AssistantContext';

// Original markdown formatter function
function formatMsgText(str) {
  if (!str) return '';
  let html = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) =>
    `<pre><code>${code.trim()}</code></pre>`);
    
  // Tables
  html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;
    const parseRow = (row) => row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
    const sep = rows[1];
    if (!/^\|?[\s-:|]+\|?$/.test(sep)) return tableBlock;
    const headerCells = parseRow(rows[0]);
    const thead = `<thead><tr>${headerCells.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
    const bodyRows = rows.slice(2).map(r => {
      const cells = parseRow(r);
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('');
    return `<table>${thead}<tbody>${bodyRows}</tbody></table>`;
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Unordered lists
  html = html.replace(/(^[\s]*[-*] .+$\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\s*[-*] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/(^[\s]*\d+\. .+$\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\s*\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs and newlines
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph if not starting with block element
  if (!html.match(/^<(h[1-3]|ul|ol|pre|table|blockquote|hr)/)) {
    html = `<p>${html}</p>`;
  }

  return html;
}

export default function RagleafAssistant({ insideSidebar = false }) {
  const { t } = useLang();
  const { isOpen, toggleAssistant, messages, isTyping, agentName, sendMessage } = useAssistant();
  const [inputValue, setInputValue] = useState('');
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const textareaRef = useRef(null);
  const chatHistoryRef = useRef(null);

  // Auto-scroll to the bottom of the chat history when messages or typing state changes
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const [isIndexPage, setIsIndexPage] = useState(true);

  // Sync Layout Position and page type based on window width and body class
  useEffect(() => {
    const checkLayout = () => {
      setIsDesktopLayout(window.innerWidth >= 1024);
      setIsIndexPage(document.body.classList.contains('index-page'));
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);

    // Watch for class changes on body to know when routing happens
    const observer = new MutationObserver(checkLayout);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('resize', checkLayout);
      observer.disconnect();
    };
  }, []);

  // Handle Input Auto Resize
  const handleInput = (e) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Close when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isDesktopLayout) return;
      const assistantEl = document.getElementById('ragleafBottomAssistant');
      const isTrigger = e.target.closest('.mobile-footer-assistant-btn') || e.target.closest('.mobile-assistant-trigger');
      if (assistantEl && !assistantEl.contains(e.target) && !isTrigger) {
        toggleAssistant(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDesktopLayout, toggleAssistant]);

  // Hide non-sidebar instance on desktop globally (since sidebar is shown on all pages)
  if (isDesktopLayout && !insideSidebar) return null;
  if (!isDesktopLayout && insideSidebar) return null;

  // HTML content of the Chat Assistant
  const content = (
    <div className="ragleaf-assistant-chat-container">
      <div className="ragleaf-assistant-header">
        <div className="assistant-header-profile">
          <span className="assistant-avatar">🍃</span>
          <div>
            <h4 className="assistant-name" id="ragleafName">{agentName}</h4>
            <span className="assistant-status">{t('status_online')}</span>
          </div>
        </div>
        {(!isDesktopLayout || !insideSidebar) && (
          <button className="assistant-close-x-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }} onClick={() => toggleAssistant(false)}>✕</button>
        )}
      </div>
      <div className="embedded-chat-history" id="ragleafChatBody" ref={chatHistoryRef}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`sim-chat-msg ${msg.role}`}
            dangerouslySetInnerHTML={{ __html: formatMsgText(msg.content) }}
          />
        ))}
        {isTyping && (
          <div className="sim-chat-msg bot typing" id="ragleafTypingIndicator">
            <span className="pulse-dot"></span>
            <span className="pulse-dot" style={{ animationDelay: '0.2s' }}></span>
            <span className="pulse-dot" style={{ animationDelay: '0.4s' }}></span>
          </div>
        )}
      </div>
      <div className="assistant-top-bar">
        <div className="embedded-chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="embedded-chat-input ragleaf-chat-input"
            placeholder={t('prompt_placeholder')}
            rows="3"
            style={{ resize: 'none', overflowY: 'auto' }}
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
          <button className="embedded-chat-send-btn" onClick={handleSend}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="send-icon-svg">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  if (isDesktopLayout) {
    if (insideSidebar) {
      return (
        <div className="ragleaf-header-assistant open" id="ragleafBottomAssistant">
          {content}
        </div>
      );
    }

    // Floating Bubble / Widget on Desktop for subpages
    return (
      <>
        {!isOpen && (
          <button 
            className="desktop-assistant-trigger"
            onClick={() => toggleAssistant(true)}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--green-500), var(--green-600))',
              border: 'none',
              boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              zIndex: 1000,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            🍃
          </button>
        )}
        
        {isOpen && (
          <div 
            className="ragleaf-header-assistant open" 
            id="ragleafBottomAssistant"
            style={{
              position: 'fixed',
              bottom: '96px',
              right: '24px',
              top: 'auto',
              left: 'auto',
              transform: 'none',
              display: 'flex',
              flexDirection: 'column',
              width: '400px',
              height: '600px',
              maxHeight: 'calc(100vh - 120px)',
              zIndex: 1000,
              background: 'rgba(9, 13, 22, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(34, 197, 94, 0.15)',
              overflow: 'hidden'
            }}
          >
            {content}
          </div>
        )}
      </>
    );
  }

  // Mobile Floating Layout
  return (
    <>
      <div 
        className={`ragleaf-assistant-backdrop ${isOpen ? 'open' : ''}`} 
        onClick={() => toggleAssistant(false)}
      />
      <div 
        className={`ragleaf-header-assistant ${isOpen ? 'open' : ''}`} 
        id="ragleafBottomAssistant"
      >
        {content}
      </div>
    </>
  );
}

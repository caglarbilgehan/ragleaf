// Ragleaf Widget — Embeddable AI Chat
// Shadow DOM based, zero-dependency, single file

interface WidgetConfig {
  agentId: string;
  apiKey: string;
  apiUrl: string;
  primaryColor: string;
  secondaryColor?: string;
  position: 'bottom-right' | 'bottom-left';
  welcomeMessage: string;
  title: string;
  placeholder: string;
  autoOpen: boolean;
  autoOpenDesktop?: boolean;
  autoOpenMobile?: boolean;
  autoOpenDelay: number;
  layoutMode: 'floating' | 'split' | 'fullscreen';
  widgetId?: string;
  themeStyle?: 'classic' | 'modern';
  containerId?: string;
  autoTheme?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  showBranding?: boolean;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  inputBgColor?: string;
  inputTextColor?: string;
  bgColorDark?: string;
  textColorDark?: string;
  borderColorDark?: string;
  inputBgColorDark?: string;
  inputTextColorDark?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
  bubbleIcon?: string;
  customIconSvg?: string;
  orgId?: string;
  language?: string;
  bottomOffset?: number;
  rightOffset?: number;
  leftOffset?: number;
  mobileBottomOffset?: number;
  mobileRightOffset?: number;
  mobileLeftOffset?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp: number;
  showForm?: boolean;
}

const DEFAULT_CONFIG: Partial<WidgetConfig> = {
  primaryColor: '#4F46E5',
  secondaryColor: '#8b5cf6',
  position: 'bottom-right',
  welcomeMessage: 'Merhaba! Size nasıl yardımcı olabilirim?',
  title: 'AI Asistan',
  placeholder: 'Mesajınızı yazın...',
  autoOpen: true,
  autoOpenDesktop: true,
  autoOpenMobile: true,
  autoOpenDelay: 1500,
  layoutMode: 'floating',
  themeStyle: 'classic',
};

const CSS = `
:host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

.ragleaf-bubble {
  position: fixed; bottom: var(--bubble-bottom, 70px); width: 60px; height: 60px;
  border-radius: 50%; cursor: pointer; z-index: 99998;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 24px rgba(0,0,0,0.25); transition: transform 0.3s, box-shadow 0.3s;
  color: white !important;
}
.ragleaf-bubble:hover { transform: scale(1.1); box-shadow: 0 6px 32px rgba(0,0,0,0.3); }
.ragleaf-bubble.right { right: var(--bubble-right, 24px); }
.ragleaf-bubble.left { left: var(--bubble-left, 24px); }
.ragleaf-bubble svg { width: 28px; height: 28px; fill: currentColor !important; color: white !important; }

.ragleaf-window {
  position: fixed; bottom: var(--window-bottom, 146px); width: 380px; max-width: calc(100vw - 32px);
  height: 520px; max-height: calc(100vh - 120px);
  border-radius: 16px; overflow: hidden; z-index: 99999;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 48px rgba(0,0,0,0.2); opacity: 0; transform: translateY(20px) scale(0.95);
  transition: opacity 0.3s, transform 0.3s; pointer-events: none;
  background: var(--bg) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
}
.ragleaf-window.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
.ragleaf-window.right { right: var(--bubble-right, 24px); }
.ragleaf-window.left { left: var(--bubble-left, 24px); }

.ragleaf-header {
  padding: 16px 20px; color: white; display: flex; align-items: center;
  justify-content: space-between; flex-shrink: 0;
}
.ragleaf-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
.ragleaf-close { background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 4px; line-height: 1; }

.ragleaf-messages {
  flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
  background: var(--bg) !important;
}
.ragleaf-messages::-webkit-scrollbar { width: 4px; }
.ragleaf-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

.ragleaf-msg {
  max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 14px;
  line-height: 1.5; word-wrap: break-word; animation: fadeIn 0.3s;
}
.ragleaf-msg.user {
  align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 4px;
}
.ragleaf-msg.assistant {
  align-self: flex-start; background: var(--assistant-bg) !important; color: var(--text) !important;
  border: 1px solid var(--border) !important; border-bottom-left-radius: 4px;
}
/* Markdown styles */
.ragleaf-msg strong { font-weight: 600; }
.ragleaf-msg em { font-style: italic; }
.ragleaf-msg code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-size: 13px; font-family: monospace; }
.ragleaf-msg pre { background: #1f2937; color: #e5e7eb; padding: 10px 12px; border-radius: 8px; overflow-x: auto; margin: 6px 0; font-size: 12px; }
.ragleaf-msg pre code { background: none; padding: 0; color: inherit; }
.ragleaf-msg ul, .ragleaf-msg ol { margin: 4px 0; padding-left: 20px; }
.ragleaf-msg li { margin: 2px 0; }
.ragleaf-msg h1,.ragleaf-msg h2,.ragleaf-msg h3 { font-weight: 600; margin: 8px 0 4px; }
.ragleaf-msg h1 { font-size: 16px; } .ragleaf-msg h2 { font-size: 15px; } .ragleaf-msg h3 { font-size: 14px; }
.ragleaf-msg table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; color: inherit; }
.ragleaf-msg th, .ragleaf-msg td { border: 1px solid var(--border) !important; padding: 6px 10px; text-align: left; }
.ragleaf-msg th { background: var(--assistant-bg) !important; font-weight: 600; }
.ragleaf-msg blockquote { border-left: 3px solid #d1d5db; margin: 4px 0; padding: 2px 10px; color: #6b7280; }
.ragleaf-msg hr { border: none; border-top: 1px solid var(--border) !important; margin: 8px 0; }
.ragleaf-msg a { color: var(--primary); text-decoration: underline; }
.ragleaf-msg p { margin: 4px 0; }
.ragleaf-msg.typing { align-self: flex-start; background: var(--assistant-bg) !important; border: 1px solid var(--border) !important; color: var(--text) !important; }
.typing-dots { display: flex; gap: 4px; padding: 4px 0; }
.typing-dots span {
  width: 6px; height: 6px; border-radius: 50%; background: #9ca3af;
  animation: bounce 1.4s infinite both;
}
.typing-dots span:nth-child(2) { animation-delay: 0.16s; }
.typing-dots span:nth-child(3) { animation-delay: 0.32s; }

.ragleaf-input-area {
  padding: 12px 16px; background: var(--bg) !important; border-top: 1px solid var(--border) !important;
  display: flex; gap: 8px; align-items: center; flex-shrink: 0;
}
.ragleaf-input {
  flex: 1; border: 1px solid var(--border) !important; border-radius: 8px; padding: 10px 14px;
  font-size: 14px; outline: none; resize: none; max-height: 80px;
  font-family: inherit; line-height: 1.4;
  background: var(--input-bg) !important; color: var(--input-text) !important;
}
.ragleaf-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(79,70,229,0.15); }
.ragleaf-send {
  width: 38px; height: 38px; border-radius: 8px; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: white; flex-shrink: 0; transition: opacity 0.2s;
}
.ragleaf-send:disabled { opacity: 0.5; cursor: not-allowed; }
.ragleaf-send svg { width: 18px; height: 18px; fill: currentColor; }

.ragleaf-powered {
  padding: 6px; text-align: center; font-size: 11px; color: #9ca3af;
  background: var(--bg) !important; border-top: 1px solid var(--border) !important;
}
.ragleaf-powered a { color: #6b7280; text-decoration: none; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
@media (max-width: 768px) {
  .ragleaf-window { width: 100vw !important; max-width: 100vw !important; height: 100vh; max-height: 100vh; top: 0; bottom: 0; right: 0 !important; left: 0 !important; border-radius: 0 !important; border: none !important; }
  .ragleaf-bubble { 
    bottom: var(--bubble-mobile-bottom, 16px) !important; 
  }
  .ragleaf-bubble.right { 
    right: var(--bubble-mobile-right, 16px) !important; 
    left: auto !important;
  }
  .ragleaf-bubble.left { 
    left: var(--bubble-mobile-left, 16px) !important; 
    right: auto !important;
  }
}

/* Layout Variations */
.ragleaf-bubble.hidden {
  display: none !important;
}
.ragleaf-window.split {
  bottom: 0 !important;
  top: 0 !important;
  height: 100vh !important;
  max-height: 100vh !important;
  border-radius: 0 !important;
  box-shadow: -4px 0 24px rgba(0,0,0,0.1) !important;
  opacity: 1 !important;
  transform: none !important;
  pointer-events: all !important;
}
.ragleaf-window.split.right {
  right: 0 !important;
  left: auto !important;
  border-left: 1px solid #e5e7eb;
}
.ragleaf-window.split.left {
  left: 0 !important;
  right: auto !important;
  border-right: 1px solid #e5e7eb;
}
.ragleaf-window.split .ragleaf-close {
  display: none !important;
}

.ragleaf-window.fullscreen {
  bottom: 0 !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  max-height: 100vh !important;
  border-radius: 0 !important;
  opacity: 1 !important;
  transform: none !important;
  pointer-events: all !important;
}

/* Modern Glassmorphic Theme Style */
.ragleaf-window.style-modern {
  background-image: radial-gradient(at 0% 0%, color-mix(in srgb, var(--primary) 8%, transparent) 0px, transparent 50%),
                    radial-gradient(at 100% 100%, color-mix(in srgb, var(--secondary) 8%, transparent) 0px, transparent 50%),
                    linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.75)) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.25) !important;
}
.ragleaf-container.dark .ragleaf-window.style-modern {
  background-image: radial-gradient(at 0% 0%, color-mix(in srgb, var(--primary) 15%, transparent) 0px, transparent 50%),
                    radial-gradient(at 100% 100%, color-mix(in srgb, var(--secondary) 15%, transparent) 0px, transparent 50%),
                    linear-gradient(135deg, rgba(9, 13, 22, 0.85), rgba(17, 24, 39, 0.9)) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.05) !important;
}
.ragleaf-window.style-modern .ragleaf-messages {
  background: transparent !important;
}
.ragleaf-window.style-modern .ragleaf-input-area {
  background: transparent !important;
  border-top-color: rgba(255, 255, 255, 0.08) !important;
}
.ragleaf-window.style-modern .ragleaf-header {
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: var(--text) !important;
}
.ragleaf-window.style-modern .ragleaf-header h3 {
  color: var(--text) !important;
}
.ragleaf-window.style-modern .ragleaf-close {
  color: var(--text) !important;
}
.ragleaf-window.style-modern .ragleaf-msg.assistant {
  background: rgba(255, 255, 255, 0.4) !important;
  border: 1px solid rgba(0, 0, 0, 0.03) !important;
  backdrop-filter: blur(10px) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02) !important;
}
.ragleaf-container.dark .ragleaf-window.style-modern .ragleaf-msg.assistant {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px) !important;
}
.ragleaf-window.style-modern .ragleaf-msg.user {
  background: linear-gradient(135deg, var(--primary), var(--secondary)) !important;
  border: none !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 20%, transparent) !important;
}
.ragleaf-window.style-modern .ragleaf-msg {
  border-radius: 14px !important;
}
.ragleaf-window.style-modern::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  z-index: 10;
}


/* Avatar styles in modern mode */
.ragleaf-msg-wrapper {
  display: flex; gap: 8px; align-items: flex-start; max-width: 85%; align-self: flex-start; animation: fadeIn 0.3s;
}
.ragleaf-msg-wrapper .ragleaf-msg {
  max-width: 100%; margin: 0;
}
.ragleaf-avatar {
  width: 28px; height: 28px; border-radius: 50%; color: white; font-size: 11px; font-weight: bold;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
`;

const CHAT_ICON = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';
const SEND_ICON = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
const CLOSE_ICON = '✕';

const BUBBLE_ICONS: Record<string, string> = {
  chat: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
  support: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12c0 2.21.72 4.25 1.94 5.92L3 21l3.08-.94C7.75 21.28 9.79 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>',
  ai: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>',
  ragleaf: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 2c-3.6 0-6.6 2.2-8 5.4C7.6 4.2 4.6 2 1 2c0 0 4 4 4 8 0 4.4 3.6 8 8 8 4.4 0 8-3.6 8-8 0-4-4-8-4-8zm-4 14c-2.2 0-4-1.8-4-4 0-2.2 1.8-4 4-4s4 1.8 4 4c0 2.2-1.8 4-4 4z"/></svg>',
  robot: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 8h-1.18C17.37 5.62 14.9 4 12 4s-5.37 1.62-5.82 4H5c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h1.18c.45 2.38 2.92 4 5.82 4s5.37-1.62 5.82-4H19c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2zM8.5 13c-.83 0-1.5-.67-1.5-1.5S7.67 10 8.5 10s1.5.67 1.5 1.5S9.33 13 8.5 13zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
  brain: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.07 19.58 10.47 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>',
  smile: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.5-9c-.83 0-1.5-.67-1.5-1.5S7.67 8 8.5 8s1.5.67 1.5 1.5S9.33 11 8.5 11zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 8 15.5 8s1.5.67 1.5 1.5S16.33 11 15.5 11zm-7 3c.88 1.76 2.94 3 5 3s4.12-1.24 5-3H8.5z"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 17.93a8 8 0 0 1-6.93-7h6.93zm0-9H4.07a8 8 0 0 1 6.93-7zm2-7a8 8 0 0 1 6.93 7H13zm0 14.93v-6.93h6.93a8 8 0 0 1-6.93 7z"/></svg>'
};


class RagleafWidget {
  private config: WidgetConfig;
  private shadow: ShadowRoot;
  private messages: Message[] = [];
  private sessionId: string;
  private isOpen = false;
  private isLoading = false;
  private container!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private windowEl!: HTMLDivElement;
  private personality: any = {};

  constructor(config: Partial<WidgetConfig>) {
    // Auto-detect language if not explicitly configured
    const detectedLang = config.language ||
      ((document.documentElement.lang || navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en');

    const defaults = { ...DEFAULT_CONFIG };
    if (detectedLang === 'en') {
      defaults.welcomeMessage = 'Hello! How can I help you?';
      defaults.title = 'AI Assistant';
      defaults.placeholder = 'Type your message...';
    }

    this.config = { ...defaults, language: detectedLang, ...config } as WidgetConfig;
    this.sessionId = this.getSessionId();

    const host = document.createElement('div');
    host.id = 'ragleaf-widget-host';
    document.body.appendChild(host);
    this.shadow = host.attachShadow({ mode: 'closed' });

    this.render();
    this.fetchAgentInfo();

    // Listen for language changes on the document.documentElement
    if (typeof MutationObserver !== 'undefined' && typeof window !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'lang') {
            const newLang = document.documentElement.lang;
            if (newLang) {
              this.updateLanguage(newLang);
            }
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
  }

  private updateLanguage(lang: string) {
    const cleanLang = lang.toLowerCase().startsWith('tr') ? 'tr' : 'en';
    if (this.config.language === cleanLang) return;

    this.config.language = cleanLang;

    // Update defaults
    if (cleanLang === 'en') {
      this.config.welcomeMessage = 'Hello! How can I help you?';
      this.config.title = 'AI Assistant';
      this.config.placeholder = 'Type your message...';
    } else {
      this.config.welcomeMessage = 'Merhaba! Size nasıl yardımcı olabilirim?';
      this.config.title = 'Yapay Zeka Asistanı';
      this.config.placeholder = 'Mesajınızı yazın...';
    }

    // Update title in header
    const h3 = this.shadow.querySelector('.ragleaf-header h3');
    if (h3) h3.textContent = this.config.title;

    // Update placeholder in DOM
    const textarea = this.shadow.querySelector('.ragleaf-input') as HTMLTextAreaElement;
    if (textarea) {
      textarea.placeholder = this.config.placeholder;
    }

    // Update branding/powered link
    const powered = this.shadow.querySelector('.ragleaf-powered') as HTMLElement;
    if (powered) {
      const refSuffix = this.config.orgId ? `?ref=${this.config.orgId}` : '';
      powered.innerHTML = `${cleanLang === 'tr' ? '' : 'Powered by '}<a href="${this.config.apiUrl}/v1/ref/click${refSuffix}" target="_blank">${cleanLang === 'tr' ? 'Ragleaf AIChat' : 'Ragleaf'}</a>`;
    }

    // Reset messages and show new welcome message
    this.messages = [];
    if (this.config.welcomeMessage) {
      this.messages.push({ role: 'assistant', content: this.config.welcomeMessage, timestamp: Date.now() });
    }
    this.renderMessages();

    // Re-fetch agent info for the new language
    this.fetchAgentInfo();
  }

  private getSessionId(): string {
    const key = `ragleaf_session_${this.config.agentId}`;
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : this.generateUUIDFallback();
      sessionStorage.setItem(key, sid);
    }
    return sid;
  }

  private generateUUIDFallback(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private async fetchAgentInfo() {
    try {
      const url = new URL(`${this.config.apiUrl}/v1/agents/${this.config.agentId}/info`);
      if (this.config.widgetId) {
        url.searchParams.append('widget_id', this.config.widgetId);
      }
      if (this.config.language) {
        url.searchParams.append('lang', this.config.language);
      }
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
      });
      if (res.ok) {
        const info = await res.json();
        if (info.name) { this.config.title = info.name; this.updateHeader(); }
        if (info.welcome_message) this.config.welcomeMessage = info.welcome_message;
        if (info.appearance) {
          const app = info.appearance;
          if (app.primary_color) {
            this.config.primaryColor = app.primary_color;
          }
          if (app.secondary_color) {
            this.config.secondaryColor = app.secondary_color;
          }
          if (app.layout_mode) {
            this.config.layoutMode = app.layout_mode;
            this.applyLayoutMode();
          }
          if (app.show_branding !== undefined && app.show_branding !== null) {
            const showBranding = app.show_branding === true || app.show_branding === 'true';
            this.config.showBranding = showBranding;
            const powered = this.shadow.querySelector('.ragleaf-powered') as HTMLElement;
            if (powered) powered.style.display = showBranding ? 'block' : 'none';
          }
          if (app.org_id) {
            this.config.orgId = app.org_id;
            const poweredLink = this.shadow.querySelector('.ragleaf-powered a') as HTMLAnchorElement;
            if (poweredLink) poweredLink.href = `${this.config.apiUrl}/v1/ref/click?ref=${app.org_id}`;
          }
          if (info.personality) {
            this.personality = info.personality;
          }
          if (info.personality && info.personality.language) {
            this.config.language = info.personality.language;
            const powered = this.shadow.querySelector('.ragleaf-powered') as HTMLElement;
            if (powered) {
              const isTurkish = info.personality.language === 'tr' || (!info.personality.language && navigator.language.startsWith('tr'));
              const refSuffix = this.config.orgId ? `?ref=${this.config.orgId}` : '';
              powered.innerHTML = `${isTurkish ? '' : 'Powered by '}<a href="${this.config.apiUrl}/v1/ref/click${refSuffix}" target="_blank">${isTurkish ? 'Ragleaf AIChat' : 'Ragleaf'}</a>`;
            }
          }
          if (app.theme_style) {
            this.config.themeStyle = app.theme_style;
            this.windowEl.classList.toggle('style-modern', app.theme_style === 'modern');
          }
          if (app.bottom_offset !== undefined && app.bottom_offset !== null) {
            this.config.bottomOffset = Number(app.bottom_offset);
          }
          if (app.right_offset !== undefined && app.right_offset !== null) {
            this.config.rightOffset = Number(app.right_offset);
          }
          if (app.left_offset !== undefined && app.left_offset !== null) {
            this.config.leftOffset = Number(app.left_offset);
          }
          if (app.mobile_bottom_offset !== undefined && app.mobile_bottom_offset !== null) {
            this.config.mobileBottomOffset = Number(app.mobile_bottom_offset);
          }
          if (app.mobile_right_offset !== undefined && app.mobile_right_offset !== null) {
            this.config.mobileRightOffset = Number(app.mobile_right_offset);
          }
          if (app.mobile_left_offset !== undefined && app.mobile_left_offset !== null) {
            this.config.mobileLeftOffset = Number(app.mobile_left_offset);
          }

          if (app.position) {
            this.config.position = app.position;
            const bubble = this.shadow.querySelector('.ragleaf-bubble') as HTMLElement;
            const posClass = (app.position === 'bottom-left' || app.position === 'left') ? 'left' : 'right';

            if (bubble) {
              bubble.className = `ragleaf-bubble ${posClass}`;
              bubble.style.bottom = '';
              bubble.style.right = '';
              bubble.style.left = '';
              bubble.style.top = '';
              bubble.style.position = '';
            }
            if (this.windowEl) {
              this.windowEl.className = `ragleaf-window ${posClass}${this.config.themeStyle === 'modern' ? ' style-modern' : ''}${this.isOpen ? ' open' : ''}`;
              this.windowEl.style.bottom = '';
              this.windowEl.style.right = '';
              this.windowEl.style.left = '';
              this.windowEl.style.top = '';
              this.windowEl.style.position = '';
            }
          }
          this.applyOffsets();
          if (app.width) {
            this.windowEl.style.width = `${app.width}px`;
          }
          if (app.height) {
            this.windowEl.style.height = `${app.height}px`;
          }
          if (app.border_radius) {
            this.windowEl.style.borderRadius = `${app.border_radius}px`;
          }
          if (app.bg_color) this.config.bgColor = app.bg_color;
          if (app.text_color) this.config.textColor = app.text_color;
          if (app.border_color) this.config.borderColor = app.border_color;
          if (app.input_bg_color) this.config.inputBgColor = app.input_bg_color;
          if (app.input_text_color) this.config.inputTextColor = app.input_text_color;
          if (app.bg_color_dark) this.config.bgColorDark = app.bg_color_dark;
          if (app.text_color_dark) this.config.textColorDark = app.text_color_dark;
          if (app.border_color_dark) this.config.borderColorDark = app.border_color_dark;
          if (app.input_bg_color_dark) this.config.inputBgColorDark = app.input_bg_color_dark;
          if (app.input_text_color_dark) this.config.inputTextColorDark = app.input_text_color_dark;
          if (app.theme) this.config.theme = app.theme;
          if (app.auto_theme !== undefined) this.config.autoTheme = app.auto_theme === true || app.auto_theme === 'true';
          if (app.bubble_icon) this.config.bubbleIcon = app.bubble_icon;
          if (app.custom_icon_svg) this.config.customIconSvg = app.custom_icon_svg;

          const bubble = this.shadow.querySelector('.ragleaf-bubble') as HTMLElement;
          if (bubble) {
            bubble.innerHTML = this.getBubbleIcon();
          }

          this.applyTheme();
        }
        // Read auto_open setting from agent appearance
        if (info.appearance) {
          const app = info.appearance;
          if (typeof app.auto_open === 'boolean') {
            this.config.autoOpen = app.auto_open;
          }
          if (typeof app.auto_open_desktop === 'boolean') {
            this.config.autoOpenDesktop = app.auto_open_desktop;
          }
          if (typeof app.auto_open_mobile === 'boolean') {
            this.config.autoOpenMobile = app.auto_open_mobile;
          }
        }
        // Trigger auto-open after fetching agent info based on device type
        const isMobileDevice = typeof window !== 'undefined' && window.innerWidth <= 768;
        const activeAutoOpen = isMobileDevice
          ? (this.config.autoOpenMobile !== undefined ? this.config.autoOpenMobile : this.config.autoOpen)
          : (this.config.autoOpenDesktop !== undefined ? this.config.autoOpenDesktop : this.config.autoOpen);

        if (activeAutoOpen && !this.isOpen) {
          setTimeout(() => { if (!this.isOpen) this.toggle(); }, this.config.autoOpenDelay);
        }
      } else {
        const isMobileDevice = typeof window !== 'undefined' && window.innerWidth <= 768;
        const activeAutoOpen = isMobileDevice
          ? (this.config.autoOpenMobile !== undefined ? this.config.autoOpenMobile : this.config.autoOpen)
          : (this.config.autoOpenDesktop !== undefined ? this.config.autoOpenDesktop : this.config.autoOpen);
        if (activeAutoOpen && !this.isOpen) {
          setTimeout(() => { if (!this.isOpen) this.toggle(); }, this.config.autoOpenDelay);
        }
      }
    } catch (e) {
      console.warn('[Ragleaf] Could not fetch agent info:', e);
      const isMobileDevice = typeof window !== 'undefined' && window.innerWidth <= 768;
      const activeAutoOpen = isMobileDevice
        ? (this.config.autoOpenMobile !== undefined ? this.config.autoOpenMobile : this.config.autoOpen)
        : (this.config.autoOpenDesktop !== undefined ? this.config.autoOpenDesktop : this.config.autoOpen);
      if (activeAutoOpen && !this.isOpen) {
        setTimeout(() => { if (!this.isOpen) this.toggle(); }, this.config.autoOpenDelay);
      }
    }
  }

  private render() {
    const style = document.createElement('style');
    style.textContent = CSS;
    this.shadow.appendChild(style);

    this.container = document.createElement('div');
    this.container.className = 'ragleaf-container';
    this.container.innerHTML = this.getHTML();
    this.shadow.appendChild(this.container);

    this.windowEl = this.shadow.querySelector('.ragleaf-window')!;
    this.messagesEl = this.shadow.querySelector('.ragleaf-messages')!;
    this.inputEl = this.shadow.querySelector('.ragleaf-input')!;
    this.sendBtn = this.shadow.querySelector('.ragleaf-send')!;

    // Events
    this.shadow.querySelector('.ragleaf-bubble')!.addEventListener('click', () => this.toggle());
    this.shadow.querySelector('.ragleaf-close')!.addEventListener('click', () => this.toggle());
    this.sendBtn.addEventListener('click', () => this.send());
    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });

    this.applyTheme();
    this.applyColors();
    this.applyOffsets();
    this.applyLayoutMode();

    if (this.config.theme === 'auto' || this.config.autoTheme) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        this.applyTheme();
      });
    }

    // Show welcome message
    if (this.config.welcomeMessage) {
      this.messages.push({ role: 'assistant', content: this.config.welcomeMessage, timestamp: Date.now() });
      this.renderMessages();
    }



    this.setupVisualViewport();
  }

  private getBubbleIcon(): string {
    if (this.config.customIconSvg && this.config.customIconSvg.includes('<svg')) {
      return this.config.customIconSvg;
    }
    const key = this.config.bubbleIcon || 'chat';
    return BUBBLE_ICONS[key] || BUBBLE_ICONS.chat;
  }

  private getHTML(): string {
    const isTurkish = this.config.language === 'tr' || (!this.config.language && navigator.language.startsWith('tr'));
    const posClass = (this.config.position === 'bottom-left' || (this.config.position as string) === 'left') ? 'left' : 'right';
    const refSuffix = this.config.orgId ? `?ref=${this.config.orgId}` : '';
    const bubbleIconHtml = this.getBubbleIcon();
    
    return `
      <div class="ragleaf-backdrop"></div>
      <div class="ragleaf-bubble ${posClass}" style="background:${this.config.primaryColor}">${bubbleIconHtml}</div>
      <div class="ragleaf-window ${posClass}">
        <div class="ragleaf-header"><h3>${this.config.title}</h3><button class="ragleaf-close">${CLOSE_ICON}</button></div>
        <div class="ragleaf-messages"></div>
        <div class="ragleaf-input-area">
          <textarea class="ragleaf-input" placeholder="${this.config.placeholder}" rows="1"></textarea>
          <button class="ragleaf-send" style="background:${this.config.primaryColor}">${SEND_ICON}</button>
        </div>
        <div class="ragleaf-powered" style="display:${this.config.showBranding !== false ? 'block' : 'none'}">${isTurkish ? '' : 'Powered by '}<a href="${this.config.apiUrl}/v1/ref/click${refSuffix}" target="_blank">${isTurkish ? 'Ragleaf AIChat' : 'Ragleaf'}</a></div>
      </div>`;
  }


  private applyColors() {
    this.container.style.setProperty('--primary', this.config.primaryColor);
    this.container.style.setProperty('--secondary', this.config.secondaryColor || '#8b5cf6');

    const isDark = this.container.classList.contains('dark');

    const bg = isDark ? (this.config.bgColorDark || '#090d16') : (this.config.bgColor || '#ffffff');
    const text = isDark ? (this.config.textColorDark || '#f3f4f6') : (this.config.textColor || '#1f2937');
    const border = isDark ? (this.config.borderColorDark || 'rgba(255,255,255,0.08)') : (this.config.borderColor || '#e5e7eb');
    const inputBg = isDark ? (this.config.inputBgColorDark || '#1f2937') : (this.config.inputBgColor || '#ffffff');
    const inputText = isDark ? (this.config.inputTextColorDark || '#f3f4f6') : (this.config.inputTextColor || '#1f2937');
    const assistantBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';

    this.container.style.setProperty('--text', text);
    this.container.style.setProperty('--bg', bg);
    this.container.style.setProperty('--border', border);
    this.container.style.setProperty('--input-bg', inputBg);
    this.container.style.setProperty('--input-text', inputText);
    this.container.style.setProperty('--assistant-bg', assistantBg);

    const bubble = this.shadow.querySelector('.ragleaf-bubble') as HTMLElement;
    const sendBtn = this.shadow.querySelector('.ragleaf-send') as HTMLElement;
    const header = this.shadow.querySelector('.ragleaf-header') as HTMLElement;
    if (bubble) bubble.style.background = this.config.primaryColor;
    if (sendBtn) sendBtn.style.background = this.config.primaryColor;
    if (header) header.style.background = this.config.primaryColor;
  }

  private applyOffsets() {
    if (!this.container) return;
    const bottomVal = (this.config.bottomOffset !== undefined) ? `${this.config.bottomOffset}px` : '70px';
    const rightVal = (this.config.rightOffset !== undefined) ? `${this.config.rightOffset}px` : '24px';
    const leftVal = (this.config.leftOffset !== undefined) ? `${this.config.leftOffset}px` : '24px';

    const mobileBottomVal = (this.config.mobileBottomOffset !== undefined) ? `${this.config.mobileBottomOffset}px` : '16px';
    const mobileRightVal = (this.config.mobileRightOffset !== undefined) ? `${this.config.mobileRightOffset}px` : '16px';
    const mobileLeftVal = (this.config.mobileLeftOffset !== undefined) ? `${this.config.mobileLeftOffset}px` : '16px';

    // Calculate window bottom offset based on bubble bottom offset to avoid overlap
    const parsedBottom = parseInt(bottomVal);
    const windowBottomVal = !isNaN(parsedBottom) ? `${parsedBottom + 76}px` : '146px';

    this.container.style.setProperty('--bubble-bottom', bottomVal);
    this.container.style.setProperty('--bubble-right', rightVal);
    this.container.style.setProperty('--bubble-left', leftVal);
    this.container.style.setProperty('--window-bottom', windowBottomVal);
    this.container.style.setProperty('--bubble-mobile-bottom', mobileBottomVal);
    this.container.style.setProperty('--bubble-mobile-right', mobileRightVal);
    this.container.style.setProperty('--bubble-mobile-left', mobileLeftVal);
  }

  private applyTheme() {
    if (!this.container) return;

    let isDark = false;
    if (this.config.theme === 'dark') {
      isDark = true;
    } else if (this.config.theme === 'auto' || this.config.autoTheme) {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.container.classList.toggle('dark', isDark);
    this.applyColors();
  }

  private applyLayoutMode() {
    const bubble = this.shadow.querySelector('.ragleaf-bubble') as HTMLElement;
    const windowEl = this.shadow.querySelector('.ragleaf-window') as HTMLElement;

    if (!bubble || !windowEl) return;

    windowEl.classList.remove('split', 'fullscreen');
    bubble.classList.remove('hidden');

    if (this.config.layoutMode === 'split') {
      windowEl.classList.add('split');
      bubble.classList.add('hidden');
      this.isOpen = true;
      windowEl.classList.add('open');
    } else if (this.config.layoutMode === 'fullscreen') {
      windowEl.classList.add('fullscreen');
      bubble.classList.add('hidden');
      this.isOpen = true;
      windowEl.classList.add('open');
    }
  }

  private updateHeader() {
    const h3 = this.shadow.querySelector('.ragleaf-header h3');
    if (h3) h3.textContent = this.config.title;
  }

  private setupVisualViewport() {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handler = () => {
      if (!this.isOpen) return;
      if (window.innerWidth <= 768) {
        const height = window.visualViewport!.height;
        const offsetTop = window.visualViewport!.offsetTop;

        this.windowEl.style.setProperty('height', `${height}px`, 'important');
        this.windowEl.style.setProperty('max-height', `${height}px`, 'important');
        this.windowEl.style.setProperty('top', `${offsetTop}px`, 'important');
        this.windowEl.style.setProperty('bottom', 'auto', 'important');

        setTimeout(() => this.scrollToBottom(), 100);
      } else {
        this.windowEl.style.removeProperty('height');
        this.windowEl.style.removeProperty('max-height');
        this.windowEl.style.removeProperty('top');
        this.windowEl.style.removeProperty('bottom');
      }
    };

    window.visualViewport.addEventListener('resize', handler);
    window.visualViewport.addEventListener('scroll', handler);
  }

  private toggle() {
    this.isOpen = !this.isOpen;
    this.windowEl.classList.toggle('open', this.isOpen);
    if (this.isOpen) {
      this.inputEl.focus();
      this.scrollToBottom();
      if (typeof window !== 'undefined' && window.visualViewport && window.innerWidth <= 768) {
        const height = window.visualViewport.height;
        const offsetTop = window.visualViewport.offsetTop;
        this.windowEl.style.setProperty('height', `${height}px`, 'important');
        this.windowEl.style.setProperty('max-height', `${height}px`, 'important');
        this.windowEl.style.setProperty('top', `${offsetTop}px`, 'important');
        this.windowEl.style.setProperty('bottom', 'auto', 'important');
        setTimeout(() => this.scrollToBottom(), 100);
      }
    } else {
      this.windowEl.style.removeProperty('height');
      this.windowEl.style.removeProperty('max-height');
      this.windowEl.style.removeProperty('top');
      this.windowEl.style.removeProperty('bottom');
    }
  }

  private renderMessages() {
    const list = [...this.messages];
    const initials = (this.config.title || 'AI').slice(0, 2).toUpperCase();
    const isModern = this.config.themeStyle === 'modern';

    this.messagesEl.innerHTML = list.map((m, index) => {
      const contentHtml = m.role === 'assistant' ? this.parseMarkdown(m.content) : this.escapeHtml(m.content, true);
      const formHtml = m.showForm ? this.getFormHtml(index) : '';
      if (isModern && m.role === 'assistant') {
        return `
          <div class="ragleaf-msg-wrapper">
            <div class="ragleaf-avatar" style="background:${this.config.primaryColor}">
              ${initials}
            </div>
            <div class="ragleaf-msg assistant">
              ${contentHtml}
              ${formHtml}
            </div>
          </div>`;
      }
      return `
        <div class="ragleaf-msg ${m.role}">
          ${contentHtml}
          ${formHtml}
        </div>`;
    }).join('');
    this.scrollToBottom();
    this.attachFormSubmitListeners();
    list.forEach((m, index) => {
      if (m.showForm) {
        this.initReservationFormBehavior(index);
      }
    });
  }

  private getFormHtml(index: number): string {
    const isTurkish = this.config.language === 'tr';
    const isReservation = !!this.personality.reservation_module_enabled;
    const minBookingSize = isReservation ? (Number(this.personality.res_min_booking_size) || 1) : 1;
    const resourceEnabled = isReservation ? !!this.personality.res_resource_management_enabled : false;

    // Fetch available slots asynchronously and render them dynamically inside the card
    setTimeout(async () => {
      const slotsContainer = this.shadow.getElementById(`ragleaf-slots-container-${index}`);
      if (!slotsContainer) return;

      try {
        const url = `${this.config.apiUrl}/v1/agents/${this.config.agentId}/available-slots`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const slots: string[] = data.slots || [];

        if (slots.length === 0) {
          slotsContainer.innerHTML = `<div style="color: #ef4444; font-size: 11px; margin-top: 4px;">${isTurkish ? 'Uygun randevu saati bulunmamaktadır.' : 'No available slots found.'}</div>`;
          return;
        }

        // Group slots by date
        const grouped: Record<string, string[]> = {};
        slots.forEach(s => {
          const [datePart, timePart] = s.split('T');
          if (!grouped[datePart]) grouped[datePart] = [];
          grouped[datePart].push(timePart);
        });

        let html = '';
        Object.keys(grouped).forEach(dateStr => {
          const dateObj = new Date(dateStr);
          const daysMapTr: Record<string, string> = { monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba', thursday: 'Perşembe', friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar' };
          const daysMapEn: Record<string, string> = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };
          
          const daysOfWeekMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayName = daysOfWeekMap[dateObj.getDay()];
          const readableDayName = isTurkish ? (daysMapTr[dayName] || dayName) : (daysMapEn[dayName] || dayName);

          const formattedDate = dateObj.toLocaleDateString(isTurkish ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          
          html += `
            <div style="margin-top: 10px;">
              <div style="font-weight: 600; font-size: 11px; margin-bottom: 5px; color: #4b5563;">${formattedDate} (${readableDayName})</div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${grouped[dateStr].map(timeStr => {
                  const fullVal = `${dateStr}T${timeStr}`;
                  return `
                    <button type="button" class="ragleaf-slot-btn" data-value="${fullVal}" style="padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); font-size: 11px; cursor: pointer; transition: all 0.2s;">
                      ${timeStr}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        });

        slotsContainer.innerHTML = html;

        // Attach slot button click listeners
        const btns = slotsContainer.querySelectorAll('.ragleaf-slot-btn');
        btns.forEach(btn => {
          btn.addEventListener('click', () => {
            btns.forEach(b => {
              (b as HTMLElement).style.background = 'var(--bg)';
              (b as HTMLElement).style.color = 'var(--text)';
              (b as HTMLElement).style.borderColor = 'var(--border)';
              b.classList.remove('selected');
            });
            (btn as HTMLElement).style.background = 'var(--primary)';
            (btn as HTMLElement).style.color = 'white';
            (btn as HTMLElement).style.borderColor = 'var(--primary)';
            btn.classList.add('selected');
          });
        });

      } catch (err) {
        slotsContainer.innerHTML = `<div style="color: #ef4444; font-size: 11px; margin-top: 4px;">${isTurkish ? 'Saatler yüklenemedi.' : 'Failed to load slots.'}</div>`;
      }
    }, 50);

    return `
      <div class="ragleaf-form-card" id="ragleaf-form-card-${index}" style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.05); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; color: var(--text);">
        <div style="font-weight: bold; margin-bottom: 8px; color: var(--primary); font-size: 14px;">
          ${isReservation 
            ? (isTurkish ? 'Rezervasyon Formu' : 'Reservation Form')
            : (isTurkish ? 'Randevu Formu' : 'Appointment Form')}
        </div>
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; margin-bottom: 3px; font-weight: 500;">${isTurkish ? 'Adınız Soyadınız' : 'Your Name'}</label>
          <input type="text" class="ragleaf-form-input name" style="width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); font-size: 12px;" required />
        </div>
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; margin-bottom: 3px; font-weight: 500;">${isTurkish ? 'Telefon Numaranız' : 'Phone Number'}</label>
          <input type="tel" class="ragleaf-form-input phone" style="width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); font-size: 12px;" required />
        </div>
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; margin-bottom: 3px; font-weight: 500;">${isTurkish ? 'E-posta Adresiniz' : 'Email Address'}</label>
          <input type="email" class="ragleaf-form-input email" style="width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); font-size: 12px;" required />
        </div>

        ${isReservation ? `
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; margin-bottom: 3px; font-weight: 500;">${isTurkish ? 'Kişi Sayısı' : 'Number of Guests'}</label>
          <input type="number" class="ragleaf-form-input party_size" min="${minBookingSize}" value="${minBookingSize}" style="width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); font-size: 12px;" required />
        </div>
        ` : ''}

        ${resourceEnabled ? `
        <div style="margin-bottom: 8px;" class="ragleaf-resource-field">
          <label style="display: block; font-size: 11px; margin-bottom: 3px; font-weight: 500;">${isTurkish ? 'Masa / Yer Seçimi' : 'Table / Spot Selection'}</label>
          <select class="ragleaf-form-input resource" style="width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); font-size: 12px;"></select>
          <div class="ragleaf-resource-warning" style="color: #ef4444; font-size: 11px; margin-top: 4px; display: none;">
            ${isTurkish ? 'Bu kişi sayısına uygun masa bulunmamaktadır.' : 'No table available for this number of guests.'}
          </div>
        </div>
        ` : ''}

        <div class="ragleaf-guests-container" style="margin-bottom: 8px;"></div>

        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; margin-bottom: 3px; font-weight: 500;">${isTurkish ? 'Uygun Tarih ve Saat Seçin' : 'Select Date & Time'}</label>
          <div id="ragleaf-slots-container-${index}" style="max-height: 180px; overflow-y: auto; padding-right: 4px; border: 1px solid var(--border); border-radius: 6px; padding: 8px; background: var(--bg);">
            <div style="font-size: 11px; color: #9ca3af;">${isTurkish ? 'Yükleniyor...' : 'Loading slots...'}</div>
          </div>
        </div>
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; margin-bottom: 3px; font-weight: 500;">${isTurkish ? 'Notlar / Tercihler' : 'Notes / Preferences'}</label>
          <textarea class="ragleaf-form-input notes" style="width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); resize: none; font-size: 12px;" rows="2"></textarea>
        </div>
        <button class="ragleaf-form-submit-btn" data-index="${index}" style="width: 100%; padding: 8px; border: none; border-radius: 4px; background: var(--primary); color: white; font-weight: bold; cursor: pointer; margin-top: 6px; font-size: 12px; transition: opacity 0.2s;">
          ${isReservation 
            ? (isTurkish ? 'Rezervasyonu Onayla 📅' : 'Confirm Reservation 📅')
            : (isTurkish ? 'Randevuyu Onayla 📅' : 'Confirm Appointment 📅')}
        </button>
      </div>
    `;
  }

  private initReservationFormBehavior(index: number) {
    const card = this.shadow.getElementById(`ragleaf-form-card-${index}`);
    if (!card) return;

    const isReservation = !!this.personality.reservation_module_enabled;
    if (!isReservation) return;

    const isTurkish = this.config.language === 'tr';
    const partySizeInput = card.querySelector('.ragleaf-form-input.party_size') as HTMLInputElement;
    const resourceSelect = card.querySelector('.ragleaf-form-input.resource') as HTMLSelectElement;
    const resourceWarning = card.querySelector('.ragleaf-resource-warning') as HTMLElement;
    const guestsContainer = card.querySelector('.ragleaf-guests-container') as HTMLElement;

    if (!partySizeInput) return;

    const updateBehavior = () => {
      const val = parseInt(partySizeInput.value) || 1;
      
      // 1. Filter resources
      if (resourceSelect) {
        const resources = this.personality.res_resources || [];
        const filtered = resources.filter((r: any) => val >= (r.min_capacity || 0) && val <= (r.max_capacity || 999));
        
        resourceSelect.innerHTML = '';
        if (filtered.length === 0) {
          if (resourceWarning) resourceWarning.style.display = 'block';
          resourceSelect.style.display = 'none';
        } else {
          if (resourceWarning) resourceWarning.style.display = 'none';
          resourceSelect.style.display = 'block';
          filtered.forEach((r: any) => {
            const opt = document.createElement('option');
            opt.value = r.name;
            opt.textContent = `${r.name} (${r.min_capacity}-${r.max_capacity} ${isTurkish ? 'Kişilik' : 'People'})`;
            resourceSelect.appendChild(opt);
          });
        }
      }

      // 2. Generate guest inputs
      if (guestsContainer && this.personality.res_require_all_guest_details) {
        guestsContainer.innerHTML = '';
        if (val > 1) {
          let guestsHtml = `<div style="margin-top: 10px; margin-bottom: 5px; font-weight: 600; font-size: 11px; color: var(--primary);">${isTurkish ? 'Diğer Katılımcıların Bilgileri' : 'Other Guest Details'}</div>`;
          for (let i = 2; i <= val; i++) {
            guestsHtml += `
              <div style="margin-bottom: 8px; padding: 6px; border-left: 2px solid var(--primary); background: rgba(0,0,0,0.02); margin-left: 4px;">
                <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px; color: #4b5563;">${isTurkish ? `Katılımcı ${i}` : `Guest ${i}`}</div>
                <div style="margin-bottom: 4px;">
                  <input type="text" placeholder="${isTurkish ? 'Adı Soyadı' : 'Name'}" class="ragleaf-guest-name" style="width: 100%; box-sizing: border-box; padding: 5px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); font-size: 11px;" required />
                </div>
                <div>
                  <input type="text" placeholder="${isTurkish ? 'Telefon veya E-posta' : 'Phone or Email'}" class="ragleaf-guest-contact" style="width: 100%; box-sizing: border-box; padding: 5px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--input-text); font-size: 11px;" required />
                </div>
              </div>
            `;
          }
          guestsContainer.innerHTML = guestsHtml;
        }
      }
    };

    partySizeInput.addEventListener('input', updateBehavior);
    partySizeInput.addEventListener('change', updateBehavior);
    updateBehavior();
  }

  private attachFormSubmitListeners() {
    const buttons = this.shadow.querySelectorAll('.ragleaf-form-submit-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const indexAttr = btn.getAttribute('data-index');
        if (indexAttr) {
          const index = parseInt(indexAttr);
          this.handleFormSubmit(index);
        }
      });
    });
  }

  private async handleFormSubmit(index: number) {
    const card = this.shadow.getElementById(`ragleaf-form-card-${index}`);
    if (!card) return;

    const nameInput = card.querySelector('.ragleaf-form-input.name') as HTMLInputElement;
    const phoneInput = card.querySelector('.ragleaf-form-input.phone') as HTMLInputElement;
    const emailInput = card.querySelector('.ragleaf-form-input.email') as HTMLInputElement;
    const notesInput = card.querySelector('.ragleaf-form-input.notes') as HTMLTextAreaElement;
    
    // Find selected slot button
    const selectedBtn = card.querySelector('.ragleaf-slot-btn.selected') as HTMLElement;

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const notes = notesInput.value.trim();

    const isTurkish = this.config.language === 'tr';
    const isReservation = !!this.personality.reservation_module_enabled;

    if (!name || !phone || !email) {
      alert(isTurkish ? 'Lütfen tüm zorunlu alanları doldurun.' : 'Please fill in all required fields.');
      return;
    }

    if (!selectedBtn) {
      alert(isTurkish ? 'Lütfen bir tarih ve saat seçin.' : 'Please select a date and time slot.');
      return;
    }

    const date = selectedBtn.getAttribute('data-value') || '';

    // Client-side date and working slot validation
    try {
      const selectedDateTime = new Date(date);
      if (isNaN(selectedDateTime.getTime())) {
        throw new Error();
      }
      
      const now = new Date();
      if (selectedDateTime <= now) {
        alert(isTurkish ? 'Lütfen gelecek bir tarih seçin.' : 'Please choose a future date.');
        return;
      }

      // Check working days
      const daysOfWeekMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = daysOfWeekMap[selectedDateTime.getDay()];
      const allowedDays = this.personality.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      if (!allowedDays.includes(dayName)) {
        const daysMapTr: Record<string, string> = { monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba', thursday: 'Perşembe', friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar' };
        const daysMapEn: Record<string, string> = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };
        const readableDays = allowedDays.map((d: string) => isTurkish ? (daysMapTr[d] || d) : (daysMapEn[d] || d)).join(', ');
        alert(isTurkish 
          ? `Seçtiğiniz gün çalışma günlerimizin dışındadır.\nÇalışma günlerimiz: ${readableDays}`
          : `The chosen day is not a working day.\nWorking days: ${readableDays}`
        );
        return;
      }

      // Check working hours
      const selectedTimeStr = date.split('T')[1] || ''; // HH:MM
      const startHour = this.personality.working_start_hour || '09:00';
      const endHour = this.personality.working_end_hour || '18:00';
      if (selectedTimeStr < startHour || selectedTimeStr > endHour) {
        alert(isTurkish
          ? `Seçtiğiniz saat çalışma saatlerimizin (${startHour} - ${endHour}) dışındadır.`
          : `The chosen time slot is outside our working hours (${startHour} - ${endHour}).`
        );
        return;
      }

    } catch (e) {
      alert(isTurkish ? 'Geçersiz tarih girdiniz.' : 'Invalid date format.');
      return;
    }

    // Reservation extra fields
    let party_size: number | undefined;
    let resource: string | undefined;
    let guest_details: any[] = [];

    if (isReservation) {
      const partySizeInput = card.querySelector('.ragleaf-form-input.party_size') as HTMLInputElement;
      if (partySizeInput) {
        party_size = parseInt(partySizeInput.value) || 1;
        const minBookingSize = Number(this.personality.res_min_booking_size) || 1;
        if (party_size < minBookingSize) {
          alert(isTurkish ? `En az ${minBookingSize} kişi seçmelisiniz.` : `Please select at least ${minBookingSize} people.`);
          return;
        }
      }

      const resourceSelect = card.querySelector('.ragleaf-form-input.resource') as HTMLSelectElement;
      if (resourceSelect && resourceSelect.style.display !== 'none') {
        resource = resourceSelect.value;
        if (!resource && this.personality.res_resource_management_enabled) {
          alert(isTurkish ? 'Lütfen uygun bir masa seçin.' : 'Please select an available table.');
          return;
        }
      }

      if (this.personality.res_require_all_guest_details && party_size && party_size > 1) {
        const guestNameInputs = card.querySelectorAll('.ragleaf-guest-name');
        const guestContactInputs = card.querySelectorAll('.ragleaf-guest-contact');
        
        for (let i = 0; i < guestNameInputs.length; i++) {
          const gName = (guestNameInputs[i] as HTMLInputElement).value.trim();
          const gContact = (guestContactInputs[i] as HTMLInputElement).value.trim();
          if (!gName || !gContact) {
            alert(isTurkish ? 'Lütfen tüm katılımcı bilgilerini doldurun.' : 'Please fill in details for all guests.');
            return;
          }
          guest_details.push({ name: gName, contact: gContact });
        }
      }
    }

    const payload: any = {
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      customer_notes: notes,
      appointment_date: date,
      service_type: isReservation 
        ? (isTurkish ? 'Masa Rezervasyonu' : 'Table Reservation')
        : (isTurkish ? 'Genel Randevu' : 'General Appointment')
    };

    if (isReservation) {
      if (party_size) payload.party_size = party_size;
      if (resource) payload.resource = resource;
      if (guest_details.length > 0) payload.guest_details = guest_details;
    }

    // Remove the form from the message so it doesn't show anymore
    this.messages[index].showForm = false;
    this.renderMessages();

    const submissionText = `[BOOKING_FORM_SUBMITTED] ${JSON.stringify(payload)}`;
    
    this.isLoading = true;
    this.sendBtn.disabled = true;
    this.showTyping();

    const displayDate = date.replace('T', ' ');
    let displayMsg = '';
    if (isReservation) {
      displayMsg = isTurkish 
        ? `Rezervasyon bilgilerimi gönderdim.\n- İsim: ${name}\n- Tarih: ${displayDate}\n- Kişi Sayısı: ${party_size || 1}`
        : `Sent my reservation details.\n- Name: ${name}\n- Date: ${displayDate}\n- Party Size: ${party_size || 1}`;
      if (resource) {
        displayMsg += isTurkish ? `\n- Masa: ${resource}` : `\n- Table: ${resource}`;
      }
    } else {
      displayMsg = isTurkish 
        ? `Randevu bilgilerimi gönderdim.\n- İsim: ${name}\n- Telefon: ${phone}\n- Tarih: ${displayDate}`
        : `Sent my booking details.\n- Name: ${name}\n- Phone: ${phone}\n- Date: ${displayDate}`;
    }
    
    this.messages.push({ role: 'user', content: displayMsg, timestamp: Date.now() });
    this.renderMessages();

    try {
      const res = await fetch(`${this.config.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: submissionText }
          ],
          session_id: this.sessionId,
          metadata: {
            lang: this.config.language
          }
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || (isTurkish ? 'Randevunuz onaylandı.' : 'Your appointment has been confirmed.');

      this.messages.push({ role: 'assistant', content: reply, timestamp: Date.now() });
    } catch (e) {
      const fallbackError = isTurkish ? 'Bağlantı hatası. Lütfen tekrar deneyin.' : 'Connection error. Please try again.';
      this.messages.push({ role: 'assistant', content: fallbackError, timestamp: Date.now() });
      console.error('[Ragleaf] Form submission error:', e);
    } finally {
      this.isLoading = false;
      this.sendBtn.disabled = false;
      this.hideTyping();
      this.renderMessages();
    }
  }

  private parseMarkdown(text: string): string {
    if (!text) return '';

    let html = this.escapeHtml(text, false);
    // Allow raw br tags in LLM responses
    html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

    const lines = html.split(/\r?\n/);
    const result: string[] = [];

    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLang = '';

    let inTable = false;
    let tableRows: string[] = [];

    let inList = false;
    let listType: 'ul' | 'ol' | null = null;

    let inBlockquote = false;
    let blockquoteContent: string[] = [];

    // Helper to parse inline markdown formats
    const parseInline = (str: string): string => {
      let s = str;
      // Bold & italic
      s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
      // Inline code
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      // Links
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return s;
    };

    const flushList = () => {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
    };

    const flushBlockquote = () => {
      if (inBlockquote) {
        result.push(`<blockquote>${parseInline(blockquoteContent.join('<br>'))}</blockquote>`);
        inBlockquote = false;
        blockquoteContent = [];
      }
    };

    const flushTable = () => {
      if (inTable) {
        if (tableRows.length >= 2) {
          const parseRow = (row: string) => {
            let r = row.trim();
            if (r.startsWith('|')) r = r.slice(1);
            if (r.endsWith('|')) r = r.slice(0, -1);
            return r.split('|').map(c => c.trim());
          };

          const headerCells = parseRow(tableRows[0]);
          const sep = tableRows[1];
          // Simple validation of separator row
          const isSep = /^[\s-:|]+$/.test(sep.trim());

          if (isSep) {
            let tableHtml = '<table>';
            tableHtml += `<thead><tr>${headerCells.map(c => `<th>${parseInline(c)}</th>`).join('')}</tr></thead>`;
            tableHtml += '<tbody>';
            for (let i = 2; i < tableRows.length; i++) {
              const cells = parseRow(tableRows[i]);
              // Make sure cells count matches header or pads
              const paddedCells = Array.from({ length: headerCells.length }, (_, idx) => cells[idx] || '');
              tableHtml += `<tr>${paddedCells.map(c => `<td>${parseInline(c)}</td>`).join('')}</tr>`;
            }
            tableHtml += '</tbody></table>';
            result.push(tableHtml);
          } else {
            // Not a valid table, output as plain lines
            tableRows.forEach(r => result.push(`<p>${parseInline(r)}</p>`));
          }
        } else {
          tableRows.forEach(r => result.push(`<p>${parseInline(r)}</p>`));
        }
        inTable = false;
        tableRows = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      const trimmed = originalLine.trim();

      // Handle Code Blocks
      if (trimmed.startsWith('```')) {
        flushList();
        flushBlockquote();
        flushTable();
        if (inCodeBlock) {
          result.push(`<pre><code>${codeContent.join('\n')}</code></pre>`);
          inCodeBlock = false;
          codeContent = [];
        } else {
          inCodeBlock = true;
          codeLang = trimmed.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(originalLine);
        continue;
      }

      // Handle Table Lines
      const isTableLine = trimmed.startsWith('|') || (trimmed.includes('|') && (inTable || (i + 1 < lines.length && /^[\s-:|]+$/.test(lines[i + 1].trim()))));
      if (isTableLine) {
        flushList();
        flushBlockquote();
        inTable = true;
        tableRows.push(originalLine);
        continue;
      } else {
        flushTable();
      }

      // Handle Blockquotes
      if (trimmed.startsWith('&gt; ') || trimmed.startsWith('>') || trimmed === '>') {
        flushList();
        flushTable();
        inBlockquote = true;
        const content = trimmed.startsWith('&gt;') ? trimmed.slice(4).trim() : (trimmed.startsWith('>') ? trimmed.slice(1).trim() : '');
        blockquoteContent.push(content);
        continue;
      } else {
        flushBlockquote();
      }

      // Handle Lists
      const ulMatch = trimmed.match(/^([-\*•+])\s+(.+)$/);
      const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);

      if (ulMatch) {
        flushBlockquote();
        flushTable();
        if (!inList || listType !== 'ul') {
          flushList();
          result.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        result.push(`<li>${parseInline(ulMatch[2])}</li>`);
        continue;
      } else if (olMatch) {
        flushBlockquote();
        flushTable();
        if (!inList || listType !== 'ol') {
          flushList();
          result.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        result.push(`<li>${parseInline(olMatch[2])}</li>`);
        continue;
      } else {
        if (trimmed === '') {
          flushList();
        }
      }

      // Handle Headers
      if (trimmed.startsWith('### ')) {
        flushList();
        result.push(`<h3>${parseInline(trimmed.slice(4))}</h3>`);
        continue;
      } else if (trimmed.startsWith('## ')) {
        flushList();
        result.push(`<h2>${parseInline(trimmed.slice(3))}</h2>`);
        continue;
      } else if (trimmed.startsWith('# ')) {
        flushList();
        result.push(`<h1>${parseInline(trimmed.slice(2))}</h1>`);
        continue;
      }

      // Handle Horizontal Rule
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        flushList();
        result.push('<hr>');
        continue;
      }

      // Handle empty lines or regular paragraphs
      if (trimmed === '') {
        continue;
      }

      // It's a normal paragraph line
      result.push(`<p>${parseInline(trimmed)}</p>`);
    }

    // Flush any remaining blocks
    flushList();
    flushBlockquote();
    flushTable();

    return result.join('\n');
  }

  private scrollToBottom() {
    requestAnimationFrame(() => { this.messagesEl.scrollTop = this.messagesEl.scrollHeight; });
  }

  private showTyping() {
    const div = document.createElement('div');
    div.className = 'ragleaf-msg typing';
    div.id = 'ragleaf-typing';
    div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    this.messagesEl.appendChild(div);
    this.scrollToBottom();
  }

  private hideTyping() {
    this.shadow.getElementById('ragleaf-typing')?.remove();
  }

  private async send() {
    const text = this.inputEl.value.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text, timestamp: Date.now() });
    this.inputEl.value = '';
    this.renderMessages();

    this.isLoading = true;
    this.sendBtn.disabled = true;
    this.showTyping();

    try {
      const res = await fetch(`${this.config.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          messages: this.messages.filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-10)
            .map(m => ({ role: m.role, content: m.content })),
          session_id: this.sessionId,
          metadata: {
            lang: this.config.language
          }
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      const fallbackNoReply = this.config.language === 'en' ? 'No response received.' : 'Yanıt alınamadı.';
      let reply = data.choices?.[0]?.message?.content || fallbackNoReply;

      let showForm = false;
      if (reply.includes('[SHOW_BOOKING_FORM]')) {
        reply = reply.replace('[SHOW_BOOKING_FORM]', '').trim();
        showForm = true;
      }

      this.messages.push({ role: 'assistant', content: reply, sources: data.sources, timestamp: Date.now(), showForm });
    } catch (e) {
      const fallbackError = this.config.language === 'en' ? 'Connection error. Please try again.' : 'Bağlantı hatası. Lütfen tekrar deneyin.';
      this.messages.push({ role: 'assistant', content: fallbackError, timestamp: Date.now() });
      console.error('[Ragleaf] Chat error:', e);
    } finally {
      this.isLoading = false;
      this.sendBtn.disabled = false;
      this.hideTyping();
      this.renderMessages();
    }
  }

  private escapeHtml(str: string, replaceNewlines: boolean = false): string {
    const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return replaceNewlines ? escaped.replace(/\n/g, '<br>') : escaped;
  }

  destroy() {
    this.shadow.host.remove();
  }
}

// === Auto-init from script tag ===
(function init() {
  const script = document.currentScript as HTMLScriptElement;
  if (!script) return;

  const agentId = script.getAttribute('data-agent-id');
  const apiKey = script.getAttribute('data-api-key');
  const apiUrl = script.getAttribute('data-api-url') || window.location.origin;

  if (!agentId || !apiKey) {
    console.error('[Ragleaf] data-agent-id and data-api-key attributes are required');
    return;
  }

  const config: Partial<WidgetConfig> = {
    agentId,
    apiKey,
    apiUrl,
    primaryColor: script.getAttribute('data-primary-color') || undefined,
    secondaryColor: script.getAttribute('data-secondary-color') || undefined,
    position: (script.getAttribute('data-position') as any) || undefined,
    title: script.getAttribute('data-title') || undefined,
    autoOpen: script.getAttribute('data-auto-open') !== 'false',
    autoOpenDesktop: script.getAttribute('data-auto-open-desktop') ? script.getAttribute('data-auto-open-desktop') !== 'false' : undefined,
    autoOpenMobile: script.getAttribute('data-auto-open-mobile') ? script.getAttribute('data-auto-open-mobile') !== 'false' : undefined,
    layoutMode: (script.getAttribute('data-layout-mode') as any) || undefined,
    widgetId: script.getAttribute('data-widget-id') || undefined,
    containerId: script.getAttribute('data-container-id') || undefined,
    autoTheme: script.getAttribute('data-auto-theme') === 'true',
    theme: (script.getAttribute('data-theme') as any) || undefined,
    showBranding: script.getAttribute('data-show-branding') !== 'false',
    themeStyle: (script.getAttribute('data-theme-style') as any) || undefined,
    bgColor: script.getAttribute('data-bg-color') || undefined,
    textColor: script.getAttribute('data-text-color') || undefined,
    borderColor: script.getAttribute('data-border-color') || undefined,
    inputBgColor: script.getAttribute('data-input-bg-color') || undefined,
    inputTextColor: script.getAttribute('data-input-text-color') || undefined,
    bgColorDark: script.getAttribute('data-bg-color-dark') || undefined,
    textColorDark: script.getAttribute('data-text-color-dark') || undefined,
    borderColorDark: script.getAttribute('data-border-color-dark') || undefined,
    inputBgColorDark: script.getAttribute('data-input-bg-color-dark') || undefined,
    inputTextColorDark: script.getAttribute('data-input-text-color-dark') || undefined,
    language: script.getAttribute('data-lang') || script.getAttribute('data-language') || undefined,
    bottomOffset: script.getAttribute('data-bottom-offset') ? Number(script.getAttribute('data-bottom-offset')) : undefined,
    rightOffset: script.getAttribute('data-right-offset') ? Number(script.getAttribute('data-right-offset')) : undefined,
    leftOffset: script.getAttribute('data-left-offset') ? Number(script.getAttribute('data-left-offset')) : undefined,
    mobileBottomOffset: script.getAttribute('data-mobile-bottom-offset') ? Number(script.getAttribute('data-mobile-bottom-offset')) : undefined,
    mobileRightOffset: script.getAttribute('data-mobile-right-offset') ? Number(script.getAttribute('data-mobile-right-offset')) : undefined,
    mobileLeftOffset: script.getAttribute('data-mobile-left-offset') ? Number(script.getAttribute('data-mobile-left-offset')) : undefined,
  };

  Object.keys(config).forEach(k => {
    if ((config as any)[k] === undefined) delete (config as any)[k];
  });

  if (document.getElementById('ragleaf-widget-host')) {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('ragleaf-widget-host')) return;
      (window as any).__ragleaf = new RagleafWidget(config);
    });
  } else {
    (window as any).__ragleaf = new RagleafWidget(config);
  }
})();

export { RagleafWidget };

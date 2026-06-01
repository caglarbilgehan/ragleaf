// Ragleaf Widget — Embeddable AI Chat
// Shadow DOM based, zero-dependency, single file

interface WidgetConfig {
  agentId: string;
  apiKey: string;
  apiUrl: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  welcomeMessage: string;
  title: string;
  placeholder: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp: number;
}

const DEFAULT_CONFIG: Partial<WidgetConfig> = {
  primaryColor: '#4F46E5',
  position: 'bottom-right',
  welcomeMessage: 'Merhaba! Size nasıl yardımcı olabilirim?',
  title: 'AI Asistan',
  placeholder: 'Mesajınızı yazın...',
};

const CSS = `
:host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

.ragleaf-bubble {
  position: fixed; bottom: 24px; width: 60px; height: 60px;
  border-radius: 50%; cursor: pointer; z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 24px rgba(0,0,0,0.25); transition: transform 0.3s, box-shadow 0.3s;
}
.ragleaf-bubble:hover { transform: scale(1.1); box-shadow: 0 6px 32px rgba(0,0,0,0.3); }
.ragleaf-bubble.right { right: 24px; }
.ragleaf-bubble.left { left: 24px; }
.ragleaf-bubble svg { width: 28px; height: 28px; fill: white; }

.ragleaf-window {
  position: fixed; bottom: 96px; width: 380px; max-width: calc(100vw - 32px);
  height: 520px; max-height: calc(100vh - 120px);
  border-radius: 16px; overflow: hidden; z-index: 99998;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 48px rgba(0,0,0,0.2); opacity: 0; transform: translateY(20px) scale(0.95);
  transition: opacity 0.3s, transform 0.3s; pointer-events: none;
  background: #fff;
}
.ragleaf-window.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
.ragleaf-window.right { right: 24px; }
.ragleaf-window.left { left: 24px; }

.ragleaf-header {
  padding: 16px 20px; color: white; display: flex; align-items: center;
  justify-content: space-between; flex-shrink: 0;
}
.ragleaf-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
.ragleaf-close { background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 4px; line-height: 1; }

.ragleaf-messages {
  flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
  background: #f9fafb;
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
  align-self: flex-start; background: white; color: #1f2937;
  border: 1px solid #e5e7eb; border-bottom-left-radius: 4px;
}
.ragleaf-msg.typing { align-self: flex-start; background: white; border: 1px solid #e5e7eb; }
.typing-dots { display: flex; gap: 4px; padding: 4px 0; }
.typing-dots span {
  width: 6px; height: 6px; border-radius: 50%; background: #9ca3af;
  animation: bounce 1.4s infinite both;
}
.typing-dots span:nth-child(2) { animation-delay: 0.16s; }
.typing-dots span:nth-child(3) { animation-delay: 0.32s; }

.ragleaf-input-area {
  padding: 12px 16px; background: white; border-top: 1px solid #e5e7eb;
  display: flex; gap: 8px; align-items: center; flex-shrink: 0;
}
.ragleaf-input {
  flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 14px;
  font-size: 14px; outline: none; resize: none; max-height: 80px;
  font-family: inherit; line-height: 1.4;
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
  background: white; border-top: 1px solid #f3f4f6;
}
.ragleaf-powered a { color: #6b7280; text-decoration: none; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
@media (max-width: 480px) {
  .ragleaf-window { width: 100vw; height: 100vh; max-height: 100vh; bottom: 0; right: 0; left: 0; border-radius: 0; }
  .ragleaf-bubble { bottom: 16px; right: 16px; }
}
`;

const CHAT_ICON = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';
const SEND_ICON = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
const CLOSE_ICON = '✕';

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

  constructor(config: Partial<WidgetConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as WidgetConfig;
    this.sessionId = this.getSessionId();
    
    const host = document.createElement('div');
    host.id = 'ragleaf-widget-host';
    document.body.appendChild(host);
    this.shadow = host.attachShadow({ mode: 'closed' });
    
    this.render();
    this.fetchAgentInfo();
  }

  private getSessionId(): string {
    const key = `ragleaf_session_${this.config.agentId}`;
    let sid = sessionStorage.getItem(key);
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(key, sid); }
    return sid;
  }

  private async fetchAgentInfo() {
    try {
      const res = await fetch(`${this.config.apiUrl}/v1/agents/${this.config.agentId}/info`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
      });
      if (res.ok) {
        const info = await res.json();
        if (info.name) { this.config.title = info.name; this.updateHeader(); }
        if (info.welcome_message) this.config.welcomeMessage = info.welcome_message;
        if (info.appearance?.primary_color) {
          this.config.primaryColor = info.appearance.primary_color;
          this.applyColors();
        }
      }
    } catch (e) { console.warn('[Ragleaf] Could not fetch agent info:', e); }
  }

  private render() {
    const style = document.createElement('style');
    style.textContent = CSS;
    this.shadow.appendChild(style);

    this.container = document.createElement('div');
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

    this.applyColors();

    // Show welcome message
    if (this.config.welcomeMessage) {
      this.messages.push({ role: 'assistant', content: this.config.welcomeMessage, timestamp: Date.now() });
      this.renderMessages();
    }
  }

  private getHTML(): string {
    const pos = this.config.position === 'bottom-left' ? 'left' : 'right';
    return `
      <div class="ragleaf-bubble ${pos}" style="background:${this.config.primaryColor}">${CHAT_ICON}</div>
      <div class="ragleaf-window ${pos}">
        <div class="ragleaf-header"><h3>${this.config.title}</h3><button class="ragleaf-close">${CLOSE_ICON}</button></div>
        <div class="ragleaf-messages"></div>
        <div class="ragleaf-input-area">
          <textarea class="ragleaf-input" placeholder="${this.config.placeholder}" rows="1"></textarea>
          <button class="ragleaf-send" style="background:${this.config.primaryColor}">${SEND_ICON}</button>
        </div>
        <div class="ragleaf-powered">Powered by <a href="https://ragleaf.com" target="_blank">Ragleaf</a></div>
      </div>`;
  }

  private applyColors() {
    this.container.style.setProperty('--primary', this.config.primaryColor);
    const bubble = this.shadow.querySelector('.ragleaf-bubble') as HTMLElement;
    const sendBtn = this.shadow.querySelector('.ragleaf-send') as HTMLElement;
    const header = this.shadow.querySelector('.ragleaf-header') as HTMLElement;
    if (bubble) bubble.style.background = this.config.primaryColor;
    if (sendBtn) sendBtn.style.background = this.config.primaryColor;
    if (header) header.style.background = this.config.primaryColor;
  }

  private updateHeader() {
    const h3 = this.shadow.querySelector('.ragleaf-header h3');
    if (h3) h3.textContent = this.config.title;
  }

  private toggle() {
    this.isOpen = !this.isOpen;
    this.windowEl.classList.toggle('open', this.isOpen);
    if (this.isOpen) { this.inputEl.focus(); this.scrollToBottom(); }
  }

  private renderMessages() {
    this.messagesEl.innerHTML = this.messages.map(m =>
      `<div class="ragleaf-msg ${m.role}">${this.escapeHtml(m.content)}</div>`
    ).join('');
    this.scrollToBottom();
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
            .slice(-10) // Last 10 messages for context
            .map(m => ({ role: m.role, content: m.content })),
          session_id: this.sessionId,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Yanıt alınamadı.';

      this.messages.push({ role: 'assistant', content: reply, sources: data.sources, timestamp: Date.now() });
    } catch (e) {
      this.messages.push({ role: 'assistant', content: 'Bağlantı hatası. Lütfen tekrar deneyin.', timestamp: Date.now() });
      console.error('[Ragleaf] Chat error:', e);
    } finally {
      this.isLoading = false;
      this.sendBtn.disabled = false;
      this.hideTyping();
      this.renderMessages();
    }
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/\n/g, '<br>');
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
    position: (script.getAttribute('data-position') as any) || undefined,
    title: script.getAttribute('data-title') || undefined,
  };

  // Clean undefined values
  Object.keys(config).forEach(k => {
    if ((config as any)[k] === undefined) delete (config as any)[k];
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { (window as any).__ragleaf = new RagleafWidget(config); });
  } else {
    (window as any).__ragleaf = new RagleafWidget(config);
  }
})();

export { RagleafWidget };

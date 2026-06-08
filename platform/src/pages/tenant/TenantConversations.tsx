import { useEffect, useState, useRef } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';

interface ConversationSummary {
  id: string;
  agent_name: string;
  agent_id: number;
  session_id: string;
  message_count: number;
  status: string;
  started_at: string | null;
  last_message_at: string | null;
  first_message_preview: string | null;
}

interface Message {
  role: string;
  content: string;
  sources?: any[];
  model?: string;
  tokens?: number;
  response_time_ms?: number;
  created_at: string | null;
}

function getApiBase(): string {
  if (window.location.origin.includes('ragleaf.com')) return 'https://api.ragleaf.com';
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:1306`;
  }
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return 'http://cserver-2:1306';
}
const API_BASE = getApiBase();

const renderMarkdown = (content: string | null) => {
  if (!content) return '';
  
  // Normalize newlines and replace basic formatting (bold, italic, code, links)
  let html = content
    .replace(/\\n/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic opacity-90">$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-black/25 px-1 py-0.5 rounded text-xs font-mono text-emerald-400">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:underline">$1</a>');

  const lines = html.split('\n');
  let inList = false; // for unordered list -
  let inNumList = false; // for ordered list 1.
  let inTable = false; // for tables |
  let inCodeBlock = false; // for fenced code blocks ```
  let inBlockquote = false; // for blockquotes >

  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // 1. Fenced code block check
    if (trimmed.startsWith('```')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }

      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = trimmed.substring(3).trim();
        return `${prefix}<pre class="bg-black/30 p-2.5 rounded-lg border border-white/5 overflow-x-auto font-mono text-xs my-1 text-emerald-400"><code class="${lang}">`;
      } else {
        inCodeBlock = false;
        return '</code></pre>';
      }
    }

    // If inside a code block, just output the raw content encoded/escaped
    if (inCodeBlock) {
      return line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
    }

    // 2. Horizontal rule check
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
      return `${prefix}<hr class="border-t border-white/10 my-3"/>`;
    }

    // 3. Header check
    if (trimmed.startsWith('#')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }
      
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const title = trimmed.replace(/^#+\s*/, '');
      if (level === 1) {
        return `${prefix}<h1 class="text-base font-bold mt-2 mb-1 text-white">${title}</h1>`;
      } else if (level === 2) {
        return `${prefix}<h2 class="text-sm font-bold mt-2 mb-1 text-white border-b border-white/5 pb-0.5">${title}</h2>`;
      } else {
        return `${prefix}<h3 class="text-xs font-bold mt-2 mb-1 text-white">${title}</h3>`;
      }
    }

    // 4. Table check
    if (trimmed.startsWith('|')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inBlockquote) { inBlockquote = false; prefix += '</blockquote>'; }

      const isSeparator = /^[|:\s-]+$/.test(trimmed);
      if (isSeparator) {
        return ''; // skip separator lines
      }

      const cells = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      if (!inTable) {
        inTable = true;
        const headerCols = cells.map(c => `<th class="border border-white/10 bg-white/5 px-3 py-2 text-left font-semibold text-white">${c}</th>`).join('');
        return `${prefix}<div class="overflow-x-auto my-3"><table class="min-w-full border-collapse border border-white/10 text-xs"><thead><tr>${headerCols}</tr></thead><tbody>`;
      } else {
        const rowCols = cells.map(c => `<td class="border border-white/10 px-3 py-1.5">${c}</td>`).join('');
        return `<tr>${rowCols}</tr>`;
      }
    }

    // 5. Blockquote check
    if (trimmed.startsWith('>')) {
      let prefix = '';
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const quoteContent = trimmed.replace(/^>\s*/, '');
      if (!inBlockquote) {
        inBlockquote = true;
        return `${prefix}<blockquote class="border-l-2 border-primary-500 bg-white/5 px-3 py-1.5 italic text-gray-300 my-1 rounded-r">${quoteContent}`;
      } else {
        return `<br/>${quoteContent}`;
      }
    }

    // Close any open blockquote if current line isn't one
    let closingPrefix = '';
    if (inBlockquote) {
      inBlockquote = false;
      closingPrefix = '</blockquote>';
    }

    // 6. Unordered list check
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      let prefix = closingPrefix;
      if (inNumList) { inNumList = false; prefix += '</ol>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const contentStr = trimmed.substring(2);
      if (!inList) {
        inList = true;
        prefix += '<ul class="list-disc pl-4 my-1 space-y-0.5">';
      }
      return `${prefix}<li>${contentStr}</li>`;
    }

    // 7. Numbered list check
    const numListMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numListMatch) {
      let prefix = closingPrefix;
      if (inList) { inList = false; prefix += '</ul>'; }
      if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

      const contentStr = numListMatch[2];
      if (!inNumList) {
        inNumList = true;
        prefix += '<ol class="list-decimal pl-4 my-1 space-y-0.5">';
      }
      return `${prefix}<li>${contentStr}</li>`;
    }

    // Regular line formatting
    let prefix = closingPrefix;
    if (inList) { inList = false; prefix += '</ul>'; }
    if (inNumList) { inNumList = false; prefix += '</ol>'; }
    if (inTable) { inTable = false; prefix += '</tbody></table></div>'; }

    return `${prefix}${line}<br/>`;
  });

  // Final cleanup for open tags
  let finalHtml = processedLines.join('');
  if (inCodeBlock) finalHtml += '</code></pre>';
  if (inTable) finalHtml += '</tbody></table></div>';
  if (inList) finalHtml += '</ul>';
  if (inNumList) finalHtml += '</ol>';
  if (inBlockquote) finalHtml += '</blockquote>';

  return finalHtml;
};

async function fetchAPI<T>(path: string): Promise<T> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantConversations() {
  const { t, language } = useTranslation();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAPI<ConversationSummary[]>('/api/org/conversations?limit=100')
      .then(setConversations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadMessages = async (sessionId: string) => {
    setSelectedSession(sessionId);
    setMessagesLoading(true);
    try {
      const data = await fetchAPI<{ messages: Message[] }>(`/api/org/conversations/${sessionId}/messages`);
      setMessages(data.messages || []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      console.error(e);
    } finally {
      setMessagesLoading(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-100 mb-1">
        <span className="text-primary-500">AI</span>chat / {language === 'tr' ? 'Konuşmalar' : 'Conversations'}
      </h1>
      <p className="text-gray-500 mb-6">{t('conv.subtitle')}</p>

      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Conversation List */}
        <div className="w-96 flex-shrink-0 bg-dark-800/60 rounded-xl  border border-white/[0.06] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-dark-700/50">
            <span className="text-sm font-medium text-gray-400">
              {t('conv.count_suffix').replace('{count}', String(conversations.length))}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p className="text-3xl mb-2">💬</p>
                <p>{t('conv.no_conversations')}</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.session_id)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.06] hover:bg-dark-700/50 transition ${
                    selectedSession === conv.session_id ? 'bg-primary-500/10 border-l-4 border-l-primary-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-100 truncate">{conv.agent_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      conv.status === 'active' ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20' : 'bg-dark-600 text-gray-400'
                    }`}>{conv.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{conv.first_message_preview || t('conv.no_preview')}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">{formatDate(conv.started_at)}</span>
                    <span className="text-xs text-gray-400">
                      {t('conv.messages_count').replace('{count}', String(conv.message_count))}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message View */}
        <div className="flex-1 bg-dark-800/60 rounded-xl  border border-white/[0.06] flex flex-col overflow-hidden">
          {!selectedSession ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-5xl mb-3">📨</p>
                <p>{t('conv.select_prompt')}</p>
              </div>
            </div>
          ) : messagesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-dark-700/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-dark-800/60 border border-white/[0.06] text-gray-200 rounded-bl-md'
                  }`}>
                    <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                      {formatDate(msg.created_at)}
                      {msg.tokens && ` · ${msg.tokens} ${language === 'tr' ? 'token' : 'tokens'}`}
                      {msg.response_time_ms && ` · ${msg.response_time_ms}ms`}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

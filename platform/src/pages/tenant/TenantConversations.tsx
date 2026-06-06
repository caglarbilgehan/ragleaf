import { useEffect, useState, useRef } from 'react';

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
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (window.location.origin.includes('ragleaf.com')) return 'https://api.ragleaf.com';
  return 'http://localhost:1306';
}
const API_BASE = getApiBase();

async function fetchAPI<T>(path: string): Promise<T> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantConversations() {
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
    return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
      <h1 className="text-2xl font-bold text-gray-100 mb-1">Konuşmalar</h1>
      <p className="text-gray-500 mb-6">Widget ve API üzerinden yapılan konuşma geçmişi</p>

      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Conversation List */}
        <div className="w-96 flex-shrink-0 bg-dark-800/60 rounded-xl  border border-white/[0.06] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-dark-700/50">
            <span className="text-sm font-medium text-gray-400">{conversations.length} konuşma</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p className="text-3xl mb-2">💬</p>
                <p>Henüz konuşma yok</p>
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
                  <div className="text-xs text-gray-500 truncate">{conv.first_message_preview || 'Mesaj yok'}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">{formatDate(conv.started_at)}</span>
                    <span className="text-xs text-gray-400">{conv.message_count} mesaj</span>
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
                <p>Bir konuşma seçin</p>
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
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                      {formatDate(msg.created_at)}
                      {msg.tokens && ` · ${msg.tokens} token`}
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

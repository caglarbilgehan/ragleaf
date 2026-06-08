import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface SearchResult {
  rank: number;
  content: string;
  score: number;
  source: string | null;
  chunk_index: number | null;
  metadata: Record<string, any>;
}

interface SearchResponse {
  query: string;
  query_embedding_preview: number[];
  search_mode: string;
  total_results: number;
  search_time_ms: number;
  results: SearchResult[];
}

interface Document {
  id: number;
  filename: string;
  chunk_count: number;
  created_at: string | null;
}

const SAMPLE_TEXT = `Zayıf akım sistemleri, modern binaların güvenlik, konfor ve enerji verimliliğini sağlayan görünmez altyapıyı oluşturur. Yüksek akım tesisatından farklı olarak, bu sistemlerde taşınan enerji değil bilgi ve kontrol sinyalleridir. Yangın algılama, acil anons, kartlı geçiş, kapalı devre kamera sistemleri (CCTV), aydınlatma ve HVAC otomasyonu, yapısal kablolama ve IP tabanlı iletişim altyapısı, zayıf akım şemsiyesi altında değerlendirilen başlıca alt sistemlerdir.

Yangın algılama sistemi, zayıf akım dünyasının en kritik bileşenlerinden biridir. Temel bileşenler; yangın santrali, adreslenebilir veya konvansiyonel algılama dedektörleri, butonlar, siren ve flaşörler, giriş–çıkış modülleri ve tekrarlama panelleridir. Adreslenebilir sistemlerde her dedektör veya saha elemanı, kendi başına bir adresle tanımlanır.

Dedektör tipleri, algılama prensibine göre duman, ısı, alev ve kombine dedektörler olarak sınıflandırılır. Optik duman dedektörleri, duman partiküllerinin ışığı dağıtma veya soğurma prensibine göre çalışır ve ofis, koridor gibi temiz hacimlerde yaygın olarak kullanılır.

Kartlı geçiş sistemi, bina güvenliğinin ve kullanıcı yönetiminin en önemli araçlarından biridir. Tipik bir erişim kontrol yapısında; kart okuyucu, kapı kontrol paneli, elektromanyetik kilit veya manyetik kilit karşılığı, kapı kontağı ve çıkış butonu gibi elemanlar bulunur.

CCTV sistemleri, hem caydırıcılık sağlar hem de olay sonrası tespit ve delil üretimi için vazgeçilmezdir. Güncel projelerde çoğunlukla IP tabanlı kameralar, PoE switch'ler, video kayıt sunucuları (NVR/VMS) ve izleme operatör istasyonları kullanılır.

HVAC otomasyonu, konfor ve enerji verimliliğinin kesiştiği noktadır. Merkezi otomasyon panelleri üzerinden kazan dairesi, chiller grupları, fan-coil üniteleri, taze hava santralleri ve ısı geri kazanım cihazları izlenip kontrol edilir.

Bina Yönetim Sistemi (BMS) veya bina otomasyon yazılımı, yangın algılama, kartlı geçiş, CCTV, HVAC ve aydınlatma otomasyonu gibi sistemlerden bilgi alarak merkezi bir arayüzde toplar.`;

const SearchTestPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'document' | 'sample'>('sample');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [topK, setTopK] = useState(5);
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(100);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const response = await api.get('/api/admin/embedding/search/documents');
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Lütfen bir arama sorgusu girin');
      return;
    }

    if (searchMode === 'document' && !selectedDocumentId) {
      toast.error('Lütfen bir doküman seçin');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<SearchResponse>('/api/admin/embedding/search/test', {
        query: query.trim(),
        search_mode: searchMode,
        document_id: searchMode === 'document' ? selectedDocumentId : null,
        sample_text: searchMode === 'sample' ? SAMPLE_TEXT : null,
        top_k: topK,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
      });

      setSearchResult(response.data);
      toast.success(`${response.data.total_results} sonuç bulundu (${response.data.search_time_ms}ms)`);
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.response?.data?.detail || 'Arama başarısız');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    if (score >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBarWidth = (score: number): string => {
    return `${Math.min(score * 100, 100)}%`;
  };

  const getScoreBarColor = (score: number): string => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    if (score >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-100">🔍 Embedding Search Test</h1>
          <p className="mt-2 text-gray-600">
            Embedding tabanlı semantik aramayı test edin - LLM kullanmadan vektör benzerliği ile arama
          </p>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">⚙️ Nasıl Çalışır?</h2>
          <div className="grid md:grid-cols-4 gap-4 text-sm text-blue-800">
            <div className="bg-dark-800/60/50 p-3 rounded">
              <div className="font-semibold mb-1">1. Sorgu Embedding</div>
              <p className="text-xs">Arama sorgunuz 768 boyutlu vektöre dönüştürülür</p>
            </div>
            <div className="bg-dark-800/60/50 p-3 rounded">
              <div className="font-semibold mb-1">2. Benzerlik Hesaplama</div>
              <p className="text-xs">Tüm chunk'larla kosinüs benzerliği hesaplanır</p>
            </div>
            <div className="bg-dark-800/60/50 p-3 rounded">
              <div className="font-semibold mb-1">3. Sıralama</div>
              <p className="text-xs">En yüksek skorlu chunk'lar sıralanır</p>
            </div>
            <div className="bg-dark-800/60/50 p-3 rounded">
              <div className="font-semibold mb-1">4. Sonuçlar</div>
              <p className="text-xs">Top-K sonuç skorlarıyla döndürülür</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Settings */}
          <div className="lg:col-span-1">
            <div className="bg-dark-800/60 rounded-lg shadow p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4">Arama Ayarları</h2>

              {/* Search Mode */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Arama Modu
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-dark-700/50 transition-colors">
                    <input
                      type="radio"
                      name="searchMode"
                      value="sample"
                      checked={searchMode === 'sample'}
                      onChange={() => setSearchMode('sample')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">📝 Örnek Metin</div>
                      <div className="text-xs text-gray-500">Zayıf akım sistemleri metni</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-dark-700/50 transition-colors">
                    <input
                      type="radio"
                      name="searchMode"
                      value="all"
                      checked={searchMode === 'all'}
                      onChange={() => setSearchMode('all')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">📚 Tüm Dokümanlar</div>
                      <div className="text-xs text-gray-500">VectorDB'deki tüm içerik</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-dark-700/50 transition-colors">
                    <input
                      type="radio"
                      name="searchMode"
                      value="document"
                      checked={searchMode === 'document'}
                      onChange={() => setSearchMode('document')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">📄 Belirli Doküman</div>
                      <div className="text-xs text-gray-500">Seçilen dokümanda ara</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Document Selection (if document mode) */}
              {searchMode === 'document' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Doküman Seçin
                  </label>
                  {loadingDocs ? (
                    <div className="text-sm text-gray-500">Yükleniyor...</div>
                  ) : documents.length === 0 ? (
                    <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded">
                      ⚠️ İşlenmiş doküman bulunamadı
                    </div>
                  ) : (
                    <select
                      value={selectedDocumentId || ''}
                      onChange={(e) => setSelectedDocumentId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seçin...</option>
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.filename} ({doc.chunk_count} chunk)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Sample mode settings */}
              {searchMode === 'sample' && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Chunk Boyutu: {chunkSize}
                    </label>
                    <input
                      type="range"
                      min="200"
                      max="1000"
                      step="50"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Overlap: {chunkOverlap}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="25"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Top K */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sonuç Sayısı: {topK}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Query Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Arama Sorgusu
                </label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Örn: Yangın dedektörü nasıl çalışır?"
                  className="w-full h-24 px-3 py-2 border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Aranıyor...
                  </>
                ) : (
                  <>🔍 Ara</>
                )}
              </button>

              {/* Example Queries */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Örnek sorgular:</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    'Yangın dedektörü',
                    'Kartlı geçiş sistemi',
                    'CCTV kamera',
                    'HVAC otomasyon',
                    'BMS nedir',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuery(q)}
                      className="text-xs bg-dark-600 hover:bg-dark-500 px-2 py-1 rounded"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            {searchResult ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-dark-800/60 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Arama Sonuçları</h2>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {searchResult.total_results} sonuç
                      </span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                        {searchResult.search_time_ms}ms
                      </span>
                    </div>
                  </div>

                  {/* Query Info */}
                  <div className="bg-dark-700/50 rounded-lg p-4 mb-4">
                    <div className="text-sm">
                      <span className="text-gray-500">Sorgu:</span>
                      <span className="ml-2 font-medium">"{searchResult.query}"</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Embedding önizleme: [{searchResult.query_embedding_preview.map(v => v.toFixed(3)).join(', ')}...]
                    </div>
                  </div>

                  {/* Score Legend */}
                  <div className="flex items-center gap-4 text-xs mb-4">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-green-500 rounded"></span>
                      Yüksek (≥0.8)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-yellow-500 rounded"></span>
                      Orta (0.6-0.8)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-orange-500 rounded"></span>
                      Düşük (0.4-0.6)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-red-500 rounded"></span>
                      Çok Düşük (&lt;0.4)
                    </span>
                  </div>
                </div>

                {/* Results List */}
                {searchResult.results.length === 0 ? (
                  <div className="bg-dark-800/60 rounded-lg shadow p-12 text-center">
                    <div className="text-gray-400 text-4xl mb-4">🔍</div>
                    <h3 className="text-lg font-medium text-gray-100 mb-2">Sonuç bulunamadı</h3>
                    <p className="text-gray-500">Farklı bir sorgu deneyin</p>
                  </div>
                ) : (
                  searchResult.results.map((result) => (
                    <div
                      key={result.rank}
                      className="bg-dark-800/60 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                            {result.rank}
                          </span>
                          <div>
                            <div className="font-medium text-gray-100">
                              {result.source || 'Bilinmeyen Kaynak'}
                            </div>
                            {result.chunk_index !== null && (
                              <div className="text-xs text-gray-500">
                                Chunk #{result.chunk_index + 1}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getScoreColor(result.score)}`}>
                            {(result.score * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">benzerlik</div>
                        </div>
                      </div>

                      {/* Score Bar */}
                      <div className="w-full bg-dark-500 rounded-full h-2 mb-4">
                        <div
                          className={`h-2 rounded-full ${getScoreBarColor(result.score)}`}
                          style={{ width: getScoreBarWidth(result.score) }}
                        />
                      </div>

                      {/* Content */}
                      <div className="text-sm text-gray-300 bg-dark-700/50 p-4 rounded-lg border-l-4 border-blue-500">
                        {result.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="bg-dark-800/60 rounded-lg shadow p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  Arama yapmaya hazır
                </h3>
                <p className="text-gray-500 mb-4">
                  Bir arama modu seçin, sorgu girin ve "Ara" butonuna tıklayın
                </p>
                <div className="text-sm text-gray-400">
                  💡 İpucu: Örnek metin modu VectorDB olmadan çalışır
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchTestPage;

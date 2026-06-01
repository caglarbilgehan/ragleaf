import React, { useState } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface QualityTestResult {
  text1: string;
  text2: string;
  expected: string;
  actual_similarity: number;
  passed: boolean;
  message: string;
}

interface QualityValidationResponse {
  model_id: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  overall_score: number;
  results: QualityTestResult[];
}

const QualityValidatorPage: React.FC = () => {
  const [modelId, setModelId] = useState('intfloat/multilingual-e5-base');
  const [validationResult, setValidationResult] = useState<QualityValidationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const availableModels = [
    { id: 'intfloat/multilingual-e5-base', name: 'Multilingual E5 Base (768D)', recommended: true },
    { id: 'intfloat/multilingual-e5-large', name: 'Multilingual E5 Large (1024D)' },
    { id: 'BAAI/bge-base-en-v1.5', name: 'BGE Base EN (768D)' },
    { id: 'BAAI/bge-m3', name: 'BGE M3 (1024D)' },
    { id: 'all-MiniLM-L6-v2', name: 'MiniLM L6 (384D)' },
  ];

  const handleValidate = async () => {
    setLoading(true);
    try {
      const response = await api.post<QualityValidationResponse>(
        '/api/admin/embedding/validate/quality',
        {
          model_id: modelId,
        }
      );

      setValidationResult(response.data);
      toast.success('Kalite validasyonu tamamlandı!');
    } catch (error: any) {
      console.error('Quality validation error:', error);
      toast.error(error.response?.data?.detail || 'Kalite validasyonu başarısız');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number): string => {
    if (score >= 90) return '⭐⭐⭐⭐⭐';
    if (score >= 80) return '⭐⭐⭐⭐';
    if (score >= 70) return '⭐⭐⭐';
    if (score >= 60) return '⭐⭐';
    return '⭐';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Embedding Kalite Validasyonu</h1>
          <p className="mt-2 text-gray-600">
            Embedding modelinizin kalitesini otomatik testlerle doğrulayın
          </p>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🔬</span> Bu Sayfa Ne İşe Yarar?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">📊 Amaç</h3>
              <p className="text-sm text-blue-700 mb-3">
                Embedding modeli, metinleri sayısal vektörlere dönüştürür. Bu sayfa, modelin 
                <strong> anlamsal benzerliği doğru tespit edip etmediğini</strong> test eder.
              </p>
              
              <h3 className="font-semibold text-blue-800 mb-2">⚙️ Nasıl Çalışır?</h3>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>İki metin seçilir (örn: "Makine öğrenmesi" ve "Machine learning")</li>
                <li>Her iki metin de vektöre dönüştürülür</li>
                <li>Vektörler arası <strong>kosinüs benzerliği</strong> hesaplanır (0-1 arası)</li>
                <li>Sonuç beklenen değerle karşılaştırılır</li>
              </ol>
            </div>
            
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">📈 Benzerlik Skorları</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p><span className="font-mono bg-green-100 px-1 rounded">&gt;0.80</span> → Çok benzer (aynı anlam)</p>
                <p><span className="font-mono bg-yellow-100 px-1 rounded">0.50-0.75</span> → Orta benzerlik (ilişkili konular)</p>
                <p><span className="font-mono bg-red-100 px-1 rounded">&lt;0.35</span> → Farklı (alakasız konular)</p>
              </div>
              
              <h3 className="font-semibold text-blue-800 mt-3 mb-2">✅ Başarı Kriterleri</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• "Yapay zeka" ↔ "Artificial intelligence" → <strong>&gt;0.80</strong> olmalı</li>
                <li>• "Elma meyve" ↔ "Bilgisayar donanım" → <strong>&lt;0.35</strong> olmalı</li>
                <li>• Genel skor <strong>%80+</strong> ideal</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Model Selection and Test */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Model Seçimi ve Test</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Edilecek Model
            </label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.recommended ? '(Önerilen)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">📋 Embedding Quality Test Kategorileri (30 Test):</h3>
            <div className="grid md:grid-cols-3 gap-3 text-sm text-gray-700">
              <div className="space-y-1">
                <p>🔥 <strong>Yangın Algılama (6):</strong></p>
                <p className="text-xs text-gray-500 ml-4">Dedektör, panel, alarm sistemleri</p>
                <p>🔒 <strong>Güvenlik Sistemleri (6):</strong></p>
                <p className="text-xs text-gray-500 ml-4">CCTV, kartlı geçiş, biyometrik</p>
              </div>
              <div className="space-y-1">
                <p>🏢 <strong>Bina Otomasyonu (6):</strong></p>
                <p className="text-xs text-gray-500 ml-4">BMS, HVAC, aydınlatma</p>
                <p>⚡ <strong>Zayıf Akım (4):</strong></p>
                <p className="text-xs text-gray-500 ml-4">Kablolama, fiber, UPS</p>
              </div>
              <div className="space-y-1">
                <p>🔄 <strong>İlişkili Sistemler (5):</strong></p>
                <p className="text-xs text-gray-500 ml-4">Farklı ama bağlantılı konular</p>
                <p>❌ <strong>Alakasız Konular (5):</strong></p>
                <p className="text-xs text-gray-500 ml-4">Sektör dışı metinler</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleValidate}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Validasyon yapılıyor...
              </span>
            ) : (
              'Kalite Validasyonu Başlat'
            )}
          </button>
        </div>

        {/* Validation Results */}
        {validationResult && (
          <>
            {/* Overall Score */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Genel Sonuç</h2>

              <div className="text-center py-6">
                <div className="text-6xl font-bold mb-2">
                  <span className={getScoreColor(validationResult.overall_score)}>
                    {validationResult.overall_score.toFixed(0)}
                  </span>
                  <span className="text-gray-400">/100</span>
                </div>
                <div className="text-3xl mb-4">{getScoreBadge(validationResult.overall_score)}</div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 font-medium">Toplam Test</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {validationResult.total_tests}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-medium">Başarılı</p>
                    <p className="text-3xl font-bold text-green-900">
                      {validationResult.passed_tests}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-red-600 font-medium">Başarısız</p>
                    <p className="text-3xl font-bold text-red-900">
                      {validationResult.failed_tests}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Detaylı Test Sonuçları</h2>

              <div className="space-y-4">
                {validationResult.results.map((result, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-2xl ${result.passed ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {result.passed ? '✓' : '✗'}
                          </span>
                          <span className="font-semibold text-gray-900">Test {index + 1}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Metin 1:</span>
                            <p className="font-medium text-gray-900">{result.text1}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Metin 2:</span>
                            <p className="font-medium text-gray-900">{result.text2}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm border-t pt-3 mt-3">
                      <div>
                        <span className="text-gray-600">Beklenen: </span>
                        <span className="font-medium">{result.expected}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Gerçek: </span>
                        <span className="font-bold">{result.actual_similarity.toFixed(3)}</span>
                      </div>
                      <div className={result.passed ? 'text-green-700' : 'text-red-700'}>
                        {result.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!validationResult && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz test yapılmadı</h3>
            <p className="text-gray-500">
              Bir model seçin ve "Kalite Validasyonu Başlat" butonuna tıklayın
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QualityValidatorPage;

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  RefreshCw,
  Search,
  Users,
  Zap
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface OverviewStats {
  today: {
    total_queries: number;
    success_rate: number;
    avg_duration_ms: number;
    unique_users: number;
  };
  week: {
    total_queries: number;
    success_rate: number;
    trend: string;
  };
  feedback: {
    likes: number;
    dislikes: number;
    satisfaction_rate: number;
  };
}

interface DocumentStats {
  top_documents: Array<{
    document_id: number;
    document_name: string;
    query_count: number;
    avg_score: number;
    last_used: string;
  }>;
  usage_trend: Array<{
    date: string;
    count: number;
  }>;
}

interface UnfoundQuery {
  query_text: string;
  count: number;
  last_asked: string;
  suggested_action: string;
  reasons: string[];
}

interface PerformanceMetrics {
  avg_total_duration_ms: number;
  avg_rag_duration_ms: number;
  avg_llm_duration_ms: number;
  avg_chunks_retrieved: number;
  avg_best_score: number;
  score_distribution: Record<string, number>;
  success_rate: number;
  total_queries: number;
}

const RAGAnalyticsPage: React.FC = () => {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [documents, setDocuments] = useState<DocumentStats | null>(null);
  const [unfound, setUnfound] = useState<{ unfound_queries: UnfoundQuery[]; total_unfound: number; unfound_rate: number } | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'unfound' | 'performance'>('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [overviewRes, docsRes, unfoundRes, perfRes] = await Promise.all([
        api.get('/admin/analytics/overview'),
        api.get('/admin/analytics/documents?period=30'),
        api.get('/admin/analytics/queries/unfound?limit=20'),
        api.get('/admin/analytics/performance?period=7'),
      ]);
      setOverview(overviewRes.data);
      setDocuments(docsRes.data);
      setUnfound(unfoundRes.data);
      setPerformance(perfRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Analitik verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RAG Analytics</h1>
          <p className="text-gray-600">RAG sisteminin kullanım ve performans analitiği</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Yenile
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b">
        {[
          { id: 'overview', label: 'Genel Bakış', icon: BarChart3 },
          { id: 'documents', label: 'Dökümanlar', icon: FileText },
          { id: 'unfound', label: 'Cevapsız Sorular', icon: AlertCircle },
          { id: 'performance', label: 'Performans', icon: Zap },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Bugün Sorgu</p>
                    <p className="text-2xl font-bold">{overview.today.total_queries}</p>
                  </div>
                  <Search className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Başarı: %{(overview.today.success_rate * 100).toFixed(0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Haftalık Sorgu</p>
                    <p className="text-2xl font-bold">{overview.week.total_queries}</p>
                  </div>
                  {overview.week.trend.startsWith('+') ? (
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <p className={`text-xs mt-2 ${overview.week.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {overview.week.trend} geçen haftaya göre
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Ort. Yanıt Süresi</p>
                    <p className="text-2xl font-bold">{(overview.today.avg_duration_ms / 1000).toFixed(1)}s</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Memnuniyet</p>
                    <p className="text-2xl font-bold">%{(overview.feedback.satisfaction_rate * 100).toFixed(0)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-600">{overview.feedback.likes}</span>
                    <ThumbsDown className="h-5 w-5 text-red-500 ml-2" />
                    <span className="text-sm text-red-600">{overview.feedback.dislikes}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage Trend Chart */}
          {documents && (
            <Card>
              <CardHeader>
                <CardTitle>Sorgu Trendi (Son 30 Gün)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end gap-1">
                  {documents.usage_trend.slice(-30).map((day, i) => {
                    const maxCount = Math.max(...documents.usage_trend.map(d => d.count), 1);
                    const height = (day.count / maxCount) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${day.date}: ${day.count} sorgu`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{documents.usage_trend[0]?.date}</span>
                  <span>{documents.usage_trend[documents.usage_trend.length - 1]?.date}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && documents && (
        <Card>
          <CardHeader>
            <CardTitle>En Çok Kullanılan Dökümanlar</CardTitle>
            <CardDescription>Son 30 günde RAG sorgularında en çok kullanılan dökümanlar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents.top_documents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Henüz veri yok</p>
              ) : (
                documents.top_documents.map((doc, i) => (
                  <div key={doc.document_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">#{i + 1}</span>
                      <div>
                        <p className="font-medium">{doc.document_name}</p>
                        <p className="text-sm text-gray-500">
                          Son kullanım: {doc.last_used ? new Date(doc.last_used).toLocaleDateString('tr-TR') : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{doc.query_count} sorgu</p>
                      <p className="text-sm text-gray-500">Ort. skor: %{(doc.avg_score * 100).toFixed(0)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unfound Queries Tab */}
      {activeTab === 'unfound' && unfound && (
        <div className="space-y-4">
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-10 w-10 text-yellow-600" />
                <div>
                  <p className="text-lg font-bold text-yellow-800">
                    {unfound.total_unfound} Cevapsız Sorgu
                  </p>
                  <p className="text-sm text-yellow-700">
                    Tüm sorguların %{(unfound.unfound_rate * 100).toFixed(1)}'i cevapsız kaldı
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cevapsız Kalan Sorular</CardTitle>
              <CardDescription>Bu sorular için döküman eklemeyi düşünün</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unfound.unfound_queries.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Tüm sorular cevaplanmış! 🎉</p>
                ) : (
                  unfound.unfound_queries.map((q, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{q.query_text}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {q.count} kez soruldu • Son: {q.last_asked ? new Date(q.last_asked).toLocaleDateString('tr-TR') : '-'}
                          </p>
                        </div>
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">
                          {q.count}x
                        </span>
                      </div>
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                        💡 {q.suggested_action}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && performance && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Toplam Yanıt Süresi</p>
                <p className="text-2xl font-bold">{(performance.avg_total_duration_ms / 1000).toFixed(2)}s</p>
                <div className="mt-2 text-xs text-gray-500">
                  <p>RAG: {(performance.avg_rag_duration_ms / 1000).toFixed(2)}s</p>
                  <p>LLM: {(performance.avg_llm_duration_ms / 1000).toFixed(2)}s</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Ort. Chunk Sayısı</p>
                <p className="text-2xl font-bold">{performance.avg_chunks_retrieved.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Ort. Skor: %{(performance.avg_best_score * 100).toFixed(0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Başarı Oranı</p>
                <p className="text-2xl font-bold">%{(performance.success_rate * 100).toFixed(0)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {performance.total_queries} sorgu (7 gün)
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Benzerlik Skoru Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(performance.score_distribution).map(([range, count]) => {
                  const total = Object.values(performance.score_distribution).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={range} className="flex items-center gap-2">
                      <span className="w-20 text-sm text-gray-600">{range}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div
                          className="bg-blue-500 h-4 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-16 text-sm text-gray-600 text-right">
                        {count} (%{percentage.toFixed(0)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RAGAnalyticsPage;

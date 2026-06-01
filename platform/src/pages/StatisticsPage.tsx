import { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  MessageSquare, Clock, Zap, TrendingUp, Calendar, 
  RefreshCw, AlertCircle, CheckCircle,
  Users, Database, Activity, Server, Cpu, BarChart3
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Get API base URL
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ragleaf.com';
};

// Fetch function for statistics
const fetchStatistics = async (endpoint: string) => {
  const token = localStorage.getItem('ragleaf_token');
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/admin${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B9D'];

export default function StatisticsPage() {
  const [selectedDays, setSelectedDays] = useState(7);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'timeline' | 'errors' | 'rag-fallbacks'>('overview');

  // Summary Statistics
  const { data: summaryStats, isLoading: summaryLoading, refetch: refetchSummary } = useQuery(
    ['statistics-summary', selectedDays], 
    () => fetchStatistics(`/statistics/summary?days=${selectedDays}`),
    { 
      refetchInterval: 30000,
      onError: (error: any) => {
        console.error('Summary stats error:', error);
      }
    }
  );

  // Performance Statistics
  const { data: performanceStats, isLoading: performanceLoading, refetch: refetchPerformance } = useQuery(
    ['statistics-performance', selectedDays], 
    () => fetchStatistics(`/statistics/performance?days=${selectedDays}`),
    { 
      refetchInterval: 30000,
      onError: (error: any) => {
        console.error('Performance stats error:', error);
      }
    }
  );

  // Timeline Statistics
  const { data: timelineStats, isLoading: timelineLoading, refetch: refetchTimeline } = useQuery(
    ['statistics-timeline', selectedDays], 
    () => fetchStatistics(`/statistics/timeline?days=${selectedDays}`),
    { 
      refetchInterval: 30000,
      onError: (error: any) => {
        console.error('Timeline stats error:', error);
      }
    }
  );

  // Error Statistics (from new error_logs table)
  const { data: errorStats, isLoading: errorLoading, refetch: refetchErrors } = useQuery(
    ['errors-stats', selectedDays], 
    () => fetchStatistics(`/errors/stats?days=${selectedDays}`),
    { 
      refetchInterval: 30000,
      onError: (error: any) => {
        console.error('Error stats error:', error);
      }
    }
  );

  // Error Logs List
  const { data: errorLogs, isLoading: errorLogsLoading, refetch: refetchErrorLogs } = useQuery(
    ['errors-list'], 
    () => fetchStatistics(`/errors?limit=20`),
    { 
      refetchInterval: 30000,
      onError: (error: any) => {
        console.error('Error logs error:', error);
      }
    }
  );

  // RAG Fallbacks - queries not found in documents
  const { data: ragFallbacks, isLoading: ragFallbacksLoading, refetch: refetchRagFallbacks } = useQuery(
    ['rag-fallbacks', selectedDays], 
    () => fetchStatistics(`/statistics/rag-fallbacks?days=${selectedDays}`),
    { 
      refetchInterval: 30000,
      onError: (error: any) => {
        console.error('RAG fallbacks error:', error);
      }
    }
  );

  const handleRefresh = () => {
    refetchSummary();
    refetchPerformance();
    refetchTimeline();
    refetchErrors();
    refetchRagFallbacks();
    toast.success('İstatistikler yenilendi');
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: {
    title: string;
    value: string | number;
    icon: any;
    color: string;
    subtitle?: string;
  }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İstatistikler</h1>
          <p className="text-gray-600">Sistem performansı ve kullanım metrikleri</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>Son 1 Gün</option>
            <option value={7}>Son 7 Gün</option>
            <option value={30}>Son 30 Gün</option>
            <option value={90}>Son 90 Gün</option>
          </select>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Genel Bakış', icon: BarChart3 },
            { id: 'performance', name: 'Performans', icon: Zap },
            { id: 'timeline', name: 'Zaman Çizelgesi', icon: Clock },
            { id: 'errors', name: 'Hatalar', icon: AlertCircle },
            { id: 'rag-fallbacks', name: 'Bulunamayan Sorgular', icon: Database }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {summaryLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Toplam İstek"
                  value={formatNumber(summaryStats?.total_requests || 0)}
                  icon={TrendingUp}
                  color="bg-blue-500"
                  subtitle={`Son ${selectedDays} gün`}
                />
                <StatCard
                  title="Ortalama Süre"
                  value={`${summaryStats?.avg_duration || 0}s`}
                  icon={Clock}
                  color="bg-yellow-500"
                  subtitle="Yanıt süresi"
                />
                <StatCard
                  title="Toplam Token"
                  value={formatNumber(summaryStats?.total_tokens || 0)}
                  icon={Zap}
                  color="bg-purple-500"
                  subtitle="İşlenen tokenler"
                />
                <StatCard
                  title="Başarı Oranı"
                  value={`${summaryStats?.success_rate || 0}%`}
                  icon={CheckCircle}
                  color="bg-emerald-500"
                  subtitle="API istekleri"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Mode */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Mod Bazında Kullanım</h3>
                  {summaryStats?.by_mode && Object.keys(summaryStats.by_mode).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(summaryStats.by_mode).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(summaryStats.by_mode).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Henüz veri yok</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* By Model */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Bazında Kullanım</h3>
                  {summaryStats?.by_model && Object.keys(summaryStats.by_model).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={Object.entries(summaryStats.by_model).map(([name, value]) => ({ name: name.split('/').pop(), value }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <Cpu className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Henüz veri yok</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {performanceLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Performance Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Operasyon Performansı</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Operasyon
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Çağrı Sayısı
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ortalama Süre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Toplam Süre
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {performanceStats?.operations && Object.keys(performanceStats.operations).length > 0 ? (
                        Object.entries(performanceStats.operations).map(([key, data]: [string, any]) => (
                          <tr key={key}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{key}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {data.count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {data.avg_duration}s
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {data.total_duration.toFixed(2)}s
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            Henüz veri yok
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {timelineLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Timeline Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">İstek Zaman Çizelgesi</h3>
                {timelineStats?.timeline && timelineStats.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={timelineStats.timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="requests" stroke="#3B82F6" name="İstekler" />
                      <Line type="monotone" dataKey="avg_duration" stroke="#10B981" name="Ort. Süre (s)" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Henüz veri yok</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Errors Tab */}
      {activeTab === 'errors' && (
        <div className="space-y-6">
          {errorLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Error Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  title="Toplam Hata"
                  value={errorStats?.total_errors || 0}
                  icon={AlertCircle}
                  color="bg-red-500"
                  subtitle={`Son ${selectedDays} gün`}
                />
                <StatCard
                  title="Çözülmemiş"
                  value={errorStats?.unresolved_count || 0}
                  icon={Clock}
                  color="bg-orange-500"
                  subtitle="Bekleyen hatalar"
                />
                <StatCard
                  title="LLM Hataları"
                  value={errorStats?.errors_by_type?.llm_request || 0}
                  icon={Zap}
                  color="bg-purple-500"
                  subtitle="API istekleri"
                />
                <StatCard
                  title="RAG Hataları"
                  value={errorStats?.errors_by_type?.rag_query || 0}
                  icon={Database}
                  color="bg-blue-500"
                  subtitle="Sorgu hataları"
                />
              </div>

              {/* Error Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Provider */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider'a Göre Hatalar</h3>
                  {errorStats?.errors_by_provider && Object.keys(errorStats.errors_by_provider).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(errorStats.errors_by_provider).map(([provider, count]: [string, any]) => (
                        <div key={provider} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{provider}</span>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Veri yok</p>
                  )}
                </div>

                {/* By Model */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Model'e Göre Hatalar</h3>
                  {errorStats?.errors_by_model && Object.keys(errorStats.errors_by_model).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(errorStats.errors_by_model).map(([model, count]: [string, any]) => (
                        <div key={model} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 truncate max-w-[200px]" title={model}>{model}</span>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Veri yok</p>
                  )}
                </div>
              </div>

              {/* Recent Error Logs */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Son Hata Logları</h3>
                  <button
                    onClick={() => refetchErrorLogs()}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Yenile
                  </button>
                </div>
                <div className="overflow-x-auto">
                  {errorLogsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : errorLogs?.errors && errorLogs.errors.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zaman</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tür</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model/Provider</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hata Mesajı</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {errorLogs.errors.map((error: any) => (
                          <tr key={error.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {error.timestamp ? new Date(error.timestamp).toLocaleString('tr-TR') : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                error.error_type === 'llm_request' ? 'bg-purple-100 text-purple-800' :
                                error.error_type === 'rag_query' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {error.error_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              <div>{error.model_name || '-'}</div>
                              <div className="text-xs text-gray-500">{error.provider_name || ''}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                              <p className="truncate" title={error.error_message}>
                                {error.error_message?.substring(0, 100)}
                                {error.error_message?.length > 100 ? '...' : ''}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {error.is_resolved ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  Çözüldü
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                  Bekliyor
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                        <p>Harika! Hiç hata yok</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* RAG Fallbacks Tab */}
      {activeTab === 'rag-fallbacks' && (
        <div className="space-y-6">
          {ragFallbacksLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  title="Bilgi Bulunamadı"
                  value={ragFallbacks?.summary?.total_unfound || 0}
                  icon={Database}
                  color="bg-amber-500"
                  subtitle="Chunk bulundu ama yeterli değil"
                />
                <StatCard
                  title="Gerçek Fallback"
                  value={ragFallbacks?.summary?.total_fallbacks || 0}
                  icon={AlertCircle}
                  color="bg-red-500"
                  subtitle="Score düşük, chat moduna geçildi"
                />
                <StatCard
                  title="Toplam RAG İsteği"
                  value={ragFallbacks?.summary?.total_rag_requests || 0}
                  icon={MessageSquare}
                  color="bg-blue-500"
                  subtitle={`Son ${selectedDays} gün`}
                />
                <StatCard
                  title="Sorun Oranı"
                  value={`${ragFallbacks?.summary?.issue_rate || 0}%`}
                  icon={AlertCircle}
                  color={ragFallbacks?.summary?.issue_rate > 30 ? "bg-red-500" : "bg-green-500"}
                  subtitle="Bulunamayan + Fallback"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">İki Tür Sorun</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1 list-disc list-inside">
                      <li><strong>Bilgi Bulunamadı (Unfound):</strong> Chunk bulundu ama LLM istenen bilgiyi çıkaramadı</li>
                      <li><strong>Gerçek Fallback:</strong> Benzerlik skoru çok düşük, chat moduna geçildi</li>
                    </ul>
                    <p className="text-sm text-blue-700 mt-2">
                      Yüksek "Bulunamadı" oranı doküman kalitesini, yüksek "Fallback" oranı doküman eksikliğini gösterir.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fallback List */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Son Bulunamayan Sorgular</h3>
                </div>
                <div className="overflow-x-auto">
                  {ragFallbacks?.fallbacks?.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorgu</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Neden</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Süre</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {ragFallbacks.fallbacks.map((fallback: any) => (
                          <tr key={fallback.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {fallback.timestamp ? new Date(fallback.timestamp).toLocaleString('tr-TR') : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {fallback.type === 'unfound' ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                                  Bulunamadı
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                  Fallback
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                              <p className="truncate" title={fallback.query}>
                                {fallback.query ? (
                                  <>
                                    {fallback.query.substring(0, 80)}
                                    {fallback.query.length > 80 ? '...' : ''}
                                  </>
                                ) : (
                                  <span className="text-gray-400 italic">Sorgu kaydedilmemiş</span>
                                )}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 max-w-sm">
                              <p className="text-xs text-gray-600">
                                {fallback.reason || 'Bilinmiyor'}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {fallback.duration}s
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                        <p>Harika! Tüm RAG sorguları dokümanlarda bulundu</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

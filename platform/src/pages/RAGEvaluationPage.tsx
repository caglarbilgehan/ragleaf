import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  FlaskConical,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface TestSet {
  id: number;
  name: string;
  description: string;
  category: string;
  question_count: number;
  run_count: number;
  created_at: string;
}

interface Question {
  id: number;
  question: string;
  expected_answer: string;
  reference_doc_ids: number[];
}

interface EvaluationRun {
  id: number;
  test_set_id: number;
  test_set_name: string;
  status: string;
  overall_score: number;
  avg_faithfulness: number;
  avg_relevancy: number;
  avg_precision: number;
  avg_recall: number;
  total_questions: number;
  completed_questions: number;
  created_at: string;
  completed_at: string;
}

interface RunResult {
  question_id: number;
  question: string;
  expected_answer: string;
  rag_answer: string;
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
  duration_ms: number;
}

const RAGEvaluationPage: React.FC = () => {
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [selectedTestSet, setSelectedTestSet] = useState<TestSet | null>(null);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);
  const [runResults, setRunResults] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'test-sets' | 'runs' | 'results'>('test-sets');
  
  // New test set form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTestSet, setNewTestSet] = useState({ name: '', description: '', category: '' });
  const [newQuestion, setNewQuestion] = useState({ question: '', expected_answer: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [testSetsRes, runsRes] = await Promise.all([
        api.get('/admin/evaluation/test-sets'),
        api.get('/admin/evaluation/runs'),
      ]);
      setTestSets(testSetsRes.data);
      setRuns(runsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const createTestSet = async () => {
    if (!newTestSet.name) {
      toast.error('Test seti adı gerekli');
      return;
    }
    try {
      await api.post('/admin/evaluation/test-sets', newTestSet);
      toast.success('Test seti oluşturuldu');
      setShowNewForm(false);
      setNewTestSet({ name: '', description: '', category: '' });
      fetchData();
    } catch (error) {
      toast.error('Test seti oluşturulamadı');
    }
  };

  const deleteTestSet = async (id: number) => {
    if (!confirm('Bu test setini silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/admin/evaluation/test-sets/${id}`);
      toast.success('Test seti silindi');
      fetchData();
    } catch (error) {
      toast.error('Test seti silinemedi');
    }
  };

  const loadTestSetDetails = async (testSet: TestSet) => {
    try {
      const res = await api.get(`/admin/evaluation/test-sets/${testSet.id}`);
      setSelectedTestSet(res.data);
    } catch (error) {
      toast.error('Test seti detayları yüklenemedi');
    }
  };

  const addQuestion = async () => {
    if (!selectedTestSet || !newQuestion.question) {
      toast.error('Soru metni gerekli');
      return;
    }
    try {
      await api.post(`/admin/evaluation/test-sets/${selectedTestSet.id}/questions`, newQuestion);
      toast.success('Soru eklendi');
      setNewQuestion({ question: '', expected_answer: '' });
      loadTestSetDetails(selectedTestSet);
    } catch (error) {
      toast.error('Soru eklenemedi');
    }
  };

  const deleteQuestion = async (questionId: number) => {
    try {
      await api.delete(`/admin/evaluation/questions/${questionId}`);
      toast.success('Soru silindi');
      if (selectedTestSet) loadTestSetDetails(selectedTestSet);
    } catch (error) {
      toast.error('Soru silinemedi');
    }
  };

  const runEvaluation = async (testSetId: number) => {
    try {
      setRunning(true);
      toast.loading('Değerlendirme çalıştırılıyor...', { id: 'eval' });
      const res = await api.post('/admin/evaluation/run', { test_set_id: testSetId });
      toast.success(`Değerlendirme tamamlandı! Skor: ${(res.data.overall_score * 100).toFixed(0)}%`, { id: 'eval' });
      fetchData();
      setActiveTab('runs');
    } catch (error) {
      toast.error('Değerlendirme başarısız', { id: 'eval' });
    } finally {
      setRunning(false);
    }
  };

  const loadRunResults = async (run: EvaluationRun) => {
    try {
      const res = await api.get(`/admin/evaluation/runs/${run.id}`);
      setSelectedRun(res.data);
      setRunResults(res.data.results || []);
      setActiveTab('results');
    } catch (error) {
      toast.error('Sonuçlar yüklenemedi');
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-100';
    if (score >= 0.8) return 'bg-green-100';
    if (score >= 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
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
          <h1 className="text-2xl font-bold text-gray-900">RAG Kalite Değerlendirmesi</h1>
          <p className="text-gray-600">Test setleri oluşturun ve RAG kalitesini ölçün</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Yenile
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b">
        {[
          { id: 'test-sets', label: 'Test Setleri', icon: FileText },
          { id: 'runs', label: 'Çalıştırmalar', icon: Play },
          { id: 'results', label: 'Sonuçlar', icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Test Sets Tab */}
      {activeTab === 'test-sets' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Test Setleri</h2>
            <Button onClick={() => setShowNewForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Yeni Test Seti
            </Button>
          </div>

          {showNewForm && (
            <Card>
              <CardHeader>
                <CardTitle>Yeni Test Seti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Ad</Label>
                  <Input
                    value={newTestSet.name}
                    onChange={(e) => setNewTestSet({ ...newTestSet, name: e.target.value })}
                    placeholder="Yangın Sistemleri Testi"
                  />
                </div>
                <div>
                  <Label>Açıklama</Label>
                  <Input
                    value={newTestSet.description}
                    onChange={(e) => setNewTestSet({ ...newTestSet, description: e.target.value })}
                    placeholder="Yangın algılama sistemleri hakkında sorular"
                  />
                </div>
                <div>
                  <Label>Kategori</Label>
                  <Input
                    value={newTestSet.category}
                    onChange={(e) => setNewTestSet({ ...newTestSet, category: e.target.value })}
                    placeholder="technical"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={createTestSet}>Oluştur</Button>
                  <Button variant="outline" onClick={() => setShowNewForm(false)}>İptal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testSets.map((ts) => (
              <Card key={ts.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{ts.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTestSet(ts.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>{ts.description || 'Açıklama yok'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-gray-500 mb-4">
                    <span>{ts.question_count} soru</span>
                    <span>{ts.run_count} çalıştırma</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadTestSetDetails(ts)}
                    >
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => runEvaluation(ts.id)}
                      disabled={running || ts.question_count === 0}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" />
                      Çalıştır
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected Test Set Details */}
          {selectedTestSet && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{selectedTestSet.name} - Sorular</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Question Form */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <Label>Yeni Soru Ekle</Label>
                  <Input
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    placeholder="Soru metni..."
                  />
                  <Input
                    value={newQuestion.expected_answer}
                    onChange={(e) => setNewQuestion({ ...newQuestion, expected_answer: e.target.value })}
                    placeholder="Beklenen cevap (opsiyonel)..."
                  />
                  <Button onClick={addQuestion} size="sm">Soru Ekle</Button>
                </div>

                {/* Questions List */}
                <div className="space-y-2">
                  {(selectedTestSet as any).questions?.map((q: Question) => (
                    <div key={q.id} className="p-3 border rounded-lg flex justify-between items-start">
                      <div>
                        <p className="font-medium">{q.question}</p>
                        {q.expected_answer && (
                          <p className="text-sm text-gray-500 mt-1">Beklenen: {q.expected_answer}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteQuestion(q.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Runs Tab */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Değerlendirme Çalıştırmaları</h2>
          
          {runs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Henüz çalıştırma yok</p>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => (
                <Card key={run.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => loadRunResults(run)}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{run.test_set_name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(run.created_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {run.status === 'completed' ? (
                          <div className={`text-2xl font-bold ${getScoreColor(run.overall_score)}`}>
                            %{((run.overall_score || 0) * 100).toFixed(0)}
                          </div>
                        ) : run.status === 'running' ? (
                          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-500" />
                        )}
                      </div>
                    </div>
                    
                    {run.status === 'completed' && (
                      <div className="grid grid-cols-4 gap-4 mt-4">
                        <div className={`p-2 rounded ${getScoreBg(run.avg_faithfulness)}`}>
                          <p className="text-xs text-gray-500">Faithfulness</p>
                          <p className={`font-bold ${getScoreColor(run.avg_faithfulness)}`}>
                            %{((run.avg_faithfulness || 0) * 100).toFixed(0)}
                          </p>
                        </div>
                        <div className={`p-2 rounded ${getScoreBg(run.avg_relevancy)}`}>
                          <p className="text-xs text-gray-500">Relevancy</p>
                          <p className={`font-bold ${getScoreColor(run.avg_relevancy)}`}>
                            %{((run.avg_relevancy || 0) * 100).toFixed(0)}
                          </p>
                        </div>
                        <div className={`p-2 rounded ${getScoreBg(run.avg_precision)}`}>
                          <p className="text-xs text-gray-500">Precision</p>
                          <p className={`font-bold ${getScoreColor(run.avg_precision)}`}>
                            %{((run.avg_precision || 0) * 100).toFixed(0)}
                          </p>
                        </div>
                        <div className={`p-2 rounded ${getScoreBg(run.avg_recall)}`}>
                          <p className="text-xs text-gray-500">Recall</p>
                          <p className={`font-bold ${getScoreColor(run.avg_recall)}`}>
                            {run.avg_recall !== null ? `%${(run.avg_recall * 100).toFixed(0)}` : '-'}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && selectedRun && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {(selectedRun as any).test_set_name} - Sonuçlar
            </h2>
            <Button variant="outline" onClick={() => setActiveTab('runs')}>
              Geri
            </Button>
          </div>

          {/* Score Summary */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Genel', value: (selectedRun as any).scores?.overall },
              { label: 'Faithfulness', value: (selectedRun as any).scores?.faithfulness },
              { label: 'Relevancy', value: (selectedRun as any).scores?.relevancy },
              { label: 'Precision', value: (selectedRun as any).scores?.precision },
              { label: 'Recall', value: (selectedRun as any).scores?.recall },
            ].map((metric) => (
              <Card key={metric.label} className={getScoreBg(metric.value)}>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-600">{metric.label}</p>
                  <p className={`text-2xl font-bold ${getScoreColor(metric.value)}`}>
                    {metric.value !== null ? `%${(metric.value * 100).toFixed(0)}` : '-'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Individual Results */}
          <Card>
            <CardHeader>
              <CardTitle>Soru Bazlı Sonuçlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {runResults.map((result, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">{result.question}</p>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${getScoreBg(result.faithfulness)} ${getScoreColor(result.faithfulness)}`}>
                          F: %{((result.faithfulness || 0) * 100).toFixed(0)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${getScoreBg(result.answer_relevancy)} ${getScoreColor(result.answer_relevancy)}`}>
                          R: %{((result.answer_relevancy || 0) * 100).toFixed(0)}
                        </span>
                      </div>
                    </div>
                    {result.expected_answer && (
                      <p className="text-sm text-gray-500 mb-2">
                        <strong>Beklenen:</strong> {result.expected_answer}
                      </p>
                    )}
                    <p className="text-sm bg-gray-50 p-2 rounded">
                      <strong>RAG Yanıtı:</strong> {result.rag_answer}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Süre: {result.duration_ms}ms
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RAGEvaluationPage;

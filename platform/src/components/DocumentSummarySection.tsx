import { useState } from 'react';
import { FileText, RefreshCw, Trash2, Sparkles, Copy, Check } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { getApiBaseUrl } from '@/services/api';
import toast from 'react-hot-toast';

interface DocumentSummarySectionProps {
  documentId: number;
  documentName: string;
}

interface SummaryData {
  document_id: number;
  document_name?: string;
  summary?: string;
  generated_at?: string;
  has_summary: boolean;
  success: boolean;
  error?: string;
  cached?: boolean;
  model?: string;
  provider?: string;
}

export default function DocumentSummarySection({ documentId, documentName }: DocumentSummarySectionProps) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const token = localStorage.getItem('ragleaf_token');

  // Fetch existing summary
  const { data: summaryData, isLoading, refetch } = useQuery<SummaryData>(
    ['document-summary', documentId],
    async () => {
      const response = await fetch(
        `${getApiBaseUrl()}/api/documents/${documentId}/summary`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) {
        if (response.status === 404) {
          return { document_id: documentId, has_summary: false, success: true };
        }
        throw new Error('Özet alınamadı');
      }
      return response.json();
    },
    {
      retry: false,
      staleTime: 30000
    }
  );

  // Generate summary mutation
  const generateMutation = useMutation(
    async (forceRegenerate: boolean = false) => {
      const response = await fetch(
        `${getApiBaseUrl()}/api/documents/${documentId}/summary/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ force_regenerate: forceRegenerate })
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Özet oluşturulamadı');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        toast.success('Özet oluşturuldu!');
        refetch();
      },
      onError: (error: Error) => {
        toast.error(error.message);
      }
    }
  );

  // Delete summary mutation
  const deleteMutation = useMutation(
    async () => {
      const response = await fetch(
        `${getApiBaseUrl()}/api/documents/${documentId}/summary`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) {
        throw new Error('Özet silinemedi');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        toast.success('Özet silindi');
        refetch();
      },
      onError: (error: Error) => {
        toast.error(error.message);
      }
    }
  );

  const handleCopy = () => {
    if (summaryData?.summary) {
      navigator.clipboard.writeText(summaryData.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Özet kopyalandı');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-dark-700/50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-dark-500 rounded w-1/4 mb-3"></div>
        <div className="h-20 bg-dark-500 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h4 className="font-medium text-purple-900">AI Döküman Özeti</h4>
        </div>
        <div className="flex items-center gap-2">
          {summaryData?.has_summary && (
            <>
              <button
                onClick={handleCopy}
                className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors"
                title="Kopyala"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={() => generateMutation.mutate(true)}
                disabled={generateMutation.isLoading}
                className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors disabled:opacity-50"
                title="Yeniden Oluştur"
              >
                <RefreshCw className={`h-4 w-4 ${generateMutation.isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isLoading}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                title="Özeti Sil"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {summaryData?.has_summary ? (
        <div className="space-y-3">
          <div className="bg-dark-800/60 rounded-lg p-4 border border-purple-100 max-h-48 overflow-y-auto">
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {summaryData.summary}
            </p>
          </div>
          {summaryData.generated_at && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Oluşturulma: {new Date(summaryData.generated_at).toLocaleString('tr-TR')}
              </span>
              {summaryData.model && (
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  {summaryData.model}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <FileText className="h-10 w-10 mx-auto mb-3 text-purple-300" />
          <p className="text-sm text-gray-600 mb-4">
            Bu döküman için henüz özet oluşturulmamış.
          </p>
          <button
            onClick={() => generateMutation.mutate(false)}
            disabled={generateMutation.isLoading}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {generateMutation.isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI ile Özet Oluştur
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

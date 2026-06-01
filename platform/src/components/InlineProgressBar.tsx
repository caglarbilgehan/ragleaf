import React, { useEffect, useState, useRef } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { getApiBaseUrl } from '@/services/api';

interface InlineProgressBarProps {
  documentId: number;
  operation: 'processing' | 'indexing';
  onComplete?: () => void;
  onError?: (error: string) => void;
  onOpenModal?: () => void;
}

interface ProgressData {
  progress: number;
  stage: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
}

const InlineProgressBar: React.FC<InlineProgressBarProps> = ({
  documentId,
  operation,
  onComplete,
  onError,
  onOpenModal,
}) => {
  const [progressData, setProgressData] = useState<ProgressData>({
    progress: 0,
    stage: operation === 'processing' ? 'İşleniyor...' : 'İndeksleniyor...',
    status: 'running',
  });
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('ragleaf_token');
    
    const fetchProgress = async () => {
      if (completedRef.current) return;
      
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/admin/documents/${documentId}/progress`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        
        const data = await response.json();
        
        // Map backend status to our status
        let status: 'running' | 'completed' | 'error' = 'running';
        if (data.status === 'processed' || data.status === 'indexed' || data.status === 'enriched') {
          status = 'completed';
        } else if (data.status === 'error' || data.status === 'failed') {
          status = 'error';
        }
        
        setProgressData({
          progress: data.processing_progress || 0,
          stage: data.processing_details || data.processing_stage || progressData.stage,
          status: status,
          error: data.error,
        });

        if (status === 'completed') {
          completedRef.current = true;
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          if (onComplete) {
            setTimeout(onComplete, 1000);
          }
        } else if (status === 'error') {
          completedRef.current = true;
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          if (onError) {
            onError(data.error || 'Unknown error');
          }
        }
      } catch (err) {
        console.error('Progress fetch error:', err);
        // Don't stop polling on temporary errors
      }
    };

    // Initial fetch
    fetchProgress();
    
    // Start polling every 1 second
    pollingRef.current = setInterval(fetchProgress, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [documentId, operation, onComplete, onError]);

  if (progressData.status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">Tamamlandı</span>
      </div>
    );
  }

  if (progressData.status === 'error') {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{progressData.error || 'Hata oluştu'}</span>
      </div>
    );
  }

  return (
    <div 
      className="w-full max-w-md cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onOpenModal}
      title="Detayları görmek için tıklayın"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 truncate max-w-[150px]">{progressData.stage}</span>
        <span className="text-xs text-gray-500">{Math.round(progressData.progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressData.progress}%` }}
        />
      </div>
    </div>
  );
};

export default InlineProgressBar;

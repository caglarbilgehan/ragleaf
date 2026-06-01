import { useEffect, useState } from 'react';
import { ProgressUpdate } from '../types';

/**
 * Hook for tracking operation progress via SSE
 * 
 * @param operationId - The operation ID to track
 * @returns Progress state and connection status
 */
export function useOperationProgress(operationId: string | null) {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!operationId) {
      setProgress(null);
      setIsConnected(false);
      setError(null);
      return;
    }

    let eventSource: EventSource | null = null;

    try {
      // Connect to SSE endpoint
      eventSource = new EventSource(
        `/api/admin/operations/${operationId}/progress`,
        { withCredentials: true }
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ProgressUpdate = JSON.parse(event.data);
          setProgress(data);

          // Close connection if completed or error
          if (data.stage === 'completed' || data.stage === 'error') {
            eventSource?.close();
            setIsConnected(false);
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err);
          setError('İlerleme verisi alınamadı');
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        setError('Bağlantı hatası');
        setIsConnected(false);
        eventSource?.close();
      };
    } catch (err) {
      console.error('Failed to create SSE connection:', err);
      setError('Bağlantı kurulamadı');
    }

    return () => {
      eventSource?.close();
      setIsConnected(false);
    };
  }, [operationId]);

  return {
    progress,
    isConnected,
    error,
    isCompleted: progress?.stage === 'completed',
    isError: progress?.stage === 'error',
    isProcessing: progress && !['completed', 'error'].includes(progress.stage)
  };
}

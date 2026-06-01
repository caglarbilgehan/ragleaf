// platform/src/hooks/useDocumentProgressSSE.ts
import { useState, useEffect, useCallback, useRef } from 'react';

export interface ProgressLog {
  timestamp: string;
  level: string;
  stage: string;
  progress: number;
  message: string;
}

export interface DocumentProgress {
  type: 'progress' | 'complete' | 'error' | 'cancelled' | 'timeout';
  document_id: number;
  status: string;
  stage: string;
  progress: number;
  details: string;
  logs: ProgressLog[];
  is_processing: boolean;
  total_chunks?: number;
  total_pages?: number;
  error?: string;
}

interface UseDocumentProgressSSEOptions {
  onComplete?: (data: DocumentProgress) => void;
  onError?: (error: string) => void;
  autoReconnect?: boolean;
}

export function useDocumentProgressSSE(
  documentId: number | null,
  options: UseDocumentProgressSSEOptions = {}
) {
  const [progress, setProgress] = useState<DocumentProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { onComplete, onError, autoReconnect = true } = options;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!documentId) return;

    // Close existing connection
    disconnect();

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const url = `${apiUrl}/admin/documents/${documentId}/progress/stream`;

    console.log('📡 Connecting to SSE:', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ SSE connection opened');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: DocumentProgress = JSON.parse(event.data);
        console.log('📊 SSE data:', data);
        setProgress(data);

        // Handle completion
        if (data.type === 'complete') {
          onComplete?.(data);
          disconnect();
        }

        // Handle error
        if (data.type === 'error') {
          setError(data.error || 'Processing error');
          onError?.(data.error || 'Processing error');
          disconnect();
        }

        // Handle cancellation
        if (data.type === 'cancelled') {
          disconnect();
        }

        // Handle timeout
        if (data.type === 'timeout') {
          setError('Progress tracking timed out');
          disconnect();
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.error('❌ SSE error:', e);
      setIsConnected(false);
      
      // Auto reconnect after 2 seconds
      if (autoReconnect && eventSourceRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Reconnecting SSE...');
          connect();
        }, 2000);
      }
    };
  }, [documentId, disconnect, onComplete, onError, autoReconnect]);

  // Connect when documentId changes
  useEffect(() => {
    if (documentId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [documentId, connect, disconnect]);

  return {
    progress,
    isConnected,
    error,
    connect,
    disconnect
  };
}

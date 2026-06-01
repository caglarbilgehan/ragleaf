// platform/src/components/BackupLogs.tsx
/**
 * Backup Logs Component
 * Displays recent backup operation logs
 */
import { CheckCircle, XCircle, Clock, Download, Trash2, HardDrive } from 'lucide-react';
import { BackupLog } from '@/services/backupApi';

interface BackupLogsProps {
  logs: BackupLog[];
}

export default function BackupLogs({ logs }: BackupLogsProps) {
  if (logs.length === 0) {
    return (
      <div className="p-6 text-center">
        <Clock className="h-8 w-8 text-gray-300 mx-auto" />
        <p className="mt-2 text-sm text-gray-500">Henüz işlem logu bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="px-4 py-3 hover:bg-gray-50">
          <div className="flex items-start">
            {/* Status Icon */}
            <div className="flex-shrink-0 mr-3">
              {log.status === 'success' && (
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              )}
              {log.status === 'error' && (
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
              )}
              {log.status === 'started' && (
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {/* Operation Icon */}
                  {log.operation === 'create' && (
                    <HardDrive className="h-4 w-4 text-gray-400 mr-1" />
                  )}
                  {log.operation === 'download' && (
                    <Download className="h-4 w-4 text-gray-400 mr-1" />
                  )}
                  {log.operation === 'delete' && (
                    <Trash2 className="h-4 w-4 text-gray-400 mr-1" />
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {getOperationLabel(log.operation)}
                  </span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    log.status === 'success' ? 'bg-green-100 text-green-800' :
                    log.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {getStatusLabel(log.status)}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(log.timestamp)}
                </span>
              </div>
              
              {log.filename && (
                <p className="text-sm text-gray-600 mt-1">
                  Dosya: <span className="font-mono text-xs">{log.filename}</span>
                </p>
              )}
              
              {log.details && (
                <p className="text-xs text-gray-500 mt-1">
                  {log.details}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getOperationLabel(operation: string): string {
  switch (operation) {
    case 'create': return 'Yedek Oluşturma';
    case 'download': return 'Yedek İndirme';
    case 'delete': return 'Yedek Silme';
    default: return operation;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'success': return 'Başarılı';
    case 'error': return 'Hata';
    case 'started': return 'Başladı';
    default: return status;
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('tr-TR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

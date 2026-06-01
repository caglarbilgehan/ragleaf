// platform/src/components/BackupManager.tsx
/**
 * Backup Manager Component
 * Main component for backup management with create, list, download, delete functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Download, 
  Trash2, 
  RefreshCw, 
  Clock, 
  HardDrive,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { backupApi, BackupInfo, BackupLog } from '@/services/backupApi';
import BackupList from './BackupList';
import BackupLogs from './BackupLogs';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function BackupManager() {
  // State
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast helper
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  // Load backups and logs
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [backupResponse, logsResponse] = await Promise.all([
        backupApi.listBackups(),
        backupApi.getBackupLogs(20)
      ]);
      setBackups(backupResponse.backups);
      setLogs(logsResponse.logs);
    } catch (error) {
      console.error('Failed to load backup data:', error);
      addToast('error', 'Yedek verileri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create backup
  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const result = await backupApi.createBackup();
      if (result.success) {
        addToast('success', `Yedek oluşturuldu: ${result.filename}`);
        await loadData();
      } else {
        addToast('error', result.error || 'Yedek oluşturulamadı');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      addToast('error', 'Yedek oluşturulurken hata oluştu');
    } finally {
      setIsCreating(false);
    }
  };

  // Download backup
  const handleDownload = async (filename: string) => {
    try {
      await backupApi.downloadBackup(filename);
      addToast('success', `${filename} indiriliyor...`);
    } catch (error) {
      console.error('Failed to download backup:', error);
      addToast('error', 'Yedek indirilemedi');
    }
  };

  // Delete backup
  const handleDelete = async (filename: string) => {
    try {
      await backupApi.deleteBackup(filename);
      addToast('success', `${filename} silindi`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete backup:', error);
      addToast('error', 'Yedek silinemedi');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="h-5 w-5 mr-2" />}
            {toast.type === 'error' && <XCircle className="h-5 w-5 mr-2" />}
            {toast.type === 'info' && <AlertCircle className="h-5 w-5 mr-2" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Yedekleme Yönetimi</h2>
            <p className="text-sm text-gray-500">Sistem yapılandırması ve kullanıcı verilerini yedekleyin</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Yedekleniyor...
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4 mr-2" />
                Yedek Oluştur
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Database className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Toplam Yedek</p>
              <p className="text-2xl font-semibold text-gray-900">{backups.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Toplam Boyut</p>
              <p className="text-2xl font-semibold text-gray-900">
                {backups.reduce((acc, b) => acc + b.size_bytes, 0) > 0 
                  ? formatSize(backups.reduce((acc, b) => acc + b.size_bytes, 0))
                  : '0 B'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Son Yedek</p>
              <p className="text-sm font-semibold text-gray-900">
                {backups.length > 0 
                  ? formatDate(backups[0].created_at)
                  : 'Yok'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Yedek Listesi</h3>
        </div>
        <BackupList
          backups={backups}
          isLoading={isLoading}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      </div>

      {/* Logs Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <h3 className="text-lg font-medium text-gray-900">İşlem Logları</h3>
          {showLogs ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>
        {showLogs && (
          <div className="border-t border-gray-200">
            <BackupLogs logs={logs} />
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

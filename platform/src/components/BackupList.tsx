// platform/src/components/BackupList.tsx
/**
 * Backup List Component
 * Displays list of backups with download and delete actions
 */
import { useState } from 'react';
import { Download, Trash2, FileArchive, AlertTriangle } from 'lucide-react';
import { BackupInfo } from '@/services/backupApi';

interface BackupListProps {
  backups: BackupInfo[];
  isLoading: boolean;
  onDownload: (filename: string) => void;
  onDelete: (filename: string) => void;
}

export default function BackupList({
  backups,
  isLoading,
  onDownload,
  onDelete
}: BackupListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDeleteClick = (filename: string) => {
    setDeleteConfirm(filename);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      onDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Yükeniyor...</p>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="p-8 text-center">
        <FileArchive className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="mt-2 text-sm text-gray-500">Henüz yedek bulunmuyor</p>
        <p className="text-xs text-gray-400">Yedek oluşturmak için yukarıdaki butonu kullanın</p>
      </div>
    );
  }

  return (
    <>
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-dark-400 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800/60 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-white/[0.06]">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 bg-red-500/10 rounded-full flex items-center justify-center mr-3">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Yedeği Sil</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              <strong>{deleteConfirm}</strong> dosyasını silmek istediğinizden emin misiniz? 
              Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-800/60 border border-white/[0.1] rounded-md hover:bg-dark-700/50"
              >
                İptal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/[0.04]">
          <thead className="bg-dark-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dosya Adı
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Boyut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Oluşturulma Tarihi
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-dark-800/60 divide-y divide-white/[0.04]">
            {backups.map((backup) => (
              <tr key={backup.filename} className="hover:bg-dark-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileArchive className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-100">
                      {backup.filename}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500">
                    {backup.size_formatted}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500">
                    {formatDate(backup.created_at)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onDownload(backup.filename)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                      title="İndir"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(backup.filename)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
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

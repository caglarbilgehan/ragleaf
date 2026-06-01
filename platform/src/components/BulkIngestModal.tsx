import { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { adminApi } from '@/services/api';

interface BulkIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkIngestModal({ isOpen, onClose }: BulkIngestModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<any>(null);
  const queryClient = useQueryClient();

  const bulkIngestMutation = useMutation(
    (files: File[]) => adminApi.bulkIngestDocuments(files),
    {
      onSuccess: (data) => {
        toast.success(`${data.files_processed} dosya başarıyla işlendi!`);
        setUploadProgress(data);
        queryClient.invalidateQueries('documents');
        queryClient.invalidateQueries('vectorstore-status');

        // Close after 3 seconds
        setTimeout(() => {
          onClose();
          setSelectedFiles([]);
          setUploadProgress(null);
        }, 3000);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Toplu yükleme hatası');
        setIsUploading(false);
      },
    }
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkIngest = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    await bulkIngestMutation.mutateAsync(selectedFiles);
    setIsUploading(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Toplu Döküman İşleme (Hybrid Vector Store)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Birden fazla dökümanı PgVector'a yükleyin
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isUploading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          {/* File Selection */}
          {!uploadProgress && (
            <>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="bulk-file-upload"
                  multiple
                  disabled={isUploading}
                />
                <label htmlFor="bulk-file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-700 mb-1">
                    Dosya Seçin veya Sürükleyin
                  </p>
                  <p className="text-sm text-gray-500">
                    PDF, TXT, MD veya DOCX - Çoklu seçim desteklenir
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Her dosya maksimum 100MB olabilir
                  </p>
                </label>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      Seçilen Dosyalar ({selectedFiles.length})
                    </h3>
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="text-sm text-red-600 hover:text-red-700"
                      disabled={isUploading}
                    >
                      Tümünü Temizle
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-primary-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                          disabled={isUploading}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Upload Progress/Result */}
          {uploadProgress && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2 text-green-600">
                <CheckCircle className="h-8 w-8" />
                <h3 className="text-lg font-semibold">İşlem Tamamlandı!</h3>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">İşlenen Dosya:</span>
                  <span className="font-semibold text-gray-900">
                    {uploadProgress.files_processed}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Oluşturulan Chunk:</span>
                  <span className="font-semibold text-gray-900">
                    {uploadProgress.chunks_created}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">PgVector Toplam:</span>
                  <span className="font-semibold text-gray-900">
                    {uploadProgress.pgvector_total_docs || 0}
                  </span>
                </div>
              </div>

              {uploadProgress.file_stats && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Dosya Detayları:</h4>
                  {uploadProgress.file_stats.map((stat: any, idx: number) => (
                    <div key={idx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      📄 {stat.file}: {stat.chunks} chunks, {stat.characters} karakter
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!uploadProgress && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="btn btn-secondary btn-md"
            >
              İptal
            </button>
            <button
              onClick={handleBulkIngest}
              disabled={selectedFiles.length === 0 || isUploading}
              className="btn btn-primary btn-md"
            >
              {isUploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  İşleniyor...
                </div>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedFiles.length} Dosyayı İşle
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

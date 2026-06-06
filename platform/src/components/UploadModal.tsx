import { useState, useRef } from 'react';
import { X, Upload, Info, FileText, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { adminApi, getApiBaseUrl } from '@/services/api';
import AutocompleteInput from './AutocompleteInput';
import TagAutocomplete from './TagAutocomplete';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);

    // Metadata State
    const [metadata, setMetadata] = useState({
        language: 'tr', // Default TR
        category: '',
        department: '',
        product_info: '',
        brand: '',
        tags: [] as string[]
    });

    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const token = localStorage.getItem('ragleaf_token');

    // Fetch metadata suggestions for autocomplete
    interface MetadataSuggestions {
        tags: string[];
        categories: string[];
        brands: string[];
    }
    
    const { data: metadataSuggestions } = useQuery<MetadataSuggestions>(
        'metadata-suggestions',
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/admin/metadata/suggestions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch suggestions');
            return response.json();
        }
    );

    // Department options (same as DocumentEditModal)
    const DEPARTMENTS = [
        'Teknik Servis',
        'Proje',
        'Uygulama',
        'Arge',
        'Satış',
        'Muhasebe',
        'Müşteri Hizmetleri'
    ];

    const batchUploadMutation = useMutation(
        ({ files, metadata }: { files: File[], metadata: any }) => adminApi.batchUploadDocuments(files, metadata),
        {
            onSuccess: (data) => {
                toast.success(`${data.successful} döküman başarıyla yüklendi!`);
                setUploadResult(data);
                queryClient.invalidateQueries('documents');

                // Reset form after 2 seconds if successful and close
                setTimeout(() => {
                    // Reset handled by manual close or new upload
                }, 2000);
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

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        setIsUploading(true);

        // Clean empty metadata fields
        const finalMetadata: any = {
            language: metadata.language
        };
        if (metadata.category) finalMetadata.category = metadata.category;
        if (metadata.department) finalMetadata.department = metadata.department;
        if (metadata.product_info) finalMetadata.product_info = metadata.product_info;
        if (metadata.brand) finalMetadata.brand = metadata.brand;
        if (metadata.tags.length > 0) finalMetadata.tags = metadata.tags;

        await batchUploadMutation.mutateAsync({ files: selectedFiles, metadata: finalMetadata });
        setIsUploading(false);
    };

    const handleClose = () => {
        setSelectedFiles([]);
        setMetadata({ language: 'tr', category: '', department: '', product_info: '', brand: '', tags: [] });
        setUploadResult(null);
        setIsUploading(false);
        onClose();
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800/60 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
                    <div>
                        <h3 className="text-xl font-bold text-gray-100">Döküman Yükle</h3>
                        <p className="text-sm text-gray-500">Dökümanları seçin ve metadata bilgilerini girin.</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-300"
                        disabled={isUploading}
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Success View */}
                    {uploadResult && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6 text-center space-y-4">
                            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
                            <div>
                                <h4 className="text-lg font-bold text-emerald-400">Yükleme Tamamlandı!</h4>
                                <p className="text-emerald-400/80">
                                    {uploadResult.successful} döküman başarıyla yüklendi.
                                    {uploadResult.failed > 0 && ` (${uploadResult.failed} başarısız)`}
                                </p>
                            </div>
                            <div className="flex justify-center gap-3">
                                <button onClick={handleClose} className="btn btn-secondary btn-sm">Kapat</button>
                                <button onClick={() => {
                                    setSelectedFiles([]);
                                    setUploadResult(null);
                                }} className="btn btn-primary btn-sm">Yeni Yükle</button>
                            </div>
                        </div>
                    )}

                    {!uploadResult && (
                        <>
                            {/* File Selection */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-primary-500/30 rounded-lg p-8 text-center hover:border-primary-500 hover:bg-primary-500/5 transition-colors cursor-pointer bg-dark-700/50"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".pdf,.txt,.md,.docx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    multiple
                                    disabled={isUploading}
                                />
                                <Upload className="h-10 w-10 text-primary-400 mx-auto mb-3" />
                                <p className="text-lg font-medium text-gray-300">Dosyaları buraya bırakın veya tıklayın</p>
                                <p className="text-sm text-gray-500 mt-1">PDF, TXT, MD, DOCX</p>
                            </div>

                            {/* Selected Files List */}
                            {selectedFiles.length > 0 && (
                                <div className="bg-dark-800/60 rounded-lg border border-white/[0.06] p-3 max-h-40 overflow-y-auto">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-semibold text-gray-300">Seçilenler ({selectedFiles.length})</h4>
                                        <button onClick={() => setSelectedFiles([])} className="text-xs text-red-600 hover:text-red-800">Tümünü Sil</button>
                                    </div>
                                    {selectedFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between py-2 text-sm border-b border-white/[0.04] last:border-0">
                                            <div className="flex items-center gap-2 truncate flex-1">
                                                <FileText className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300 truncate">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500 text-xs">{formatFileSize(file.size)}</span>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(index); }} className="text-gray-400 hover:text-red-500">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Metadata Inputs */}
                            <div className="bg-dark-700/50 p-4 rounded-lg border border-white/[0.06] space-y-4">
                                <div className="flex items-center text-sm font-medium text-gray-200 mb-2">
                                    <Info className="h-4 w-4 mr-2 text-primary-600" />
                                    Döküman Metadata Bilgileri (Tüm dosyalar için uygulanır)
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Language Selection */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center">
                                            <Globe className="h-3 w-3 mr-1" />
                                            Döküman Dili (Kaynak)
                                        </label>
                                        <select
                                            value={metadata.language}
                                            onChange={(e) => setMetadata({ ...metadata, language: e.target.value })}
                                            className="input w-full text-sm"
                                        >
                                            <option value="tr">Türkçe (Varsayılan)</option>
                                            <option value="en">İngilizce</option>
                                            <option value="de">Almanca</option>
                                            <option value="fr">Fransızca</option>
                                            <option value="es">İspanyolca</option>
                                        </select>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                            Seçilen dil dışındaki aktif diller için otomatik çeviri yapılacaktır (Eğer aktifse).
                                        </p>
                                    </div>

                                    {/* Category with Autocomplete */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Kategori</label>
                                        <AutocompleteInput
                                            value={metadata.category}
                                            onChange={(value: string) => setMetadata({ ...metadata, category: value })}
                                            suggestions={metadataSuggestions?.categories || []}
                                            placeholder="Örn: Teknik Şartname"
                                            className="text-sm"
                                        />
                                    </div>

                                    {/* Brand with Autocomplete */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Marka</label>
                                        <AutocompleteInput
                                            value={metadata.brand}
                                            onChange={(value: string) => setMetadata({ ...metadata, brand: value })}
                                            suggestions={metadataSuggestions?.brands || []}
                                            placeholder="Örn: Firma Adı"
                                            className="text-sm"
                                        />
                                    </div>

                                    {/* Product Info */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Ürün Bilgisi</label>
                                        <input
                                            type="text"
                                            className="input w-full text-sm"
                                            placeholder="Örn: Ürün Adı, Model"
                                            value={metadata.product_info}
                                            onChange={e => setMetadata({ ...metadata, product_info: e.target.value })}
                                        />
                                    </div>

                                    {/* Department Checkboxes */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Birim / Departman</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {DEPARTMENTS.map(dept => {
                                                const departments = metadata.department ? metadata.department.split(',').map((d: string) => d.trim()) : [];
                                                const isSelected = departments.includes(dept);
                                                return (
                                                    <label
                                                        key={dept}
                                                        className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all text-sm ${isSelected
                                                            ? 'border-primary-500 bg-primary-500/10'
                                                            : 'border-white/[0.06] hover:border-white/[0.1]'
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                let newDepts = [...departments];
                                                                 if (e.target.checked) {
                                                                     newDepts.push(dept);
                                                                 } else {
                                                                     newDepts = newDepts.filter(d => d !== dept);
                                                                 }
                                                                 setMetadata({ ...metadata, department: newDepts.join(', ') });
                                                            }}
                                                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                                                        />
                                                        <span className="text-gray-300">{dept}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Tags with Autocomplete */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Etiketler</label>
                                        <TagAutocomplete
                                            tags={metadata.tags}
                                            onTagsChange={(tags: string[]) => setMetadata({ ...metadata, tags })}
                                            suggestions={metadataSuggestions?.tags || []}
                                            placeholder="Etiket yazıp Enter'a basın..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                </div>

                {/* Footer */}
                {!uploadResult && (
                    <div className="p-6 border-t border-white/[0.06] bg-dark-700/50 flex justify-end gap-3">
                        <button
                            onClick={handleClose}
                            className="btn btn-secondary"
                            disabled={isUploading}
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleUpload}
                            className="btn btn-primary px-6"
                            disabled={selectedFiles.length === 0 || isUploading}
                        >
                            {isUploading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Yükleniyor...
                                </div>
                            ) : (
                                `Yükle (${selectedFiles.length})`
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}

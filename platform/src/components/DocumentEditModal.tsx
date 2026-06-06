import React, { useState } from 'react';
import { X, Globe, Save, FileText, Sparkles, Tag, MessageCircle, CheckCircle, Layers, Eye, AlertTriangle, Info, Zap, Image, FileJson } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import type { Document } from '@/types';
import { getApiBaseUrl } from '@/services/api';
import VisualEnrichmentTab from './VisualEnrichmentTab';
import DocumentEnrichmentTab from './DocumentEnrichmentTab';
import AutocompleteInput from './AutocompleteInput';
import TagAutocomplete from './TagAutocomplete';

interface DocumentEditModalProps {
    document: Document;
    onClose: () => void;
}

interface DocumentChunk {
    id: number;
    chunk_index: number;
    content: string;
    language: string;
    enrichment_data: {
        suggested_questions?: string[];
        visual_reference?: number;
        special_instructions?: string;
        tags?: string[];
    };
    image_relations?: Array<{
        asset_id: number;
        page?: number;
        index?: number;
        file_path?: string;
        auto_linked?: boolean;
    }> | number[];
}

interface DocumentAsset {
    id: number;
    asset_type: string;
    file_path: string;
    caption?: string;
    ocr_text?: string;
    asset_metadata: {
        page?: number;
        index?: number;
        width?: number;
        height?: number;
        size_bytes?: number;
        linked_chunks?: number[];
        tags?: string[];
    };
}

interface ActiveModelInfo {
    model_id: string;
    display_name: string;
    dimension: number;
    multilingual: boolean;
    deployment_type: string;
}

interface MultilingualSettings {
    active_languages: string[];
    auto_translate: boolean;
}

const LANGUAGES = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'İngilizce', flag: '🇬🇧' },
    { code: 'de', name: 'Almanca', flag: '🇩🇪' },
    { code: 'fr', name: 'Fransızca', flag: '🇫🇷' },
    { code: 'es', name: 'İspanyolca', flag: '🇪🇸' },
];

export default function DocumentEditModal({ document, onClose }: DocumentEditModalProps) {
    const [activeTab, setActiveTab] = useState<'metadata' | 'chunks' | 'preview' | 'visual' | 'enrichment'>('metadata');
    const isProcessed = document.chunking_completed || document.status === 'processed' || document.vector_indexed || (document.total_chunks && document.total_chunks > 0);
    
    // Document basic info state
    const [documentName, setDocumentName] = useState(document.name || '');
    const [originalFilename, setOriginalFilename] = useState(document.original_filename || '');
    const [language, setLanguage] = useState(document.language || 'tr');
    
    const [metadata, setMetadata] = useState({
        category: document.doc_metadata?.category || '',
        department: document.doc_metadata?.department || '',
        product_info: document.doc_metadata?.product_info || '',
        brand: document.doc_metadata?.brand || '',
        tags: document.doc_metadata?.tags || [] as string[]
    });

    // Chunk editing state
    const [selectedChunkId, setSelectedChunkId] = useState<number | null>(null);
    const [enrichmentForm, setEnrichmentForm] = useState({
        suggested_questions: [] as string[],
        special_instructions: '',
        tags: [] as string[]
    });
    const [newQuestion, setNewQuestion] = useState('');
    const [newChunkTag, setNewChunkTag] = useState('');
    const [selectedImages, setSelectedImages] = useState<number[]>([]);

    const queryClient = useQueryClient();
    const token = localStorage.getItem('ragleaf_token');

    // Fetch active embedding model info
    const { data: activeModel } = useQuery<ActiveModelInfo>(
        'active-embedding-model',
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/api/admin/embedding-models/active/info`);
            if (!response.ok) throw new Error('Failed to fetch model info');
            return response.json();
        }
    );

    // Fetch multilingual settings
    const { data: multilingualSettings } = useQuery<MultilingualSettings>(
        'multilingual-settings',
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/api/admin/settings/multilingual_settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch settings');
            return response.json();
        }
    );

    const isMultilingual = activeModel?.multilingual ?? false;
    const autoTranslateEnabled = multilingualSettings?.auto_translate ?? false;
    const isNonTurkish = language !== 'tr';

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

    // Fetch chunks for this document
    const { data: chunksData, isLoading: chunksLoading } = useQuery(
        ['document-chunks', document.id],
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/chunks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch chunks');
            return response.json();
        },
        { enabled: activeTab === 'chunks' || activeTab === 'visual' }
    );

    // Fetch assets (images) for this document
    const { data: assetsData, isLoading: assetsLoading, refetch: refetchAssets } = useQuery<DocumentAsset[]>(
        ['document-assets', document.id],
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/assets`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch assets');
            return response.json();
        },
        { enabled: activeTab === 'visual' || activeTab === 'chunks' }
    );

    // Auto-sync assets if none found
    const [assetsSyncAttempted, setAssetsSyncAttempted] = useState(false);
    
    React.useEffect(() => {
        const syncAssets = async () => {
            // Trigger sync if: not loading, assets is empty array or undefined, not attempted yet, and on correct tab
            const shouldSync = !assetsLoading && 
                              (assetsData === undefined || (Array.isArray(assetsData) && assetsData.length === 0)) && 
                              !assetsSyncAttempted && 
                              (activeTab === 'chunks' || activeTab === 'visual');
            
            if (shouldSync) {
                setAssetsSyncAttempted(true);
                console.log('🔄 Auto-syncing assets for document:', document.id);
                try {
                    const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/sync-assets`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const result = await response.json();
                        console.log('✅ Sync result:', result);
                        if (result.synced > 0) {
                            toast.success(`${result.synced} görsel senkronize edildi`);
                            refetchAssets();
                        }
                    }
                } catch (error) {
                    console.error('❌ Asset sync failed:', error);
                }
            }
        };
        syncAssets();
    }, [assetsData, assetsLoading, assetsSyncAttempted, document.id, token, activeTab, refetchAssets]);

    // Save document metadata mutation
    const saveMetadataMutation = useMutation(
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/metadata`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    display_name: documentName,
                    language,
                    doc_metadata: metadata
                })
            });
            if (!response.ok) throw new Error('Failed to save metadata');
            return response.json();
        },
        {
            onSuccess: () => {
                toast.success('Döküman ayarları kaydedildi!');
                queryClient.invalidateQueries('documents');
            },
            onError: () => {
                toast.error('Kaydetme başarısız');
            }
        }
    );

    // Save chunk enrichment mutation
    const saveEnrichmentMutation = useMutation(
        async ({ chunkId, data }: { chunkId: number, data: any }) => {
            const response = await fetch(`${getApiBaseUrl()}/admin/chunks/${chunkId}/enrichment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save enrichment');
            return response.json();
        },
        {
            onSuccess: () => {
                toast.success('Chunk zenginleştirme kaydedildi!');
                queryClient.invalidateQueries(['document-chunks', document.id]);
                setSelectedChunkId(null);
            },
            onError: () => {
                toast.error('Kaydetme başarısız');
            }
        }
    );

    const startEditingChunk = (chunk: any) => {
        setSelectedChunkId(chunk.id || chunk.index);
        setEnrichmentForm({
            suggested_questions: chunk.enrichment_data?.suggested_questions || [],
            special_instructions: chunk.enrichment_data?.special_instructions || '',
            tags: chunk.enrichment_data?.tags || []
        });
        // Handle both old format (number[]) and new format (object[])
        const relations = chunk.image_relations || [];
        const assetIds = relations.map((r: any) => typeof r === 'number' ? r : r.asset_id).filter(Boolean);
        setSelectedImages(assetIds);
    };

    const saveChunkEnrichment = () => {
        if (!selectedChunkId) return;
        saveEnrichmentMutation.mutate({
            chunkId: selectedChunkId,
            data: {
                ...enrichmentForm,
                image_relations: selectedImages
            }
        });
    };

    const addQuestion = () => {
        if (newQuestion.trim()) {
            setEnrichmentForm(prev => ({
                ...prev,
                suggested_questions: [...prev.suggested_questions, newQuestion.trim()]
            }));
            setNewQuestion('');
        }
    };

    const addChunkTag = () => {
        if (newChunkTag.trim() && !enrichmentForm.tags.includes(newChunkTag.trim())) {
            setEnrichmentForm(prev => ({
                ...prev,
                tags: [...prev.tags, newChunkTag.trim()]
            }));
            setNewChunkTag('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center" style={{ marginTop: 0 }}>
            <div className="h-screen w-full bg-dark-800/60 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/[0.06] bg-gradient-to-r from-primary-600 to-primary-700">
                    <div className="flex items-center text-white">
                        <div className="h-10 w-10 bg-dark-800/60/20 rounded-lg flex items-center justify-center mr-4">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Döküman Düzenle</h2>
                            <p className="text-primary-100 text-sm">{document.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Tab Buttons */}
                        <div className="flex bg-dark-800/60/20 rounded-lg p-1">
                            <button
                                onClick={() => setActiveTab('metadata')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'metadata'
                                    ? 'bg-dark-800/60 text-primary-700'
                                    : 'text-white hover:bg-dark-800/60/10'
                                    }`}
                            >
                                <Globe className="h-4 w-4 inline mr-1" />
                                Metadata & Dil
                            </button>
                            <button
                                onClick={() => setActiveTab('preview')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'preview'
                                    ? 'bg-dark-800/60 text-primary-700'
                                    : 'text-white hover:bg-dark-800/60/10'
                                    }`}
                            >
                                <Eye className="h-4 w-4 inline mr-1" />
                                Önizleme
                            </button>
                            {isProcessed && (
                                <button
                                    onClick={() => setActiveTab('enrichment')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'enrichment'
                                        ? 'bg-dark-800/60 text-primary-700'
                                        : 'text-white hover:bg-dark-800/60/10'
                                        }`}
                                >
                                    <FileJson className="h-4 w-4 inline mr-1" />
                                    Döküman Zenginleştirme
                                </button>
                            )}
                            {isProcessed && (
                                <>
                                    <button
                                        onClick={() => setActiveTab('chunks')}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'chunks'
                                            ? 'bg-dark-800/60 text-primary-700'
                                            : 'text-white hover:bg-dark-800/60/10'
                                            }`}
                                    >
                                        <Sparkles className="h-4 w-4 inline mr-1" />
                                        Chunk Zenginleştirme
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('visual')}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'visual'
                                            ? 'bg-dark-800/60 text-primary-700'
                                            : 'text-white hover:bg-dark-800/60/10'
                                            }`}
                                    >
                                        <Layers className="h-4 w-4 inline mr-1" />
                                        Görsel Zenginleştirme
                                    </button>
                                </>
                            )}
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'metadata' && (
                        <div className="w-full space-y-8">
                            {/* Document Basic Info */}
                            <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                                    <FileText className="h-5 w-5 mr-2 text-primary-600" />
                                    Döküman Bilgileri
                                </h3>
                                <div className="space-y-4">
                                    {/* Döküman Adı - Full width on top */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Döküman Adı</label>
                                        <input
                                            type="text"
                                            value={documentName}
                                            onChange={(e) => setDocumentName(e.target.value)}
                                            className="input w-full"
                                            placeholder="Döküman adını girin"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Görüntülenen döküman adı (düzenlenebilir)</p>
                                    </div>
                                    
                                    {/* ID and Original Filename - Side by side (20% / 80%) */}
                                    <div className="flex gap-4">
                                        <div className="w-1/5">
                                            <label className="block text-sm font-medium text-gray-300 mb-1">ID</label>
                                            <input
                                                type="text"
                                                value={document.id}
                                                disabled
                                                className="input w-full bg-dark-600 cursor-not-allowed text-center font-mono"
                                            />
                                        </div>
                                        <div className="w-4/5">
                                            <label className="block text-sm font-medium text-gray-300 mb-1">Orijinal Dosya Adı</label>
                                            <input
                                                type="text"
                                                value={originalFilename}
                                                disabled
                                                className="input w-full bg-dark-600 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Language Selection */}
                            <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                                    <Globe className="h-5 w-5 mr-2 text-primary-600" />
                                    Döküman Dili
                                </h3>
                                <div className="grid grid-cols-5 gap-3">
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang.code}
                                            onClick={() => setLanguage(lang.code)}
                                            className={`p-4 rounded-lg border-2 transition-all ${language === lang.code
                                                ? 'border-primary-500 bg-primary-50'
                                                : 'border-white/[0.06] hover:border-white/[0.1]'
                                                }`}
                                        >
                                            <span className="text-2xl block text-center mb-1">{lang.flag}</span>
                                            <span className="text-sm font-medium text-gray-300 block text-center">{lang.name}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-3">
                                    Dökümanın kaynak dili.
                                </p>

                                {/* Model Info Banner */}
                                {activeModel && (
                                    <div className={`mt-4 rounded-lg p-3 ${isMultilingual ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                                        <div className="flex items-start gap-2">
                                            <Zap className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isMultilingual ? 'text-green-600' : 'text-amber-600'}`} />
                                            <div className="flex-1">
                                                <p className={`text-sm font-medium ${isMultilingual ? 'text-green-800' : 'text-amber-800'}`}>
                                                    {activeModel.display_name}
                                                </p>
                                                <p className={`text-xs mt-1 ${isMultilingual ? 'text-green-700' : 'text-amber-700'}`}>
                                                    {isMultilingual
                                                        ? '✅ Multilingual model - Tüm diller desteklenir'
                                                        : '⚠️ Bu model yalnızca Türkçe için optimize edilmiştir. Türkçe dışındaki dökümanlar için Çoklu Dil Ayarları sayfasında Otomatik Çeviri özelliğinin açık olması gerekmektedir.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Warning: Non-Turkish language selected with non-multilingual model */}
                                {!isMultilingual && isNonTurkish && (
                                    <div className="mt-4 space-y-3">
                                        {autoTranslateEnabled ? (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <div className="flex items-start gap-2">
                                                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                                                    <div>
                                                        <p className="text-sm font-medium text-blue-800">
                                                            Otomatik Çeviri Aktif
                                                        </p>
                                                        <p className="text-xs text-blue-700 mt-1">
                                                            Bu döküman işlenirken LLM tarafından otomatik olarak Türkçe'ye çevrilecektir.
                                                        </p>
                                                        <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span>LLM kullanımı token tüketir ve ek maliyete neden olabilir.</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
                                                    <div>
                                                        <p className="text-sm font-medium text-red-800">
                                                            Dikkat: RAG Sorgularında Sorun Yaşanabilir
                                                        </p>
                                                        <p className="text-xs text-red-700 mt-1">
                                                            Otomatik çeviri <strong>kapalı</strong> ve mevcut embedding modeli Türkçe için optimize edilmiştir.
                                                            Bu döküman RAG sorgularında doğru sonuç vermeyebilir.
                                                        </p>
                                                        <p className="text-xs text-gray-600 mt-2">
                                                            Çözüm: Çoklu Dil Ayarları'ndan otomatik çeviriyi aktif edin veya multilingual bir embedding modeli kullanın.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Metadata Fields */}
                            <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                                    <Tag className="h-5 w-5 mr-2 text-primary-600" />
                                    Metadata Bilgileri
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Kategori</label>
                                        <AutocompleteInput
                                            value={metadata.category}
                                            onChange={(value: string) => setMetadata({ ...metadata, category: value })}
                                            suggestions={metadataSuggestions?.categories || []}
                                            placeholder="Örn: Teknik Şartname"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Marka</label>
                                        <AutocompleteInput
                                            value={metadata.brand}
                                            onChange={(value: string) => setMetadata({ ...metadata, brand: value })}
                                            suggestions={metadataSuggestions?.brands || []}
                                            placeholder="Örn: Firma Adı"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Departman</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {[
                                                'Teknik Servis',
                                                'Proje',
                                                'Uygulama',
                                                'Arge',
                                                'Satış',
                                                'Muhasebe',
                                                'Müşteri Hizmetleri'
                                            ].map(dept => {
                                                const departments = metadata.department ? metadata.department.split(',').map((d: string) => d.trim()) : [];
                                                const isSelected = departments.includes(dept);
                                                return (
                                                    <label
                                                        key={dept}
                                                        className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                                            ? 'border-primary-500 bg-primary-50'
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
                                                        <span className="text-sm text-gray-300">{dept}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Ürün Bilgisi</label>
                                        <input
                                            type="text"
                                            value={metadata.product_info}
                                            onChange={e => setMetadata({ ...metadata, product_info: e.target.value })}
                                            placeholder="Örn: Ürün Adı, Model"
                                            className="input w-full"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Etiketler</label>
                                        <TagAutocomplete
                                            tags={metadata.tags}
                                            onTagsChange={(tags: string[]) => setMetadata({ ...metadata, tags })}
                                            suggestions={metadataSuggestions?.tags || []}
                                            placeholder="Etiket ekle..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => saveMetadataMutation.mutate()}
                                    disabled={saveMetadataMutation.isLoading}
                                    className="btn btn-primary btn-lg flex items-center gap-2"
                                >
                                    <Save className="h-5 w-5" />
                                    {saveMetadataMutation.isLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preview' && (
                        <div className="w-full h-full">
                            <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-gray-100 flex items-center">
                                        <Eye className="h-5 w-5 mr-2 text-primary-600" />
                                        Döküman Önizleme
                                    </h3>
                                </div>

                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileText className="h-24 w-24 text-gray-300 mb-6" />

                                    <h4 className="text-xl font-medium text-gray-100 mb-2">
                                        {document.original_filename}
                                    </h4>

                                    <p className="text-gray-500 mb-2">
                                        Dosya türü: <span className="font-medium">{document.file_type?.toUpperCase() || 'Bilinmiyor'}</span>
                                    </p>

                                    <p className="text-gray-500 mb-6">
                                        Boyut: <span className="font-medium">{document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB` : 'Bilinmiyor'}</span>
                                    </p>

                                    <a
                                        href={`${getApiBaseUrl()}/admin/documents/${document.id}/file?token=${token}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary btn-lg flex items-center gap-2"
                                    >
                                        <Eye className="h-5 w-5" />
                                        Dosyayı Görüntüle / İndir
                                    </a>

                                    <p className="text-sm text-gray-400 mt-4">
                                        PDF dosyaları tarayıcıda görüntülenebilir, diğer dosyalar indirilir.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'chunks' && (
                        <div className="w-full">
                            <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6 mb-6">
                                <h3 className="text-lg font-semibold text-gray-100 mb-2 flex items-center">
                                    <Layers className="h-5 w-5 mr-2 text-primary-600" />
                                    Chunk Zenginleştirme
                                </h3>
                                <p className="text-gray-600 text-sm">
                                    Her chunk'a önerilen sorular, özel talimatlar ve etiketler ekleyerek RAG kalitesini artırın.
                                </p>
                            </div>

                            {chunksLoading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                                    {/* Chunks List */}
                                    <div className="lg:col-span-2 space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                        {(Array.isArray(chunksData) ? chunksData : chunksData?.chunks)?.map((chunk: DocumentChunk, idx: number) => {
                                            const imageCount = chunk.image_relations?.length || 0;
                                            return (
                                            <div
                                                key={chunk.id || (chunk as any).index || idx}
                                                onClick={() => startEditingChunk(chunk)}
                                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedChunkId === (chunk.id || (chunk as any).index)
                                                    ? 'border-primary-500 bg-primary-50'
                                                    : 'border-white/[0.06] hover:border-white/[0.1] bg-dark-800/60'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-semibold text-primary-600 bg-primary-100 px-2 py-1 rounded">
                                                        Chunk #{chunk.chunk_index + 1}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {imageCount > 0 && (
                                                            <span className="text-xs text-blue-600 flex items-center bg-blue-50 px-1.5 py-0.5 rounded">
                                                                <Image className="h-3 w-3 mr-1" />
                                                                {imageCount}
                                                            </span>
                                                        )}
                                                        {(chunk.enrichment_data?.suggested_questions?.length ?? 0) > 0 && (
                                                            <span className="text-xs text-green-600 flex items-center">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Zenginleştirilmiş
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-300 line-clamp-3">
                                                    {chunk.content.substring(0, 150)}...
                                                </p>
                                            </div>
                                        )})}
                                    </div>

                                    {/* Enrichment Editor */}
                                    <div className="lg:col-span-3 bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6 sticky top-0 max-h-[600px] overflow-y-auto">
                                        {selectedChunkId ? (
                                            <div className="space-y-4">
                                                {/* Full Chunk Content */}
                                                {(() => {
                                                    const selectedChunk = (Array.isArray(chunksData) ? chunksData : chunksData?.chunks)?.find(
                                                        (c: DocumentChunk) => (c.id || (c as any).index) === selectedChunkId
                                                    );
                                                    return selectedChunk ? (
                                                        <div className="bg-dark-700/50 rounded-lg p-4 border border-white/[0.06]">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-semibold text-primary-600 bg-primary-100 px-2 py-1 rounded">
                                                                    Chunk #{selectedChunk.chunk_index + 1}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    {selectedChunk.content.length} karakter
                                                                </span>
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto">
                                                                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                                    {selectedChunk.content}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}

                                                <h4 className="font-semibold text-gray-100 pt-2 border-t">Zenginleştirme Düzenle</h4>

                                                {/* Suggested Questions */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                                                        <MessageCircle className="h-4 w-4 mr-1" />
                                                        Önerilen Sorular
                                                    </label>
                                                    <div className="flex gap-2 mb-2">
                                                        <input
                                                            type="text"
                                                            value={newQuestion}
                                                            onChange={e => setNewQuestion(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && addQuestion()}
                                                            placeholder="Soru ekle..."
                                                            className="input flex-1 text-sm"
                                                        />
                                                        <button onClick={addQuestion} className="btn btn-sm btn-primary">Ekle</button>
                                                    </div>
                                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                                        {enrichmentForm.suggested_questions.map((q, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 text-sm bg-blue-50 px-3 py-2 rounded">
                                                                <span className="flex-1">{q}</span>
                                                                <button
                                                                    onClick={() => setEnrichmentForm(prev => ({
                                                                        ...prev,
                                                                        suggested_questions: prev.suggested_questions.filter((_, i) => i !== idx)
                                                                    }))}
                                                                    className="text-red-500 hover:text-red-700"
                                                                >×</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Special Instructions */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        Özel Talimatlar
                                                    </label>
                                                    <textarea
                                                        value={enrichmentForm.special_instructions}
                                                        onChange={e => setEnrichmentForm({ ...enrichmentForm, special_instructions: e.target.value })}
                                                        placeholder="LLM'e bu chunk kullanıldığında verilecek ek talimatlar..."
                                                        className="input w-full text-sm"
                                                        rows={3}
                                                    />
                                                </div>

                                                {/* Tags */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Etiketler</label>
                                                    <div className="flex gap-2 mb-2">
                                                        <input
                                                            type="text"
                                                            value={newChunkTag}
                                                            onChange={e => setNewChunkTag(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && addChunkTag()}
                                                            placeholder="Etiket ekle..."
                                                            className="input flex-1 text-sm"
                                                        />
                                                        <button onClick={addChunkTag} className="btn btn-sm btn-primary">Ekle</button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {enrichmentForm.tags.map((tag, idx) => (
                                                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs">
                                                                {tag}
                                                                <button
                                                                    onClick={() => setEnrichmentForm(prev => ({
                                                                        ...prev,
                                                                        tags: prev.tags.filter((_, i) => i !== idx)
                                                                    }))}
                                                                    className="ml-1"
                                                                >×</button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Related Images Section */}
                                                <div className="pt-4 border-t">
                                                    {/* Calculate valid selected images (only those that exist in assetsData) */}
                                                    {(() => {
                                                        const validSelectedImages = assetsData 
                                                            ? selectedImages.filter(id => assetsData.some(a => a.id === id))
                                                            : [];
                                                        const hasAssets = assetsData && assetsData.length > 0;
                                                        
                                                        return (
                                                            <>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                                                        <Image className="h-4 w-4 mr-1" />
                                                        İlişkili Görseller ({validSelectedImages.length})
                                                        {selectedImages.length > validSelectedImages.length && (
                                                            <span className="ml-2 text-xs text-amber-600" title="Bazı ilişkili görseller veritabanında bulunamadı">
                                                                ⚠️ {selectedImages.length - validSelectedImages.length} görsel bulunamadı
                                                            </span>
                                                        )}
                                                    </label>
                                                    
                                                    {/* Selected Images Preview */}
                                                    {validSelectedImages.length > 0 && assetsData && (
                                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                                            {validSelectedImages.map(assetId => {
                                                                const asset = assetsData.find(a => a.id === assetId);
                                                                if (!asset) return null;
                                                                return (
                                                                    <div key={assetId} className="relative group">
                                                                        <img
                                                                            src={`${getApiBaseUrl()}/admin/documents/asset/file?path=${encodeURIComponent(asset.file_path)}&token=${token}`}
                                                                            alt={asset.caption || `Görsel ${asset.asset_metadata?.index}`}
                                                                            className="w-full h-20 object-cover rounded border border-white/[0.06]"
                                                                        />
                                                                        <button
                                                                            onClick={() => setSelectedImages(prev => prev.filter(id => id !== assetId))}
                                                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 truncate">
                                                                            S.{asset.asset_metadata?.page} #{asset.asset_metadata?.index}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Add More Images */}
                                                    {hasAssets && (
                                                        <details className="bg-dark-700/50 rounded-lg border border-white/[0.06]">
                                                            <summary className="px-3 py-2 cursor-pointer text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                                                                <span>+ Daha Fazla Görsel İlişkilendir</span>
                                                            </summary>
                                                            <div className="p-2 max-h-48 overflow-y-auto grid grid-cols-4 gap-2">
                                                                {assetsData.filter(a => !selectedImages.includes(a.id)).map(asset => (
                                                                    <div
                                                                        key={asset.id}
                                                                        onClick={() => setSelectedImages(prev => [...prev, asset.id])}
                                                                        className="cursor-pointer hover:ring-2 hover:ring-primary-500 rounded overflow-hidden"
                                                                    >
                                                                        <img
                                                                            src={`${getApiBaseUrl()}/admin/documents/asset/file?path=${encodeURIComponent(asset.file_path)}&token=${token}`}
                                                                            alt={asset.caption || `Görsel ${asset.asset_metadata?.index}`}
                                                                            className="w-full h-16 object-cover"
                                                                        />
                                                                        <div className="bg-dark-600 text-xs px-1 py-0.5 text-center truncate">
                                                                            S.{asset.asset_metadata?.page}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )}

                                                    {!hasAssets && (
                                                        <div className="text-xs text-gray-500 space-y-2">
                                                            <p className="italic">Bu dökümanda görsel bulunmuyor</p>
                                                            {selectedImages.length > 0 && (
                                                                <p className="text-amber-600">
                                                                    ⚠️ Chunk'ta {selectedImages.length} görsel referansı var ama veritabanında bulunamadı.
                                                                </p>
                                                            )}
                                                            <div className="flex flex-col gap-1">
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/sync-assets`, {
                                                                                method: 'POST',
                                                                                headers: { 'Authorization': `Bearer ${token}` }
                                                                            });
                                                                            if (response.ok) {
                                                                                const result = await response.json();
                                                                                if (result.synced > 0) {
                                                                                    toast.success(`${result.synced} görsel senkronize edildi`);
                                                                                    refetchAssets();
                                                                                } else {
                                                                                    toast.error(`Görsel bulunamadı. Kontrol edilen: ${result.checked_paths?.join(', ') || 'bilinmiyor'}`);
                                                                                }
                                                                            }
                                                                        } catch (error) {
                                                                            toast.error('Senkronizasyon başarısız');
                                                                        }
                                                                    }}
                                                                    className="text-primary-600 hover:text-primary-700 underline text-left"
                                                                >
                                                                    🔄 Görselleri Senkronize Et
                                                                </button>
                                                                {selectedImages.length > 0 && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            try {
                                                                                const response = await fetch(`${getApiBaseUrl()}/admin/documents/${document.id}/cleanup-image-relations`, {
                                                                                    method: 'POST',
                                                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                                                });
                                                                                if (response.ok) {
                                                                                    const result = await response.json();
                                                                                    toast.success(`${result.invalid_refs_removed} geçersiz referans temizlendi`);
                                                                                    // Clear local state and refetch chunks
                                                                                    setSelectedImages([]);
                                                                                    queryClient.invalidateQueries(['document-chunks', document.id]);
                                                                                }
                                                                            } catch (error) {
                                                                                toast.error('Temizleme başarısız');
                                                                            }
                                                                        }}
                                                                        className="text-red-600 hover:text-red-700 underline text-left"
                                                                    >
                                                                        🗑️ Geçersiz Referansları Temizle
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>

                                                <button
                                                    onClick={saveChunkEnrichment}
                                                    disabled={saveEnrichmentMutation.isLoading}
                                                    className="btn btn-primary w-full flex items-center justify-center gap-2"
                                                >
                                                    <Save className="h-4 w-4" />
                                                    {saveEnrichmentMutation.isLoading ? 'Kaydediliyor...' : 'Chunk\'ı Kaydet'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-gray-500">
                                                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>Düzenlemek için bir chunk seçin</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'visual' && (
                        <div className="w-full h-full">
                            <VisualEnrichmentTab 
                                documentId={document.id} 
                                token={token || ''} 
                            />
                        </div>
                    )}

                    {activeTab === 'enrichment' && (
                        <div className="w-full h-full">
                            <DocumentEnrichmentTab 
                                documentId={document.id} 
                                token={token || ''} 
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

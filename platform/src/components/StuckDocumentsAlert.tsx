import React, { useState, useEffect } from 'react';
import { AlertTriangle, RotateCcw, X, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { adminApi } from '@/services/api';
import toast from 'react-hot-toast';

interface StuckDocument {
    id: number;
    name: string;
    status: string;
    last_stage: string | null;
    progress: number;
    details: string | null;
    updated_at: string | null;
}

interface StuckDocumentsAlertProps {
    onRefresh?: () => void;
}

export default function StuckDocumentsAlert({ onRefresh }: StuckDocumentsAlertProps) {
    const [stuckDocs, setStuckDocs] = useState<StuckDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        checkStuckDocuments();
    }, []);

    const checkStuckDocuments = async () => {
        try {
            setLoading(true);
            const result = await adminApi.getStuckDocuments();
            setStuckDocs(result.stuck_documents);
        } catch (error) {
            console.error('Failed to check stuck documents:', error);
        } finally {
            setLoading(false);
        }
    };

    // Resume kaldırıldı - doğru çalışmıyordu, sadece reset (baştan başlat) var

    const handleRestart = async (docId: number, docName: string) => {
        setProcessingId(docId);
        try {
            await adminApi.resetStuckDocument(docId);
            toast.success(`"${docName}" baştan başlatılıyor`, { icon: '🔄' });
            setStuckDocs(prev => prev.filter(d => d.id !== docId));
            onRefresh?.();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Başlatma başarısız');
        } finally {
            setProcessingId(null);
        }
    };

    const handleCancel = async (docId: number, docName: string) => {
        setProcessingId(docId);
        try {
            await adminApi.resetStuckDocument(docId);
            toast.success(`"${docName}" iptal edildi ve temizlendi`, { icon: '🗑️' });
            setStuckDocs(prev => prev.filter(d => d.id !== docId));
            onRefresh?.();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'İptal başarısız');
        } finally {
            setProcessingId(null);
        }
    };

    const handleRestartAll = async () => {
        for (const doc of stuckDocs) {
            await handleRestart(doc.id, doc.name);
        }
    };

    const handleCancelAll = async () => {
        for (const doc of stuckDocs) {
            await handleCancel(doc.id, doc.name);
        }
    };

    const getStageLabel = (stage: string | null) => {
        const stages: Record<string, string> = {
            'initialization': 'Başlatma',
            'pdf_analysis': 'PDF Analizi',
            'image_extraction': 'Görsel Çıkarma',
            'text_extraction': 'Metin Çıkarma',
            'ocr_processing': 'OCR İşlemi',
            'image_ocr': 'Görsel OCR',
            'text_processing': 'Metin İşleme',
            'chunking': 'Metin Parçalama',
            'translation': 'Çeviri',
            'embedding': 'Embedding',
            'indexing': 'İndeksleme',
        };
        return stage ? stages[stage] || stage : 'Bilinmiyor';
    };

    // Don't show if no stuck documents or dismissed
    if (loading || stuckDocs.length === 0 || dismissed) {
        return null;
    }

    return (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg  mb-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-full">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-amber-400">
                            {stuckDocs.length} Takılı Döküman Bulundu
                        </h3>
                        <p className="text-sm text-gray-400">
                            Sistem yeniden başladığında yarıda kalan işlemler
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1 hover:bg-amber-500/10 rounded"
                    >
                        {expanded ? <ChevronUp className="h-5 w-5 text-amber-400" /> : <ChevronDown className="h-5 w-5 text-amber-400" />}
                    </button>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 hover:bg-amber-500/10 rounded"
                        title="Kapat"
                    >
                        <X className="h-5 w-5 text-amber-400" />
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t border-amber-500/20">
                    {/* Bulk Actions */}
                    <div className="flex gap-2 p-3 bg-dark-700/50 border-b border-white/[0.06]">
                        <button
                            onClick={handleRestartAll}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Tümünü Baştan Başlat
                        </button>
                        <button
                            onClick={handleCancelAll}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                            <X className="h-4 w-4" />
                            Tümünü İptal Et
                        </button>
                    </div>

                    {/* Document List */}
                    <div className="divide-y divide-white/[0.04]">
                        {stuckDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-dark-700/20">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-100 truncate">{doc.name}</span>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${doc.status === 'processing' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                            }`}>
                                            {doc.status === 'processing' ? 'İşleme' : 'İndeksleme'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {getStageLabel(doc.last_stage)} - %{doc.progress}
                                        </span>
                                        {doc.updated_at && (
                                            <span>Son: {new Date(doc.updated_at).toLocaleString('tr-TR')}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    <button
                                        onClick={() => handleRestart(doc.id, doc.name)}
                                        disabled={processingId === doc.id}
                                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Baştan Başlat
                                    </button>
                                    <button
                                        onClick={() => handleCancel(doc.id, doc.name)}
                                        disabled={processingId === doc.id}
                                        className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                        İptal Et
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

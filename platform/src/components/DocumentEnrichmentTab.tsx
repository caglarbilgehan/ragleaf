/**
 * DocumentEnrichmentTab - Document Enrichment Management Component
 * 
 * Allows adding JSON data and Q&A pairs to documents for RAG enhancement.
 * These enrichments are embedded and searchable in RAG queries.
 */

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X, FileJson, MessageSquare, Loader2, AlertCircle, CheckCircle, Sparkles, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '@/services/api';

interface DocumentEnrichmentTabProps {
    documentId: number;
    token: string;
}

interface Enrichment {
    id: number;
    document_id: number;
    type: 'json' | 'qa';
    title: string;
    content: string;
    embedding_chunk_id: number | null;
    created_at: string;
    updated_at: string;
}

interface EnrichmentListResponse {
    success: boolean;
    enrichments: Enrichment[];
    total: number;
    json_count: number;
    qa_count: number;
}

type EnrichmentType = 'json' | 'qa';

export default function DocumentEnrichmentTab({ documentId, token }: DocumentEnrichmentTabProps) {
    const queryClient = useQueryClient();
    
    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState<EnrichmentType>('json');
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    
    // LLM Generation state
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [generateCount, setGenerateCount] = useState(5);
    const [generatedPairs, setGeneratedPairs] = useState<Array<{question: string; answer: string; selected: boolean}>>([]);

    // Fetch enrichments
    const { data, isLoading, error } = useQuery<EnrichmentListResponse>(
        ['document-enrichments', documentId],
        async () => {
            const response = await fetch(
                `${getApiBaseUrl()}/api/admin/documents/${documentId}/enrichments`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (!response.ok) throw new Error('Failed to fetch enrichments');
            return response.json();
        }
    );

    // Create enrichment mutation
    const createMutation = useMutation(
        async (data: { type: EnrichmentType; title: string; content: string }) => {
            const response = await fetch(
                `${getApiBaseUrl()}/api/admin/documents/${documentId}/enrichments`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                }
            );
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to create enrichment');
            }
            return response.json();
        },
        {
            onSuccess: () => {
                toast.success('Zenginleştirme eklendi!');
                queryClient.invalidateQueries(['document-enrichments', documentId]);
                resetForm();
            },
            onError: (err: Error) => {
                toast.error(err.message);
            }
        }
    );

    // Update enrichment mutation
    const updateMutation = useMutation(
        async ({ id, title, content }: { id: number; title: string; content: string }) => {
            const response = await fetch(
                `${getApiBaseUrl()}/api/admin/enrichments/${id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ title, content })
                }
            );
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to update enrichment');
            }
            return response.json();
        },
        {
            onSuccess: () => {
                toast.success('Zenginleştirme güncellendi!');
                queryClient.invalidateQueries(['document-enrichments', documentId]);
                resetForm();
            },
            onError: (err: Error) => {
                toast.error(err.message);
            }
        }
    );

    // Delete enrichment mutation
    const deleteMutation = useMutation(
        async (id: number) => {
            const response = await fetch(
                `${getApiBaseUrl()}/api/admin/enrichments/${id}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            if (!response.ok) throw new Error('Failed to delete enrichment');
            return response.json();
        },
        {
            onSuccess: () => {
                toast.success('Zenginleştirme silindi!');
                queryClient.invalidateQueries(['document-enrichments', documentId]);
            },
            onError: () => {
                toast.error('Silme başarısız');
            }
        }
    );

    // LLM Generate mutation
    const generateMutation = useMutation(
        async (count: number) => {
            const response = await fetch(
                `${getApiBaseUrl()}/api/admin/documents/${documentId}/enrichments/generate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ count })
                }
            );
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to generate Q&A');
            }
            return response.json();
        },
        {
            onSuccess: (data) => {
                const pairs = data.qa_pairs.map((p: {question: string; answer: string}) => ({
                    ...p,
                    selected: true
                }));
                setGeneratedPairs(pairs);
                toast.success(`${pairs.length} soru-cevap üretildi!`);
            },
            onError: (err: Error) => {
                toast.error(err.message);
            }
        }
    );

    // Bulk create mutation
    const bulkCreateMutation = useMutation(
        async (pairs: Array<{question: string; answer: string}>) => {
            const enrichments = pairs.map(p => ({
                type: 'qa' as const,
                title: p.question,
                content: p.answer
            }));
            const response = await fetch(
                `${getApiBaseUrl()}/api/admin/documents/${documentId}/enrichments/bulk`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(enrichments)
                }
            );
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to save Q&A pairs');
            }
            return response.json();
        },
        {
            onSuccess: (data) => {
                toast.success(`${data.created_count} soru-cevap kaydedildi!`);
                queryClient.invalidateQueries(['document-enrichments', documentId]);
                setShowGenerateModal(false);
                setGeneratedPairs([]);
            },
            onError: (err: Error) => {
                toast.error(err.message);
            }
        }
    );

    const resetForm = () => {
        setShowForm(false);
        setFormType('json');
        setFormTitle('');
        setFormContent('');
        setEditingId(null);
        setJsonError(null);
    };

    const validateJson = (content: string): boolean => {
        if (!content.trim()) {
            setJsonError('JSON içeriği boş olamaz');
            return false;
        }
        try {
            JSON.parse(content);
            setJsonError(null);
            return true;
        } catch (e) {
            setJsonError('Geçersiz JSON formatı');
            return false;
        }
    };

    const handleSubmit = () => {
        if (!formTitle.trim()) {
            toast.error(formType === 'json' ? 'Başlık gerekli' : 'Soru gerekli');
            return;
        }
        if (!formContent.trim()) {
            toast.error(formType === 'json' ? 'JSON içeriği gerekli' : 'Cevap gerekli');
            return;
        }
        if (formType === 'json' && !validateJson(formContent)) {
            return;
        }

        if (editingId) {
            updateMutation.mutate({ id: editingId, title: formTitle, content: formContent });
        } else {
            createMutation.mutate({ type: formType, title: formTitle, content: formContent });
        }
    };

    const startEdit = (enrichment: Enrichment) => {
        setEditingId(enrichment.id);
        setFormType(enrichment.type);
        setFormTitle(enrichment.title);
        setFormContent(enrichment.content);
        setShowForm(true);
        setJsonError(null);
    };

    const handleDelete = (id: number) => {
        if (window.confirm('Bu zenginleştirmeyi silmek istediğinize emin misiniz?')) {
            deleteMutation.mutate(id);
        }
    };

    const jsonEnrichments = data?.enrichments.filter(e => e.type === 'json') || [];
    const qaEnrichments = data?.enrichments.filter(e => e.type === 'qa') || [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-red-600">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p>Zenginleştirmeler yüklenemedi</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-100 flex items-center">
                            <FileJson className="h-5 w-5 mr-2 text-primary-600" />
                            Döküman Zenginleştirme
                        </h3>
                        <p className="text-gray-600 text-sm mt-1">
                            JSON verisi ve Soru-Cevap çiftleri ekleyerek RAG kalitesini artırın.
                            Bu veriler embedding'e dahil edilir ve arama sonuçlarında kullanılır.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                            <span className="font-medium text-primary-600">{data?.json_count || 0}</span> JSON, 
                            <span className="font-medium text-green-600 ml-1">{data?.qa_count || 0}</span> S-C
                        </div>
                        {!showForm && (
                            <>
                                <button
                                    onClick={() => setShowGenerateModal(true)}
                                    className="btn btn-secondary flex items-center gap-2"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    LLM ile Üret
                                </button>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="btn btn-primary flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Zenginleştirme Ekle
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-100">
                            {editingId ? 'Zenginleştirme Düzenle' : 'Yeni Zenginleştirme'}
                        </h4>
                        <button onClick={resetForm} className="text-gray-400 hover:text-gray-300">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Type Selector */}
                    {!editingId && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Tip</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setFormType('json'); setJsonError(null); }}
                                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                                        formType === 'json'
                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                            : 'border-white/[0.06] hover:border-white/[0.1]'
                                    }`}
                                >
                                    <FileJson className="h-4 w-4" />
                                    JSON Veri
                                </button>
                                <button
                                    onClick={() => { setFormType('qa'); setJsonError(null); }}
                                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                                        formType === 'qa'
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-white/[0.06] hover:border-white/[0.1]'
                                    }`}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    Soru-Cevap
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                {formType === 'json' ? 'Başlık' : 'Soru'}
                            </label>
                            <input
                                type="text"
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                placeholder={formType === 'json' ? 'Örn: Ürün Özellikleri' : 'Örn: Bu ürünün garanti süresi nedir?'}
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                {formType === 'json' ? 'JSON İçeriği' : 'Cevap'}
                            </label>
                            <textarea
                                value={formContent}
                                onChange={e => {
                                    setFormContent(e.target.value);
                                    if (formType === 'json') validateJson(e.target.value);
                                }}
                                placeholder={formType === 'json' 
                                    ? '{"key": "value", "items": [1, 2, 3]}'
                                    : 'Bu ürünün garanti süresi 2 yıldır.'
                                }
                                className={`input w-full font-mono text-sm ${
                                    jsonError ? 'border-red-500 focus:ring-red-500' : ''
                                }`}
                                rows={formType === 'json' ? 6 : 4}
                            />
                            {jsonError && (
                                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-4 w-4" />
                                    {jsonError}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={resetForm} className="btn btn-secondary">
                            İptal
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={createMutation.isLoading || updateMutation.isLoading}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            {(createMutation.isLoading || updateMutation.isLoading) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {editingId ? 'Güncelle' : 'Kaydet'}
                        </button>
                    </div>
                </div>
            )}

            {/* JSON Enrichments List */}
            {jsonEnrichments.length > 0 && (
                <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                    <h4 className="font-semibold text-gray-100 mb-4 flex items-center">
                        <FileJson className="h-5 w-5 mr-2 text-primary-600" />
                        JSON Zenginleştirmeler ({jsonEnrichments.length})
                    </h4>
                    <div className="space-y-3">
                        {jsonEnrichments.map(enrichment => (
                            <div
                                key={enrichment.id}
                                className="border border-white/[0.06] rounded-lg p-4 hover:border-primary-300 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-medium text-gray-100">{enrichment.title}</span>
                                            {enrichment.embedding_chunk_id && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3" />
                                                    Embedded
                                                </span>
                                            )}
                                        </div>
                                        <pre className="text-sm text-gray-600 bg-dark-700/50 p-2 rounded overflow-x-auto max-h-32">
                                            {(() => {
                                                try {
                                                    return JSON.stringify(JSON.parse(enrichment.content), null, 2);
                                                } catch {
                                                    return enrichment.content;
                                                }
                                            })()}
                                        </pre>
                                    </div>
                                    <div className="flex items-center gap-1 ml-4">
                                        <button
                                            onClick={() => startEdit(enrichment)}
                                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                                            title="Düzenle"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(enrichment.id)}
                                            disabled={deleteMutation.isLoading}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="Sil"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Q&A Enrichments List */}
            {qaEnrichments.length > 0 && (
                <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-6">
                    <h4 className="font-semibold text-gray-100 mb-4 flex items-center">
                        <MessageSquare className="h-5 w-5 mr-2 text-green-600" />
                        Soru-Cevap Zenginleştirmeler ({qaEnrichments.length})
                    </h4>
                    <div className="space-y-3">
                        {qaEnrichments.map(enrichment => (
                            <div
                                key={enrichment.id}
                                className="border border-white/[0.06] rounded-lg p-4 hover:border-green-300 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                                                Soru
                                            </span>
                                            {enrichment.embedding_chunk_id && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3" />
                                                    Embedded
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-100 font-medium mb-2">{enrichment.title}</p>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                Cevap
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-sm">{enrichment.content}</p>
                                    </div>
                                    <div className="flex items-center gap-1 ml-4">
                                        <button
                                            onClick={() => startEdit(enrichment)}
                                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                                            title="Düzenle"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(enrichment.id)}
                                            disabled={deleteMutation.isLoading}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="Sil"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {data?.total === 0 && !showForm && (
                <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-12 text-center">
                    <FileJson className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <h4 className="text-lg font-medium text-gray-100 mb-2">Henüz zenginleştirme yok</h4>
                    <p className="text-gray-500 mb-4">
                        JSON verisi veya Soru-Cevap çiftleri ekleyerek dökümanınızı zenginleştirin.
                    </p>
                    <div className="flex justify-center gap-2">
                        <button
                            onClick={() => setShowGenerateModal(true)}
                            className="btn btn-secondary inline-flex items-center gap-2"
                        >
                            <Sparkles className="h-4 w-4" />
                            LLM ile Üret
                        </button>
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn btn-primary inline-flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Manuel Ekle
                        </button>
                    </div>
                </div>
            )}

            {/* LLM Generate Modal */}
            {showGenerateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-800/60 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-white/[0.06]">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-primary-600" />
                                    LLM ile Soru-Cevap Üret
                                </h3>
                                <button 
                                    onClick={() => { setShowGenerateModal(false); setGeneratedPairs([]); }}
                                    className="text-gray-400 hover:text-gray-300"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            {generatedPairs.length === 0 ? (
                                <div className="space-y-4">
                                    <p className="text-gray-600">
                                        Döküman içeriğinden otomatik soru-cevap çiftleri üretin.
                                        LLM, dökümanı analiz ederek en uygun soruları oluşturacak.
                                    </p>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Kaç adet soru-cevap üretilsin?
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={generateCount}
                                            onChange={e => setGenerateCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                                            className="input w-32"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Maksimum 10 adet</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-gray-600 text-sm">
                                        Kaydetmek istediğiniz soru-cevapları seçin:
                                    </p>
                                    <div className="space-y-3">
                                        {generatedPairs.map((pair, idx) => (
                                            <div 
                                                key={idx}
                                                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                                    pair.selected 
                                                        ? 'border-green-500 bg-green-50' 
                                                        : 'border-white/[0.06] hover:border-white/[0.1]'
                                                }`}
                                                onClick={() => {
                                                    const updated = [...generatedPairs];
                                                    updated[idx].selected = !updated[idx].selected;
                                                    setGeneratedPairs(updated);
                                                }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                                        pair.selected 
                                                            ? 'border-green-500 bg-green-500' 
                                                            : 'border-white/[0.1]'
                                                    }`}>
                                                        {pair.selected && <Check className="h-3 w-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-100">{pair.question}</p>
                                                        <p className="text-gray-600 text-sm mt-1">{pair.answer}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/[0.06] flex justify-end gap-2">
                            <button 
                                onClick={() => { setShowGenerateModal(false); setGeneratedPairs([]); }}
                                className="btn btn-secondary"
                            >
                                İptal
                            </button>
                            {generatedPairs.length === 0 ? (
                                <button
                                    onClick={() => generateMutation.mutate(generateCount)}
                                    disabled={generateMutation.isLoading}
                                    className="btn btn-primary flex items-center gap-2"
                                >
                                    {generateMutation.isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-4 w-4" />
                                    )}
                                    {generateMutation.isLoading ? 'Üretiliyor...' : 'Üret'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        const selected = generatedPairs.filter(p => p.selected);
                                        if (selected.length === 0) {
                                            toast.error('En az bir soru-cevap seçin');
                                            return;
                                        }
                                        bulkCreateMutation.mutate(selected);
                                    }}
                                    disabled={bulkCreateMutation.isLoading}
                                    className="btn btn-primary flex items-center gap-2"
                                >
                                    {bulkCreateMutation.isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    {bulkCreateMutation.isLoading ? 'Kaydediliyor...' : `${generatedPairs.filter(p => p.selected).length} Seçili Kaydet`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

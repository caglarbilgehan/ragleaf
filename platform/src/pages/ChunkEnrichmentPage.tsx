import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FileText, Edit3, Save, X, Image as ImageIcon, MessageCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/services/api';

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
}

export default function ChunkEnrichmentPage() {
    const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
    const [editingChunkId, setEditingChunkId] = useState<number | null>(null);
    const [enrichmentForm, setEnrichmentForm] = useState({
        suggested_questions: [] as string[],
        visual_reference: undefined as number | undefined,
        special_instructions: '',
        tags: [] as string[]
    });
    const [newQuestion, setNewQuestion] = useState('');
    const [newTag, setNewTag] = useState('');

    const queryClient = useQueryClient();

    // Fetch documents for selection
    const { data: documents } = useQuery('documents', () => adminApi.getDocuments());

    // Fetch chunks for selected document
    const { data: chunks, isLoading: chunksLoading } = useQuery(
        ['document-chunks', selectedDocId],
        async () => {
            if (!selectedDocId) return [];
            const response = await fetch(`/api/admin/documents/${selectedDocId}/chunks`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ragleaf_token')}` }
            });
            if (!response.ok) throw new Error('Failed to fetch chunks');
            return response.json();
        },
        { enabled: !!selectedDocId }
    );

    // Save enrichment mutation
    const saveEnrichmentMutation = useMutation(
        async ({ chunkId, data }: { chunkId: number, data: any }) => {
            const response = await fetch(`/api/admin/chunks/${chunkId}/enrichment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('ragleaf_token')}`
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save enrichment');
            return response.json();
        },
        {
            onSuccess: () => {
                toast.success('Zenginleştirme kaydedildi!');
                queryClient.invalidateQueries(['document-chunks', selectedDocId]);
                setEditingChunkId(null);
            },
            onError: () => {
                toast.error('Kaydetme başarısız');
            }
        }
    );

    const startEditing = (chunk: DocumentChunk) => {
        setEditingChunkId(chunk.id);
        setEnrichmentForm({
            suggested_questions: chunk.enrichment_data?.suggested_questions || [],
            visual_reference: chunk.enrichment_data?.visual_reference,
            special_instructions: chunk.enrichment_data?.special_instructions || '',
            tags: chunk.enrichment_data?.tags || []
        });
    };

    const saveEnrichment = () => {
        if (!editingChunkId) return;
        saveEnrichmentMutation.mutate({
            chunkId: editingChunkId,
            data: enrichmentForm
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

    const addTag = () => {
        if (newTag.trim()) {
            setEnrichmentForm(prev => ({
                ...prev,
                tags: [...prev.tags, newTag.trim()]
            }));
            setNewTag('');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-100 flex items-center">
                    <Sparkles className="h-7 w-7 mr-2 text-primary-600" />
                    Chunk Zenginleştirme
                </h1>
                <p className="text-gray-600 mt-1">
                    Döküman chunk'larına senaryo metadata'sı, önerilen sorular ve görsel referanslar ekleyin.
                </p>
            </div>

            {/* Document Selection */}
            <div className="bg-dark-800/60 rounded-lg  border border-white/[0.06] p-6">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Döküman Seçin</label>
                <select
                    value={selectedDocId || ''}
                    onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : null)}
                    className="input w-full max-w-md"
                >
                    <option value="">-- Döküman seçin --</option>
                    {documents?.documents?.map((doc: any) => (
                        <option key={doc.id} value={doc.id}>
                            {doc.name} ({doc.language?.toUpperCase() || 'TR'}) - {doc.total_chunks} chunks
                        </option>
                    ))}
                </select>
            </div>

            {/* Chunks List */}
            {selectedDocId && (
                <div className="space-y-4">
                    {chunksLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        </div>
                    ) : (
                        chunks?.map((chunk: DocumentChunk) => (
                            <div key={chunk.id} className="bg-dark-800/60 rounded-lg  border border-white/[0.06]">
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-gray-400" />
                                            <span className="text-sm font-semibold text-gray-300">
                                                Chunk #{chunk.chunk_index} ({chunk.language?.toUpperCase()})
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => editingChunkId === chunk.id ? setEditingChunkId(null) : startEditing(chunk)}
                                            className="btn btn-sm btn-secondary flex items-center gap-1"
                                        >
                                            {editingChunkId === chunk.id ? (
                                                <>
                                                    <X className="h-4 w-4" />
                                                    İptal
                                                </>
                                            ) : (
                                                <>
                                                    <Edit3 className="h-4 w-4" />
                                                    Düzenle
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="bg-dark-700/50 p-3 rounded text-sm text-gray-300 mb-3">
                                        {chunk.content.substring(0, 200)}...
                                    </div>

                                    {editingChunkId === chunk.id ? (
                                        <div className="space-y-4 border-t border-white/[0.06] pt-4">
                                            {/* Suggested Questions */}
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center">
                                                    <MessageCircle className="h-4 w-4 mr-1" />
                                                    Önerilen Sorular
                                                </label>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Örn: Bu özellik nasıl çalışır?"
                                                        value={newQuestion}
                                                        onChange={(e) => setNewQuestion(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                                                        className="input flex-1 text-sm"
                                                    />
                                                    <button onClick={addQuestion} className="btn btn-sm btn-primary">Ekle</button>
                                                </div>
                                                <div className="space-y-1">
                                                    {enrichmentForm.suggested_questions.map((q, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-sm bg-blue-50 px-3 py-1 rounded">
                                                            <span className="flex-1">{q}</span>
                                                            <button
                                                                onClick={() => setEnrichmentForm(prev => ({
                                                                    ...prev,
                                                                    suggested_questions: prev.suggested_questions.filter((_, i) => i !== idx)
                                                                }))}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Special Instructions */}
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-300 mb-2">Özel Talimatlar</label>
                                                <textarea
                                                    value={enrichmentForm.special_instructions}
                                                    onChange={(e) => setEnrichmentForm({ ...enrichmentForm, special_instructions: e.target.value })}
                                                    placeholder="Örn: Bu chunk kullanıldığında kullanıcıyı uyar..."
                                                    className="input w-full text-sm"
                                                    rows={3}
                                                />
                                            </div>

                                            {/* Tags */}
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-300 mb-2">Etiketler</label>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Etiket ekle..."
                                                        value={newTag}
                                                        onChange={(e) => setNewTag(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                                        className="input flex-1 text-sm"
                                                    />
                                                    <button onClick={addTag} className="btn btn-sm btn-primary">Ekle</button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {enrichmentForm.tags.map((tag, idx) => (
                                                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs">
                                                            {tag}
                                                            <button
                                                                onClick={() => setEnrichmentForm(prev => ({
                                                                    ...prev,
                                                                    tags: prev.tags.filter((_, i) => i !== idx)
                                                                }))}
                                                                className="ml-1 hover:text-green-900"
                                                            >×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={saveEnrichment}
                                                disabled={saveEnrichmentMutation.isLoading}
                                                className="btn btn-primary flex items-center gap-2"
                                            >
                                                <Save className="h-4 w-4" />
                                                {saveEnrichmentMutation.isLoading ? 'Kaydediliyor...' : 'Kaydet'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-sm">
                                            {chunk.enrichment_data && Object.keys(chunk.enrichment_data).length > 0 ? (
                                                <div className="space-y-2">
                                                    {(chunk.enrichment_data?.suggested_questions?.length ?? 0) > 0 && (
                                                        <div>
                                                            <span className="font-semibold text-gray-300">Sorular: </span>
                                                            <span className="text-gray-600">{chunk.enrichment_data?.suggested_questions?.length} soru</span>
                                                        </div>
                                                    )}
                                                    {chunk.enrichment_data?.special_instructions && (
                                                        <div>
                                                            <span className="font-semibold text-gray-300">Talimat: </span>
                                                            <span className="text-gray-600">{chunk.enrichment_data.special_instructions.substring(0, 50)}...</span>
                                                        </div>
                                                    )}
                                                    {(chunk.enrichment_data?.tags?.length ?? 0) > 0 && (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {chunk.enrichment_data?.tags?.map((tag, idx) => (
                                                                <span key={idx} className="px-2 py-0.5 bg-dark-600 text-gray-300 rounded text-xs">{tag}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Zenginleştirme yok</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

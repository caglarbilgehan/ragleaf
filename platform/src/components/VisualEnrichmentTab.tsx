import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Image, Search, Filter, Save, Tag, Link2, AlertTriangle, 
  ChevronDown, X, Plus, FileText, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '@/services/api';

interface VisualEnrichmentTabProps {
  documentId: number;
  token: string;
}

interface AssetWithDetails {
  id: number;
  asset_type: string;
  file_path: string;
  caption: string | null;
  ocr_text: string | null;
  page: number | null;
  index: number | null;
  width: number | null;
  height: number | null;
  tags: string[] | null;
  linked_chunks: number[] | null;
  asset_metadata: Record<string, any>;
}

interface ChunkInfo {
  id: number;
  chunk_index: number;
  content: string;
}

export default function VisualEnrichmentTab({ documentId, token }: VisualEnrichmentTabProps) {
  // State
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [filterPage, setFilterPage] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Edit form state
  const [editCaption, setEditCaption] = useState('');
  const [editOcrText, setEditOcrText] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [selectedChunks, setSelectedChunks] = useState<number[]>([]);
  const [originalOcrText, setOriginalOcrText] = useState('');

  const queryClient = useQueryClient();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch assets
  const { data: assets, isLoading: assetsLoading, refetch: refetchAssets } = useQuery<AssetWithDetails[]>(
    ['document-assets', documentId, filterPage, debouncedSearch],
    async () => {
      const params = new URLSearchParams();
      if (filterPage !== null) params.append('page', filterPage.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      
      const url = `${getApiBaseUrl()}/admin/documents/${documentId}/assets${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch assets');
      return response.json();
    }
  );

  // Auto-sync assets if none found (first load only)
  const [syncAttempted, setSyncAttempted] = useState(false);
  
  useEffect(() => {
    const syncAssets = async () => {
      // Trigger sync if: not loading, assets is empty array or undefined, not attempted yet, no filters active
      const shouldSync = !assetsLoading && 
                        (assets === undefined || (Array.isArray(assets) && assets.length === 0)) && 
                        !syncAttempted && 
                        !filterPage && 
                        !debouncedSearch;
      
      if (shouldSync) {
        setSyncAttempted(true);
        console.log('🔄 Auto-syncing assets for document:', documentId);
        try {
          const response = await fetch(`${getApiBaseUrl()}/admin/documents/${documentId}/sync-assets`, {
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
  }, [assets, assetsLoading, syncAttempted, documentId, token, filterPage, debouncedSearch, refetchAssets]);

  // Fetch chunks for linking
  const { data: chunksData } = useQuery(
    ['document-chunks', documentId],
    async () => {
      const response = await fetch(`${getApiBaseUrl()}/admin/documents/${documentId}/chunks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch chunks');
      return response.json();
    }
  );

  const chunks: ChunkInfo[] = useMemo(() => {
    if (!chunksData?.chunks) return [];
    return chunksData.chunks.map((c: any) => ({
      id: c.id,
      chunk_index: c.chunk_index,
      content: c.content
    }));
  }, [chunksData]);

  // Get unique page numbers for filter
  const pageNumbers = useMemo(() => {
    if (!assets) return [];
    const pages = new Set<number>();
    assets.forEach(a => {
      if (a.page !== null) pages.add(a.page);
    });
    return Array.from(pages).sort((a, b) => a - b);
  }, [assets]);

  // Selected asset
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId || !assets) return null;
    return assets.find(a => a.id === selectedAssetId) || null;
  }, [selectedAssetId, assets]);

  // Update form when asset selected
  useEffect(() => {
    if (selectedAsset) {
      setEditCaption(selectedAsset.caption || '');
      setEditOcrText(selectedAsset.ocr_text || '');
      setOriginalOcrText(selectedAsset.ocr_text || '');
      setEditTags(selectedAsset.tags || []);
      setSelectedChunks(selectedAsset.linked_chunks || []);
    }
  }, [selectedAsset]);

  // Save mutation
  const saveMutation = useMutation(
    async () => {
      if (!selectedAssetId) return;
      
      // Update asset metadata
      const response = await fetch(`${getApiBaseUrl()}/admin/assets/${selectedAssetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          caption: editCaption,
          ocr_text: editOcrText,
          tags: editTags
        })
      });
      
      if (!response.ok) throw new Error('Failed to save asset');
      const result = await response.json();
      
      // Update chunk relations
      const relResponse = await fetch(`${getApiBaseUrl()}/admin/assets/${selectedAssetId}/chunk-relations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chunk_ids: selectedChunks })
      });
      
      if (!relResponse.ok) throw new Error('Failed to save chunk relations');
      
      return result;
    },
    {
      onSuccess: (result) => {
        queryClient.invalidateQueries(['document-assets', documentId]);
        queryClient.invalidateQueries(['document-chunks', documentId]);
        
        if (result?.ocr_changed) {
          toast.success('Değişiklikler kaydedildi! OCR metni değişti, embedding güncellemesi gerekebilir.', {
            duration: 5000,
            icon: '⚠️'
          });
        } else {
          toast.success('Değişiklikler kaydedildi!');
        }
        setOriginalOcrText(editOcrText);
      },
      onError: () => {
        toast.error('Kaydetme başarısız');
      }
    }
  );

  const handleAddTag = () => {
    if (newTag.trim() && !editTags.includes(newTag.trim())) {
      setEditTags([...editTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  const toggleChunk = (chunkId: number) => {
    if (selectedChunks.includes(chunkId)) {
      setSelectedChunks(selectedChunks.filter(id => id !== chunkId));
    } else {
      setSelectedChunks([...selectedChunks, chunkId]);
    }
  };

  // Highlight search term in text
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  };

  const ocrChanged = editOcrText !== originalOcrText;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 flex items-center">
              <Image className="h-5 w-5 mr-2 text-primary-600" />
              Görsel Zenginleştirme
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              Dökümandan çıkarılan görselleri düzenleyin ve chunk'larla ilişkilendirin.
            </p>
          </div>
          {selectedAsset && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isLoading}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isLoading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-800/60 rounded-xl  border border-white/[0.06] p-4 mb-4">
        <div className="flex items-center gap-4">
          {/* Page Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filterPage ?? ''}
              onChange={(e) => setFilterPage(e.target.value ? parseInt(e.target.value) : null)}
              className="input py-1.5 text-sm min-w-[140px]"
            >
              <option value="">Tüm Sayfalar</option>
              {pageNumbers.map(p => (
                <option key={p} value={p}>Sayfa {p}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="OCR metinde ara..."
              className="input pl-9 py-1.5 text-sm w-full"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Count */}
          <div className="text-sm text-gray-500">
            {assets?.length || 0} görsel
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Left Panel - Image List */}
        <div className="lg:col-span-1 bg-dark-800/60 rounded-xl  border border-white/[0.06] overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-dark-700/50 font-medium text-sm text-gray-300 flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            Görsel Listesi
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {assetsLoading ? (
              <div className="py-12 text-center text-gray-400">
                <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Yükleniyor...
              </div>
            ) : assets && assets.length > 0 ? (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedAssetId === asset.id
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-white/[0.06] bg-dark-800/60 hover:bg-dark-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-primary-600">
                      📄 Sayfa {asset.page || '?'}, #{asset.index || '?'}
                    </span>
                    {asset.linked_chunks && asset.linked_chunks.length > 0 && (
                      <span className="text-xs text-green-600 flex items-center">
                        <Link2 className="h-3 w-3 mr-1" />
                        {asset.linked_chunks.length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 italic">
                    {asset.ocr_text ? (
                      <>"{highlightText(asset.ocr_text.substring(0, 80), debouncedSearch)}..."</>
                    ) : (
                      <span className="text-gray-400">OCR metni yok</span>
                    )}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-gray-400">
                <Image className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>{debouncedSearch ? 'Aramayla eşleşen görsel bulunamadı' : 'Bu dökümanda görsel yok'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Image Detail */}
        <div className="lg:col-span-2 bg-dark-800/60 rounded-xl  border border-white/[0.06] overflow-hidden flex flex-col">
          {selectedAsset ? (
            <>
              {/* Image Preview */}
              <div className="p-4 border-b bg-dark-700/50">
                <div className="flex items-center justify-center bg-dark-800/60 rounded-lg border border-white/[0.06] p-4 max-h-[300px] overflow-hidden">
                  <img
                    src={`${getApiBaseUrl()}/admin/documents/asset/file?path=${encodeURIComponent(selectedAsset.file_path)}&token=${token}`}
                    alt={selectedAsset.caption || 'Asset'}
                    className="max-w-full max-h-[280px] object-contain"
                  />
                </div>
                <div className="mt-2 text-center text-xs text-gray-500">
                  Sayfa {selectedAsset.page} | #{selectedAsset.index} | {selectedAsset.width}x{selectedAsset.height}px
                </div>
              </div>

              {/* Edit Form */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Başlık (Caption)
                  </label>
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Görsel için açıklayıcı başlık..."
                    className="input w-full"
                  />
                </div>

                {/* OCR Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                    OCR Metni
                    {ocrChanged && (
                      <span className="ml-2 text-xs text-amber-600 flex items-center">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Değiştirildi
                      </span>
                    )}
                  </label>
                  <textarea
                    value={editOcrText}
                    onChange={(e) => setEditOcrText(e.target.value)}
                    placeholder="Görselden çıkarılan metin..."
                    className="input w-full min-h-[120px] font-mono text-sm"
                    rows={5}
                  />
                  {ocrChanged && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ OCR metni değiştirildi. Bu değişiklik arama sonuçlarını etkileyebilir.
                    </p>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    <Tag className="h-4 w-4 inline mr-1" />
                    Etiketler
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Etiket ekle..."
                      className="input flex-1 text-sm"
                    />
                    <button onClick={handleAddTag} className="btn btn-sm btn-primary">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {editTags.map((tag, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-primary-100 text-primary-800 text-xs">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-primary-900">×</button>
                      </span>
                    ))}
                    {editTags.length === 0 && (
                      <span className="text-xs text-gray-400">Henüz etiket eklenmemiş</span>
                    )}
                  </div>
                </div>

                {/* Linked Chunks */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    <Link2 className="h-4 w-4 inline mr-1" />
                    İlişkili Chunk'lar
                  </label>
                  <div className="border border-white/[0.06] rounded-lg max-h-[200px] overflow-y-auto">
                    {chunks.length > 0 ? (
                      chunks.map((chunk) => (
                        <label
                          key={chunk.id}
                          className={`flex items-start gap-2 p-2 border-b last:border-b-0 cursor-pointer hover:bg-dark-700/50 ${
                            selectedChunks.includes(chunk.id) ? 'bg-primary-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedChunks.includes(chunk.id)}
                            onChange={() => toggleChunk(chunk.id)}
                            className="mt-1 h-4 w-4 text-primary-600 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-primary-600">Chunk #{chunk.chunk_index + 1}</span>
                            <p className="text-xs text-gray-600 line-clamp-2">{chunk.content.substring(0, 100)}...</p>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-400 text-sm">
                        Bu dökümanda chunk bulunamadı
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedChunks.length} chunk seçili
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <Eye className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg">Düzenlemek için bir görsel seçin</p>
              <p className="text-sm mt-1">Sol panelden bir görsel seçerek detaylarını görüntüleyin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

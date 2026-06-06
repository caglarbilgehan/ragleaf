import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Globe, Save, RefreshCw, AlertTriangle, Info, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, getApiBaseUrl } from '@/services/api';

const AVAILABLE_LANGUAGES = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
];

interface ActiveModelInfo {
    model_id: string;
    display_name: string;
    dimension: number;
    multilingual: boolean;
    deployment_type: string;
}

export default function MultilingualSettingsPage() {
    const [activeLanguages, setActiveLanguages] = useState<string[]>(['tr']);
    const [autoTranslate, setAutoTranslate] = useState(true); // Default ON for non-multilingual
    const queryClient = useQueryClient();

    // Fetch active embedding model info
    const { data: activeModel, isLoading: modelLoading } = useQuery<ActiveModelInfo>(
        'active-embedding-model',
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/api/admin/embedding-models/active/info`);
            if (!response.ok) throw new Error('Failed to fetch model info');
            return response.json();
        }
    );

    const isMultilingual = activeModel?.multilingual ?? false;

    // Fetch current settings
    const { data: settings, isLoading } = useQuery(
        'multilingual-settings',
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/api/admin/settings/multilingual_settings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error('Failed to fetch settings');
            return response.json();
        },
        {
            onSuccess: (data) => {
                setActiveLanguages(data.active_languages || ['tr']);
                // If multilingual model, auto_translate should be false
                // If non-multilingual, default to true
                setAutoTranslate(isMultilingual ? false : (data.auto_translate ?? true));
            }
        }
    );

    // Update autoTranslate when model info loads
    useEffect(() => {
        if (activeModel) {
            if (activeModel.multilingual) {
                setAutoTranslate(false);
            }
        }
    }, [activeModel]);

    // Save settings mutation
    const saveMutation = useMutation(
        async () => {
            const response = await fetch(`${getApiBaseUrl()}/api/admin/settings/multilingual_settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    active_languages: activeLanguages,
                    default_source_language: 'tr',
                    auto_translate: isMultilingual ? false : autoTranslate,
                    translation_provider: 'openai'
                })
            });
            if (!response.ok) throw new Error('Failed to save settings');
            return response.json();
        },
        {
            onSuccess: () => {
                toast.success('Ayarlar kaydedildi!');
                queryClient.invalidateQueries('multilingual-settings');
            },
            onError: () => {
                toast.error('Kaydetme başarısız');
            }
        }
    );

    const toggleLanguage = (code: string) => {
        if (code === 'tr') return; // TR always active

        if (activeLanguages.includes(code)) {
            setActiveLanguages(prev => prev.filter(l => l !== code));
        } else {
            setActiveLanguages(prev => [...prev, code]);
        }
    };

    if (isLoading || modelLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center">
                        <Globe className="h-7 w-7 mr-2 text-primary-600" />
                        Çoklu Dil Ayarları
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Embedding için aktif dilleri yönetin ve otomatik çeviri ayarlarını yapılandırın.
                    </p>
                </div>
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isLoading}
                    className="btn btn-primary flex items-center gap-2"
                >
                    {saveMutation.isLoading ? (
                        <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Kaydediliyor...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Kaydet
                        </>
                    )}
                </button>
            </div>

            {/* Current Model Info */}
            {activeModel && (
                <div className={`rounded-lg border p-4 ${isMultilingual ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${isMultilingual ? 'bg-green-100' : 'bg-amber-100'}`}>
                            <Zap className={`h-5 w-5 ${isMultilingual ? 'text-green-600' : 'text-amber-600'}`} />
                        </div>
                        <div className="flex-1">
                            <h4 className={`font-semibold ${isMultilingual ? 'text-green-900' : 'text-amber-900'}`}>
                                Aktif Embedding Modeli: {activeModel.display_name}
                            </h4>
                            <p className={`text-sm mt-1 ${isMultilingual ? 'text-green-700' : 'text-amber-700'}`}>
                                {isMultilingual ? (
                                    <>
                                        ✅ <strong>Multilingual model</strong> kullanıyorsunuz. Tüm dillerdeki dökümanlar doğrudan desteklenir, otomatik çeviriye gerek yoktur.
                                    </>
                                ) : (
                                    <>
                                        ⚠️ Bu model <strong>yalnızca tek dil</strong> için optimize edilmiştir. Farklı dillerdeki dökümanlar için <strong>Otomatik Çeviri</strong> önerilir.
                                    </>
                                )}
                            </p>
                            <p className="text-xs mt-2 text-gray-600">
                                Model: <code className="bg-dark-600 px-1 py-0.5 rounded">{activeModel.model_id}</code> | Boyut: {activeModel.dimension}D
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto-Translate Toggle - Only show for non-multilingual models */}
            <div className={`bg-dark-800/60 rounded-lg  border border-white/[0.06] p-6 ${isMultilingual ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-100">Otomatik Çeviri</h3>
                            {isMultilingual && (
                                <span className="text-xs font-medium text-gray-500 bg-dark-600 px-2 py-1 rounded">
                                    Gerekli Değil
                                </span>
                            )}
                        </div>

                        {isMultilingual ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800 flex items-start gap-2">
                                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        <strong>Multilingual embedding modeli</strong> kullandığınız için otomatik çeviri özelliğine ihtiyaç yoktur.
                                        Model, farklı dillerdeki metinleri aynı vektör uzayına yerleştirir ve cross-lingual arama yapabilir.
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600">
                                    Etkinleştirilirse, Türkçe dışındaki dillerdeki dökümanlar işlenirken LLM tarafından otomatik olarak Türkçe'ye çevrilir.
                                </p>

                                {/* Cost Warning */}
                                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-sm text-amber-800 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>
                                            <strong>Maliyet Uyarısı:</strong> Otomatik çeviri, LLM API kullanımı gerektirir.
                                            Bu işlem token tüketir ve ek maliyete neden olabilir.
                                        </span>
                                    </p>
                                </div>

                                {/* Warning when disabled */}
                                {!autoTranslate && (
                                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-sm text-red-800 flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                                <strong>Dikkat:</strong> Otomatik çeviri kapalı olduğunda, Türkçe olmayan dökümanlar
                                                RAG sorgularında düzgün çalışmayacaktır. Model yalnızca Türkçe metinler için optimize edilmiştir.
                                            </span>
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <label className={`relative inline-flex items-center ml-4 ${isMultilingual ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                            type="checkbox"
                            checked={isMultilingual ? false : autoTranslate}
                            onChange={(e) => !isMultilingual && setAutoTranslate(e.target.checked)}
                            disabled={isMultilingual}
                            className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-dark-500 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-800/60 after:border-white/[0.1] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${isMultilingual ? 'opacity-50' : ''}`}></div>
                    </label>
                </div>
            </div>

            {/* Languages Grid */}
            <div className="bg-dark-800/60 rounded-lg  border border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Aktif Embedding Dilleri</h3>
                <p className="text-sm text-gray-600 mb-6">
                    Seçilen diller ChatUI'de kullanıcılara sunulacaktır.
                    <strong className="text-primary-700"> Türkçe daima aktiftir.</strong>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {AVAILABLE_LANGUAGES.map((lang) => {
                        const isActive = activeLanguages.includes(lang.code);
                        const isDefault = lang.code === 'tr';

                        return (
                            <div
                                key={lang.code}
                                onClick={() => !isDefault && toggleLanguage(lang.code)}
                                className={`
                                    relative p-4 rounded-lg border-2 transition-all cursor-pointer
                                    ${isActive
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-white/[0.06] bg-dark-800/60 hover:border-white/[0.1]'
                                    }
                                    ${isDefault ? 'opacity-100 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{lang.flag}</span>
                                        <div>
                                            <h4 className="font-semibold text-gray-100">{lang.name}</h4>
                                            <p className="text-xs text-gray-500 uppercase">{lang.code}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        {isDefault && (
                                            <span className="text-xs font-medium text-primary-700 bg-primary-100 px-2 py-1 rounded">
                                                Varsayılan
                                            </span>
                                        )}
                                        {!isDefault && (
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                onChange={() => { }}
                                                className="h-5 w-5 text-primary-600 focus:ring-primary-500 rounded pointer-events-none"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Nasıl Çalışır?</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Bir döküman yüklendiğinde, seçtiğiniz <strong>Kaynak Dil</strong> belirtilir.</li>
                    {isMultilingual ? (
                        <li><strong>Multilingual model</strong> sayesinde tüm dillerdeki dökümanlar doğrudan indexlenir ve aranabilir.</li>
                    ) : (
                        <li>Eğer <strong>Otomatik Çeviri</strong> açıksa, döküman LLM tarafından Türkçe'ye çevrilir ve öyle indexlenir.</li>
                    )}
                    <li>Chat UI'de kullanıcı dil seçtiğinde, ilgili dildeki içerikler aranır.</li>
                </ul>
            </div>
        </div>
    );
}

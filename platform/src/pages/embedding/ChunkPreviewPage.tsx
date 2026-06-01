import React, { useState } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface ChunkInfo {
  text: string;
  start_idx: number;
  end_idx: number;
  length: number;
  overlap_start: number | null;
  overlap_end: number | null;
}

interface ChunkPreviewResponse {
  chunks: ChunkInfo[];
  statistics: {
    total_chunks: number;
    avg_length: number;
    max_length: number;
    min_length: number;
    total_characters: number;
    overlap_percentage: number;
  };
}

const ChunkPreviewPage: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [chunkSize, setChunkSize] = useState<number>(750);
  const [chunkOverlap, setChunkOverlap] = useState<number>(100);
  const [preview, setPreview] = useState<ChunkPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    if (!text.trim()) {
      toast.error('Lütfen analiz edilecek metin girin');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<ChunkPreviewResponse>(
        '/api/admin/embedding/chunks/preview',
        {
          text,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
        }
      );

      setPreview(response.data);
      toast.success('Chunk önizlemesi oluşturuldu!');
    } catch (error: any) {
      console.error('Chunk preview error:', error);
      toast.error(error.response?.data?.detail || 'Chunk önizlemesi oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setText(event.target?.result as string);
        toast.success(`${file.name} yüklendi`);
      };
      reader.readAsText(file);
    }
  };

  const loadSampleText = () => {
    const sampleText = `Zayıf akım sistemleri, modern binaların güvenlik, konfor ve enerji verimliliğini sağlayan görünmez altyapıyı oluşturur. Yüksek akım tesisatından farklı olarak, bu sistemlerde taşınan enerji değil bilgi ve kontrol sinyalleridir. Yangın algılama, acil anons, kartlı geçiş, kapalı devre kamera sistemleri (CCTV), aydınlatma ve HVAC otomasyonu, yapısal kablolama ve IP tabanlı iletişim altyapısı, zayıf akım şemsiyesi altında değerlendirilen başlıca alt sistemlerdir. Doğru tasarlanmamış veya entegre edilmemiş bir zayıf akım altyapısı, en modern binayı bile işletme açısından sorunlu ve güvensiz hâle getirebilir.

Yangın algılama sistemi, zayıf akım dünyasının en kritik bileşenlerinden biridir. Temel bileşenler; yangın santrali, adreslenebilir veya konvansiyonel algılama dedektörleri, butonlar, siren ve flaşörler, giriş–çıkış modülleri ve tekrarlama panelleridir. Adreslenebilir sistemlerde her dedektör veya saha elemanı, kendi başına bir adresle tanımlanır; böylece alarm durumunda hangi odada veya hangi hacimde sorun olduğu noktasal olarak izlenebilir. Santral ile sahadaki elemanlar arasındaki haberleşme çoğunlukla halka (loop) topolojisiyle kurulur; bu yapı hem kablo tasarrufu sağlar hem de tek noktadaki bir arızanın tüm sistemi devre dışı bırakmasını engeller. Yangın senaryoları hazırlanırken duman dedektörlerinin yerleşimi, tavan yüksekliği, hava akımları ve mahallin kullanım amacı dikkate alınır; otopark, mutfak, elektrik odası gibi farklı risk sınıfları için farklı algılama teknolojileri tercih edilir.

Dedektör tipleri, algılama prensibine göre duman, ısı, alev ve kombine dedektörler olarak sınıflandırılır. Optik duman dedektörleri, duman partiküllerinin ışığı dağıtma veya soğurma prensibine göre çalışır ve ofis, koridor gibi temiz hacimlerde yaygın olarak kullanılır. Isı dedektörleri, ani sıcaklık artışı veya belirli bir eşiğin aşılması durumunda alarm verir; tozlu veya buharlı ortamlarda yanlış alarm riskini azaltmak için tercih edilir. Alev dedektörleri ise özellikle endüstriyel tesislerde, yakıt depolarında ve yüksek tavanlı hacimlerde kullanılır. Tüm bu algılama elemanları, uygun kapasitede ve doğru zonlama ile seçilmiş yangın panellerine bağlanır; paneller, diğer sistemlere kuru kontak, röle, Modbus veya benzeri arayüzlerle senaryo komutları gönderir.

Kartlı geçiş sistemi, bina güvenliğinin ve kullanıcı yönetiminin en önemli araçlarından biridir. Tipik bir erişim kontrol yapısında; kart okuyucu, kapı kontrol paneli, elektromanyetik kilit veya manyetik kilit karşılığı, kapı kontağı ve çıkış butonu gibi elemanlar bulunur. Kullanıcılar, MIFARE veya benzeri RFID kartlar, anahtarlıklar ya da mobil kimlikler ile kapılardan geçiş yaparlar. Merkezi yazılım üzerinde personel, ziyaretçi ve taşeron grupları tanımlanarak; kimin hangi kapıdan, hangi saat aralıklarında geçebileceği detaylı şekilde kurgulanır. Turnikeler, otopark bariyerleri, asansör kabinleri ve kritik mekanik odalar da kartlı geçiş sistemine entegre edilerek güvenlik seviyesi artırılır. Log kayıtları sayesinde, bir olayın ardından hangi kullanıcının hangi kapıdan ne zaman geçtiği geriye dönük olarak incelenebilir.

CCTV sistemleri, hem caydırıcılık sağlar hem de olay sonrası tespit ve delil üretimi için vazgeçilmezdir. Güncel projelerde çoğunlukla IP tabanlı kameralar, PoE switch'ler, video kayıt sunucuları (NVR/VMS) ve izleme operatör istasyonları kullanılır. Kamera seçimi yapılırken çözünürlük, mercek yapısı, gece görüş (IR), WDR performansı, IP koruma sınıfı ve çalışma sıcaklığı gibi teknik kriterler dikkate alınır. Otoparklarda plaka tanıma, giriş–çıkışlarda yüz tanıma, üretim sahalarında yapay zekâ destekli hatalı ürün tespiti gibi senaryolar, video analiz teknolojileriyle gerçek zamanlı olarak çalıştırılabilir. Kayıt süreleri, ilgili ülke mevzuatı, işletmecinin beklentisi ve disk kapasitesi hesapları üzerinden belirlenir; kritik kameralarda RAID yapıları ve yedekli kayıt sunucuları tercih edilir.

HVAC otomasyonu, konfor ve enerji verimliliğinin kesiştiği noktadır. Merkezi otomasyon panelleri üzerinden kazan dairesi, chiller grupları, fan-coil üniteleri, taze hava santralleri ve ısı geri kazanım cihazları izlenip kontrol edilir. Sıcaklık, nem, CO ve CO₂ sensörlerinden alınan veriler, otomasyon yazılımında trend grafikler olarak saklanır; böylece enerji tüketimi ve sistem performansı periyodik olarak analiz edilebilir. Modbus, BACnet, KNX, LON gibi farklı haberleşme protokolleri üzerinden, mekanik cihazlarla otomasyon sistemi arasında veri alışverişi sağlanır. Yangın senaryosu devreye girdiğinde, duman tahliye fanlarının açılması, pozitif basınçlandırma fanlarının devreye girmesi ve yangın damperlerinin konum değiştirmesi gibi kritik komutlar HVAC otomasyonu üzerinden yürütülür.

Aydınlatma otomasyonu, hem kullanıcı konforunu artırır hem de büyük yapılarda ciddi enerji tasarrufu sağlar. Koridor ve ortak alanlarda hareket ve günışığı sensörleri ile senaryolar oluşturulur; mahaller kullanılmadığında ışıklar otomatik olarak kısılır veya kapanır. KNX, DALI veya DMX gibi protokollerle çalışan akıllı modüller sayesinde, armatürler tek tek ya da grup hâlinde kontrol edilebilir. Ofis projelerinde, çalışma saatleri içinde sabah–öğle–akşam farklı aydınlatma seviyeleri atanarak kullanıcıların biyolojik ritmine uygun bir ışık ortamı oluşturulabilir. Otel odalarında ise oda kartının takılmasıyla birlikte aydınlatma, prizler, perde motorları ve iklimlendirme tek bir senaryo altında yönetilebilir.

Tüm bu alt sistemlerin birbirinden bağımsız çalışması, modern bir binada istenen bir durum değildir. En yüksek verim, entegrasyon sayesinde elde edilir. Bina Yönetim Sistemi (BMS) veya bina otomasyon yazılımı, yangın algılama, kartlı geçiş, CCTV, HVAC ve aydınlatma otomasyonu gibi sistemlerden bilgi alarak merkezi bir arayüzde toplar. Operatör, tek bir ekrandan alarm durumlarını görebilir, trend grafiklerini inceleyebilir ve raporlar oluşturabilir. Örneğin yangın alarmı geldiğinde; BMS, ilgili bölgedeki kartlı geçiş kapılarını otomatik olarak kilitsiz hâle getirir, asansörleri güvenli kata çeker ve CCTV sisteminde ilgili kameraları operatör ekranına getirir. Bu tür çapraz senaryolar, can güvenliği ve tahliye performansı açısından kritik öneme sahiptir.

Zayıf akım sistemlerinin tasarım, montaj ve devreye alma süreçleri kadar, işletme ve bakım süreçleri de önemlidir. Periyodik testler yapılmadığında, en iyi teknolojiye sahip sistemler bile gerçek bir acil durumda beklenen performansı gösteremeyebilir. Bu nedenle bakım planları, üretici tavsiyeleri ve ilgili standartlar doğrultusunda oluşturulmalı; dedektör temizliği, siren testleri, batarya kapasiteleri, kamera odak ayarları, kayıt süreleri ve yedekleme stratejileri düzenli olarak kontrol edilmelidir. Dijital bakım ve varlık yönetim yazılımları sayesinde, hangi cihazın ne zaman test edildiği ve bir sonraki kontrol tarihinin ne olduğu izlenebilir; sahadan gelen arıza bildirimleri kayıt altına alınarak kurumsal bir bilgi havuzu oluşturulabilir.

Sonuç olarak zayıf akım sistemleri, bir binanın görünmeyen sinir sistemi olarak düşünülebilir. Yangın algılama, kartlı geçiş, CCTV, HVAC ve aydınlatma otomasyonu gibi bileşenler ne kadar doğru tasarlanır, projelendirilir ve entegre edilirse; bina da o ölçüde güvenli, konforlu ve sürdürülebilir olur. Tasarımcılar, uygulayıcılar ve işletmeciler arasında kurulan sağlıklı iletişim, bu sistemlerin uzun yıllar boyunca sorunsuz ve verimli şekilde çalışmasının ana koşuludur.`;

    setText(sampleText);
    toast.success('Zayıf akım sistemleri örnek metni yüklendi');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Chunk Önizleme ve Test</h1>
          <p className="mt-2 text-gray-600">
            Chunk ayarlarınızı test edin ve metnin nasıl parçalanacağını gerçek zamanlı görün
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Settings */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4">Chunk Ayarları</h2>

              {/* Chunk Size */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chunk Boyutu: {chunkSize} karakter
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>100</span>
                  <span>2000</span>
                </div>
              </div>

              {/* Chunk Overlap */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overlap: {chunkOverlap} karakter
                </label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="10"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>500</span>
                </div>
              </div>

              {/* Statistics */}
              {preview && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">İstatistikler</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Chunk Sayısı:</span>
                      <span className="font-medium">{preview.statistics.total_chunks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ortalama Boyut:</span>
                      <span className="font-medium">{preview.statistics.avg_length.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Boyut:</span>
                      <span className="font-medium">{preview.statistics.max_length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min Boyut:</span>
                      <span className="font-medium">{preview.statistics.min_length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overlap %:</span>
                      <span className="font-medium">{preview.statistics.overlap_percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 space-y-2">
                <button
                  onClick={handlePreview}
                  disabled={loading || !text}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Oluşturuluyor...' : 'Önizleme Oluştur'}
                </button>

                <label className="block w-full text-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 cursor-pointer font-medium">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  TXT Dosyası Yükle
                </label>

                <button
                  onClick={loadSampleText}
                  className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Örnek Metin Yükle
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Text Input */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Metin Girişi</h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Analiz edilecek metni buraya girin veya dosya yükleyin..."
                className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Chunks Preview */}
            {preview && preview.chunks.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    Chunk Önizlemesi ({preview.chunks.length} adet)
                  </h2>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></span>
                      Normal
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-orange-200 border border-orange-400 rounded"></span>
                      ← Öncekinden
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-purple-200 border border-purple-400 rounded"></span>
                      Sonrakine →
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  {preview.chunks.map((chunk, index) => {
                    // Calculate overlap - beginning overlap (from previous chunk)
                    const hasBeginOverlap = chunk.overlap_start !== null && chunk.overlap_end !== null && index > 0;
                    const beginOverlapLength = hasBeginOverlap ? (chunk.overlap_end! - chunk.overlap_start!) : 0;
                    
                    // Calculate overlap - ending overlap (will be in next chunk)
                    const nextChunk = preview.chunks[index + 1];
                    const hasEndOverlap = nextChunk && nextChunk.overlap_start !== null && nextChunk.overlap_end !== null;
                    const endOverlapLength = hasEndOverlap ? (nextChunk.overlap_end! - nextChunk.overlap_start!) : 0;
                    
                    // Render text with both overlaps highlighted
                    const renderChunkText = () => {
                      const text = chunk.text;
                      const textLength = text.length;
                      
                      // Calculate positions
                      const beginEnd = beginOverlapLength;
                      const endStart = hasEndOverlap ? textLength - endOverlapLength : textLength;
                      
                      // Handle overlapping regions (when begin and end overlap intersect)
                      if (beginEnd >= endStart && hasBeginOverlap && hasEndOverlap) {
                        // Entire text is overlap
                        return (
                          <span className="bg-gradient-to-r from-orange-200 to-purple-200 text-gray-900 px-0.5 rounded">
                            {text}
                          </span>
                        );
                      }
                      
                      return (
                        <>
                          {/* Beginning overlap (orange) */}
                          {hasBeginOverlap && beginOverlapLength > 0 && (
                            <span className="bg-orange-200 text-orange-900 px-0.5 rounded" title="Önceki chunk ile örtüşen bölge">
                              {text.substring(0, beginEnd)}
                            </span>
                          )}
                          
                          {/* Middle part (normal) */}
                          <span>
                            {text.substring(hasBeginOverlap ? beginEnd : 0, hasEndOverlap ? endStart : textLength)}
                          </span>
                          
                          {/* Ending overlap (purple) */}
                          {hasEndOverlap && endOverlapLength > 0 && (
                            <span className="bg-purple-200 text-purple-900 px-0.5 rounded" title="Sonraki chunk ile örtüşecek bölge">
                              {text.substring(endStart)}
                            </span>
                          )}
                        </>
                      );
                    };
                    
                    return (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-700">
                              Chunk {index + 1}
                            </span>
                            <span className="text-xs text-gray-400">
                              [{chunk.start_idx} - {chunk.end_idx}]
                            </span>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">Boyut: {chunk.length}</span>
                            {hasBeginOverlap && (
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                                ← {beginOverlapLength} kar.
                              </span>
                            )}
                            {hasEndOverlap && (
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                                {endOverlapLength} kar. →
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                          {renderChunkText()}
                        </div>
                        {(hasBeginOverlap || hasEndOverlap) && (
                          <div className="mt-2 text-xs flex items-center gap-3">
                            {hasBeginOverlap && (
                              <span className="text-orange-600 flex items-center gap-1">
                                <span className="w-2 h-2 bg-orange-200 rounded"></span>
                                Önceki chunk'tan gelen
                              </span>
                            )}
                            {hasEndOverlap && (
                              <span className="text-purple-600 flex items-center gap-1">
                                <span className="w-2 h-2 bg-purple-200 rounded"></span>
                                Sonraki chunk'a geçecek
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!preview && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="mx-auto h-16 w-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Henüz önizleme oluşturulmadı
                </h3>
                <p className="text-gray-500">
                  Metin girin ve "Önizleme Oluştur" butonuna tıklayın
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChunkPreviewPage;

# 🛠️ Ragleaf Sistem Genel Özeti & Teknik Dökümantasyon

Bu belge Ragleaf platformunun güncel teknik mimarisini, servislerini ve veri akış şemalarını özetler.

## 1. Mimari Katmanlar

### A. Backend Servisleri (FastAPI)
- **Public Chat API**: `/chat/completions` ve `/conversations/{session_id}/history` endpoint'leri ile widget ve dış entegrasyon isteklerini karşılar.
- **Enhanced RAG Service**: Dokümanları pgvector entegrasyonu, sorgu genişletme (query expansion) ve cross-document paylaşımıyla analiz eder.
- **Failover LLM Router**: OpenAI, Gemini ve DeepSeek gibi LLM servisleri arasında otomatik hata kurtarma (failover) ve gecikme minimizasyonu sağlar.
- **Randevu Sorumlusu & Scheduler**: Region A (1 gün önce), Region B (1 saat önce) ve Region C (30 dk önce) kronolojik grupları ile randevu hatırlatıcılarını SMTP/SMS üzerinden iletir.
- **Contact API**: Landing page `/contact` formundan gelen talepleri Superadmin yetki korumalarıyla PostgreSQL'e yazar ve admin dashboard üzerinden yönetilmesini sağlar.

### B. Frontend (Vanilla JS & React)
- **Landing Page**: Glassmorphic premium tasarım, `components/` shared header/footer/lang-modal modülleri, Nginx Clean URL yönlendirmeleri (`/pricing`, `/developers`, `/nasil-calisir`, `/contact`).
- **Müşteri Paneli (React Dashboard)**: Marka ve asistan kurulumunu gerçekleştiren 2 adımlı Onboarding sihirbazı, organizasyon limitlerinin ve Ragleaf Yaprağı (Leaves) sadakat puanlarının takip edildiği arayüz.

## 2. Sohbet İçi Aksiyon Kartları & JSON Parser Akışı
1. Kullanıcı asistanla konuşur ("Yarın saat 14:00'e randevu istiyorum").
2. LLM RAG bilgileri ve sistem promptundaki talimatlara göre gerekli bilgileri (isim, tel, tarih) toplar.
3. Bilgiler tamamlandığında LLM yanıtın sonuna ```APPOINTMENT_JSON veya ```SPONSORSHIP_JSON bloğunu ekler.
4. Backend endpoint'i bu JSON bloğunu yakalar, regex ile parseler, veritabanına ilgili kaydı (`appointments` veya `sponsorship_deals`) ekler ve JSON bloğunu temizleyerek referans ID'si ile onay mesajını istemciye döner.
5. Landing page simülatöründe ise bu durum interaktif form, takvim veya kredi kartı ödeme kartı render ederek simüle edilir.

## 3. Ragleaf Leaves Sadakat Algoritması
Her başarılı sohbet sorgusu tamamlandığında ilgili organizasyonun `ragleaf_leaves` değeri veritabanında 1 artırılır. Bu değer:
- Organizasyonun sadık bir kullanıcı olduğunu gösterir.
- Gelecekteki fatura dönemlerinde indirim kuponuna dönüştürülebilir.
- Müşteri ve admin panellerinde badge/istatistik kartı olarak listelenir.
